// compressor.js — compressão de vídeo no navegador (ffmpeg.wasm) para respeitar o
// limite de upload do Supabase (50 MB no plano gratuito).
//
// Port da lógica do compressor.py: calcula o bitrate-alvo a partir da duração,
// reduz a resolução quando necessário e refaz com alvo menor se ainda passar do limite.
//
// Como funciona: sobrescreve window.uploadVideo (mesma técnica do recalibrador.js).
// Vídeos <= limite passam direto; maiores são comprimidos e só então enviados.
// Todo o app.js (drop global, "Vídeos (Lote)", etc.) passa a usar isso sem alteração.
//
// Uso no index.html, DEPOIS do app.js:
//   <script src="compressor.js?v=1"></script>

(function () {
  "use strict";

  const LIMITE_UPLOAD_MB = 50;   // se o bucket tiver limite menor, ajuste aqui
  const MARGEM = 0.90;           // mira em 90% do limite
  const AUDIO_KBPS = 96;
  const MIN_VIDEO_KBPS = 150;    // abaixo disso o vídeo ficaria ilegível
  const MAX_TENTATIVAS = 3;

  const CDN_FFMPEG = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd";
  const CDN_CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";

  // ---------- carregamento sob demanda do ffmpeg.wasm ----------
  function carregarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Falha ao carregar " + src));
      document.head.appendChild(s);
    });
  }

  // Baixa o recurso e devolve uma blob: URL (evita bloqueio de Worker/WASM cross-origin).
  async function toBlobURL(url, mime) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ao baixar ${url}`);
    const buf = await resp.arrayBuffer();
    return URL.createObjectURL(new Blob([buf], { type: mime }));
  }

  let ffmpegPromise = null;
  let aoProgredir = null;

  function obterFFmpeg() {
    if (ffmpegPromise) return ffmpegPromise;
    ffmpegPromise = (async () => {
      if (!window.FFmpegWASM) await carregarScript(`${CDN_FFMPEG}/ffmpeg.js`);
      const ffmpeg = new window.FFmpegWASM.FFmpeg();
      ffmpeg.on("progress", ({ progress }) => {
        if (aoProgredir && isFinite(progress)) aoProgredir(Math.min(Math.max(progress, 0), 1));
      });
      await ffmpeg.load({
        classWorkerURL: await toBlobURL(`${CDN_FFMPEG}/814.ffmpeg.js`, "text/javascript"),
        coreURL: await toBlobURL(`${CDN_CORE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CDN_CORE}/ffmpeg-core.wasm`, "application/wasm")
      });
      return ffmpeg;
    })().catch((e) => {
      ffmpegPromise = null; // permite tentar de novo depois
      throw e;
    });
    return ffmpegPromise;
  }

  // ---------- utilidades ----------
  function sondar(file) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      const url = URL.createObjectURL(file);
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => {
        const r = { duracao: v.duration, w: v.videoWidth, h: v.videoHeight };
        URL.revokeObjectURL(url);
        if (!isFinite(r.duracao) || r.duracao <= 0) {
          reject(new Error("Não foi possível descobrir a duração do vídeo."));
        } else resolve(r);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler o vídeo."));
      };
      v.src = url;
    });
  }

  function ladoCurtoAlvo(videoKbps) {
    if (videoKbps >= 2500) return 1080;
    if (videoKbps >= 1200) return 720;
    if (videoKbps >= 600) return 540;
    return 432;
  }

  async function montarEntrada(ffmpeg, file) {
    // WORKERFS lê o arquivo direto do disco, sem copiar tudo para a memória.
    try {
      await ffmpeg.createDir("/in");
      await ffmpeg.mount("WORKERFS", { files: [file] }, "/in");
      return {
        caminho: `/in/${file.name}`,
        limpar: async () => {
          try { await ffmpeg.unmount("/in"); await ffmpeg.deleteDir("/in"); } catch (_) {}
        }
      };
    } catch (_) {
      const dados = new Uint8Array(await file.arrayBuffer());
      await ffmpeg.writeFile("entrada.bin", dados);
      return {
        caminho: "entrada.bin",
        limpar: async () => { try { await ffmpeg.deleteFile("entrada.bin"); } catch (_) {} }
      };
    }
  }

  // ---------- compressão ----------
  async function comprimir(file, canalId) {
    const limite = LIMITE_UPLOAD_MB * 1024 * 1024;
    const { duracao, w, h } = await sondar(file);
    const curto = Math.min(w, h) || 1080;
    let alvoBytes = limite * MARGEM;

    setCardStatus(canalId, "Carregando compressor...", "info");
    const ffmpeg = await obterFFmpeg();
    const entrada = await montarEntrada(ffmpeg, file);

    try {
      for (let t = 1; t <= MAX_TENTATIVAS; t++) {
        const totalKbps = (alvoBytes * 8) / duracao / 1000;
        const videoKbps = Math.floor(totalKbps - AUDIO_KBPS);
        if (videoKbps < MIN_VIDEO_KBPS) {
          throw new Error(
            `Vídeo longo demais (${Math.round(duracao)}s) para caber em ${LIMITE_UPLOAD_MB} MB com qualidade aceitável.`
          );
        }

        const lado = Math.min(ladoCurtoAlvo(videoKbps), curto);
        const vf = lado < curto ? ["-vf", w >= h ? `scale=-2:${lado}` : `scale=${lado}:-2`] : [];

        aoProgredir = (p) =>
          setCardStatus(
            canalId,
            `Comprimindo vídeo... ${Math.round(p * 100)}%` + (t > 1 ? ` (tentativa ${t}/${MAX_TENTATIVAS})` : ""),
            "info"
          );
        aoProgredir(0);

        const codigo = await ffmpeg.exec([
          "-i", entrada.caminho,
          "-map", "0:v:0",
          ...vf,
          "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
          "-b:v", `${videoKbps}k`, "-maxrate", `${Math.floor(videoKbps * 1.3)}k`,
          "-bufsize", `${videoKbps * 2}k`,
          "-map", "0:a:0?", "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-ac", "2",
          "-movflags", "+faststart",
          "-y", "saida.mp4"
        ]);
        if (codigo !== 0) throw new Error("ffmpeg falhou ao codificar o vídeo.");

        const dados = await ffmpeg.readFile("saida.mp4");
        await ffmpeg.deleteFile("saida.mp4");

        if (dados.length <= limite) {
          const nome = file.name.replace(/\.[^.]+$/, "") + ".mp4";
          return new File([dados], nome, { type: "video/mp4" });
        }
        alvoBytes *= 0.88; // ainda passou do limite: tenta com alvo menor
      }
      throw new Error(`Não consegui reduzir o vídeo para menos de ${LIMITE_UPLOAD_MB} MB.`);
    } finally {
      aoProgredir = null;
      await entrada.limpar();
    }
  }

  // Uma compressão por vez (uma única instância do ffmpeg.wasm).
  let fila = Promise.resolve();
  function enfileirar(fn) {
    const p = fila.then(fn);
    fila = p.catch(() => {});
    return p;
  }

  // ---------- monkey-patch do uploadVideo ----------
  const uploadOriginal = window.uploadVideo;
  if (typeof uploadOriginal !== "function") {
    console.error("[Compressor] uploadVideo não encontrado — carregue compressor.js depois do app.js.");
    return;
  }

  window.uploadVideo = async function (canalId, file) {
    const limite = LIMITE_UPLOAD_MB * 1024 * 1024;
    if (!file || file.size <= limite) return uploadOriginal(canalId, file);

    const mbOriginal = (file.size / 1048576).toFixed(1);
    setCardStatus(canalId, `Vídeo de ${mbOriginal} MB: aguardando compressão...`, "info");

    let comprimido;
    try {
      comprimido = await enfileirar(() => comprimir(file, canalId));
    } catch (e) {
      throw new Error("Compressão falhou: " + e.message);
    }

    setCardStatus(
      canalId,
      `Comprimido ${mbOriginal} → ${(comprimido.size / 1048576).toFixed(1)} MB. Enviando...`,
      "info"
    );
    return uploadOriginal(canalId, comprimido);
  };

  window.comprimirVideoNavegador = comprimir;
})();
