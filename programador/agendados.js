// agendados.js
// Módulo standalone com duas melhorias para o Evrix Social:
//   1) Painel "Posts Agendados": lista o que está pendente na tabela
//      posts_agendados e o que falhou (os publicados com sucesso são apagados
//      da tabela pelo próprio sistema, então não aparecem aqui).
//   2) Botão "Analytics": redireciona para a página de analytics (menu/).
//
// Só LÊ do Supabase (GET em posts_agendados). Não altera nem apaga nada.
// Carregar no index.html DEPOIS do app.js:
//   <script src="app.js?v=5"></script>
//   <script src="agendados.js?v=1"></script>

(function () {
  "use strict";

  // Endereço do painel de analytics (relativo à pasta atual da plataforma).
  const URL_ANALYTICS = "menu/";

  const STATUS_FALHA = /erro|falh|fail|error/i;
  const STATUS_CONCLUIDO = /publicad|enviad|sucesso|success|done|conclu/i;
  const ROTULO_REDE = { youtube: "YT", instagram: "IG", tiktok: "TK" };

  let cachePosts = [];
  let abaAtiva = "agendados";
  let filtroCanal = "";
  let carregando = false;

  // ------------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------------
  function esc(valor) {
    return String(valor == null ? "" : valor)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function classificar(post) {
    const s = String(post.status || "").toLowerCase();
    if (STATUS_FALHA.test(s)) return "falhou";
    if (STATUS_CONCLUIDO.test(s)) return "concluido";
    return "agendado";
  }

  function nomeDoCanal(canalId) {
    try {
      // eslint-disable-next-line no-undef
      const lista = typeof CANAIS_DINAMICOS !== "undefined" ? CANAIS_DINAMICOS : [];
      const c = lista.find((x) => x.id === canalId);
      if (c && c.nome) return c.nome;
    } catch (_) {}
    return canalId || "—";
  }

  function tituloDoPost(post) {
    let t = post.titulo;
    if (typeof t === "string") {
      try {
        const parsed = JSON.parse(t);
        if (parsed && typeof parsed === "object") t = parsed;
      } catch (_) {
        return t;
      }
    }
    if (t && typeof t === "object") {
      const achado = ["youtube", "instagram", "tiktok"]
        .map((p) => t[p])
        .find((v) => typeof v === "string" && v.trim() !== "");
      return achado || "";
    }
    return t || "";
  }

  function textoDoErro(post) {
    const bruto =
      post.erro ||
      post.error ||
      post.mensagem_erro ||
      post.erro_msg ||
      post.error_message ||
      post.motivo_erro ||
      post.detalhes_erro ||
      post.log ||
      "";
    if (!bruto) return "";
    if (typeof bruto === "object") {
      try {
        return JSON.stringify(bruto);
      } catch (_) {
        return String(bruto);
      }
    }
    return String(bruto);
  }

  function formatarDataHora(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { dia: "Sem data", hora: "--:--", chaveDia: "sem-data", data: null };
    return {
      dia: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" }),
      hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      chaveDia: d.toISOString().slice(0, 10) + "-" + d.getDate(),
      data: d
    };
  }

  // ------------------------------------------------------------------
  // Dados
  // ------------------------------------------------------------------
  async function buscarPosts() {
    const { url, key } = window.getCreds();
    if (!url || !key) throw new Error("Preencha e salve as credenciais do Supabase primeiro.");
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/posts_agendados?select=*&order=agendado_para.asc&limit=1000`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const dados = await res.json();
    return Array.isArray(dados) ? dados : [];
  }

  async function carregar() {
    if (carregando) return;
    carregando = true;
    const corpo = document.getElementById("ag-corpo");
    if (corpo) corpo.innerHTML = `<div class="ag-vazio">Carregando posts...</div>`;
    try {
      cachePosts = await buscarPosts();
      renderizar();
    } catch (e) {
      if (corpo) corpo.innerHTML = `<div class="ag-vazio ag-vazio-erro">Erro ao carregar: ${esc(e.message)}</div>`;
    } finally {
      carregando = false;
    }
  }

  // ------------------------------------------------------------------
  // Renderização
  // ------------------------------------------------------------------
  function renderizar() {
    const corpo = document.getElementById("ag-corpo");
    if (!corpo) return;

    const doFiltro = cachePosts.filter((p) => !filtroCanal || p.canal_id === filtroCanal);
    const agendados = doFiltro.filter((p) => classificar(p) === "agendado");
    const falharam = doFiltro.filter((p) => classificar(p) === "falhou");

    const cAg = document.getElementById("ag-count-agendados");
    const cFa = document.getElementById("ag-count-falharam");
    if (cAg) cAg.textContent = agendados.length;
    if (cFa) cFa.textContent = falharam.length;

    document.querySelectorAll(".ag-tab").forEach((b) => {
      b.classList.toggle("ativa", b.dataset.aba === abaAtiva);
    });

    const lista = abaAtiva === "falharam" ? falharam : agendados;
    if (!lista.length) {
      corpo.innerHTML = `<div class="ag-vazio">${
        abaAtiva === "falharam" ? "Nenhum post com falha. Tudo certo por aqui." : "Nenhum post agendado no momento."
      }</div>`;
      return;
    }

    const agora = Date.now();
    let diaAtual = "";
    let html = `<table class="ag-tabela"><thead><tr>
      <th>Hora</th><th>Canal</th><th>Redes</th><th>Título</th><th>${abaAtiva === "falharam" ? "Erro" : "Situação"}</th>
    </tr></thead><tbody>`;

    lista.forEach((p) => {
      const dt = formatarDataHora(p.agendado_para);
      if (dt.chaveDia !== diaAtual) {
        diaAtual = dt.chaveDia;
        html += `<tr class="ag-dia"><td colspan="5">${esc(dt.dia)}</td></tr>`;
      }

      const redes = (Array.isArray(p.plataformas) ? p.plataformas : [])
        .map((r) => `<span class="ag-rede ag-rede-${esc(r)}">${esc(ROTULO_REDE[r] || r)}</span>`)
        .join("");

      let situacao;
      if (abaAtiva === "falharam") {
        const erro = textoDoErro(p);
        situacao = `<span class="ag-tag ag-tag-erro">${esc(p.status || "falhou")}</span>${
          erro ? `<div class="ag-erro-txt">${esc(erro)}</div>` : ""
        }`;
      } else if (dt.data && dt.data.getTime() < agora) {
        situacao = `<span class="ag-tag ag-tag-aviso">Atrasado / na fila</span>`;
      } else {
        situacao = `<span class="ag-tag ag-tag-ok">Agendado</span>`;
      }

      html += `<tr>
        <td class="ag-hora">${esc(dt.hora)}</td>
        <td class="ag-canal">${esc(nomeDoCanal(p.canal_id))}</td>
        <td>${redes || "—"}</td>
        <td class="ag-titulo" title="${esc(tituloDoPost(p))}">${esc(tituloDoPost(p)) || "—"}</td>
        <td>${situacao}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    corpo.innerHTML = html;
  }

  function opcoesFiltroCanal() {
    const ids = Array.from(new Set(cachePosts.map((p) => p.canal_id).filter(Boolean)));
    ids.sort((a, b) => nomeDoCanal(a).localeCompare(nomeDoCanal(b)));
    return (
      `<option value="">Todos os canais</option>` +
      ids.map((id) => `<option value="${esc(id)}"${id === filtroCanal ? " selected" : ""}>${esc(nomeDoCanal(id))}</option>`).join("")
    );
  }

  // ------------------------------------------------------------------
  // Modal
  // ------------------------------------------------------------------
  function fecharPainelAgendados() {
    const m = document.getElementById("modal-agendados");
    if (m) m.remove();
    document.removeEventListener("keydown", aoPressionarTecla);
  }

  function aoPressionarTecla(e) {
    if (e.key === "Escape") fecharPainelAgendados();
  }

  async function abrirPainelAgendados() {
    fecharPainelAgendados();
    abaAtiva = "agendados";
    filtroCanal = "";

    const overlay = document.createElement("div");
    overlay.id = "modal-agendados";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box modal-agendados-box">
        <div class="modal-head ag-head">
          <div>
            <h2>Posts Agendados</h2>
            <p>O que está na fila para publicar e o que falhou. Posts publicados com sucesso são removidos da tabela automaticamente.</p>
          </div>
          <button class="btn btn-outline ag-fechar" id="ag-btn-fechar" type="button" aria-label="Fechar">✕</button>
        </div>
        <div class="ag-toolbar">
          <div class="ag-tabs">
            <button type="button" class="ag-tab ativa" data-aba="agendados">Agendados <span class="ag-badge" id="ag-count-agendados">0</span></button>
            <button type="button" class="ag-tab" data-aba="falharam">Falharam <span class="ag-badge ag-badge-erro" id="ag-count-falharam">0</span></button>
          </div>
          <div class="ag-toolbar-dir">
            <select id="ag-filtro-canal" class="ag-select"><option value="">Todos os canais</option></select>
            <button type="button" class="btn btn-cyan" id="ag-btn-atualizar">Atualizar</button>
          </div>
        </div>
        <div class="ag-corpo" id="ag-corpo"><div class="ag-vazio">Carregando posts...</div></div>
      </div>`;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) fecharPainelAgendados();
    });
    document.body.appendChild(overlay);
    document.addEventListener("keydown", aoPressionarTecla);

    document.getElementById("ag-btn-fechar").addEventListener("click", fecharPainelAgendados);
    document.getElementById("ag-btn-atualizar").addEventListener("click", async () => {
      await carregar();
      document.getElementById("ag-filtro-canal").innerHTML = opcoesFiltroCanal();
    });
    document.querySelectorAll(".ag-tab").forEach((b) => {
      b.addEventListener("click", () => {
        abaAtiva = b.dataset.aba;
        renderizar();
      });
    });
    document.getElementById("ag-filtro-canal").addEventListener("change", (e) => {
      filtroCanal = e.target.value;
      renderizar();
    });

    await carregar();
    const sel = document.getElementById("ag-filtro-canal");
    if (sel) sel.innerHTML = opcoesFiltroCanal();
  }

  // ------------------------------------------------------------------
  // Analytics (redirecionador)
  // ------------------------------------------------------------------
  function abrirAnalytics() {
    window.location.href = URL_ANALYTICS;
  }

  window.abrirPainelAgendados = abrirPainelAgendados;
  window.fecharPainelAgendados = fecharPainelAgendados;
  window.abrirAnalytics = abrirAnalytics;
})();
