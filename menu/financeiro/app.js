// =========================================
// EVRIX FINANCEIRO - APP.JS (v3 - Desktop + Mobile App)
// =========================================

const SUPABASE_URL = "https://abdliioyzkylccfylils.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Estado ----------
let graficoReceita = null;
let graficoDistribuicao = null;
let TODOS = [];   // todos os registros (histórico)
let MES = [];     // registros do mês filtrado

const mq = window.matchMedia("(max-width: 768px)");
const prefixo = () => (mq.matches ? "m-" : "");

const COR = {
    Clipei: "#38ef7d",
    Clipay: "#2dd4bf",
    TikTok: "#06b6d4",
    YouTube: "#ef4444",
    Instagram: "#c084fc"
};
const corDe = g => COR[g] || "#f7b84b";
const grupoDe = p =>
    (p === "Bytedance Tiktok shop" || p === "Bytedance programa de recompensa") ? "TikTok" : p;

// ---------- Utils ----------
const $ = id => document.getElementById(id);
const setTxt = (id, v) => { const e = $(id); if (e) e.innerText = v; };
const setHtml = (id, v) => { const e = $(id); if (e) e.innerHTML = v; };
const num = v => parseFloat(v) || 0;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtData = d => (d ? d.split("-").reverse().join("/") : "---");

function formatarMoeda(valor) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function mesAtual() {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

function toast(msg, erro = false) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show" + (erro ? " erro" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.className = "toast"), 2600);
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
    setMes(mesAtual(), false);
    carregarDashboard();

    $("filtro-mes").addEventListener("change", e => setMes(e.target.value));
    $("m-filtro-mes").addEventListener("change", e => setMes(e.target.value));

    const form = $("form-financeiro");
    if (form) form.addEventListener("submit", salvarRegistro);

    // Navegação inferior (mobile)
    document.querySelectorAll(".m-nav-btn").forEach(btn =>
        btn.addEventListener("click", () => abrirAba(btn.dataset.tab))
    );

    // Bottom sheet do formulário
    $("m-fab").addEventListener("click", () => sheet(true));
    $("sheet-close").addEventListener("click", () => sheet(false));
    $("sheet-overlay").addEventListener("click", () => sheet(false));

    // Troca de layout (girar tela / redimensionar)
    mq.addEventListener("change", () => { renderizarGraficos(MES); if (window.renderBanco) renderBanco(); });
});

function setMes(valor, recarregar = true) {
    if (!valor) return;
    $("filtro-mes").value = valor;
    $("m-filtro-mes").value = valor;
    if (recarregar) carregarDashboard();
}

function abrirAba(id) {
    document.querySelectorAll(".m-tab").forEach(t => t.classList.toggle("active", t.id === id));
    document.querySelectorAll(".m-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    window.scrollTo({ top: 0 });
    if (id === "tab-graficos") {
        // canvas estava oculto: força o recálculo de tamanho
        setTimeout(() => { graficoReceita && graficoReceita.resize(); graficoDistribuicao && graficoDistribuicao.resize(); }, 30);
    }
}

function sheet(abrir) {
    $("sheet-form").classList.toggle("open", abrir);
    $("sheet-overlay").classList.toggle("open", abrir);
    document.body.style.overflow = abrir && mq.matches ? "hidden" : "";
}

// ---------- Busca (com paginação: o Supabase limita 1000 linhas por consulta) ----------
async function buscarTudo() {
    const tam = 1000;
    const out = [];
    for (let i = 0; ; i += tam) {
        const { data, error } = await supabaseClient
            .from("analise_financeira")
            .select("*")
            .order("data_lancamento", { ascending: false })
            .range(i, i + tam - 1);
        if (error) throw error;
        out.push(...data);
        if (data.length < tam) break;
    }
    return out;
}

async function carregarDashboard() {
    const mesFiltro = $("filtro-mes").value;
    if (!mesFiltro) return;

    try {
        TODOS = await buscarTudo();
        MES = TODOS.filter(i => i.data_lancamento && i.data_lancamento.startsWith(mesFiltro));

        renderizarTabela(MES);
        calcularCards(MES, TODOS);
        renderizarMobile(MES, TODOS);
        renderizarGraficos(MES);
        if (window.carregarBanco) carregarBanco(); // módulo de extrato bancário (banco.js)
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error.message);
        toast("Erro ao carregar dados", true);
    }
}

// ---------- Tempo de operação e média mensal ----------
function calcularTempo(todos) {
    const datas = todos.map(i => i.data_lancamento).filter(Boolean).sort();
    if (!datas.length) return null;

    const [y, m, d] = datas[0].split("-").map(Number);
    const inicio = new Date(y, m - 1, d);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

    let meses = (hoje.getFullYear() - y) * 12 + (hoje.getMonth() - (m - 1));
    if (hoje.getDate() < d) meses--;
    meses = Math.max(0, meses);

    const dias = Math.max(0, Math.round((hoje - inicio) / 864e5));
    return { primeira: datas[0], ultima: datas[datas.length - 1], meses, dias };
}

function textoTempo(t) {
    if (!t) return "---";
    if (t.meses < 1) return `${t.dias} ${t.dias === 1 ? "dia" : "dias"}`;
    if (t.meses < 12) return `${t.meses} ${t.meses === 1 ? "mês" : "meses"}`;
    const a = Math.floor(t.meses / 12), r = t.meses % 12;
    return `${a} ${a === 1 ? "ano" : "anos"}` + (r ? ` e ${r} ${r === 1 ? "mês" : "meses"}` : "");
}

// Média = total histórico ÷ nº de meses de calendário desde o 1º registro (inclui o mês atual)
function calcularMedia(todos, t) {
    if (!t) return { media: 0, n: 0 };
    const total = todos.reduce((a, i) => a + num(i.receita), 0);
    const [y1, m1] = t.primeira.split("-").map(Number);
    const h = new Date();
    let [y2, m2] = [h.getFullYear(), h.getMonth() + 1];
    const [yu, mu] = t.ultima.split("-").map(Number);
    if (yu * 12 + mu > y2 * 12 + m2) { y2 = yu; m2 = mu; }
    const n = Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
    return { media: total / n, n };
}

// ---------- Agrupamentos ----------
function somarPorGrupo(lista) {
    const r = {};
    lista.forEach(i => { const g = grupoDe(i.plataforma); r[g] = (r[g] || 0) + num(i.receita); });
    return r;
}

// ---------- Cards (desktop + dados compartilhados) ----------
function calcularCards(dadosMes, todos) {
    const mes = somarPorGrupo(dadosMes);
    const hist = somarPorGrupo(todos);
    const totalMes = dadosMes.reduce((a, i) => a + num(i.receita), 0);
    const totalHist = todos.reduce((a, i) => a + num(i.receita), 0);

    let campea = "---", maior = 0;
    for (const [nome, v] of Object.entries(somarPorPlataforma(dadosMes))) {
        if (v > maior) { maior = v; campea = nome; }
    }

    setTxt("card-faturamento", formatarMoeda(totalMes));
    setTxt("card-faturamento-historico", formatarMoeda(totalHist));
    setTxt("card-campeao", campea);
    setTxt("card-faturamento-clipei", formatarMoeda(mes.Clipei || 0));
    setTxt("card-faturamento-clipei-historico", formatarMoeda(hist.Clipei || 0));
    setTxt("card-faturamento-clipay", formatarMoeda(mes.Clipay || 0));
    setTxt("card-faturamento-clipay-historico", formatarMoeda(hist.Clipay || 0));
    setTxt("card-faturamento-tiktok-mes", formatarMoeda(mes.TikTok || 0));
    setTxt("card-faturamento-tiktok-historico", formatarMoeda(hist.TikTok || 0));

    // Tempo de operação e média mensal
    const t = calcularTempo(todos);
    const { media, n } = calcularMedia(todos, t);
    const subTempo = t ? `Desde ${fmtData(t.primeira)} · ${t.dias} dias` : "Sem registros ainda";
    const subMedia = t ? `Total ÷ ${n} ${n === 1 ? "mês" : "meses"}` : "Sem registros ainda";

    setTxt("card-tempo", textoTempo(t));
    setTxt("card-tempo-sub", subTempo);
    setTxt("card-media", formatarMoeda(media));
    setTxt("card-media-sub", subMedia);

    setTxt("m-tempo", textoTempo(t));
    setTxt("m-tempo-sub", subTempo);
    setTxt("m-media", formatarMoeda(media));
    setTxt("m-media-sub", subMedia);

    // Hero + campeã mobile
    setTxt("m-fat-mes", formatarMoeda(totalMes));
    setTxt("m-fat-hist", formatarMoeda(totalHist));
    setTxt("m-campeao", campea);
}

function somarPorPlataforma(lista) {
    const r = {};
    lista.forEach(i => { r[i.plataforma] = (r[i.plataforma] || 0) + num(i.receita); });
    return r;
}

// ---------- Mobile: listas e cards ----------
function itemLista(item) {
    const rec = num(item.receita);
    const esf = parseInt(item.esforco) || 0;
    const sub = item.subcategoria && item.subcategoria !== "Geral" ? ` · ${esc(item.subcategoria)}` : "";
    const efic = esf > 0 ? ` · ${formatarMoeda(rec / esf)}/corte` : "";
    return `
        <div class="m-item" style="--cor:${corDe(grupoDe(item.plataforma))}">
            <div class="m-dot"></div>
            <div class="m-item-main">
                <b>${esc(item.plataforma)}${sub}</b>
                <small>${fmtData(item.data_lancamento)} · ${esf} cortes${efic}</small>
            </div>
            <div class="m-item-val">${formatarMoeda(rec)}</div>
        </div>`;
}

function renderizarMobile(dadosMes, todos) {
    const mes = somarPorGrupo(dadosMes);
    const hist = somarPorGrupo(todos);
    const totalMes = dadosMes.reduce((a, i) => a + num(i.receita), 0);

    // grupos: fixos + qualquer outro que tenha dados
    const grupos = ["Clipei", "Clipay", "TikTok"];
    Object.keys(hist).forEach(g => { if (!grupos.includes(g)) grupos.push(g); });

    setHtml("m-plat-scroll", grupos.map(g => `
        <div class="m-plat" style="--cor:${corDe(g)}">
            <div class="m-plat-nome">${esc(g === "TikTok" ? "Bytedance TikTok" : g)}</div>
            <div class="m-plat-valor">${formatarMoeda(mes[g] || 0)}</div>
            <div class="m-plat-hist">Histórico total<b>${formatarMoeda(hist[g] || 0)}</b></div>
        </div>`).join(""));

    setHtml("m-plat-lista", [...grupos].sort((a, b) => (mes[b] || 0) - (mes[a] || 0)).map(g => {
        const pct = totalMes > 0 ? ((mes[g] || 0) / totalMes) * 100 : 0;
        return `
        <div class="m-plat-det" style="--cor:${corDe(g)}">
            <div class="m-plat-det-top"><b>${esc(g === "TikTok" ? "Bytedance TikTok" : g)}</b><span>${formatarMoeda(mes[g] || 0)}</span></div>
            <div class="m-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
            <div class="m-plat-det-foot"><span>${pct.toFixed(1)}% do mês</span><span>Histórico <b>${formatarMoeda(hist[g] || 0)}</b></span></div>
        </div>`;
    }).join(""));

    const vazio = `<div class="m-vazio">Nenhum lançamento neste período.</div>`;
    setHtml("m-recentes", dadosMes.length ? dadosMes.slice(0, 5).map(itemLista).join("") : vazio);
    setHtml("m-lista", dadosMes.length ? dadosMes.map(itemLista).join("") : vazio);
    setTxt("m-qtd", dadosMes.length ? `${dadosMes.length} lançamentos` : "");
}

// ---------- Tabela (desktop) ----------
function renderizarTabela(dados) {
    const tbody = $("tabela-corpo");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (dados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--muted); padding:30px;">Nenhum lançamento encontrado para este período.</td></tr>`;
        return;
    }

    dados.forEach(item => {
        const rec = num(item.receita);
        const esf = parseInt(item.esforco) || 0;
        const subCat = item.subcategoria || "Geral";
        const nome = (subCat === "Geral" || subCat === "Parcerias")
            ? `${esc(item.plataforma)} <span style="color: var(--muted); font-weight: 500; font-size: .82rem;">(${esc(subCat)})</span>`
            : `${esc(item.plataforma)} <b style="color: var(--primary);">· ${esc(subCat)}</b>`;

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td style="font-weight:700;">${nome}</td>
            <td>${formatarMoeda(rec)}</td>
            <td>${esf}</td>
            <td>${formatarMoeda(esf > 0 ? rec / esf : 0)}</td>
            <td style="color:var(--muted)">${fmtData(item.data_lancamento)}</td>`;
        tbody.appendChild(tr);
    });
}

// ---------- Salvar ----------
async function salvarRegistro(e) {
    e.preventDefault();

    const payload = {
        plataforma: $("plataforma").value,
        subcategoria: $("subcategoria").value,
        data_lancamento: $("data-lancamento").value,
        receita: num($("receita").value),
        esforco: parseInt($("esforco").value) || 0
    };

    const btn = e.target.querySelector(".btn-salvar");
    btn.disabled = true;

    try {
        const { error } = await supabaseClient.from("analise_financeira").insert([payload]);
        if (error) throw error;

        $("receita").value = "";
        $("esforco").value = "";
        $("data-lancamento").value = hojeLocal();

        // se lançou em outro mês, mostra esse mês para o resultado aparecer na tela
        const mesLancado = payload.data_lancamento.slice(0, 7);
        if (mesLancado !== $("filtro-mes").value) setMes(mesLancado, false);

        sheet(false);
        await carregarDashboard();
        toast("Resultado salvo com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar:", error.message);
        toast("Falha ao salvar: " + error.message, true);
    } finally {
        btn.disabled = false;
    }
}

// ---------- Gráficos ----------
function renderizarGraficos(dados) {
    const filtro = $("filtro-mes").value;
    if (!filtro || typeof Chart === "undefined") return;
    const p = prefixo();
    const mobile = mq.matches;

    const [ano, mes] = filtro.split("-");
    const porData = {};
    const ultimoDia = new Date(ano, mes, 0).getDate();
    for (let d = 1; d <= ultimoDia; d++) porData[`${ano}-${mes}-${String(d).padStart(2, "0")}`] = 0;

    dados.forEach(i => { if (i.data_lancamento && porData[i.data_lancamento] !== undefined) porData[i.data_lancamento] += num(i.receita); });

    const labels = Object.keys(porData).sort();
    const valores = labels.map(d => porData[d]);
    const labelsExib = labels.map(d => d.split("-").reverse().slice(0, 2).join("/"));

    const dist = somarPorPlataforma(dados);
    const total = valores.reduce((a, v) => a + v, 0);
    setTxt("receita-total-chart", formatarMoeda(total));
    setTxt("m-receita-total-chart", formatarMoeda(total));

    if (graficoReceita) graficoReceita.destroy();
    if (graficoDistribuicao) graficoDistribuicao.destroy();

    const ctxR = $(p + "graficoReceita");
    if (ctxR) {
        graficoReceita = new Chart(ctxR, {
            type: "line",
            data: {
                labels: labelsExib,
                datasets: [{
                    label: "Receita", data: valores, tension: 0.3, borderWidth: mobile ? 2.5 : 3, fill: true,
                    pointRadius: mobile ? 0 : 2, pointHoverRadius: 6, borderColor: "#f5b041", backgroundColor: "rgba(245,176,65,.08)"
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { intersect: false, mode: "index" },
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: "#8a99ad", maxTicksLimit: mobile ? 6 : 10 }, grid: { display: false } },
                    y: { ticks: { color: "#8a99ad", maxTicksLimit: mobile ? 5 : 8 }, grid: { color: "rgba(255,255,255,.04)" }, min: 0 }
                }
            }
        });
    }

    const ctxD = $(p + "graficoDistribuicao");
    if (ctxD) {
        graficoDistribuicao = new Chart(ctxD, {
            type: "doughnut",
            data: {
                labels: Object.keys(dist),
                datasets: [{
                    data: Object.values(dist), borderWidth: 0, cutout: "74%",
                    backgroundColor: ["#f5b041", "#ff4d4d", "#00ff66", "#3498db", "#9b59b6", "#e67e22"]
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { color: "#8a99ad", padding: 14, usePointStyle: true } } }
            }
        });
    }
}
