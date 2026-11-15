// modern.js — Dynamic Island, Docs e animações. Não altera a lógica do app.js.
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);

  // ---------- Organiza o painel em blocos (grid) ----------
  function organizarPainel(p, dz) {
    p.querySelectorAll(":scope > .control-divider").forEach((d) => d.remove());
    const g = [...p.querySelectorAll(":scope > .control-group")];
    const lab = (n) => g.find((x) => { const l = x.querySelector(".control-group-label"); return l && l.textContent.trim() === n; });
    const t = {
      conexao: lab("Conexão Supabase"), imp: lab("Importação em Lote"), can: lab("Canais"),
      glob: lab("Ações Globais"), hp: lab("Horário Padrão"), acomp: lab("Acompanhamento"),
      anti: g.find((x) => x.querySelector('[onclick*="randomizarHorarios"]')),
      fire: g.find((x) => x.classList.contains("control-group-fire"))
    };
    if (t.anti && !t.anti.querySelector(".control-group-label")) {
      const l = document.createElement("span"); l.className = "control-group-label"; l.textContent = "Anti-Shadowban";
      t.anti.prepend(l);
    }
    if (dz) { dz.classList.add("t-dz"); t.dz = dz; }
    ["conexao", "imp", "can", "hp", "glob", "acomp", "anti", "dz", "fire"].forEach((k) => {
      if (!t[k]) return;
      t[k].classList.add("tile", "t-" + k);
      p.appendChild(t[k]);
    });
  }

  // ---------- Dynamic Island: contém todo o painel; abre com hover ou clique ----------
  function criarIsland() {
    const il = document.createElement("div");
    il.id = "island";
    il.innerHTML = '<div class="i-bar"><span class="i-dot"></span><span class="i-txt">Evrix Social · online</span><span class="i-clk">--:--</span></div>' +
      '<div class="i-body"><div class="i-in"><div class="i-pad"><div class="i-top"><span>Painel de controle</span><button id="i-docs" class="btn btn-outline" type="button">📘 Docs</button></div><div class="i-slot"></div></div></div></div>';
    document.body.appendChild(il);
    const slot = $(".i-slot", il), txt = $(".i-txt", il), clk = $(".i-clk", il);
    const painel = $(".control-panel"), dz = $("#dz-import-horarios-extras");
    if (painel) { slot.appendChild(painel); organizarPainel(painel, dz); }
    $("#i-docs").onclick = () => window.abrirDocs && window.abrirDocs();

    let pinned = false, tOpen, tClose, tNote;
    const padrao = "Evrix Social · online";
    const abrir = () => { clearTimeout(tClose); il.classList.add("open"); };
    const fechar = () => { pinned = false; il.classList.remove("open"); if (!il.classList.contains("note")) txt.textContent = padrao; };
    const editando = () => il.contains(document.activeElement) && /input|select|textarea/i.test(document.activeElement.tagName);
    const recolherNota = () => { il.classList.remove("note", "err", "busy"); if (!il.classList.contains("open")) txt.textContent = padrao; };

    il.addEventListener("mouseenter", () => { clearTimeout(tClose); tOpen = setTimeout(abrir, 120); });
    il.addEventListener("mouseleave", () => {
      clearTimeout(tOpen);
      if (pinned) return;
      tClose = setTimeout(() => { if (!editando()) fechar(); }, 450);
    });
    $(".i-bar", il).addEventListener("click", () => {
      if (il.classList.contains("open") && pinned) fechar(); else { pinned = true; abrir(); }
    });
    il.querySelector(".i-body").addEventListener("pointerdown", () => { pinned = true; });
    document.addEventListener("pointerdown", (e) => { if (!il.contains(e.target) && il.classList.contains("open")) fechar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
    setInterval(() => (clk.textContent = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })), 1000);

    // Espelha as mensagens do setMsg (#msg) na ilha
    const msg = $("#msg");
    if (!msg) return;
    new MutationObserver(() => {
      const s = $("span", msg), texto = s ? s.textContent.trim() : "";
      if (!texto || texto === "Pronto para uso") return;
      const m = (getComputedStyle(msg).color.match(/\d+/g) || []).map(Number);
      const erro = m[0] > 200 && m[1] < 160;
      const busy = /\.\.\.$|…$|enviando|carregando|salvando|sincroniz/i.test(texto);
      il.classList.toggle("err", erro);
      il.classList.toggle("busy", !erro && busy);
      il.classList.add("note", "bump");
      txt.textContent = texto;
      setTimeout(() => il.classList.remove("bump"), 500);
      clearTimeout(tNote);
      if (!busy) tNote = setTimeout(recolherNota, erro ? 7000 : 4200);
    }).observe(msg, { childList: true, subtree: true });
  }

  // ---------- Docs ----------
  const DOCS = {
    "Início": `<h2>Evrix Social</h2><p>Programador multi-canal: envie vídeos, defina títulos e horários e agende tudo para YouTube, Instagram e TikTok de uma vez.</p>
<h4>Fluxo rápido</h4><ol><li>Arraste os vídeos (ou use <b>Vídeos (Lote)</b>).</li><li>Importe o JSON de títulos.</li><li>Confira data, redes e horários nos cards.</li><li>Clique em <b>Disparar Programação</b>.</li></ol>
<p>Atalhos: <kbd>?</kbd> abre estes docs · <kbd>Esc</kbd> fecha.</p>`,
    "Vídeos em lote": `<h2>Vídeos em lote</h2><p>O sistema descobre o canal pelo <b>nome do arquivo</b>: ele precisa conter o ID ou o nome do canal.</p>
<pre>alvox_1.mp4\nalvox_2.mp4\ncris_1.mp4</pre>
<ul><li>Vários vídeos do mesmo canal ficam no mesmo card, em ordem natural (1, 2, 10).</li><li>Cada vídeo extra ganha uma <b>trilha</b> com horário próprio.</li><li>Arquivos que não batem com nenhum canal são avisados na ilha.</li></ul>`,
    "Horários": `<h2>Horário padrão</h2><p>Não existem mais blocos de manhã e noite: todos os canais ficam em uma lista só. Escolha na ilha, em <b>Horário Padrão</b>:</p>
<ul><li><b>Padrão 1</b>: o primeiro canal sai às <code>11:00</code>.</li><li><b>Padrão 2</b>: o primeiro canal sai às <code>18:00</code>.</li></ul>
<p>Cada canal seguinte soma <code>5 min</code>, na ordem dos cards. Com 5 canais no Padrão 1: 11:00, 11:05, 11:10, 11:15, 11:20. Arrastar um card muda a ordem e os horários se ajustam.</p>
<p>Vídeos extras do mesmo canal ganham o horário da trilha 1 + 2h por trilha.</p>
<p>Para importar horários prontos, solte um JSON na caixa tracejada da ilha:</p>
<pre>{\n  "horarios_extras_video_2": [\n    { "canal": "Alvox", "horario": "14:40" }\n  ]\n}</pre>
<p>Isso só altera a tela; nada é gravado até você agendar.</p>`,
    "Agendar e disparar": `<h2>Agendar e disparar</h2><ul><li><b>Agendar Este Canal</b>: grava só aquele canal.</li><li><b>Disparar Programação</b>: grava todos os canais selecionados.</li><li>É obrigatório ter data, ao menos uma rede e um título.</li><li>Títulos do YouTube acima de 100 caracteres são cortados.</li></ul>`,
    "Posts agendados": `<h2>Posts agendados</h2><p>Abra em <b>Acompanhamento → Posts Agendados</b>.</p><ul><li><b>Agendados</b>: fila pendente. "Atrasado / na fila" = horário já passou.</li><li><b>Falharam</b>: mostra o erro registrado.</li><li>Publicados com sucesso saem da tabela sozinhos.</li></ul><p>O botão <b>Analytics</b> leva ao painel em <code>/menu/</code>.</p>`,
    "Anti-Shadowban": `<h2>Anti-Shadowban</h2><p>Randomiza os horários entre os canais para evitar padrão repetido de postagem. Use <b>Adicionar JSON</b> para alimentar o histórico.</p>`
  };

  function criarDocs() {
    const ov = document.createElement("div");
    ov.id = "docs-ov";
    ov.innerHTML = '<div id="docs-box"><nav id="docs-nav"><h3>📘 Docs</h3></nav><div id="docs-main"></div></div><button id="docs-x" type="button">✕</button>';
    document.body.append(ov);
    const nav = $("#docs-nav"), main = $("#docs-main");
    function ir(nome) {
      main.innerHTML = DOCS[nome]; main.scrollTop = 0;
      nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.textContent === nome));
    }
    Object.keys(DOCS).forEach((n) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = n;
      b.onclick = () => ir(n); nav.appendChild(b);
    });
    const abrir = () => { ov.classList.add("on"); ir("Início"); };
    const fechar = () => ov.classList.remove("on");
    $("#docs-x").onclick = fechar;
    ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") fechar();
      else if (e.key === "?" && !/input|textarea|select/i.test(e.target.tagName)) abrir();
    });
    window.abrirDocs = abrir;
  }

  // ---------- Reveal ao rolar ----------
  function reveal() {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }), { threshold: .08 });
    document.querySelectorAll(".bloco").forEach((el) => { el.classList.add("rv"); io.observe(el); });
  }

  function iniciar() { criarDocs(); criarIsland(); reveal(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
