// =========================================
// EVRIX FINANCEIRO - BANCO.JS
// Importação e análise de extrato bancário (Caixa)
// Depende de app.js: $, esc, num, formatarMoeda, fmtData, supabaseClient, TODOS, toast, mq, prefixo
// =========================================

let EXT = null, PREV = null, gFluxo = null, gCat = null;

const NORM = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const SOMA = (l, f) => l.reduce((a, x) => a + f(x), 0);
const R$ = formatarMoeda;

function hash(s) { // cyrb53 (determinístico, sem depender de crypto.subtle)
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ---------- Categorização (ordem importa: específico antes de genérico) ----------
const CATS = [
    ["Receita de plataformas", /TIKTOK|BYTEDANCE|CLIPEI|CLIPAY|YOUTUBE|ADSENSE|GOOGLE|META\b|FACEBOOK|KWAI|HOTMART|KIWIFY|EDUZZ|MONETIZZE|PAYPAL|STRIPE|ASAAS|PAGSEGURO/, "entrada"],
    ["Salário e benefícios", /SALARIO|BENEFICIO|INSS|FGTS|AUXILIO|BOLSA|SEGURO DESEMP/, "entrada"],
    ["Rendimentos e estornos", /RENDIMENT|POUPANCA|ESTORNO|DEVOLU|RESGATE|JUROS|CORRECAO MONETARIA/, "entrada"],
    ["Depósitos", /DEPOSITO|\bDP\b|DINHEIRO/, "entrada"],
    ["Apostas / bets", /\b(BET|BETANO|BET365|BLAZE|PIXBET|SPORTINGBET|ESTRELABET|VAIDEBET|BETNACIONAL|TIGRINHO|CASSINO)\b/],
    ["Fatura de cartão", /FATURA|CARTAO (DE )?CREDITO/],
    ["Tarifas e taxas", /TARIFA|\bIOF\b|ANUIDADE|JUROS|ENCARGO|CESTA|PACOTE DE SERV/],
    ["Saques", /SAQUE/],
    ["Empréstimos", /EMPREST|FINANCIAM|PARCELA|CONSIGNADO|\bCDC\b/],
    ["Anúncios", /FACEBK|META ADS|FACEBOOK ADS|GOOGLE ADS|TIKTOK ADS|\bADS\b/],
    ["Assinaturas e ferramentas", /NETFLIX|SPOTIFY|PRIME|DISNEY|HBO|APPLE|OPENAI|CHATGPT|ANTHROPIC|CLAUDE|ELEVENLABS|CANVA|CAPCUT|HOSTINGER|NAMECHEAP|GODADDY|REGISTRO BR|VERCEL|SUPABASE|CLOUDFLARE|GITHUB|ADOBE|MICROSOFT|NOTION|DIGITALOCEAN|RAILWAY|GOOGLE ONE/],
    ["Alimentação", /IFOOD|RAPPI|RESTAURANTE|LANCHE|PIZZ|PADARIA|SUPERMERC|MERCADINHO|ATACAD|ACOUGUE|BURGER|SORVET|ACAI|CAFE/],
    ["Transporte", /UBER|\b99\b|POSTO|COMBUST|SHELL|IPIRANGA|PETROBRAS|ESTACIONAMENTO|PEDAGIO|SEM PARAR/],
    ["Telefonia e internet", /CLARO|\bVIVO\b|\bTIM\b|\bOI\b|TELEFON|INTERNET|RECARGA/],
    ["Contas da casa", /ENERGIA|EQUATORIAL|CEMAR|CAEMA|AGUA|ALUGUEL|CONDOMINIO/],
    ["Saúde", /FARMAC|DROGA|HOSPITAL|CLINICA|MEDIC|LABORAT|ODONTO|UNIMED/],
    ["Compras online/varejo", /MERCADO ?LIVRE|SHOPEE|SHEIN|AMAZON|MAGALU|MAGAZINE|AMERICANAS|ALIEXPRESS|CASAS BAHIA/],
    ["Impostos", /DARF|\bDAS (MEI|SIMPLES)\b|IMPOSTO|IPVA|IPTU|RECEITA FEDERAL/],
    ["Boletos e pagamentos", /BOLETO|PAG ?BOL|PAGAMENTO|PAGTO|CONVENIO|COBRANCA|LOTERIA/],
    ["Compras no débito", /COMPRA|CP DEB|CARTAO|\bELO\b|VISA|MASTER/],
];

function categorizar(n, tipo) {
    for (const [c, re, t] of CATS) if ((!t || t === tipo) && re.test(n)) return c;
    if (/PIX|TRANSF|\bTED\b|\bDOC\b/.test(n)) return tipo === "entrada" ? "Pix/transferências recebidas" : "Pix/transferências enviadas";
    return tipo === "entrada" ? "Outras entradas" : "Outros";
}

const contraparte = n => n.replace(/\b(PIX|ENVIADO|RECEBIDO|ENVIO|RECEBIMENTO|CRED|DEB|TRANSF|TRANSFERENCIA|TED|DOC|COMPRA|CARTAO|DEBITO|CREDITO|PAG|PAGTO|PAGAMENTO|EM|C\/C|DE|DA|DO|PARA|AUTOR)\b/g, " ")
    .replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 32) || "SEM IDENTIFICACAO";

// ---------- Leitura de valores e linhas ----------
function moedas(t) { // acha valores no formato brasileiro; detecta sinal por sufixo C/D, "-" ou "+"
    const re = /(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?!\d)/g, out = []; let m, x;
    while ((m = re.exec(t))) {
        const ant = t.slice(Math.max(0, m.index - 6), m.index), dep = t.slice(re.lastIndex, re.lastIndex + 3);
        let s = 0;
        if ((x = dep.match(/^\s?([CD])(?![A-Za-z])/i))) s = x[1].toUpperCase() === "C" ? 1 : -1;
        else if (/^\s?-/.test(dep)) s = -1;
        else if (/(^|\s)-\s?(R\$\s?)?$|\($/.test(ant)) s = -1;
        else if (/\+\s?(R\$\s?)?$/.test(ant)) s = 1;
        out.push({ v: parseFloat(m[1].replace(/\./g, "") + "." + m[2]), s });
    }
    return out;
}

const limpa = s => s.replace(/(\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)(\s?[CD](?![A-Za-z]))?/gi, " ")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\*{3}\.?\d{3}\.?\d{3}-?\*{2}|\b\d{14}\b/g, "•••") // mascara CPF/CNPJ
    .replace(/^[\s\-–—~=]*\d{1,2}:\d{2}(:\d{2})?\s*/, "").replace(/^\s*\d{4,}\s+/, "").replace(/\s+/g, " ").trim().slice(0, 120);

const SG_D = /CARTAO (DE )?CREDITO|COMPRA|SAQUE|ENVIAD|PAGAMENTO|PAGTO|PAG BOL|BOLETO|TARIFA|FATURA|\bIOF\b|\bDEB\b|DEBITO|\bENVIO/;
const SG_C = /RECEBID|RECEBIMENTO|CREDITO|CORRECAO|DEPOSITO|\bDP\b|ESTORNO|RESGATE|RENDIMENT|SALARIO|PROVENTO|DEVOLU/;
const sgDesc = n => /ESTORNO|DEVOLU|RECEBID/.test(n) ? 1 : SG_D.test(n) ? -1 : SG_C.test(n) ? 1 : 0;

function direcao(r) { // [+1 entrada | -1 saída, incerto?]
    if (r.s) return [r.s, r.flag === "incerto"];
    const d = sgDesc(NORM(r.desc));
    return d ? [d, false] : [-1, true];
}

// Tolerante a layout: cada data no início de linha abre um lançamento; valores podem estar na mesma linha ou nas seguintes
function parseLinhas(L) {
    const c = L.some(l => /SALDO ?(DIA|ANTERIOR)/i.test(NORM(l))) ? parseCaixa(L) : null;
    if (c && c.rows.length >= 3) return c;
    const rows = [], saldoDia = {}; let ini = null, cur = null;
    const sv = x => x.v * (x.s || 1);
    const fecha = () => {
        if (!cur) return; const c = cur; cur = null;
        const ms = moedas(c.txt); if (!ms.length) return;
        const desc = limpa(c.txt), n = NORM(desc);
        if (/^SALDO (ANTERIOR|INICIAL)/.test(n)) { ini = sv(ms[ms.length - 1]); return; }
        if (/^SALDO\b/.test(n)) { saldoDia[c.data] = sv(ms[ms.length - 1]); return; }
        const val = ms.length > 1 ? (ms.slice(0, -1).find(x => x.v) || ms[0]) : ms[0];
        rows.push({ data: c.data, desc, v: val.v, s: val.s, saldo: ms.length > 1 ? sv(ms[ms.length - 1]) : null });
    };
    for (const ln of L) {
        const m = ln.match(/^\s*(\d{2})[\/.](\d{2})[\/.](\d{4}|\d{2})\b\s*(.*)$/);
        const n = NORM(ln);
        if (m) { fecha(); cur = { data: `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2]}-${m[1]}`, txt: m[4], n: 0 }; }
        else if (/^SALDO (ANTERIOR|INICIAL)/.test(n)) { fecha(); const ms = moedas(ln); if (ms.length) ini = sv(ms[ms.length - 1]); }
        else if (cur && !/PERIODO|PAGINA|SAC |OUVIDORIA|0800|WWW\.|CAIXA ECON|EXTRATO|EMITIDO/.test(n)) {
            const hm = moedas(ln).length;
            if (hm ? !moedas(cur.txt).length : (cur.n < 2 && ln.length < 70)) { cur.txt += " " + ln; if (!hm) cur.n++; }
        }
    }
    fecha();
    const ult = Object.keys(saldoDia).sort().pop();
    return { rows, ini, fim: ult ? saldoDia[ult] : null, saldoDia };
}

// ---------- Extrato com coluna de saldo (Caixa): leitura tolerante a OCR + conferência pela cadeia de saldos ----------
// Cada linha traz "valor" e "saldo após". O OCR erra muito (C/D viram 6/0/¢, vírgula some, ano vira 2028...),
// então o saldo é usado como prova: saldo_anterior ± valor tem que ser igual ao saldo da linha.
const r2 = x => Math.round(x * 100) / 100;
const trimD = D => D.length > 3 ? D.slice(0, -1) : D;
const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length]; };

function candNum(tok) { // valores possíveis de um número lido por OCR (o mais provável primeiro)
    const t = String(tok).replace(/[^\d.,]/g, "").replace(/[.,]+$/, ""), D = t.replace(/\D/g, "");
    if (D.length < 2) return [];
    const c = n => r2(parseInt(n, 10) / 100);
    let r;
    if (/[.,]\d{2}$/.test(t)) r = [c(D)];                       // 1.773,71
    else if (/[.,]\d{3}$/.test(t)) r = [c(trimD(D)), c(D)];      // 2,336 -> o "C" virou 6
    else r = [c(D), c(trimD(D))];                                // vírgula perdida: 144 -> 1,44
    return [...new Set(r)];
}

const HIST = /^[^A-Za-z]*(PIX ?(?:ENVIAD\w*|RECEBID\w*)|COMPRA CARTAO \w+|DEB RECARGA PREPAGO IBC|SAQUE DIN \w+|CREDITO JUROS|CORRECAO MONETARIA|SALDO ?DIA)\.?/i;
const ehValor = t => /^[^\d,]*\d{1,3}(?:\.\d{3})*,\d{2,3}\D{0,2}$/.test(t) || /^[^\d.,\/*]*\d{2,}[^\d.,\/*]{0,2}$/.test(t);
const ehSaldo = t => (t.match(/\d/g) || []).length >= 3;

function lerLinhaCaixa(ln) {
    const m = ln.match(/^\s*[^\dA-Za-z]*(\d{2})\s?[\/.]?\s?(\d{2})\s?[\/.]\s?(\d{4})(?!\d)\s*(.*)$/);
    if (!m) return null;
    const dia = +m[1], mes = +m[2]; if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    let rest = m[4].replace(/^\s*[-–—~=]*\s*\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*/, "").replace(/^\s*\d{5,7}\s+/, "");
    const tk = rest.split(/\s+/).filter(Boolean);
    let iS = -1; for (let i = tk.length - 1; i >= 0; i--) if (ehSaldo(tk[i])) { iS = i; break; }
    let iV = -1; if (iS > 0) for (let i = iS - 1; i >= 0; i--) if (/\d/.test(tk[i])) { if (ehValor(tk[i])) iV = i; break; }
    const hm = rest.match(HIST), hist = hm ? hm[1].toUpperCase().replace(/^PIX ?/, "PIX ").replace(/\s+/g, " ") : "";
    const fimTxt = iV >= 0 ? iV : iS >= 0 ? iS : tk.length;
    let fav = hm ? rest.slice(hm[0].length) : rest;
    fav = fav.trim().split(/\s+/).slice(0, Math.max(0, fimTxt - (hm ? hm[0].trim().split(/\s+/).length : 0))).filter(w => /^\*?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ.'’*-]*$/.test(w)).join(" ");
    const histTxt = hist || tk.slice(0, fimTxt).filter(w => /[A-Za-zÀ-ÿ]/.test(w)).join(" ");
    const x = { dia, mes, ano: +m[3], hist: histTxt, fav, sd: /SALDO ?D/i.test(histTxt) || /SALDO ?D/i.test(rest), vc: [], sc: [], solo: false, sufixo: 0 };
    if (iS >= 0 && iV >= 0) { x.vc = candNum(tk[iV]); x.sc = candNum(tk[iS]); }
    else if (iS >= 0) { x.vc = candNum(tk[iS]); x.solo = true; }
    if (iV >= 0) {
        const suf = tk[iV].replace(/^[^\d]*[\d.,]+/, "") + " " + tk.slice(iV + 1, iS).join(" ");
        x.sufixo = /[Dd]/.test(suf) ? -1 : /[Cc¢]/.test(suf) ? 1 : 0;
    }
    const n = NORM(histTxt);
    x.sg = x.sd ? 1 : (sgDesc(n) || x.sufixo);
    return x;
}

function parseCaixa(L) {
    let ini = null; const it = [];
    for (const ln of L) {
        if (/^[^A-Z0-9]*SALDO (ANTERIOR|INICIAL)/.test(NORM(ln))) {
            const nums = ln.match(/\d[\d.,]*/g) || [], c = nums.length ? candNum(nums[nums.length - 1]) : [];
            if (c.length) ini = c[0]; continue;
        }
        const x = lerLinhaCaixa(ln); if (x) it.push(x);
    }
    if (it.length < 3) return null;

    // ano: o OCR às vezes lê 2025 como 2028; corrige pelo ano dos vizinhos
    const anos = it.map(x => x.ano), freq = {}; anos.forEach(a => freq[a] = (freq[a] || 0) + 1);
    const moda = +Object.keys(freq).sort((a, b) => freq[b] - freq[a])[0], ok = a => Math.abs(a - moda) <= 1;
    const dia0 = (y, m, d) => Date.UTC(y, m - 1, d) / 864e5;
    it.forEach((x, i) => {
        if (ok(x.ano)) return;
        const viz = [it[i - 1], it[i + 1], it[i - 2], it[i + 2]].filter(y => y && ok(y.ano)).slice(0, 2);
        const cand = [moda - 1, moda].map(y => ({ y, d: viz.reduce((a, v) => a + Math.abs(dia0(y, x.mes, x.dia) - dia0(v.ano, v.mes, v.dia)), 0) }));
        x.ano = cand.sort((a, b) => a.d - b.d)[0].y;
    });
    it.forEach(x => { x.data = `${x.ano}-${String(x.mes).padStart(2, "0")}-${String(x.dia).padStart(2, "0")}`; });

    // o extrato vem do mais novo para o mais antigo: processa do mais antigo para o mais novo
    const seq = (it[0].data >= it[it.length - 1].data ? it.slice().reverse() : it.slice());
    seq.forEach(x => { if (x.solo && x.sd) { x.solo = false; x.sc = x.vc; x.vc = []; } });
    const opcoes = x => x.sd ? [{ v: 0, s: 1 }] : (x.sg ? [x.sg] : [-1, 1]).flatMap(s => x.vc.map(v => ({ v, s })));
    if (ini == null) { const p = seq.find(x => !x.sd && x.sc.length && x.vc.length && x.sg); if (p) ini = r2(p.sc[0] - p.sg * p.vc[0]); }
    if (ini == null) return null;

    let run = ini; const out = [], st = { corr: 0, ins: 0, nver: 0, perd: 0 };
    const add = (x, o, saldo, flag) => { if (x.sd) return; out.push({ data: x.data, desc: x.hist + (x.fav ? " · " + x.fav : ""), v: o.v, s: o.s, saldo, flag: flag || null }); };
    for (let k = 0; k < seq.length; k++) {
        const x = seq[k], antes = run;
        if (x.solo && !x.sd) { x.solo = false; const sh = x.vc.filter(S => Math.abs(S - antes) < .35 * Math.abs(antes) + .01); if (sh.length) { x.sc = sh; x.vc = []; } }
        const op = opcoes(x),  hit = (S, o) => Math.abs(r2(antes + o.s * o.v) - S) < .006;
        const pick = x.sc.length ? op.find(o => x.sc.some(S => hit(S, o))) : null;
        if (pick) { run = r2(antes + pick.s * pick.v); add(x, pick, run); continue; }          // bate com o saldo do extrato
        if (!x.sc.length) {                                                                    // sem saldo para provar
            if (!op.length) { if (!x.sd) st.perd++; continue; }
            run = r2(antes + op[0].s * op[0].v); add(x, op[0], null, x.sg ? null : "incerto"); st.nver++; continue;
        }
        const def = op[0];
        if (def) { // o saldo desta linha pode ser só um erro de OCR: confirma olhando o próximo saldo legível
            let r = r2(antes + def.s * def.v), conf = false;
            for (let j = k + 1; j < seq.length; j++) {
                const y = seq[j], oy = opcoes(y)[0]; if (oy) r = r2(r + oy.s * oy.v);
                if (y.sc.length) { conf = y.sc.some(S => Math.abs(S - r) < .006); break; }
            }
            if (conf) { run = r2(antes + def.s * def.v); add(x, def, null); st.nver++; continue; }
        }
        if (x.sd) { // saldo do dia não fecha: faltou lançamento(s) no OCR
            const S = x.sc.slice().sort((a, b) => Math.abs(a - antes) - Math.abs(b - antes))[0], d = r2(S - antes);
            if (Math.abs(d) >= .005) { add({ data: x.data, hist: "LANÇAMENTO NÃO LIDO PELO OCR", fav: "" }, { v: Math.abs(d), s: d > 0 ? 1 : -1 }, null, "inserido"); st.ins++; }
            run = S; continue;
        }
        // o valor lido está errado (ou faltou uma linha): usa o saldo como prova
        const S = x.sc.slice().sort((a, b) => Math.abs(Math.abs(a - antes) - (def ? def.v : 0)) - Math.abs(Math.abs(b - antes) - (def ? def.v : 0)))[0], t = r2(S - antes);
        if (Math.abs(t) < .005) { run = S; st.perd++; continue; }
        const nv = { v: Math.abs(t), s: t > 0 ? 1 : -1 };
        if (def && lev(String(Math.round(def.v * 100)), String(Math.round(nv.v * 100))) > 1) { // valores sem parentesco: faltou uma linha inteira no OCR
            const d = r2(S - (antes + def.s * def.v));
            if (Math.abs(d) >= .005) { add({ data: x.data, hist: "LANÇAMENTO NÃO LIDO PELO OCR", fav: "" }, { v: Math.abs(d), s: d > 0 ? 1 : -1 }, null, "inserido"); st.ins++; }
            run = S; add(x, def, S); continue;
        }
        run = S; add(x, nv, S, "corrigido"); st.corr++;                                        // valor/sinal lido errado: vale o saldo
    }
    const ult = seq.slice().reverse().find(x => x.sc.length), fim = ult ? ult.sc.slice().sort((a, b) => Math.abs(a - run) - Math.abs(b - run))[0] : null;
    return { rows: out, ini, fim, saldoDia: {}, st };
}

function parseOFX(t) {
    const rows = [];
    (t.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi) || []).forEach(b => {
        const g = k => ((b.match(new RegExp("<" + k + ">([^<\\r\\n]*)", "i")) || [])[1] || "").trim();
        const d = g("DTPOSTED"), a = parseFloat(g("TRNAMT").replace(",", "."));
        if (d.length >= 8 && !isNaN(a)) rows.push({ data: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, desc: limpa(g("MEMO") || g("NAME")), v: Math.abs(a), s: a < 0 ? -1 : 1, saldo: null });
    });
    const lb = t.match(/<LEDGERBAL>[\s\S]*?<BALAMT>([-\d.,]+)/i);
    return { rows, ini: null, fim: lb ? parseFloat(lb[1].replace(",", ".")) : null, saldoDia: {} };
}

function numBR(s) {
    const x = String(s || "").replace(/R\$|\s/g, ""); if (!x) return null;
    const neg = /^-|-$|^\(|D$/i.test(x), c = x.replace(/[^\d,.]/g, "");
    const v = /,\d{1,2}$/.test(c) ? parseFloat(c.replace(/\./g, "").replace(",", ".")) : parseFloat(c.replace(/,/g, ""));
    return isNaN(v) ? null : (neg ? -v : v);
}

function parseCSV(t) {
    const ls = t.split(/\r?\n/).filter(l => l.trim()), first = ls[0] || "";
    const sep = [";", "\t", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];
    const T = ls.map(l => l.split(sep).map(c => c.replace(/^"|"$/g, "").trim()));
    const hi = T.findIndex(r => r.some(c => /^DATA/.test(NORM(c)))), H = hi >= 0 ? T[hi].map(NORM) : [];
    const ix = re => H.findIndex(h => re.test(h));
    const iD = ix(/^DATA/), iH = ix(/HIST|DESC|LANC/), iV = ix(/^VALOR/), iC = ix(/CREDIT/), iB = ix(/DEBIT/), iT = ix(/TIPO|D\/C|NATUREZA/);
    if (hi < 0 || iD < 0 || (iV < 0 && iC < 0)) return parseLinhas(T.map(r => r.join(" "))); // sem cabeçalho: tenta como texto
    const rows = [];
    T.slice(hi + 1).forEach(r => {
        const dm = (r[iD] || "").match(/(\d{2})\/(\d{2})\/(\d{4})|(\d{4})-(\d{2})-(\d{2})/); if (!dm) return;
        const data = dm[1] ? `${dm[3]}-${dm[2]}-${dm[1]}` : dm[0];
        let v = iV >= 0 ? numBR(r[iV]) : (numBR(r[iC]) || 0) - Math.abs(numBR(r[iB]) || 0);
        if (v == null || v === 0) return;
        const tp = iT >= 0 ? NORM(r[iT]) : "";
        let s = v < 0 ? -1 : 0;
        if (/^D|DEB|SAI/.test(tp)) s = -1; else if (/^C|CRED|ENTR/.test(tp)) s = 1;
        if (!s && iV >= 0 && !/-/.test(r[iV]) && !tp) s = 0; // sem sinal: decide por palavras
        rows.push({ data, desc: limpa(r[iH] || ""), v: Math.abs(v), s: s || (iC >= 0 && v > 0 ? 1 : 0), saldo: null });
    });
    return { rows, ini: null, fim: null, saldoDia: {} };
}

// ---------- PDF (pdf.js carregado só quando necessário) ----------
function carregaPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return new Promise((ok, no) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; ok(); };
        s.onerror = () => no(new Error("Não foi possível carregar o leitor de PDF (verifique a internet)."));
        document.head.appendChild(s);
    });
}

async function linhasPDF(buf) {
    await carregaPdfJs();
    const task = pdfjsLib.getDocument({ data: buf });
    task.onPassword = cb => cb(prompt("O PDF tem senha. Digite:") || "");
    const pdf = await task.promise, out = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const tc = await (await pdf.getPage(p)).getTextContent();
        const it = tc.items.filter(i => i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5] })).sort((a, b) => b.y - a.y || a.x - b.x);
        let cur = null; const ls = [];
        for (const t of it) { if (cur && Math.abs(cur.y - t.y) <= 3) cur.t.push(t); else { cur = { y: t.y, t: [t] }; ls.push(cur); } }
        ls.forEach(l => out.push(l.t.sort((a, b) => a.x - b.x).map(t => t.s).join(" ").replace(/\s+/g, " ").trim()));
    }
    if (!out.length) return ocrPDF(pdf); // PDF em imagem: lê por OCR
    return out;
}

// OCR (tesseract.js, só carregado se o PDF não tiver texto)
function carregaScript(src) {
    return new Promise((ok, no) => {
        const s = document.createElement("script"); s.src = src; s.onload = ok;
        s.onerror = () => no(new Error("Não foi possível carregar " + src.split("/")[4] + " (verifique a internet)."));
        document.head.appendChild(s);
    });
}

async function ocrPDF(pdf) {
    const box = $("bx-prev"), out = [];
    out.ocr = true;
    box.innerHTML = "PDF em imagem: carregando leitor de texto (OCR)…";
    await carregaScript("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
    const worker = await Tesseract.createWorker("por");
    try {
        await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
        for (let p = 1; p <= pdf.numPages; p++) {
            box.innerHTML = `Lendo página ${p} de ${pdf.numPages} por OCR… (pode levar alguns segundos por página)`;
            const page = await pdf.getPage(p), vp = page.getViewport({ scale: 2.5 });
            const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
            const ctx = c.getContext("2d", { willReadFrequently: true });
            ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data; let soma = 0;
            for (let i = 0; i < d.length; i += 16) soma += d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11;
            if (soma / (d.length / 16) < 110) { // fundo escuro: inverte para texto escuro em fundo claro
                for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
                ctx.putImageData(im, 0, 0);
            }
            const { data } = await worker.recognize(c);
            data.text.split("\n").forEach(l => { l = l.replace(/\s+/g, " ").trim(); if (l) out.push(l); });
        }
    } finally { await worker.terminate(); }
    return out;
}

// ---------- Importação ----------
async function lerArquivo(file) {
    const buf = await file.arrayBuffer(), nome = file.name.toLowerCase();
    const texto = () => { try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { return new TextDecoder("windows-1252").decode(buf); } };
    if (nome.endsWith(".pdf") || file.type === "application/pdf") {
        const L = await linhasPDF(buf);
        if (!L.length) throw new Error("Não consegui ler texto nem por OCR. Exporte em CSV/OFX ou gere outro PDF.");
        return { p: parseLinhas(L), formato: "pdf", ocr: !!L.ocr };
    }
    const t = texto();
    if (/<OFX>|<STMTTRN>/i.test(t)) return { p: parseOFX(t), formato: "ofx" };
    return { p: parseCSV(t), formato: "csv" };
}

function montar(p, arquivo, formato, ocr) {
    const occ = {}, chaves = new Set(EXT.map(x => x.chave_unica)), soft = {};
    EXT.forEach(x => { if (x.formato !== formato) { const k = x.data_movimento + "|" + Math.round(x.valor * 100); soft[k] = (soft[k] || 0) + 1; } });
    const tx = p.rows.filter(r => r.v > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.data)).map(r => {
        const [d, incerto] = direcao(r), tipo = d > 0 ? "entrada" : "saida", dn = NORM(r.desc);
        const base = `${r.data}|${tipo[0]}${Math.round(r.v * 100)}` + (ocr ? "" : `|${hash(dn)}`); // OCR muda a grafia a cada leitura: a chave não usa o texto occ[base] = (occ[base] || 0) + 1;
        const chave = `${base}|${occ[base]}`;
        return { chave_unica: chave, data_movimento: r.data, descricao: r.desc || "(sem descrição)", valor: r.v, tipo, categoria: categorizar(dn, tipo), contraparte: contraparte(dn), saldo_apos: r.saldo, formato, arquivo_origem: arquivo, incerto, ajuste: r.flag === "corrigido" || r.flag === "inserido" ? r.flag : null, dup: chaves.has(chave) };
    });
    const ultimo = {}; tx.forEach(t => (ultimo[t.data_movimento] = t));
    if (p.st) tx.forEach(t => { if (ultimo[t.data_movimento] !== t) t.saldo_apos = null; }); // saldo só no último lançamento do dia (usado no KPI de saldo)
    Object.entries(p.saldoDia || {}).forEach(([d, s]) => { if (ultimo[d] && ultimo[d].saldo_apos == null) ultimo[d].saldo_apos = s; });
    tx.forEach(t => { if (!t.dup) { const k = t.data_movimento + "|" + Math.round(t.valor * 100); if (soft[k] > 0) { soft[k]--; t.prov = true; } } });
    return tx;
}

async function importar(file) {
    if (!file) return;
    if (!EXT) return toast("Crie a tabela extrato_bancario no Supabase primeiro", true);
    const box = $("bx-prev"); box.hidden = false; box.innerHTML = "Lendo arquivo…";
    try {
        const { p, formato, ocr } = await lerArquivo(file);
        const tx = montar(p, file.name, formato, ocr);
        if (!tx.length) throw new Error("Nenhum lançamento reconhecido. Se for PDF, me envie um exemplo sem dados pessoais para ajustar a leitura.");
        PREV = { tx };
        const ent = SOMA(tx.filter(t => t.tipo === "entrada"), t => t.valor), sai = SOMA(tx.filter(t => t.tipo === "saida"), t => t.valor);
        const datas = tx.map(t => t.data_movimento).sort(), nv = tx.filter(t => !t.dup && !t.prov).length;
        const ajs = tx.filter(t => t.ajuste), dup = tx.filter(t => t.dup).length, prov = tx.filter(t => t.prov).length, inc = tx.filter(t => t.incerto).length;
        let conf = "Sem saldos no arquivo para conferir.";
        if (p.ini != null && p.fim != null) {
            const dif = p.ini + ent - sai - p.fim;
            conf = Math.abs(dif) < 0.015 ? "✅ Conferência: bate com os saldos do extrato." : `⚠️ Diferença de ${R$(dif)} em relação ao saldo final — alguma linha pode ter sinal errado ou faltar.`;
        }
        box.innerHTML = `
            <div class="analytics-label">Pré-visualização · ${esc(file.name)}</div>
            <div class="bx-prev-grid">
                <div><small>Período</small><b>${fmtData(datas[0])} → ${fmtData(datas[datas.length - 1])}</b></div>
                <div><small>Lançamentos</small><b>${tx.length}</b></div>
                <div><small>Entradas</small><b style="color:var(--success)">${R$(ent)}</b></div>
                <div><small>Saídas</small><b style="color:var(--danger)">${R$(sai)}</b></div>
                <div><small>Novos</small><b>${nv}</b></div>
                <div><small>Já importados</small><b>${dup}</b></div>
            </div>
            <p class="bx-nota">${conf}${inc ? ` · ${inc} linha(s) com sinal deduzido pela descrição.` : ""}${ocr ? " · ℹ️ PDF em imagem lido por OCR; cada valor foi conferido pela coluna de saldo do extrato." : ""}</p>
            ${ajs.length ? `<details class="bx-nota" open><summary>✏️ ${ajs.length} lançamento(s) ajustado(s) pelo saldo — confira:</summary>${ajs.map(t => `<div>${fmtData(t.data_movimento)} · ${esc(t.descricao)} · ${t.tipo === "entrada" ? "+" : "−"}${R$(t.valor)}</div>`).join("")}</details>` : ""}
            ${prov ? `<label class="bx-chk"><input type="checkbox" id="bx-soft" checked> Ignorar ${prov} provável(is) duplicata(s) (mesmo dia e valor já existentes, vindos de outro formato)</label>` : ""}
            <div class="bx-acoes"><button class="btn-salvar" type="button" onclick="salvarImport()" ${nv + (prov ? 0 : 0) ? "" : "disabled"}>Salvar ${nv} novo(s)</button><button class="bx-sec" type="button" onclick="cancelarImport()">Cancelar</button></div>`;
    } catch (e) {
        console.error(e); PREV = null; box.innerHTML = `<b style="color:var(--danger)">Não consegui ler:</b> ${esc(e.message)}`;
    }
}

function cancelarImport() { PREV = null; $("bx-prev").hidden = true; $("bx-file").value = ""; }

async function salvarImport() {
    if (!PREV) return;
    const ignora = $("bx-soft") ? $("bx-soft").checked : false, lote = Date.now().toString(36);
    const rows = PREV.tx.filter(t => !t.dup && !(t.prov && ignora)).map(t => ({
        chave_unica: t.chave_unica, data_movimento: t.data_movimento, descricao: t.descricao, valor: t.valor, tipo: t.tipo, categoria: t.categoria,
        contraparte: t.contraparte, saldo_apos: t.saldo_apos, formato: t.formato, arquivo_origem: t.arquivo_origem, lote_id: lote
    }));
    const ultimaData = rows.map(r => r.data_movimento).sort().pop();
    let ins = 0;
    try {
        for (let i = 0; i < rows.length; i += 500) {
            const { data, error } = await supabaseClient.from("extrato_bancario")
                .upsert(rows.slice(i, i + 500), { onConflict: "chave_unica", ignoreDuplicates: true }).select("chave_unica");
            if (error) throw error;
            ins += data.length;
        }
        cancelarImport();
        if (ultimaData) setMes(ultimaData.slice(0, 7), false);
        await carregarBanco(true);
        toast(`${ins} lançamento(s) importado(s)`);
    } catch (e) { console.error(e); toast("Falha ao salvar: " + e.message, true); }
}

// ---------- Carga ----------
async function carregarBanco(forcar) {
    if (EXT && !forcar) return renderBanco();
    try {
        const out = [];
        for (let i = 0; ; i += 1000) {
            const { data, error } = await supabaseClient.from("extrato_bancario").select("*").order("data_movimento", { ascending: false }).range(i, i + 999);
            if (error) throw error;
            out.push(...data); if (data.length < 1000) break;
        }
        EXT = out;
    } catch (e) { console.warn("extrato_bancario:", e.message); EXT = null; }
    renderBanco();
}

// ---------- Análise ----------
const agrupa = (l, f) => { const r = {}; l.forEach(x => { const k = f(x); r[k] = (r[k] || 0) + (+x.valor); }); return r; };
const ranking = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
const mesAnt = m => { const [y, mm] = m.split("-").map(Number); const d = new Date(y, mm - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const kpi = (t, v, d, cor) => `<div class="card"><div class="card-header-flex"><div class="card-titulo">${t}</div></div><div class="card-valor" style="color:${cor}">${v}</div><div class="card-detalhe">${d}</div></div>`;

function alertas(mes, E, sai, tE, tS, fat) {
    const A = [], cats = ranking(agrupa(sai, x => x.categoria));
    if (!E.length) return ["Nenhum lançamento da conta neste mês. Importe o extrato para ver o diagnóstico."];
    A.push(tS > tE ? `🔴 As saídas (${R$(tS)}) superaram as entradas (${R$(tE)}): o saldo caiu ${R$(tS - tE)} no mês.` : `🟢 Entrou ${R$(tE)} e saiu ${R$(tS)}: sobraram ${R$(tE - tS)} no mês.`);
    if (cats[0]) A.push(`💸 Maior ralo: <b>${esc(cats[0][0])}</b> — ${R$(cats[0][1])} (${(cats[0][1] / tS * 100).toFixed(0)}% das saídas).`);
    const ct = ranking(agrupa(sai, x => x.contraparte)).filter(c => c[0] !== "SEM IDENTIFICACAO")[0];
    if (ct) A.push(`👤 Maior destino individual: <b>${esc(ct[0])}</b> — ${R$(ct[1])} em ${sai.filter(x => x.contraparte === ct[0]).length} saída(s).`);
    const peq = sai.filter(x => +x.valor < 30);
    if (peq.length >= 15) A.push(`🪙 ${peq.length} saídas abaixo de R$ 30 somam ${R$(SOMA(peq, x => +x.valor))} — pequenos gastos frequentes.`);
    const ant = EXT.filter(x => x.tipo === "saida" && x.data_movimento.startsWith(mesAnt(mes))), ca = agrupa(ant, x => x.categoria);
    if (ant.length) { const s = cats.map(([c, v]) => [c, v - (ca[c] || 0), ca[c] || 0]).filter(x => x[1] > 100 && (!x[2] || x[1] / x[2] > .3)).sort((a, b) => b[1] - a[1])[0]; if (s) A.push(`📈 Maior aumento vs. mês anterior: <b>${esc(s[0])}</b> (+${R$(s[1])}).`); }
    const rec = {}; EXT.filter(x => x.tipo === "saida" && x.data_movimento.slice(0, 7) >= mesAnt(mesAnt(mes))).forEach(x => { (rec[x.contraparte] = rec[x.contraparte] || []).push(x); });
    Object.entries(rec).filter(([k, l]) => k !== "SEM IDENTIFICACAO" && new Set(l.map(x => x.data_movimento.slice(0, 7))).size >= 2 && Math.max(...l.map(x => +x.valor)) / Math.min(...l.map(x => +x.valor)) < 1.15)
        .slice(0, 3).forEach(([k, l]) => A.push(`🔁 Possível recorrência: <b>${esc(k)}</b> (~${R$(l[0].valor)} por mês).`));
    A.push(`📊 Faturado nos projetos: ${R$(fat)} · entrou na conta: ${R$(tE)}${fat ? ` (${(tE / fat * 100).toFixed(0)}%)` : ""}. Plataformas pagam com atraso — veja o acumulado em “Projetos × conta”.`);
    return A;
}

function renderBanco() {
    const erro = $("bx-erro"); if (!erro) return;
    if (!EXT) { erro.hidden = false; erro.innerHTML = `<b>Tabela <code>extrato_bancario</code> não encontrada.</b> Rode o arquivo <code>extrato_bancario.sql</code> no SQL Editor do Supabase e recarregue a página.`; return; }
    erro.hidden = true;
    const mes = $("filtro-mes").value, E = EXT.filter(x => x.data_movimento.startsWith(mes));
    const ent = E.filter(x => x.tipo === "entrada"), sai = E.filter(x => x.tipo === "saida");
    const tE = SOMA(ent, x => +x.valor), tS = SOMA(sai, x => +x.valor);
    const fat = SOMA(TODOS.filter(i => (i.data_lancamento || "").startsWith(mes)), i => num(i.receita));
    const sd = E.filter(x => x.saldo_apos != null).sort((a, b) => (a.data_movimento < b.data_movimento ? 1 : -1))[0];

    setHtml("bx-kpis", kpi("Entrou na conta", R$(tE), `${ent.length} entradas`, "var(--success)") + kpi("Saiu da conta", R$(tS), `${sai.length} saídas`, "var(--danger)") +
        kpi("Resultado do mês", R$(tE - tS), `Faturado nos projetos: ${R$(fat)}`, tE - tS >= 0 ? "var(--primary)" : "var(--danger)") +
        kpi("Saldo ao fim do período", sd ? R$(sd.saldo_apos) : "---", sd ? `em ${fmtData(sd.data_movimento)}` : "Sem saldo no extrato", "var(--cyan)"));
    setHtml("bx-alertas", alertas(mes, E, sai, tE, tS, fat).map(a => `<p class="bx-alerta">${a}</p>`).join(""));

    const cats = ranking(agrupa(sai, x => x.categoria));
    setHtml("bx-cats", cats.length ? cats.map(([c, v]) => `<div class="bx-cat"><div><b>${esc(c)}</b><span>${R$(v)}</span></div><div class="m-bar"><i style="width:${(v / tS * 100).toFixed(1)}%;background:var(--danger)"></i></div><small>${(v / tS * 100).toFixed(1)}% das saídas</small></div>`).join("") : `<div class="bx-vazio">Sem saídas no período.</div>`);

    const fm = {}; const g = m => (fm[m] = fm[m] || { f: 0, e: 0, s: 0 });
    TODOS.forEach(i => { if (i.data_lancamento) g(i.data_lancamento.slice(0, 7)).f += num(i.receita); });
    EXT.forEach(x => { g(x.data_movimento.slice(0, 7))[x.tipo === "entrada" ? "e" : "s"] += +x.valor; });
    const ms = Object.keys(fm).filter(m => fm[m].e || fm[m].s).sort().reverse().slice(0, 12), acc = { f: 0, e: 0, s: 0 };
    ms.forEach(m => { acc.f += fm[m].f; acc.e += fm[m].e; acc.s += fm[m].s; });
    const lin = (n, o, b) => `<tr${b ? ' style="font-weight:800"' : ""}><td>${n}</td><td>${R$(o.f)}</td><td style="color:var(--success)">${R$(o.e)}</td><td style="color:var(--danger)">${R$(o.s)}</td><td>${R$(o.e - o.s)}</td><td>${o.f ? (o.e / o.f * 100).toFixed(0) + "%" : "---"}</td></tr>`;
    setHtml("bx-cruz", ms.length ? ms.map(m => lin(m.split("-").reverse().join("/"), fm[m])).join("") + lin("Acumulado", acc, true) : `<tr><td colspan="6" class="bx-vazio">Importe um extrato para cruzar com o faturamento.</td></tr>`);

    listar();
    if ($("view-banco").offsetParent !== null) graficosBanco(mes, ent, sai, cats);
}

function listar() {
    if (!EXT) return;
    const mes = $("filtro-mes").value, q = NORM($("bx-q").value), t = $("bx-t").value;
    const L = EXT.filter(x => x.data_movimento.startsWith(mes) && (!t || x.tipo === t) && (!q || NORM(x.descricao + " " + x.categoria).includes(q)));
    setHtml("bx-lista", L.length ? L.slice(0, 200).map(x => `<div class="m-item" style="--cor:${x.tipo === "entrada" ? "var(--success)" : "var(--danger)"}"><div class="m-dot"></div><div class="m-item-main"><b>${esc(x.descricao)}</b><small>${fmtData(x.data_movimento)} · ${esc(x.categoria)}</small></div><div class="m-item-val" style="color:${x.tipo === "entrada" ? "var(--success)" : "var(--danger)"}">${x.tipo === "entrada" ? "+" : "−"}${R$(x.valor)}</div></div>`).join("") + (L.length > 200 ? `<div class="bx-vazio">Mostrando 200 de ${L.length}. Use a busca.</div>` : "") : `<div class="bx-vazio">Nenhum lançamento.</div>`);
}

function graficosBanco(mes, ent, sai, cats) {
    if (typeof Chart === "undefined") return;
    const [ano, mm] = mes.split("-"), n = new Date(ano, mm, 0).getDate(), dias = [...Array(n)].map((_, i) => `${ano}-${mm}-${String(i + 1).padStart(2, "0")}`);
    const por = (l, d) => SOMA(l.filter(x => x.data_movimento === d), x => +x.valor);
    let acc = 0; const e = dias.map(d => por(ent, d)), s = dias.map(d => por(sai, d)), sa = dias.map((_, i) => (acc += e[i] - s[i]));
    const tk = { color: "#8a99ad" }, mobile = mq.matches;
    if (gFluxo) gFluxo.destroy(); if (gCat) gCat.destroy();
    gFluxo = new Chart($("bxFluxo"), {
        type: "bar",
        data: { labels: dias.map(d => d.slice(8)), datasets: [
            { type: "bar", label: "Entradas", data: e, backgroundColor: "#22c55e" }, { type: "bar", label: "Saídas", data: s, backgroundColor: "#ef4444" },
            { type: "line", label: "Resultado acumulado", data: sa, borderColor: "#f5b041", borderWidth: 2.5, pointRadius: 0, tension: .3 }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: "index" }, plugins: { legend: { labels: { color: "#8a99ad", usePointStyle: true } } },
            scales: { x: { ticks: { ...tk, maxTicksLimit: mobile ? 8 : 16 }, grid: { display: false } }, y: { ticks: { ...tk, maxTicksLimit: 6 }, grid: { color: "rgba(255,255,255,.04)" } } } }
    });
    gCat = new Chart($("bxCat"), {
        type: "doughnut",
        data: { labels: cats.slice(0, 8).map(c => c[0]), datasets: [{ data: cats.slice(0, 8).map(c => c[1]), borderWidth: 0, cutout: "70%", backgroundColor: ["#ef4444", "#f5b041", "#3498db", "#9b59b6", "#2dd4bf", "#e67e22", "#c084fc", "#64748b"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#8a99ad", padding: 10, usePointStyle: true } } } }
    });
}

// ---------- Troca de visão (Projetos / Conta) e eventos ----------
function setView(v) {
    document.body.dataset.view = v;
    document.querySelectorAll(".bx-seg button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
    const mb = $("m-modo"); if (mb) mb.textContent = v === "banco" ? "Projetos" : "Conta";
    window.scrollTo({ top: 0 });
    if (v === "banco") carregarBanco().catch(e => { console.error(e); toast("Erro na aba Conta: " + e.message, true); });
    else { graficoReceita && graficoReceita.resize(); graficoDistribuicao && graficoDistribuicao.resize(); }
}

document.addEventListener("DOMContentLoaded", () => {
    document.body.dataset.view = "projetos";
    document.querySelectorAll(".bx-seg button").forEach(b => b.addEventListener("click", () => setView(b.dataset.v)));
    if ($("m-modo")) $("m-modo").addEventListener("click", () => setView(document.body.dataset.view === "banco" ? "projetos" : "banco"));
    const f = $("bx-file"), z = $("bx-drop");
    $("bx-btn").addEventListener("click", () => f.click());
    f.addEventListener("change", () => importar(f.files[0]));
    ["dragover", "dragenter"].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add("over"); }));
    ["dragleave", "drop"].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove("over"); }));
    z.addEventListener("drop", e => importar(e.dataTransfer.files[0]));
    $("bx-q").addEventListener("input", listar); $("bx-t").addEventListener("change", listar);
});

console.log("banco.js v4 carregado");
