// =========================================
// EVRIX FINANCEIRO - APP.JS
// PREMIUM ANALYTICS DASHBOARD
// =========================================

// =========================================
// SUPABASE CONFIG
// =========================================
const SUPABASE_URL = "https://abdliioyzkylccfylils.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================
// CHARTS GLOBALS
// =========================================
let graficoReceita = null;
let graficoDistribuicao = null;

// =========================================
// INIT INITIALIZATION
// =========================================
document.addEventListener("DOMContentLoaded", () => {
    const filtroMes = document.getElementById("filtro-mes");
    
    // Injeta o mês atual no formato AAAA-MM
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    filtroMes.value = `${ano}-${mes}`;

    // Chamada inicial para carregar dados
    carregarDashboard();

    // Eventos
    filtroMes.addEventListener("change", carregarDashboard);
    
    const formFinanceiro = document.getElementById("form-financeiro");
    if (formFinanceiro) {
        formFinanceiro.addEventListener("submit", salvarRegistro);
    }
});

// =========================================
// CARREGAR DASHBOARD
// =========================================
async function carregarDashboard() {
    const filtroMesEl = document.getElementById("filtro-mes");
    if (!filtroMesEl) return;
    
    const mesFiltro = filtroMesEl.value;
    if (!mesFiltro) return;

    try {
        const { data, error } = await supabaseClient
            .from('analise_financeira')
            .select('*')
            .order('data_lancamento', { ascending: false });

        if (error) throw error;

        // Filtra os dados com base no mês selecionado (AAAA-MM)
        const dadosFiltrados = data.filter(item => {
            return (
                item.data_lancamento &&
                item.data_lancamento.startsWith(mesFiltro)
            );
        });

        // Atualiza os componentes da Interface
        renderizarTabela(dadosFiltrados);
        calcularCards(dadosFiltrados, data);
        renderizarGraficos(dadosFiltrados);

    } catch (error) {
        console.error("Erro ao carregar dashboard:", error.message);
    }
}

// =========================================
// METRICS & CARDS CALCULATIONS (DASHBOARD COMPLETO)
// =========================================
function calcularCards(dadosDoMes, todosOsDados) {
    let faturamentoGeralMes = 0;
    const faturamentoPorPlataforma = {};

    const resumoMes = {
        Clipei: { receita: 0 },
        Clipay: { receita: 0 },
        TikTok: { receita: 0 }
    };

    // 1. Processa os dados APENAS do mês filtrado atual
    dadosDoMes.forEach(item => {
        const plat = item.plataforma;
        const rec = parseFloat(item.receita) || 0;

        faturamentoGeralMes += rec;
        faturamentoPorPlataforma[plat] = (faturamentoPorPlataforma[plat] || 0) + rec;

        if (plat === "Clipei") {
            resumoMes.Clipei.receita += rec;
        } else if (plat === "Clipay") {
            resumoMes.Clipay.receita += rec;
        } else if (plat === "Bytedance Tiktok shop" || plat === "Bytedance programa de recompensa") {
            resumoMes.TikTok.receita += rec;
        }
    });

    // 2. Processa os faturamentos HISTÓRICOS TOTAIS
    let faturamentoGeralHistorico = 0; // Acumulador absoluto de todo o app
    let faturamentoClipeiHistorico = 0;
    let faturamentoClipayHistorico = 0;
    let faturamentoTikTokHistorico = 0;

    todosOsDados.forEach(item => {
        const plat = item.plataforma;
        const rec = parseFloat(item.receita) || 0;

        // Soma para o faturamento histórico global absoluto
        faturamentoGeralHistorico += rec;

        // Somas individuais por plataforma
        if (plat === "Clipei") {
            faturamentoClipeiHistorico += rec;
        } else if (plat === "Clipay") {
            faturamentoClipayHistorico += rec;
        } else if (plat === "Bytedance Tiktok shop" || plat === "Bytedance programa de recompensa") {
            faturamentoTikTokHistorico += rec;
        }
    });

    // 3. Calcula a Plataforma Campeã do Mês
    let plataformaCampea = "---";
    let maiorValor = 0;
    for (const [nomePlat, valor] of Object.entries(faturamentoPorPlataforma)) {
        if (valor > maiorValor) {
            maiorValor = valor;
            plataformaCampea = nomePlat;
        }
    }

    // --- ATUALIZAÇÃO DOS COMPONENTES NA UI ---

    // CARD PRINCIPAL: Faturamento Geral (Mês e Histórico)
    const elFaturamento = document.getElementById("card-faturamento");
    if (elFaturamento) elFaturamento.innerText = formatarMoeda(faturamentoGeralMes);

    const elFaturamentoHistorico = document.getElementById("card-faturamento-historico");
    if (elFaturamentoHistorico) elFaturamentoHistorico.innerText = formatarMoeda(faturamentoGeralHistorico);

    // CARD PRINCIPAL: Campeão do Mês
    const elCampeao = document.getElementById("card-campeao");
    if (elCampeao) elCampeao.innerText = plataformaCampea;

    // CARD CLIPEI: Mês e Histórico
    const elFatClipei = document.getElementById("card-faturamento-clipei");
    if (elFatClipei) elFatClipei.innerText = formatarMoeda(resumoMes.Clipei.receita);
    
    const elFatClipeiHistorico = document.getElementById("card-faturamento-clipei-historico");
    if (elFatClipeiHistorico) elFatClipeiHistorico.innerText = formatarMoeda(faturamentoClipeiHistorico);

    // CARD CLIPAY: Mês e Histórico
    const elFatClipay = document.getElementById("card-faturamento-clipay");
    if (elFatClipay) elFatClipay.innerText = formatarMoeda(resumoMes.Clipay.receita);

    const elFatClipayHistorico = document.getElementById("card-faturamento-clipay-historico");
    if (elFatClipayHistorico) elFatClipayHistorico.innerText = formatarMoeda(faturamentoClipayHistorico);

    // CARD TIKTOK: Mês e Histórico
    const elTiktokMes = document.getElementById("card-faturamento-tiktok-mes");
    if (elTiktokMes) elTiktokMes.innerText = formatarMoeda(resumoMes.TikTok.receita);

    const elTiktokHistorico = document.getElementById("card-faturamento-tiktok-historico");
    if (elTiktokHistorico) elTiktokHistorico.innerText = formatarMoeda(faturamentoTikTokHistorico);
}



// =========================================
// RENDER DATA TABLE
// =========================================
function renderizarTabela(dados) {
    const tbody = document.getElementById("tabela-corpo");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (dados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; color:var(--texto-secundario); padding:30px;">
                    Nenhum lançamento encontrado para este período.
                </td>
            </tr>
        `;
        return;
    }

    dados.forEach(item => {
        const tr = document.createElement("tr");

        const rec = parseFloat(item.receita) || 0;
        const esf = parseInt(item.esforco) || 0;
        const mediaPorVideo = esf > 0 ? (rec / esf) : 0;
        
        const dataFormatada = item.data_lancamento 
            ? item.data_lancamento.split('-').reverse().join('/') 
            : '---';

        const subCat = item.subcategoria || "Geral";

        // Aplica estilizações dinâmicas baseadas nas variáveis corretas do CSS root
        const nomeExibicao = (subCat === "Geral" || subCat === "Parcerias")
            ? `${item.plataforma} <span style="color: var(--texto-secundario); font-weight: 500; font-size: .82rem;">(${subCat})</span>`
            : `${item.plataforma} <b style="color: var(--cor-primaria);">· ${subCat}</b>`;

        tr.innerHTML = `
            <td style="font-weight:700;">${nomeExibicao}</td>
            <td>${formatarMoeda(rec)}</td>
            <td>${esf}</td>
            <td>${formatarMoeda(mediaPorVideo)}</td>
            <td style="color:var(--texto-secundario)">${dataFormatada}</td>
        `;

        tbody.appendChild(tr);
    });
}

// =========================================
// SUBMIT DATA TO SUPABASE
// =========================================
async function salvarRegistro(e) {
    e.preventDefault();

    const payload = {
        plataforma: document.getElementById("plataforma").value,
        subcategoria: document.getElementById("subcategoria").value,
        data_lancamento: document.getElementById("data-lancamento").value,
        receita: parseFloat(document.getElementById("receita").value) || 0,
        esforco: parseInt(document.getElementById("esforco").value) || 0
    };

    try {
        const { error } = await supabaseClient
            .from('analise_financeira')
            .insert([payload]);

        if (error) throw error;

        // Reseta os campos numéricos do formulário de entrada
        document.getElementById("receita").value = "";
        document.getElementById("esforco").value = "";
        document.getElementById('data-lancamento').valueAsDate = new Date();

        // Recarrega os dados atualizados na tela
        carregarDashboard();
        alert("Resultado salvo com sucesso!");

    } catch (error) {
        console.error("Erro ao salvar:", error.message);
        alert("Falha ao salvar: " + error.message);
    }
}

// =========================================
// UTILS: MONEY FORMATTER
// =========================================
function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// =========================================
// CHARTS RENDERIZATION (CHART.JS CORRIGIDO)
// =========================================
function renderizarGraficos(dados) {
    const filtroMesEl = document.getElementById("filtro-mes");
    if (!filtroMesEl) return;
    
    const [ano, mes] = filtroMesEl.value.split('-');
    
    // 1. Gerar TODOS os dias do mês com valor ZERO para o gráfico não mentir
    const agrupadoPorData = {};
    const ultimoDia = new Date(ano, mes, 0).getDate(); // Pega o último dia do mês (28, 30 ou 31)
    
    for (let dia = 1; dia <= ultimoDia; dia++) {
        const diaFormatado = String(dia).padStart(2, '0');
        const dataCompleta = `${ano}-${mes}-${diaFormatado}`;
        agrupadoPorData[dataCompleta] = 0;
    }

    // 2. Injetar os dados reais vindos do Supabase por cima dos zeros
    dados.forEach(item => {
        const data = item.data_lancamento;
        if (data && agrupadoPorData[data] !== undefined) {
            const receita = parseFloat(item.receita) || 0;
            agrupadoPorData[data] += receita; // Somatória se houver mais de um ganho no mesmo dia
        }
    });

    // Ordenar as chaves garante a linha do tempo linear perfeita (01 até 31)
    const labels = Object.keys(agrupadoPorData).sort();
    const valores = labels.map(data => agrupadoPorData[data]);

    // Formatador visual para o Eixo X não ficar poluído com "2026-05-01"
    // Vai exibir apenas "01", "02", "03"... ou "01/05"
    const labelsExibicao = labels.map(data => {
        const [,,, dia] = data.split('-'); 
        // Retorna apenas DD/MM para ficar mais limpo
        return data.split('-').reverse().slice(0,2).join('/');
    });

    // Agrupamento de receitas para o Gráfico de Distribuição (Donut)
    const distribuicao = {};
    dados.forEach(item => {
        const plat = item.plataforma;
        const receita = parseFloat(item.receita) || 0;
        distribuicao[plat] = (distribuicao[plat] || 0) + receita;
    });

    const labelsDistribuicao = Object.keys(distribuicao);
    const valoresDistribuicao = Object.values(distribuicao);

    // Totalização
    const total = valores.reduce((acc, val) => acc + val, 0);
    const receitaTotalEl = document.getElementById("receita-total-chart");
    if (receitaTotalEl) {
        receitaTotalEl.innerText = formatarMoeda(total);
    }

    // Limpa instâncias antigas
    if (graficoReceita) graficoReceita.destroy();
    if (graficoDistribuicao) graficoDistribuicao.destroy();

    // Renderização do Line Chart (Gráfico Receita)
    const ctxReceita = document.getElementById("graficoReceita");
    if (ctxReceita && typeof Chart !== 'undefined') {
        graficoReceita = new Chart(ctxReceita, {
            type: 'line',
            data: {
                labels: labelsExibicao, // Usa as labels formatadas mais limpas
                datasets: [{
                    label: 'Receita',
                    data: valores,
                    tension: 0.3, // Curvatura elegante, sem exageros
                    borderWidth: 3,
                    fill: true,
                    pointRadius: 2, // Pequeno ponto para identificar que houve registro ali
                    pointHoverRadius: 6,
                    borderColor: '#f5b041',
                    backgroundColor: 'rgba(245,176,65,.04)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { 
                        ticks: { 
                            color: '#8a99ad',
                            maxTicksLimit: 10 // Evita que o eixo X quebre se o mês tiver 31 dias
                        }, 
                        grid: { display: false } 
                    },
                    y: { 
                        ticks: { color: '#8a99ad' }, 
                        grid: { color: 'rgba(255,255,255,.03)' },
                        min: 0 // Garante que o gráfico comece do zero
                    }
                }
            }
        });
    }

    // Renderização do Donut Chart (Gráfico Distribuição)
    const ctxDistribuicao = document.getElementById("graficoDistribuicao");
    if (ctxDistribuicao && typeof Chart !== 'undefined') {
        graficoDistribuicao = new Chart(ctxDistribuicao, {
            type: 'doughnut',
            data: {
                labels: labelsDistribuicao,
                datasets: [{
                    data: valoresDistribuicao,
                    borderWidth: 0,
                    cutout: '74%',
                    backgroundColor: ['#f5b041', '#ff4d4d', '#00ff66', '#3498db', '#9b59b6', '#e67e22']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#8a99ad', padding: 14, usePointStyle: true }
                    }
                }
            }
        });
    }
}
