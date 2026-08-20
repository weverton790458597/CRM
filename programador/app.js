// ============================================================================
// app.js — Programador de Vídeos (front-end)
// ============================================================================

// ---- Auto-fechamento do Pop-up OAuth / Tratamento de Retorno ----
if (window.opener && new URLSearchParams(window.location.search).has("auth")) {
  try {
    const params = new URLSearchParams(window.location.search);
    const authType = params.get("auth");
    
    // Se for o mapeamento do Instagram, passa os dados para a janela principal e fecha
    if (authType === "instagram_pending_map") {
      window.opener.postMessage({ type: "instagram_pending_map", search: window.location.search }, "*");
    } else if (typeof window.opener.testarConexaoSupabase === "function") {
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

function obterDataPadrao() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
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

  const dataPadrao = obterDataPadrao();
  const dataGlobalEl = document.getElementById("dataGlobal");
  if (dataGlobalEl && !dataGlobalEl.value) dataGlobalEl.value = dataPadrao;

  CANAIS.forEach((c) => {
    estadoCanais[c.id] = {
      arquivo: null,
      videoUrl: null,
      titulo: "",
      plataformas: { youtube: true, instagram: true, tiktok: true },
      agendamento: "",
    };

    const cardHTML = `<div class="card" id="card-${c.id}">
      <div>
        <div class="card-header"><span>${c.nome}</span></div>
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
        <div class="agendamento-select">
          <input type="date" class="input-data" id="data-${c.id}" value="${dataPadrao}" onchange="atualizarAgendamento('${c.id}')">
          <input type="time" class="input-hora" id="hora-${c.id}" value="${c.horario}" onchange="atualizarAgendamento('${c.id}')">
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
      <button class="btn-disparar-card" onclick="agendarCanalIndividual('${c.id}')">📅 Agendar Este Canal</button>
      <div class="card-status" id="card-status-${c.id}"></div>
    </div>`;

    if (c.faixa === "manha" && containerManha) containerManha.innerHTML += cardHTML;
    else if (containerNoite) containerNoite.innerHTML += cardHTML;
  });

  CANAIS.forEach((c) => atualizarAgendamento(c.id));
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

function atualizarAgendamento(canalId) {
  const dataEl = document.getElementById(`data-${canalId}`);
  const horaEl = document.getElementById(`hora-${canalId}`);
  if (!dataEl || !horaEl || !estadoCanais[canalId]) return;

  const data = dataEl.value;
  const hora = horaEl.value;
  estadoCanais[canalId].agendamento = data && hora ? `${data}T${hora}:00` : "";
}

function aplicarDataATodos() {
  const dataGlobalEl = document.getElementById("dataGlobal");
  if (!dataGlobalEl || !dataGlobalEl.value) {
    setMsg("Selecione uma data global antes de aplicar.", true);
    return;
  }

  CANAIS.forEach((c) => {
    const dataEl = document.getElementById(`data-${c.id}`);
    if (dataEl) {
      dataEl.value = dataGlobalEl.value;
      atualizarAgendamento(c.id);
    }
  });

  setMsg("Data aplicada a todos os canais!");
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
// Testar conexão Supabase
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
// TELA DE MAPEAMENTO VISUAL (DRAG AND DROP DO INSTAGRAM)
// ---------------------------------------------------------------------------
function criarModalMapeamento(batchId, contas) {
  // Remove modal existente se houver
  const antigo = document.getElementById("modal-mapeamento-ig");
  if (antigo) antigo.remove();

  const overlay = document.createElement("div");
  overlay.id = "modal-mapeamento-ig";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.85); z-index: 99999; display: flex;
    align-items: center; justify-content: center; font-family: inherit; color: #fff;
  `;

  let contasHtml = contas.map(acc => {
    const idVal = acc.igUserId || acc.ig_user_id || "";
    return `
      <div class="ig-account-chip" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', '${idVal}')" data-ig-id="${idVal}" style="
        background: #1e293b; border: 1px solid #38bdf8; padding: 10px; border-radius: 8px;
        margin-bottom: 8px; cursor: grab; display: flex; align-items: center; gap: 10px;
      ">
        <div style="font-weight: bold; font-size: 14px;">📷 @${acc.username || idVal}</div>
      </div>
    `;
  }).join("");

  let containersHtml = CANAIS.map(c => `
    <div class="drop-target-canal" ondragover="event.preventDefault()" ondrop="receberDropContaIG(event, '${c.id}')" style="
      background: #0f172a; border: 2px dashed #475569; padding: 12px; border-radius: 8px;
      text-align: center; min-height: 70px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    " id="target-ig-${c.id}">
      <span style="font-weight: bold; color: #38bdf8; font-size: 14px;">${c.nome}</span>
      <span style="font-size: 11px; color: #94a3b8;" class="slot-status">Arraste a conta do IG aqui</span>
    </div>
  `).join("");

  overlay.innerHTML = `
    <div style="background: #111827; border: 1px solid #374151; width: 900px; max-height: 90vh; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
      <div style="padding: 20px; border-bottom: 1px solid #374151; background: #1f2937;">
        <h2 style="margin: 0; font-size: 18px; color: #38bdf8;">Vincular Contas do Instagram aos Canais</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #9ca3af;">Arraste cada conta do Instagram da esquerda para o seu respectivo container de canal à direita.</p>
      </div>
      <div style="display: flex; flex: 1; overflow: hidden; padding: 20px; gap: 20px;">
        <div style="width: 350px; overflow-y: auto; background: #0b0f19; padding: 15px; border-radius: 8px; border: 1px solid #1f2937;">
          <h3 style="margin-top: 0; font-size: 14px; color: #cbd5e1; border-bottom: 1px solid #1f2937; padding-bottom: 8px;">Contas do Instagram (Meta)</h3>
          <div id="lista-chips-ig">${contasHtml}</div>
        </div>
        <div style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; align-content: start; padding-right: 5px;">
          ${containersHtml}
        </div>
      </div>
      <div style="padding: 15px 20px; border-top: 1px solid #374151; background: #1f2937; display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="concluirMapeamentoIG('${batchId}')" style="background: #22c55e; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; cursor: pointer;">Salvar Vínculos</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  window._mapeamentoTempContas = contas;
  window._mapeamentoVinculos = {}; // canalId -> ig_user_id
}

async function receberDropContaIG(event, canalId) {
  event.preventDefault();
  const igUserId = event.dataTransfer.getData("text/plain");
  if (!igUserId || igUserId === "undefined") return;

  window._mapeamentoVinculos[canalId] = igUserId;

  const targetEl = document.getElementById(`target-ig-${canalId}`);
  if (targetEl) {
    targetEl.style.borderColor = "#22c55e";
    targetEl.style.background = "#064e3b";
    targetEl.querySelector(".slot-status").textContent = `Conectado: ID ${igUserId}`;
  }
}

async function concluirMapeamentoIG(batchId) {
  const { url, key, admin } = getCreds();
  const vinculos = window._mapeamentoVinculos || {};

  if (Object.keys(vinculos).length === 0) {
    alert("Vincule pelo menos uma conta antes de salvar.");
    return;
  }

  setMsg("Salvando vínculos do Instagram...");

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/functions/v1/auth-instagram/save-mappings`, {
      method: "POST",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`,
        "x-admin-secret": admin,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ batch_id: batchId, mappings: vinculos })
    });

    if (!res.ok) throw new Error("Erro ao salvar vínculos no servidor.");

    document.getElementById("modal-mapeamento-ig")?.remove();
    setMsg("Contas do Instagram vinculadas com sucesso!");
    testarConexaoSupabase();
  } catch (e) {
    setMsg("Erro ao salvar mapeamento: " + e.message, true);
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
    const videoUrl = await uploadVideo(id, file);
    estadoCanais[id].videoUrl = videoUrl;
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

function atualizarVisualContainer(id) {
  const dz = document.getElementById(`dz-${id}`);
  const st = estadoCanais[id];

  if (dz) {
    if (st.arquivo) dz.classList.add("cheio");
    else dz.classList.remove("cheio");
  }

  let html = "";
  if (st.arquivo) html += `<span class="arquivo" style="display:block;font-size:12px;margin-bottom:2px;">🎬 ${st.arquivo}</span>`;
  if (st.videoUrl) html += `<span class="url-meta" style="display:block;font-size:10px;color:#38bdf8;">🔗 Enviado ao Storage</span>`;
  if (!html) html = `<span class="dz-text">Vídeo ou JSON</span>`;

  const meta = document.getElementById(`meta-${id}`);
  if (meta) meta.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Gravação do Agendamento na tabela do Supabase (REST API)
// ---------------------------------------------------------------------------
async function salvarAgendamentoNoBanco(canalId) {
  const { url, key } = getCreds();
  const st = estadoCanais[canalId];
  const plataformasAtivas = PLATAFORMAS.filter((p) => st.plataformas[p]);

  const payload = {
    canal_id: canalId,
    video_url: st.videoUrl || "",
    titulo: st.titulo || "",
    plataformas: plataformasAtivas,
    agendado_para: st.agendamento || "",
    status: "pendente"
  };

  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/posts_agendados`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return true;
}

async function agendarCanalIndividual(canalId) {
  const { url, key } = getCreds();
  if (!url || !key) {
    setMsg("Configure URL e Key do Supabase antes de agendar.", true);
    return;
  }

  const st = estadoCanais[canalId];
  if (!st) return;

  if (!st.videoUrl) {
    setCardStatus(canalId, "Envie um vídeo antes de agendar.", "erro");
    return;
  }
  if (!st.titulo) {
    setCardStatus(canalId, "Preencha o título antes de agendar.", "erro");
    return;
  }
  if (!st.agendamento) {
    setCardStatus(canalId, "Selecione data e hora.", "erro");
    return;
  }

  setCardStatus(canalId, "Agendando...", "info");
  try {
    await salvarAgendamentoNoBanco(canalId);
    setCardStatus(canalId, "📅 Agendado com sucesso!", "ok");
  } catch (e) {
    setCardStatus(canalId, `Erro: ${e.message}`, "erro");
  }
}

// Mensagem entre abas/janelas para pegar o batch de contas do Instagram
window.addEventListener("message", async (e) => {
  if (e.data && e.data.type === "instagram_pending_map") {
    const params = new URLSearchParams(e.data.search);
    const batchId = params.get("batch_id");
    if (batchId) {
      const { url, key } = getCreds();
      try {
        const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/contas_pendentes_meta?batch_id=eq.${batchId}&select=*`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        const dados = await res.json();
        if (dados && dados.length > 0) {
          criarModalMapeamento(batchId, dados[0].contas);
        }
      } catch (err) {
        setMsg("Erro ao carregar contas para mapeamento.", true);
      }
    }
  }
});

if (new URLSearchParams(location.search).get("auth") === "instagram_pending_map") {
  const batchId = new URLSearchParams(location.search).get("batch_id");
  if (batchId) {
    getCreds().url && fetch(`${getCreds().url.replace(/\/$/, "")}/rest/v1/contas_pendentes_meta?batch_id=eq.${batchId}&select=*`, {
      headers: { apikey: getCreds().key, Authorization: `Bearer ${getCreds().key}` }
    }).then(r => r.json()).then(dados => {
      if (dados && dados.length > 0) criarModalMapeamento(batchId, dados[0].contas);
    });
  }
} else if (new URLSearchParams(location.search).get("auth")) {
  setMsg("Conexão realizada! Atualizando status...");
  testarConexaoSupabase();
}

montarInterface();
