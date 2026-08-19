// ============================================================================
// app.js — Programador de Vídeos (front-end)
// ============================================================================

// ---- Auto-fechamento do Pop-up OAuth ----
if (window.opener && new URLSearchParams(window.location.search).has("auth")) {
  try {
    if (typeof window.opener.testarConexaoSupabase === "function") {
      window.opener.testarConexaoSupabase();
    } else {
      window.opener.location.reload();
    }
  } catch (_) {}
  window.close();
}

// ---- Lista fixa de canais (6 manhã, 5 noite) ----
const CANAIS = [
  { id: "alvox", nome: "Alvox", faixa: "manha", horario: "11:00" },
  { id: "flux", nome: "Flux", faixa: "manha", horario: "11:20" },
  { id: "loopx", nome: "Loopx", faixa: "manha", horario: "11:40" },
  { id: "cris", nome: "Cris", faixa: "manha", horario: "12:00" },
  { id: "lunax", nome: "Lunax", faixa: "manha", horario: "12:20" },
  { id: "maxx", nome: "Maxx", faixa: "manha", horario: "12:40" },
  { id: "most", nome: "Most", faixa: "noite", horario: "18:00" },
  { id: "post", nome: "Post", faixa: "noite", horario: "18:20" },
  { id: "primordial", nome: "Primordial", faixa: "noite", horario: "18:40" },
  { id: "topx", nome: "Topx", faixa: "noite", horario: "19:00" },
  { id: "vibex", nome: "Vibex", faixa: "noite", horario: "19:20" },
];

const PLATAFORMAS = ["youtube", "instagram", "tiktok"];

const estadoCanais = {};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function setMsg(text, isError = false) {
  const el = document.getElementById("msg");
  if (el) {
    el.textContent = text;
    el.style.color = isError ? "#ef4444" : "#38bdf8";
  }
}

function setCardStatus(canalId, text, tipo = "info") {
  const el = document.getElementById(`card-status-${canalId}`);
  if (!el) return;
  el.textContent = text;
  const cores = { info: "#38bdf8", ok: "#22c55e", erro: "#ef4444", aviso: "#f59e0b" };
  el.style.color = cores[tipo] || cores.info;
}

function getCreds() {
  return {
    url: localStorage.getItem("supa_url") || "",
    key: localStorage.getItem("supa_key") || "",
    admin: localStorage.getItem("admin_secret") || "",
  };
}

// ---------------------------------------------------------------------------
// Montagem da interface
// ---------------------------------------------------------------------------
function montarInterface() {
  const containerManha = document.getElementById("grid-manha");
  const containerNoite = document.getElementById("grid-noite");
  const { url, key, admin } = getCreds();

  if (document.getElementById("supaUrl")) document.getElementById("supaUrl").value = url;
  if (document.getElementById("supaKey")) document.getElementById("supaKey").value = key;
  if (document.getElementById("adminSecret")) document.getElementById("adminSecret").value = admin;

  CANAIS.forEach((c) => {
    estadoCanais[c.id] = {
      arquivo: null,
      videoUrl: null,
      titulo: "",
      plataformas: { youtube: true, instagram: true, tiktok: true },
    };

    const cardHTML = `<div class="card" id="card-${c.id}">
      <div>
        <div class="card-header"><span>${c.nome}</span><span class="horario">${c.horario}</span></div>
        <div class="auth-buttons">
          <button class="btn-auth btn-yt" onclick="conectarPlataforma('${c.id}', 'youtube')">YT</button>
          <button class="btn-auth btn-ig" onclick="conectarPlataforma('${c.id}', 'instagram')">IG</button>
          <button class="btn-auth btn-tk" onclick="conectarPlataforma('${c.id}', 'tiktok')">TK</button>
        </div>
        <div class="status">
          <span id="st-yt-${c.id}" class="err">YT</span><span id="st-ig-${c.id}" class="err">IG</span><span id="st-tk-${c.id}" class="err">TK</span>
        </div>
        <div class="plataformas-select">
          <label class="chk-plataforma"><input type="checkbox" id="chk-youtube-${c.id}" disabled onchange="atualizarPlataforma('${c.id}','youtube',this.checked)"> YT</label>
          <label class="chk-plataforma"><input type="checkbox" id="chk-instagram-${c.id}" disabled onchange="atualizarPlataforma('${c.id}','instagram',this.checked)"> IG</label>
          <label class="chk-plataforma"><input type="checkbox" id="chk-tiktok-${c.id}" disabled onchange="atualizarPlataforma('${c.id}','tiktok',this.checked)"> TK</label>
        </div>
      </div>
      <div class="dropzone" id="dz-${c.id}"
           ondragover="event.preventDefault(); event.stopPropagation(); this.classList.add('over')"
           ondragleave="event.stopPropagation(); this.classList.remove('over')"
           ondrop="tratarDropCard(event, '${c.id}')"
           onclick="document.getElementById('single-${c.id}').click()">
        <span class="dz-text" id="dz-text-${c.id}">Vídeo ou JSON</span>
        <div class="detalhes-meta" id="meta-${c.id}"></div>
        <input id="single-${c.id}" type="file" accept="video/*,.json" style="display:none" onchange="tratarSelecaoCard(this, '${c.id}')">
      </div>
      <div class="campos-texto">
        <input type="text" class="input-titulo" id="titulo-${c.id}" placeholder="Título (usado em todas as plataformas)"
               oninput="atualizarTexto('${c.id}','titulo',this.value)">
      </div>
      <button class="btn-disparar-card" onclick="dispararCanalIndividual('${c.id}')">🚀 Disparar Este Canal</button>
      <div class="card-status" id="card-status-${c.id}"></div>
    </div>`;

    if (c.faixa === "manha" && containerManha) containerManha.innerHTML += cardHTML;
    else if (containerNoite) containerNoite.innerHTML += cardHTML;
  });
}

// ---------------------------------------------------------------------------
// Credenciais
// ---------------------------------------------------------------------------
function salvarSupa() {
  const url = document.getElementById("supaUrl").value.trim();
  const key = document.getElementById("supaKey").value.trim();
  const admin = document.getElementById("adminSecret").value.trim();
  localStorage.setItem("supa_url", url);
  localStorage.setItem("supa_key", key);
  localStorage.setItem("admin_secret", admin);
  setMsg("Credenciais salvas!");
}

// ---------------------------------------------------------------------------
// Plataformas / textos por card
// ---------------------------------------------------------------------------
function atualizarPlataforma(canalId, platform, checked) {
  if (!estadoCanais[canalId]) return;
  estadoCanais[canalId].plataformas[platform] = checked;
}

function atualizarTexto(canalId, campo, valor) {
  if (!estadoCanais[canalId]) return;
  estadoCanais[canalId][campo] = valor;
}

function aplicarStatusConexao(canalId, platform, conectado) {
  const cb = document.getElementById(`chk-${platform}-${canalId}`);
  if (!cb) return;

  const eraConectado = cb.dataset.conectado === "1";
  cb.disabled = !conectado;
  cb.dataset.conectado = conectado ? "1" : "0";

  if (conectado && !eraConectado) {
    cb.checked = true;
    estadoCanais[canalId].plataformas[platform] = true;
  } else if (!conectado) {
    cb.checked = false;
    estadoCanais[canalId].plataformas[platform] = false;
  }
}

function selecionarTudoGlobal() {
  let marcados = 0;
  CANAIS.forEach((c) => {
    PLATAFORMAS.forEach((p) => {
      const cb = document.getElementById(`chk-${p}-${c.id}`);
      if (cb && !cb.disabled) {
        cb.checked = true;
        estadoCanais[c.id].plataformas[p] = true;
        marcados++;
      }
    });
  });
  setMsg(marcados > 0 ? "Todas as plataformas conectadas foram selecionadas!" : "Nenhuma plataforma conectada para selecionar.");
}

// ---------------------------------------------------------------------------
// Testar conexão
// ---------------------------------------------------------------------------
async function testarConexaoSupabase() {
  const { url, key } = getCreds();
  if (!url || !key) {
    setMsg("Configure URL e Key do Supabase primeiro!", true);
    return;
  }
  try {
    const resposta = await fetch(`${url.replace(/\/$/, "")}/rest/v1/conexoes_canais_status?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    const dados = await resposta.json();

    const conectadoPorCanal = {};
    CANAIS.forEach((c) => {
      conectadoPorCanal[c.id] = { youtube: false, instagram: false, tiktok: false };
    });

    dados.forEach((row) => {
      const cid = (row.canal_id || "").toLowerCase();
      if (!conectadoPorCanal[cid]) return;
      if (row.provider in conectadoPorCanal[cid]) {
        conectadoPorCanal[cid][row.provider] = !!row.conectado;
      }
    });

    CANAIS.forEach((c) => {
      const conn = conectadoPorCanal[c.id];

      const yt = document.getElementById(`st-yt-${c.id}`);
      const ig = document.getElementById(`st-ig-${c.id}`);
      const tk = document.getElementById(`st-tk-${c.id}`);
      if (yt) yt.className = conn.youtube ? "ok" : "err";
      if (ig) ig.className = conn.instagram ? "ok" : "err";
      if (tk) tk.className = conn.tiktok ? "ok" : "err";

      aplicarStatusConexao(c.id, "youtube", conn.youtube);
      aplicarStatusConexao(c.id, "instagram", conn.instagram);
      aplicarStatusConexao(c.id, "tiktok", conn.tiktok);
    });

    setMsg("Conectado e status atualizado!");
  } catch (e) {
    setMsg("Erro ao testar conexão: " + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Conexão OAuth
// ---------------------------------------------------------------------------
async function conectarPlataforma(canalId, plataforma) {
  const { url, key, admin } = getCreds();
  if (!url || !key || !admin) {
    setMsg("Configure URL, Key e Admin Secret antes de conectar.", true);
    return;
  }

  setMsg(`Iniciando conexão com ${plataforma}...`);

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/auth-${plataforma}`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "x-admin-secret": admin,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        channel_id: canalId,
        redirect_to: window.location.href.split("?")[0]
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.url) {
      const popup = window.open(data.url, `auth_${plataforma}`, "width=600,height=700");

      const timer = setInterval(() => {
        try {
          if (!popup || popup.closed) {
            clearInterval(timer);
            testarConexaoSupabase();
          }
        } catch (_) {}
      }, 1500);
    } else {
      throw new Error("URL de autenticação não retornada pela API.");
    }
  } catch (e) {
    setMsg(`Erro ao conectar com ${plataforma}: ` + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Upload de vídeo
// ---------------------------------------------------------------------------
async function uploadVideo(canalId, file) {
  const { url, key, admin } = getCreds();
  if (!url || !key || !admin) throw new Error("Credenciais do Supabase ausentes");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("canal_id", canalId);

  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/upload-video`, {
    method: "POST",
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "x-admin-secret": admin
    },
    body: fd,
  });
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error || `Upload HTTP ${res.status}`);
  }
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "Falha no upload");
  return out.url;
}

// ---------------------------------------------------------------------------
// Drag / seleção de arquivos nos cards
// ---------------------------------------------------------------------------
async function tratarDropCard(e, id) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove("over");
  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;
  await processarArquivo(id, files[0]);
}

async function tratarSelecaoCard(input, id) {
  if (!input.files || input.files.length === 0) return;
  await processarArquivo(id, input.files[0]);
  input.value = "";
}

async function processarArquivo(id, file) {
  if (file.name.toLowerCase().endsWith(".json")) {
    processarArquivoJson(file);
    return;
  }

  estadoCanais[id].arquivo = file.name;
  estadoCanais[id].videoUrl = null;
  atualizarVisualContainer(id);

  setMsg(`Enviando vídeo para ${id}...`);
  setCardStatus(id, "Enviando vídeo...", "info");

  try {
    const url = await uploadVideo(id, file);
    estadoCanais[id].videoUrl = url;
    setMsg(`Vídeo de ${id} enviado com sucesso!`);
    setCardStatus(id, "Vídeo enviado com sucesso!", "ok");
  } catch (e) {
    setMsg(`Erro ao enviar vídeo de ${id}: ${e.message}`, true);
    setCardStatus(id, `Erro no upload: ${e.message}`, "erro");
  } finally {
    atualizarVisualContainer(id);
  }
}

// ---------------------------------------------------------------------------
// Lote de vídeos
// ---------------------------------------------------------------------------
async function processarArquivosVideo(files) {
  const listaArquivos = Array.from(files);
  for (let i = 0; i < listaArquivos.length; i++) {
    const f = listaArquivos[i];
    let cid = extrairCanalDoNome(f.name);

    if (!cid && CANAIS[i]) {
      cid = CANAIS[i].id;
    }

    if (cid) await processarArquivo(cid, f);
  }
}

function extrairCanalDoNome(nome) {
  const lower = nome.toLowerCase();
  return CANAIS.find((c) => lower.includes(c.id))?.id || null;
}

// ---------------------------------------------------------------------------
// Importação de JSON (títulos)
// ---------------------------------------------------------------------------
function processarArquivoJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const lista = Array.isArray(data) ? data : [data];
      lista.forEach((item) => {
        const c = CANAIS.find((c) => c.id === item.canal || c.nome === item.canal);
        if (!c) return;

        const titulo = item.titulo || item.title || item.legenda || item.caption || "";

        if (titulo) estadoCanais[c.id].titulo = titulo;

        const inputTitulo = document.getElementById(`titulo-${c.id}`);
        if (inputTitulo && titulo) inputTitulo.value = titulo;

        atualizarVisualContainer(c.id);
      });
      setMsg("JSON de títulos importado!");
    } catch (err) {
      setMsg("JSON inválido: " + err.message, true);
    }
  };
  reader.readAsText(file);
}

// ---------------------------------------------------------------------------
// Atualização visual do card
// ---------------------------------------------------------------------------
function atualizarVisualContainer(id) {
  const dz = document.getElementById(`dz-${id}`);
  const st = estadoCanais[id];

  if (dz) {
    if (st.arquivo) {
      dz.classList.add("cheio");
    } else {
      dz.classList.remove("cheio");
    }
  }

  let html = "";
  if (st.arquivo) html += `<span class="arquivo" style="display:block;font-size:12px;margin-bottom:2px;">🎬 ${st.arquivo}</span>`;
  if (st.videoUrl) html += `<span class="url-meta" style="display:block;font-size:10px;color:#38bdf8;">🔗 Enviado ao Storage</span>`;
  if (!html) html = `<span class="dz-text">Vídeo ou JSON</span>`;

  const meta = document.getElementById(`meta-${id}`);
  if (meta) meta.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Publicação
// ---------------------------------------------------------------------------
async function publicarPlataforma(canalId, platform) {
  const { url, key, admin } = getCreds();
  const st = estadoCanais[canalId];

  const payload = {
    video_url: st.videoUrl || "",
    title: st.titulo || "",
    caption: st.titulo || "",
    platform,
    channel_id: canalId,
    privacy_status: "private",
  };

  const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/publish-post`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      "x-admin-secret": admin,
    },
    body: JSON.stringify(payload),
  });

  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) {
    throw new Error(out.error || `HTTP ${res.status}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Disparo individual por card
// ---------------------------------------------------------------------------
async function dispararCanalIndividual(canalId) {
  const { url, key, admin } = getCreds();
  if (!url || !key || !admin) {
    setMsg("Configure URL, Key e Admin Secret antes de disparar.", true);
    return;
  }

  const st = estadoCanais[canalId];
  if (!st) return;

  if (!st.videoUrl) {
    setCardStatus(canalId, "Envie um vídeo (upload concluído) antes de disparar.", "erro");
    setMsg(`Canal ${canalId}: envie um vídeo antes de disparar.`, true);
    return;
  }

  if (!st.titulo) {
    setCardStatus(canalId, "Preencha o título antes de disparar.", "erro");
    setMsg(`Canal ${canalId}: preencha o título.`, true);
    return;
  }

  const plataformasAtivas = PLATAFORMAS.filter((p) => st.plataformas[p]);
  if (plataformasAtivas.length === 0) {
    setCardStatus(canalId, "Nenhuma plataforma selecionada.", "erro");
    setMsg(`Canal ${canalId}: nenhuma plataforma selecionada.`, true);
    return;
  }

  setCardStatus(canalId, "Disparando...", "info");
  setMsg(`Disparando canal ${canalId}...`);

  let sucessos = 0;
  let erros = 0;
  for (const platform of plataformasAtivas) {
    try {
      await publicarPlataforma(canalId, platform);
      sucessos++;
    } catch (e) {
      erros++;
      console.error(`Erro ${canalId}/${platform}:`, e.message);
    }
  }

  const resumo = `${sucessos} ok / ${erros} erro(s)`;
  setCardStatus(canalId, resumo, erros > 0 ? (sucessos > 0 ? "aviso" : "erro") : "ok");
  setMsg(`Canal ${canalId}: ${resumo}`, erros > 0 && sucessos === 0);
}

// ---------------------------------------------------------------------------
// Disparar programação (lote)
// ---------------------------------------------------------------------------
async function dispararProgramacao() {
  const { url, key, admin } = getCreds();
  if (!url || !key || !admin) {
    setMsg("Configure URL, Key e Admin Secret antes de disparar.", true);
    return;
  }

  const canaisParaDisparar = Object.keys(estadoCanais)
    .map((id) => ({ id, ...estadoCanais[id] }))
    .filter((c) => c.videoUrl && c.titulo);

  if (canaisParaDisparar.length === 0) {
    setMsg("Nenhum canal possui vídeo enviado e título preenchido para disparar.");
    return;
  }

  let sucessos = 0;
  let erros = 0;
  let totalChamadas = 0;

  for (const item of canaisParaDisparar) {
    const plataformasAtivas = PLATAFORMAS.filter((p) => item.plataformas[p]);

    if (plataformasAtivas.length === 0) {
      setCardStatus(item.id, "Nenhuma plataforma selecionada — ignorado.", "aviso");
      continue;
    }

    setCardStatus(item.id, "Disparando...", "info");

    let sucessosCanal = 0;
    let errosCanal = 0;

    for (const platform of plataformasAtivas) {
      totalChamadas++;
      try {
        await publicarPlataforma(item.id, platform);
        sucessos++;
        sucessosCanal++;
      } catch (err) {
        erros++;
        errosCanal++;
        console.error(`Falha de conexão ${item.id}/${platform}:`, err.message);
      }
    }

    const resumoCanal = `${sucessosCanal} ok / ${errosCanal} erro(s)`;
    setCardStatus(item.id, resumoCanal, errosCanal > 0 ? (sucessosCanal > 0 ? "aviso" : "erro") : "ok");
  }

  setMsg(`Disparo concluído! Chamadas: ${totalChamadas} | Sucessos: ${sucessos} | Erros: ${erros}`);
}

// ---------------------------------------------------------------------------
// Drag global
// ---------------------------------------------------------------------------
window.addEventListener("dragover", (e) => {
  e.preventDefault();
  const drop = document.getElementById("globalDrop");
  if (drop) drop.classList.add("active");
});
window.addEventListener("dragleave", (e) => {
  const drop = document.getElementById("globalDrop");
  if (e.relatedTarget === null && drop) drop.classList.remove("active");
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  const drop = document.getElementById("globalDrop");
  if (drop) drop.classList.remove("active");
  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;
  const first = files[0];
  if (first.name.toLowerCase().endsWith(".json")) {
    processarArquivoJson(first);
  } else {
    processarArquivosVideo(files);
  }
});

// Mensagem entre abas/janelas
window.addEventListener("message", (e) => {
  if (e.data && typeof e.data === "string" && e.data.startsWith("auth_")) {
    testarConexaoSupabase();
  }
});

if (new URLSearchParams(location.search).get("auth")) {
  setMsg("Conexão realizada! Atualizando status...");
  testarConexaoSupabase();
}

// ---------------------------------------------------------------------------
montarInterface();
