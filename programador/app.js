// ============================================================================
// app.js — Programador de Vídeos (front-end)
// Gerencia: credenciais Supabase (URL/anon/admin secret), cards de 11 canais,
// OAuth via popup, upload real de vídeo para o Storage, importação de JSON de
// títulos e disparo de publicação por plataforma conectada.
// ============================================================================

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

// Estado por canal: arquivo (File), titulo, videoUrl (URL pública do Storage)
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
    estadoCanais[c.id] = { arquivo: null, titulo: null, videoUrl: null };
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
      </div>
      <div class="dropzone" id="dz-${c.id}"
           ondragover="event.preventDefault(); this.classList.add('over')"
           ondragleave="this.classList.remove('over')"
           ondrop="tratarDropCard(event, '${c.id}')"
           onclick="document.getElementById('single-${c.id}').click()">
        <span class="dz-text" id="dz-text-${c.id}">Vídeo ou JSON</span>
        <div class="detalhes-meta" id="meta-${c.id}"></div>
        <input id="single-${c.id}" type="file" accept="video/*,.json" style="display:none" onchange="tratarSelecaoCard(this, '${c.id}')">
      </div>
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
// Testar conexão + pintar indicadores YT/IG/TK (formato longo)
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

    // Reseta indicadores
    CANAIS.forEach((c) => {
      const yt = document.getElementById(`st-yt-${c.id}`);
      const ig = document.getElementById(`st-ig-${c.id}`);
      const tk = document.getElementById(`st-tk-${c.id}`);
      if (yt) yt.className = "err";
      if (ig) ig.className = "err";
      if (tk) tk.className = "err";
    });

    // Agrupa por canal_id + provider
    dados.forEach((row) => {
      const cid = (row.canal_id || "").toLowerCase();
      const canal = CANAIS.find((c) => c.id === cid);
      if (!canal) return;
      const temToken = !!row.conectado;
      
      const yt = document.getElementById(`st-yt-${canal.id}`);
      const ig = document.getElementById(`st-ig-${canal.id}`);
      const tk = document.getElementById(`st-tk-${canal.id}`);

      if (row.provider === "youtube" && temToken && yt) yt.className = "ok";
      if (row.provider === "instagram" && temToken && ig) ig.className = "ok";
      if (row.provider === "tiktok" && temToken && tk) tk.className = "ok";
    });

    setMsg("Conectado e status atualizado!");
  } catch (e) {
    setMsg("Erro ao testar conexão: " + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Conexão OAuth via popup
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
      body: JSON.stringify({ channel_id: canalId })
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
        } catch (_) { /* cross-origin até voltar ao domínio local */ }
      }, 1500);
    } else {
      throw new Error("URL de autenticação não retornada pela API.");
    }
  } catch (e) {
    setMsg(`Erro ao conectar com ${plataforma}: ` + e.message, true);
  }
}

// ---------------------------------------------------------------------------
// Upload real de vídeo para o Storage (Edge Function upload-video)
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
  setMsg(`Enviando vídeo de ${id}...`);
  try {
    const url = await uploadVideo(id, file);
    estadoCanais[id].videoUrl = url;
    setMsg(`Vídeo de ${id} enviado com sucesso!`);
  } catch (e) {
    setMsg(`Erro ao enviar vídeo de ${id}: ${e.message}`, true);
    return;
  }
  atualizarVisualContainer(id);
}

// ---------------------------------------------------------------------------
// Lote de vídeos (input do toolbar)
// ---------------------------------------------------------------------------
async function processarArquivosVideo(files) {
  for (const f of Array.from(files)) {
    const cid = extrairCanalDoNome(f.name);
    if (cid) await processarArquivo(cid, f);
  }
}

function extrairCanalDoNome(nome) {
  const lower = nome.toLowerCase();
  return CANAIS.find((c) => lower.includes(c.id))?.id || null;
}

// ---------------------------------------------------------------------------
// Importação de JSON de títulos
// ---------------------------------------------------------------------------
function processarArquivoJson(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const lista = Array.isArray(data) ? data : [data];
      lista.forEach((item) => {
        const c = CANAIS.find((c) => c.id === item.canal || c.nome === item.canal);
        if (c) {
          estadoCanais[c.id].titulo = item.titulo || item.title || null;
          atualizarVisualContainer(c.id);
        }
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
  if (dz) dz.classList.add("cheio");
  const st = estadoCanais[id];
  let html = "";
  if (st.arquivo) html += `<span class="arquivo">🎬 ${st.arquivo}</span>`;
  if (st.videoUrl) html += `<span class="url-meta">🔗 ${st.videoUrl}</span>`;
  if (st.titulo) html += `<span class="titulo-meta">📝 ${st.titulo}</span>`;
  if (!html) html = `<span class="dz-text">Vídeo ou JSON</span>`;
  
  const meta = document.getElementById(`meta-${id}`);
  if (meta) meta.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Disparar programação — uma chamada publish-post por plataforma conectada
// ---------------------------------------------------------------------------
async function dispararProgramacao() {
  const { url, key, admin } = getCreds();
  if (!url || !key || !admin) {
    setMsg("Configure URL, Key e Admin Secret antes de disparar.", true);
    return;
  }

  let conexoes = [];
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/conexoes_canais_status?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    conexoes = await r.json();
  } catch (e) {
    setMsg("Erro ao ler conexões: " + e.message, true);
    return;
  }

  const porCanal = {};
  conexoes.forEach((row) => {
    const cid = (row.canal_id || "").toLowerCase();
    if (!porCanal[cid]) porCanal[cid] = new Set();
    if (row.conectado) porCanal[cid].add(row.provider);
  });

  const canaisParaDisparar = Object.keys(estadoCanais)
    .map((id) => ({ id, ...estadoCanais[id] }))
    .filter((c) => c.videoUrl || c.titulo);

  if (canaisParaDisparar.length === 0) {
    setMsg("Nenhum canal possui vídeo ou título preenchido para disparar.");
    return;
  }

  const edgeUrl = `${url.replace(/\/$/, "")}/functions/v1/publish-post`;
  let sucessos = 0;
  let erros = 0;
  let totalChamadas = 0;

  for (const item of canaisParaDisparar) {
    const providers = porCanal[item.id] || new Set();
    if (providers.size === 0) {
      setMsg(`Canal ${item.id} sem plataformas conectadas — ignorado.`, true);
      continue;
    }
    for (const platform of providers) {
      totalChamadas++;
      const payload = {
        video_url: item.videoUrl || "",
        title: item.titulo || "",
        caption: item.titulo || "",
        platform,
        channel_id: item.id,
        privacy_status: "private",
      };
      try {
        const res = await fetch(edgeUrl, {
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
        if (res.ok && out.ok) sucessos++;
        else {
          erros++;
          console.error(`Erro ${item.id}/${platform}:`, out.error);
        }
      } catch (err) {
        erros++;
        console.error(`Falha de conexão ${item.id}/${platform}:`, err);
      }
    }
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

// Atualiza indicadores caso o popup tenha voltado com ?auth=... na mesma aba
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
