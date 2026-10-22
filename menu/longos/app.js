/**
 * Painel de Métricas YouTube — app.js
 * Usa a mesma conexão Supabase (tabela canais_youtube) do TradeWR Social.
 */

// ============================================================
// 1. CONFIGURAÇÃO
// ============================================================
const CONFIG = {
  SUPABASE_URL: 'https://abdliioyzkylccfylils.supabase.co',
  SUPABASE_KEY: 'sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n',

  // 👉 COLOQUE AQUI A SUA CHAVE DA YOUTUBE DATA API (opcional).
  // Com a chave preenchida o painel NÃO depende dos tokens OAuth (que expiram em 1h)
  // e lê as métricas públicas (views, likes, comentários, inscritos) de todos os canais.
  // Se deixar vazio, usa o google_access_token salvo no Supabase para cada canal.
  YT_API_KEY: '',

  MAX_VIDEOS_POR_CANAL: 150,     // 3 páginas de 50 (custa ~6 unidades de cota por canal)
  CACHE_MIN: 30,                 // minutos de cache no navegador
  SHORT_MAX_SEG: 180             // até 3 min = Short
};

let supabaseClient = null;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

// ============================================================
// 2. UTILIDADES
// ============================================================
const DIA = 86400000;
const DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const CORES = ['#4ea1ff', '#ff5c5c', '#3fb950', '#f2c94c', '#a78bfa', '#ff8c42', '#2dd4bf',
               '#f472b6', '#94a3b8', '#84cc16', '#38bdf8', '#fb7185'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'k';
  return String(Math.round(n));
}
const fmtFull = (n) => (n ?? 0).toLocaleString('pt-BR');
const fmtPct = (n, casas = 2) => (n === null || n === undefined || isNaN(n)) ? '—' : n.toFixed(casas).replace('.', ',') + '%';
const soma = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const media = (arr) => arr.length ? soma(arr) / arr.length : 0;
function mediana(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function fmtDur(seg) {
  const m = Math.floor(seg / 60), s = seg % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h${pad(m % 60)}`;
  return `${m}:${pad(s)}`;
}
function parseDur(iso) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}
function deltaHtml(pct) {
  if (pct === null || pct === undefined || !isFinite(pct)) return '<span style="color:var(--cinza)">—</span>';
  const cls = pct >= 0 ? 'up' : 'down';
  return `<span class="${cls}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1).replace('.', ',')}%</span>`;
}

// ============================================================
// 3. ESTADO
// ============================================================
const state = {
  canais: [],       // {id, nome, foto, cor, subs, views, nVideos, videos:[], erro, db}
  janela: 30,
  canalSel: null,
  charts: {},
  sessionToken: null
};

// ============================================================
// 4. ARMAZENAMENTO (cache de vídeos + snapshots de inscritos)
// ============================================================
const Store = {
  getCache(id) {
    try {
      const raw = sessionStorage.getItem('ytp_v_' + id);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (Date.now() - o.ts > CONFIG.CACHE_MIN * 60000) return null;
      return o;
    } catch { return null; }
  },
  setCache(id, videos, info) {
    try { sessionStorage.setItem('ytp_v_' + id, JSON.stringify({ ts: Date.now(), videos, info })); } catch { /* cheio */ }
  },
  clearCache() {
    Object.keys(sessionStorage).filter(k => k.startsWith('ytp_v_')).forEach(k => sessionStorage.removeItem(k));
  },
  // snapshots diários de inscritos/views para medir crescimento ao longo do tempo
  snapshots() {
    try { return JSON.parse(localStorage.getItem('ytp_snap_v1') || '{}'); } catch { return {}; }
  },
  salvarSnapshot(canais) {
    const s = this.snapshots();
    const hoje = dKey(new Date());
    canais.forEach(c => {
      if (c.erro || c.subs === null) return;
      s[c.id] = s[c.id] || {};
      s[c.id][hoje] = { subs: c.subs, views: c.views };
    });
    try { localStorage.setItem('ytp_snap_v1', JSON.stringify(s)); } catch { /* ignore */ }
  }
};

// ============================================================
// 5. ACESSO À API DO YOUTUBE
// ============================================================
async function ytGet(path, params, token) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers = {};
  if (CONFIG.YT_API_KEY) url.searchParams.set('key', CONFIG.YT_API_KEY);
  else headers.Authorization = 'Bearer ' + token;
  const r = await fetch(url, { headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error?.message || ('HTTP ' + r.status));
    e.status = r.status;
    throw e;
  }
  return j;
}

function tokensDoCanal(c) {
  const lista = [c.db.google_access_token, sessionStorage.getItem('yt_token'), state.sessionToken].filter(Boolean);
  return [...new Set(lista)];
}

// tenta cada token candidato até algum funcionar (ou usa a chave de API direto)
async function comAuth(c, fn) {
  if (CONFIG.YT_API_KEY) return fn(null);
  const tokens = tokensDoCanal(c);
  if (!tokens.length) { const e = new Error('Sem token para este canal'); e.status = 401; throw e; }
  let ultimo;
  for (const t of tokens) {
    try { return await fn(t); } catch (e) {
      ultimo = e;
      if (e.status !== 401 && e.status !== 403) throw e;
    }
  }
  throw ultimo;
}

async function buscarVideos(c) {
  const uploads = 'UU' + c.id.slice(2);
  const itens = [];
  let pageToken = '';
  const paginas = Math.ceil(CONFIG.MAX_VIDEOS_POR_CANAL / 50);
  for (let p = 0; p < paginas; p++) {
    const params = { part: 'contentDetails', playlistId: uploads, maxResults: 50 };
    if (pageToken) params.pageToken = pageToken;
    const j = await comAuth(c, (t) => ytGet('playlistItems', params, t));
    (j.items || []).forEach(i => itens.push(i.contentDetails.videoId));
    pageToken = j.nextPageToken;
    if (!pageToken) break;
  }
  const videos = [];
  for (let i = 0; i < itens.length; i += 50) {
    const ids = itens.slice(i, i + 50).join(',');
    const j = await comAuth(c, (t) => ytGet('videos', { part: 'snippet,statistics,contentDetails', id: ids, maxResults: 50 }, t));
    (j.items || []).forEach(v => {
      const dur = parseDur(v.contentDetails?.duration);
      videos.push({
        id: v.id,
        titulo: v.snippet.title,
        pub: v.snippet.publishedAt,
        thumb: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
        views: parseInt(v.statistics?.viewCount) || 0,
        likes: parseInt(v.statistics?.likeCount) || 0,
        comments: parseInt(v.statistics?.commentCount) || 0,
        dur
      });
    });
  }
  return videos;
}

async function buscarInfoCanal(c) {
  const j = await comAuth(c, (t) => ytGet('channels', { part: 'snippet,statistics', id: c.id }, t));
  const it = j.items?.[0];
  if (!it) return null;
  return {
    subs: it.statistics.hiddenSubscriberCount ? null : parseInt(it.statistics.subscriberCount),
    views: parseInt(it.statistics.viewCount) || 0,
    nVideos: parseInt(it.statistics.videoCount) || 0,
    foto: it.snippet.thumbnails?.default?.url
  };
}

function hidratarVideos(raw, c) {
  return raw.map(v => {
    const data = new Date(v.pub);
    return {
      ...v,
      canalId: c.id,
      data,
      short: v.dur > 0 && v.dur <= CONFIG.SHORT_MAX_SEG,
      dow: data.getDay(),
      hora: data.getHours(),
      eng: v.views ? (v.likes + v.comments) / v.views * 100 : 0
    };
  });
}

async function carregarCanal(c, force) {
  c.erro = null;
  const cache = !force && Store.getCache(c.id);
  if (cache) {
    c.videos = hidratarVideos(cache.videos, c);
    Object.assign(c, cache.info);
    return;
  }
  try {
    const [info, videos] = await Promise.all([buscarInfoCanal(c), buscarVideos(c)]);
    if (info) {
      c.subs = info.subs ?? c.subs;
      c.views = info.views;
      c.nVideos = info.nVideos;
      if (info.foto) c.foto = info.foto;
    }
    c.videos = hidratarVideos(videos, c);
    Store.setCache(c.id, videos, { subs: c.subs, views: c.views, nVideos: c.nVideos, foto: c.foto });
  } catch (e) {
    console.warn('Falha no canal', c.nome, e);
    c.erro = e.message || 'erro';
    c.erroStatus = e.status;
    c.videos = [];
  }
}

// ============================================================
// 6. CÁLCULO DE MÉTRICAS
// ============================================================
function recorte(videos, dias, offset = 0) {
  if (!dias) return offset ? [] : videos;
  const fim = Date.now() - offset * dias * DIA;
  const ini = fim - dias * DIA;
  return videos.filter(v => v.data.getTime() > ini && v.data.getTime() <= fim);
}

function metricas(c) {
  const dias = state.janela;
  const v = recorte(c.videos, dias);
  const ant = recorte(c.videos, dias, 1);
  const views = soma(v, x => x.views), likes = soma(v, x => x.likes), com = soma(v, x => x.comments);
  const viewsAnt = soma(ant, x => x.views);
  let spanDias = dias;
  if (!dias && v.length) spanDias = Math.max(7, (Date.now() - Math.min(...v.map(x => x.data.getTime()))) / DIA);
  const ordenados = [...v].sort((a, b) => b.views - a.views);
  const shorts = v.filter(x => x.short), longos = v.filter(x => !x.short);
  return {
    v, ant,
    n: v.length, nAnt: ant.length,
    views, viewsAnt, likes, comments: com,
    avg: v.length ? views / v.length : 0,
    avgAnt: ant.length ? viewsAnt / ant.length : 0,
    med: mediana(v.map(x => x.views)),
    eng: views ? (likes + com) / views * 100 : 0,
    cresc: dias && viewsAnt > 0 ? (views - viewsAnt) / viewsAnt * 100 : null,
    freq: v.length ? v.length / (spanDias / 7) : 0,
    best: ordenados[0] || null,
    worst: ordenados[ordenados.length - 1] || null,
    nShorts: shorts.length, nLongos: longos.length,
    viewsShorts: soma(shorts, x => x.views), viewsLongos: soma(longos, x => x.views),
    avgShorts: shorts.length ? soma(shorts, x => x.views) / shorts.length : 0,
    avgLongos: longos.length ? soma(longos, x => x.views) / longos.length : 0,
    viewsPorSub: c.subs ? (v.length ? views / v.length : 0) / c.subs * 100 : null,
    pctFlop: v.length ? v.filter(x => x.views < 500).length / v.length * 100 : 0,
    pct1k: v.length ? v.filter(x => x.views >= 1000).length / v.length * 100 : 0
  };
}

function deltaInscritos(c) {
  const s = Store.snapshots()[c.id];
  if (!s) return null;
  const dias = Object.keys(s).sort();
  if (dias.length < 2) return null;
  return s[dias[dias.length - 1]].subs - s[dias[0]].subs;
}

// agrupa por dia (ou semana quando o intervalo é longo)
function construirBuckets(m) {
  const todos = m.flatMap(x => x.v);
  if (!todos.length) return { keys: [], fn: () => '' };
  const ini = state.janela ? new Date(Date.now() - state.janela * DIA) : new Date(Math.min(...todos.map(x => x.data.getTime())));
  const fim = new Date();
  const span = (fim - ini) / DIA;
  const semanal = span > 60;
  const fn = (d) => {
    const x = new Date(d);
    if (semanal) x.setDate(x.getDate() - x.getDay());
    return dKey(x);
  };
  const keys = [];
  const cur = new Date(ini);
  cur.setHours(0, 0, 0, 0);
  while (cur <= fim) {
    const k = fn(cur);
    if (!keys.length || keys[keys.length - 1] !== k) keys.push(k);
    cur.setDate(cur.getDate() + 1);
  }
  return { keys, fn, semanal };
}
const rotuloBucket = (k) => { const [, m, d] = k.split('-'); return `${d}/${m}`; };

// ============================================================
// 7. CHARTS (helpers)
// ============================================================
Chart.defaults.color = '#8b98a8';
Chart.defaults.borderColor = '#2a3340';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.tooltip.callbacks.label = function (ctx) {
  const lbl = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
  const val = ctx.parsed.y ?? ctx.parsed.x ?? ctx.parsed;
  return lbl + (typeof val === 'number' ? fmtFull(Math.round(val * 100) / 100) : val);
};

function mk(id, type, data, opts = {}) {
  if (state.charts[id]) state.charts[id].destroy();
  const el = $(id);
  if (!el) return;
  const cartesiano = ['bar', 'line', 'scatter', 'bubble'].includes(type);
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: { legend: { display: (data.datasets.length > 1) || ['doughnut', 'pie'].includes(type) } }
  };
  if (cartesiano) {
    base.scales = {
      x: { grid: { display: false }, ticks: { maxRotation: 45, autoSkip: true } },
      y: { beginAtZero: true, ticks: { callback: (v) => fmt(v) } }
    };
  }
  state.charts[id] = new Chart(el, { type, data, options: deepMerge(base, opts) });
}

function deepMerge(a, b) {
  const o = { ...a };
  for (const k in b) {
    o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object')
      ? deepMerge(a[k], b[k]) : b[k];
  }
  return o;
}

function card(grid, id, titulo, sub, largura = 'w6', alto = false) {
  const d = document.createElement('div');
  d.className = `card ${largura}${alto ? ' tall' : ''}`;
  d.innerHTML = `<h3>${titulo}</h3><p class="sub">${sub || ''}</p><div class="chart-box"><canvas id="${id}"></canvas></div>`;
  grid.appendChild(d);
}

function kpi(el, itens) {
  el.innerHTML = itens.map(i => `
    <div class="kpi"><div class="lbl">${i.l}</div><div class="val">${i.v}</div>${i.d ? `<div class="delta">${i.d}</div>` : ''}</div>`).join('');
}

// ============================================================
// 8. TABELAS ORDENÁVEIS
// ============================================================
const tabelaEstado = {};
function tabela(containerId, cols, rows, opts = {}) {
  const el = $(containerId);
  if (!el) return;
  const st = tabelaEstado[containerId] = tabelaEstado[containerId] || { k: opts.ordem || cols[0].k, dir: -1 };
  const col = cols.find(c => c.k === st.k) || cols[0];
  const ord = [...rows].sort((a, b) => {
    const x = col.v(a), y = col.v(b);
    if (typeof x === 'string') return st.dir * x.localeCompare(y);
    return st.dir * ((x ?? -Infinity) - (y ?? -Infinity));
  });
  const lim = opts.limite || 500;
  el.innerHTML = rows.length ? `<table><thead><tr>${cols.map(c =>
    `<th data-k="${c.k}">${c.l}${c.k === st.k ? `<span class="seta">${st.dir < 0 ? '▼' : '▲'}</span>` : ''}</th>`).join('')}</tr></thead>
    <tbody>${ord.slice(0, lim).map(r => `<tr>${cols.map(c => `<td${c.cls ? ` class="${c.cls}"` : ''}>${c.h ? c.h(r) : fmt(c.v(r))}</td>`).join('')}</tr>`).join('')}</tbody></table>`
    : '<div class="vazio">Sem dados para exibir.</div>';
  el.querySelectorAll('th').forEach(th => th.onclick = () => {
    const k = th.dataset.k;
    if (st.k === k) st.dir *= -1; else { st.k = k; st.dir = -1; }
    tabela(containerId, cols, rows, opts);
  });
}

const celulaCanal = (c) => `<div class="cell-canal"><img src="${esc(c.foto)}" alt=""><span>${esc(c.nome)}</span></div>`;

// ============================================================
// 9. RENDER — VISÃO GERAL
// ============================================================
function renderGeral(ms) {
  const ok = ms.filter(x => !x.c.erro);
  const totalSubs = soma(state.canais, c => c.subs || 0);
  const totalViewsVida = soma(state.canais, c => c.views || 0);
  const totalVideos = soma(state.canais, c => c.nVideos || 0);
  const viewsJan = soma(ok, x => x.m.views), viewsAnt = soma(ok, x => x.m.viewsAnt);
  const nJan = soma(ok, x => x.m.n);
  const likes = soma(ok, x => x.m.likes), com = soma(ok, x => x.m.comments);
  const cresc = state.janela && viewsAnt > 0 ? (viewsJan - viewsAnt) / viewsAnt * 100 : null;

  kpi($('kpi-geral'), [
    { l: 'Canais', v: state.canais.length },
    { l: 'Inscritos (total)', v: fmt(totalSubs) },
    { l: 'Views (vida toda)', v: fmt(totalViewsVida) },
    { l: 'Vídeos publicados', v: fmtFull(totalVideos), d: 'em todos os canais' },
    { l: 'Views na janela', v: fmt(viewsJan), d: cresc !== null ? deltaHtml(cresc) + ' vs janela anterior' : '' },
    { l: 'Vídeos na janela', v: fmtFull(nJan), d: `${(nJan ? viewsJan / nJan : 0).toFixed(0)} views/vídeo` },
    { l: 'Engajamento médio', v: fmtPct(viewsJan ? (likes + com) / viewsJan * 100 : 0), d: '(likes + comentários) / views' }
  ]);

  const g = $('grid-geral'); g.innerHTML = '';
  card(g, 'g-timeline', 'Views por período de publicação', 'Soma das views dos vídeos publicados em cada dia/semana, empilhado por canal.', 'w8', true);
  card(g, 'g-share', 'Participação nas views da janela', 'Quanto cada canal representa do total.', 'w4', true);
  card(g, 'g-subs', 'Inscritos por canal', '', 'w6');
  card(g, 'g-views-vida', 'Views totais (vida do canal)', '', 'w6');
  card(g, 'g-avg', 'Média de views por vídeo (janela)', 'Quanto cada vídeo entrega em média.', 'w6');
  card(g, 'g-eng', 'Engajamento por canal (%)', '(likes + comentários) / views.', 'w6');
  card(g, 'g-nvid', 'Vídeos publicados na janela', 'Ritmo de produção.', 'w6');
  card(g, 'g-tipo', 'Shorts × Longos (views na janela)', '', 'w6');

  const nomes = ok.map(x => x.c.nome), cores = ok.map(x => x.c.cor);
  const b = construirBuckets(ok.map(x => x.m));
  mk('g-timeline', 'bar', {
    labels: b.keys.map(rotuloBucket),
    datasets: ok.map(x => {
      const mapa = {};
      x.m.v.forEach(v => { const k = b.fn(v.data); mapa[k] = (mapa[k] || 0) + v.views; });
      return { label: x.c.nome, data: b.keys.map(k => mapa[k] || 0), backgroundColor: x.c.cor, stack: 's' };
    })
  }, { scales: { x: { stacked: true }, y: { stacked: true } }, plugins: { legend: { display: ok.length <= 12 } } });

  mk('g-share', 'doughnut', {
    labels: nomes, datasets: [{ data: ok.map(x => x.m.views), backgroundColor: cores, borderColor: '#161b22' }]
  }, { plugins: { legend: { position: 'bottom' } } });

  const barraH = (id, valores, rotulo, fmtLbl) => {
    const idx = valores.map((v, i) => i).sort((a, b) => valores[b] - valores[a]);
    mk(id, 'bar', {
      labels: idx.map(i => nomes[i]),
      datasets: [{ label: rotulo, data: idx.map(i => valores[i]), backgroundColor: idx.map(i => cores[i]) }]
    }, { indexAxis: 'y', scales: { x: { ticks: { callback: fmtLbl || ((v) => fmt(v)) } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } });
  };
  barraH('g-subs', ok.map(x => x.c.subs || 0), 'Inscritos');
  barraH('g-views-vida', ok.map(x => x.c.views || 0), 'Views');
  barraH('g-avg', ok.map(x => Math.round(x.m.avg)), 'Média de views');
  barraH('g-eng', ok.map(x => +x.m.eng.toFixed(2)), 'Engajamento %', (v) => v + '%');
  barraH('g-nvid', ok.map(x => x.m.n), 'Vídeos');

  mk('g-tipo', 'bar', {
    labels: nomes,
    datasets: [
      { label: 'Shorts', data: ok.map(x => x.m.viewsShorts), backgroundColor: '#a78bfa', stack: 't' },
      { label: 'Longos', data: ok.map(x => x.m.viewsLongos), backgroundColor: '#4ea1ff', stack: 't' }
    ]
  }, { scales: { x: { stacked: true }, y: { stacked: true } } });

  tabela('tb-geral', colunasCanais(), ms, { ordem: 'views' });
}

function colunasCanais() {
  return [
    { k: 'canal', l: 'Canal', v: r => r.c.nome, h: r => celulaCanal(r.c) },
    { k: 'subs', l: 'Inscritos', v: r => r.c.subs },
    { k: 'vida', l: 'Views (vida)', v: r => r.c.views },
    { k: 'nvid', l: 'Vídeos (total)', v: r => r.c.nVideos },
    { k: 'n', l: 'Vídeos na janela', v: r => r.m.n },
    { k: 'views', l: 'Views na janela', v: r => r.m.views },
    { k: 'avg', l: 'Média/vídeo', v: r => r.m.avg },
    { k: 'med', l: 'Mediana', v: r => r.m.med },
    { k: 'eng', l: 'Engaj.', v: r => r.m.eng, h: r => fmtPct(r.m.eng) },
    { k: 'freq', l: 'Vídeos/semana', v: r => r.m.freq, h: r => r.m.freq.toFixed(1).replace('.', ',') },
    { k: 'flop', l: '% < 500 views', v: r => r.m.pctFlop, h: r => fmtPct(r.m.pctFlop, 0) },
    { k: 'cresc', l: 'Crescimento', v: r => r.m.cresc, h: r => deltaHtml(r.m.cresc) },
    { k: 'dsubs', l: 'Δ inscritos*', v: r => deltaInscritos(r.c), h: r => { const d = deltaInscritos(r.c); return d === null ? '—' : `<span class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${fmtFull(d)}</span>`; } },
    { k: 'status', l: 'Status', v: r => r.c.erro ? 0 : 1, h: r => r.c.erro ? `<span class="tag" style="color:var(--vermelho);border-color:var(--vermelho)" title="${esc(r.c.erro)}">erro</span>` : '<span class="tag" style="color:var(--verde);border-color:var(--verde)">ok</span>' }
  ];
}

// ============================================================
// 10. RENDER — COMPARAR CANAIS
// ============================================================
function renderComparar(ms) {
  const ok = ms.filter(x => !x.c.erro && x.m.n > 0);
  const topo = (f) => ok.length ? [...ok].sort((a, b) => f(b) - f(a))[0] : null;
  const crescer = state.janela ? topo(x => x.m.cresc ?? -Infinity) : null;
  const tAvg = topo(x => x.m.avg), tEng = topo(x => x.m.eng), tProd = topo(x => x.m.n), tViews = topo(x => x.m.views);

  kpi($('kpi-comparar'), [
    { l: '🚀 Mais cresce', v: crescer && crescer.m.cresc !== null ? esc(crescer.c.nome) : '—', d: crescer && crescer.m.cresc !== null ? deltaHtml(crescer.m.cresc) + ' em views' : 'escolha uma janela fixa' },
    { l: '👁️ Mais views (janela)', v: tViews ? esc(tViews.c.nome) : '—', d: tViews ? fmt(tViews.m.views) + ' views' : '' },
    { l: '🎯 Melhor média/vídeo', v: tAvg ? esc(tAvg.c.nome) : '—', d: tAvg ? fmt(tAvg.m.avg) + ' views' : '' },
    { l: '💬 Maior engajamento', v: tEng ? esc(tEng.c.nome) : '—', d: tEng ? fmtPct(tEng.m.eng) : '' },
    { l: '🏭 Mais produtivo', v: tProd ? esc(tProd.c.nome) : '—', d: tProd ? tProd.m.n + ' vídeos' : '' }
  ]);

  const g = $('grid-comparar'); g.innerHTML = '';
  card(g, 'c-cresc', 'Crescimento de views vs janela anterior (%)', 'Views dos vídeos publicados nesta janela comparados à janela imediatamente anterior.', 'w6');
  card(g, 'c-janelas', 'Views: janela atual × anterior', '', 'w6');
  card(g, 'c-acum', 'Views acumuladas ao longo do período', 'Cada linha soma as views dos vídeos conforme foram sendo publicados.', 'w12', true);
  card(g, 'c-radar', 'Perfil comparado (radar)', 'Cada eixo normalizado: 100 = melhor canal naquele critério.', 'w6', true);
  card(g, 'c-bolha', 'Volume × qualidade', 'Eixo X: vídeos na janela · Eixo Y: média de views · Tamanho: inscritos.', 'w6', true);
  card(g, 'c-dow', 'Média de views por dia da semana', 'Em que dia cada canal rende mais.', 'w6');
  card(g, 'c-vps', 'Média de views ÷ inscritos (%)', 'Alcance relativo: quanto do público do canal assiste cada vídeo.', 'w6');
  card(g, 'c-subs', 'Evolução de inscritos (monitorado neste navegador)', 'O painel guarda um registro diário; o gráfico aparece a partir do 2º dia de uso.', 'w12');

  const nomes = ok.map(x => x.c.nome);
  mk('c-cresc', 'bar', {
    labels: nomes,
    datasets: [{ label: 'Crescimento %', data: ok.map(x => x.m.cresc === null ? 0 : +x.m.cresc.toFixed(1)), backgroundColor: ok.map(x => (x.m.cresc ?? 0) >= 0 ? '#3fb950' : '#ff5c5c') }]
  }, { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } } });

  mk('c-janelas', 'bar', {
    labels: nomes,
    datasets: [
      { label: 'Janela anterior', data: ok.map(x => x.m.viewsAnt), backgroundColor: '#3a4656' },
      { label: 'Janela atual', data: ok.map(x => x.m.views), backgroundColor: '#4ea1ff' }
    ]
  });

  const b = construirBuckets(ok.map(x => x.m));
  mk('c-acum', 'line', {
    labels: b.keys.map(rotuloBucket),
    datasets: ok.map(x => {
      const mapa = {};
      x.m.v.forEach(v => { const k = b.fn(v.data); mapa[k] = (mapa[k] || 0) + v.views; });
      let ac = 0;
      return { label: x.c.nome, data: b.keys.map(k => (ac += (mapa[k] || 0))), borderColor: x.c.cor, backgroundColor: x.c.cor, pointRadius: 0, borderWidth: 2, tension: .25 };
    })
  });

  const crit = [
    ['Média/vídeo', x => x.m.avg], ['Engajamento', x => x.m.eng], ['Frequência', x => x.m.freq],
    ['Inscritos', x => x.c.subs || 0], ['Views/inscrito', x => x.m.viewsPorSub || 0], ['% ≥1k views', x => x.m.pct1k]
  ];
  const maxs = crit.map(([, f]) => Math.max(...ok.map(f), 1e-9));
  mk('c-radar', 'radar', {
    labels: crit.map(c => c[0]),
    datasets: ok.map(x => ({
      label: x.c.nome, data: crit.map(([, f], i) => +(f(x) / maxs[i] * 100).toFixed(1)),
      borderColor: x.c.cor, backgroundColor: x.c.cor + '22', borderWidth: 2, pointRadius: 2
    }))
  }, { scales: { r: { beginAtZero: true, max: 100, ticks: { display: false }, grid: { color: '#2a3340' }, angleLines: { color: '#2a3340' } } } });

  const maxSubs = Math.max(...ok.map(x => x.c.subs || 0), 1);
  mk('c-bolha', 'bubble', {
    datasets: ok.map(x => ({
      label: x.c.nome,
      data: [{ x: x.m.n, y: Math.round(x.m.avg), r: 6 + 22 * Math.sqrt((x.c.subs || 0) / maxSubs) }],
      backgroundColor: x.c.cor + 'aa', borderColor: x.c.cor
    }))
  }, {
    scales: { x: { beginAtZero: true, title: { display: true, text: 'Vídeos na janela' }, grid: { display: true } }, y: { title: { display: true, text: 'Média de views' } } },
    plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.raw.x} vídeos · ${fmtFull(c.raw.y)} views/vídeo` } } }
  });

  mk('c-dow', 'line', {
    labels: DIAS_SEM,
    datasets: ok.map(x => ({
      label: x.c.nome,
      data: DIAS_SEM.map((_, d) => { const s = x.m.v.filter(v => v.dow === d); return s.length ? Math.round(media(s.map(v => v.views))) : null; }),
      borderColor: x.c.cor, backgroundColor: x.c.cor, borderWidth: 2, pointRadius: 3, tension: .25, spanGaps: true
    }))
  });

  mk('c-vps', 'bar', {
    labels: nomes,
    datasets: [{ label: 'Views/inscritos %', data: ok.map(x => x.m.viewsPorSub === null ? 0 : +x.m.viewsPorSub.toFixed(2)), backgroundColor: ok.map(x => x.c.cor) }]
  }, { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + '%' } } } });

  // snapshots de inscritos
  const snaps = Store.snapshots();
  const comHist = state.canais.filter(c => snaps[c.id] && Object.keys(snaps[c.id]).length >= 2);
  if (comHist.length) {
    const dias = [...new Set(comHist.flatMap(c => Object.keys(snaps[c.id])))].sort();
    mk('c-subs', 'line', {
      labels: dias.map(rotuloBucket),
      datasets: comHist.map(c => ({
        label: c.nome, data: dias.map(d => snaps[c.id][d]?.subs ?? null),
        borderColor: c.cor, backgroundColor: c.cor, borderWidth: 2, pointRadius: 3, tension: .2, spanGaps: true
      }))
    }, { scales: { y: { beginAtZero: false } } });
  } else {
    const box = $('c-subs').parentElement;
    box.innerHTML = '<div class="vazio">Ainda sem histórico. Abra o painel nos próximos dias e a evolução de inscritos aparece aqui.</div>';
  }

  tabela('tb-comparar', colunasCanais(), ms, { ordem: 'avg' });
}

// ============================================================
// 11. RENDER — ANÁLISE DO CANAL
// ============================================================
function renderCanal() {
  const c = state.canais.find(x => x.id === state.canalSel) || state.canais[0];
  if (!c) return;
  state.canalSel = c.id;
  $('sel-canal').value = c.id;
  $('canal-nome').textContent = c.nome;
  $('canal-foto').src = c.foto || '';

  const m = metricas(c);
  const v = m.v;

  kpi($('kpi-canal'), [
    { l: 'Inscritos', v: fmt(c.subs), d: deltaInscritos(c) !== null ? `${deltaInscritos(c) >= 0 ? '+' : ''}${fmtFull(deltaInscritos(c))} desde o início do monitoramento` : '' },
    { l: 'Views (vida)', v: fmt(c.views), d: fmtFull(c.nVideos) + ' vídeos' },
    { l: 'Vídeos na janela', v: m.n, d: m.freq.toFixed(1).replace('.', ',') + ' por semana' },
    { l: 'Views na janela', v: fmt(m.views), d: m.cresc !== null ? deltaHtml(m.cresc) + ' vs anterior' : '' },
    { l: 'Média/vídeo', v: fmt(m.avg), d: 'mediana ' + fmt(m.med) },
    { l: 'Engajamento', v: fmtPct(m.eng), d: `${fmt(m.likes)} likes · ${fmt(m.comments)} comentários` },
    { l: 'Melhor vídeo', v: m.best ? fmt(m.best.views) : '—', d: m.best ? esc(m.best.titulo.slice(0, 40)) : '' },
    { l: '% vídeos ≥ 1k views', v: fmtPct(m.pct1k, 0), d: fmtPct(m.pctFlop, 0) + ' abaixo de 500' }
  ]);

  $('insights').innerHTML = gerarInsights(c, m).map(i => `<li class="${i.cls}">${i.html}</li>`).join('');

  const g = $('grid-canal'); g.innerHTML = '';
  if (!v.length) {
    g.innerHTML = '<div class="card w12"><div class="vazio">Nenhum vídeo nesta janela de tempo (ou o canal teve erro de leitura).</div></div>';
    $('lista-top').innerHTML = $('lista-bottom').innerHTML = '';
    return;
  }
  card(g, 'k-timeline', 'Views de cada vídeo ao longo do tempo', 'Roxo = Short · Azul = vídeo longo · Linha = média móvel de 5 vídeos.', 'w12', true);
  card(g, 'k-eng', 'Engajamento por vídeo (%)', 'Vídeos em ordem cronológica.', 'w6');
  card(g, 'k-hist', 'Distribuição de views', 'Quantos vídeos caíram em cada faixa de views.', 'w6');
  card(g, 'k-dow', 'Média de views por dia da semana', '', 'w6');
  card(g, 'k-hora', 'Média de views por horário de publicação', 'Horário local de quando o vídeo foi publicado.', 'w6');
  card(g, 'k-dur', 'Duração × views', 'Cada ponto é um vídeo (duração em minutos).', 'w6');
  card(g, 'k-tipo', 'Shorts × Longos', 'Média de views por tipo de vídeo.', 'w6');
  card(g, 'k-lc', 'Likes e comentários por vídeo', '', 'w12');

  const cron = [...v].sort((a, b) => a.data - b.data);
  const lbl = cron.map(x => x.data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
  const mm = cron.map((_, i) => { const s = cron.slice(Math.max(0, i - 4), i + 1); return Math.round(media(s.map(x => x.views))); });

  mk('k-timeline', 'bar', {
    labels: lbl,
    datasets: [
      { type: 'bar', label: 'Views', data: cron.map(x => x.views), backgroundColor: cron.map(x => x.short ? '#a78bfa' : '#4ea1ff'), order: 2 },
      { type: 'line', label: 'Média móvel (5)', data: mm, borderColor: '#f2c94c', borderWidth: 2, pointRadius: 0, tension: .3, order: 1 }
    ]
  }, {
    plugins: { tooltip: { callbacks: { title: (it) => cron[it[0].dataIndex].titulo, label: (ctx) => `${ctx.dataset.label}: ${fmtFull(ctx.parsed.y)}` } } }
  });

  mk('k-eng', 'line', {
    labels: lbl, datasets: [{ label: 'Engajamento %', data: cron.map(x => +x.eng.toFixed(2)), borderColor: '#3fb950', backgroundColor: '#3fb95033', fill: true, tension: .3, pointRadius: 2 }]
  }, { plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => v + '%' } } } });

  const faixas = [['< 500', 0, 500], ['500–1k', 500, 1000], ['1k–5k', 1000, 5000], ['5k–10k', 5000, 10000], ['10k–50k', 10000, 50000], ['50k+', 50000, Infinity]];
  mk('k-hist', 'bar', {
    labels: faixas.map(f => f[0]),
    datasets: [{ label: 'Vídeos', data: faixas.map(([, a, b]) => v.filter(x => x.views >= a && x.views < b).length), backgroundColor: ['#ff5c5c', '#f2c94c', '#84cc16', '#3fb950', '#2dd4bf', '#4ea1ff'] }]
  }, { plugins: { legend: { display: false } }, scales: { y: { ticks: { precision: 0, callback: v => v } } } });

  mk('k-dow', 'bar', {
    labels: DIAS_SEM,
    datasets: [{ label: 'Média de views', data: DIAS_SEM.map((_, d) => { const s = v.filter(x => x.dow === d); return s.length ? Math.round(media(s.map(x => x.views))) : 0; }), backgroundColor: '#4ea1ff' }]
  }, { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (ctx) => v.filter(x => x.dow === ctx.dataIndex).length + ' vídeos' } } } });

  const horas = Array.from({ length: 24 }, (_, i) => i);
  mk('k-hora', 'bar', {
    labels: horas.map(h => pad(h) + 'h'),
    datasets: [{ label: 'Média de views', data: horas.map(h => { const s = v.filter(x => x.hora === h); return s.length ? Math.round(media(s.map(x => x.views))) : 0; }), backgroundColor: '#2dd4bf' }]
  }, { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (ctx) => v.filter(x => x.hora === ctx.dataIndex).length + ' vídeos' } } } });

  mk('k-dur', 'scatter', {
    datasets: [
      { label: 'Shorts', data: v.filter(x => x.short).map(x => ({ x: +(x.dur / 60).toFixed(2), y: x.views, t: x.titulo })), backgroundColor: '#a78bfa' },
      { label: 'Longos', data: v.filter(x => !x.short).map(x => ({ x: +(x.dur / 60).toFixed(2), y: x.views, t: x.titulo })), backgroundColor: '#4ea1ff' }
    ]
  }, {
    scales: { x: { title: { display: true, text: 'Duração (min)' }, grid: { display: true } }, y: { title: { display: true, text: 'Views' } } },
    plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.raw.t.slice(0, 50)} — ${ctx.raw.x} min · ${fmtFull(ctx.raw.y)} views` } } }
  });

  mk('k-tipo', 'bar', {
    labels: ['Shorts', 'Longos'],
    datasets: [{ label: 'Média de views', data: [Math.round(m.avgShorts), Math.round(m.avgLongos)], backgroundColor: ['#a78bfa', '#4ea1ff'] }]
  }, { plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (ctx) => (ctx.dataIndex ? m.nLongos : m.nShorts) + ' vídeos' } } } });

  mk('k-lc', 'bar', {
    labels: lbl,
    datasets: [
      { label: 'Likes', data: cron.map(x => x.likes), backgroundColor: '#ff5c5c' },
      { label: 'Comentários', data: cron.map(x => x.comments), backgroundColor: '#8b98a8' }
    ]
  });

  const ord = [...v].sort((a, b) => b.views - a.views);
  $('lista-top').innerHTML = ord.slice(0, 5).map(itemVideo).join('');
  $('lista-bottom').innerHTML = ord.slice(-5).reverse().map(itemVideo).join('');
}

function itemVideo(v) {
  return `<a class="vitem" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">
    <img src="${esc(v.thumb)}" alt="">
    <div><div class="t">${esc(v.titulo)}</div>
    <div class="m">${v.data.toLocaleDateString('pt-BR')} · ${fmtDur(v.dur)} · 👁 ${fmt(v.views)} · ❤ ${fmt(v.likes)} · 💬 ${fmt(v.comments)}</div></div></a>`;
}

function gerarInsights(c, m) {
  const out = [];
  const v = m.v;
  if (c.erro) return [{ cls: 'ruim', html: `Não foi possível ler este canal: <b>${esc(c.erro)}</b>.` }];
  if (v.length < 3) return [{ cls: 'neutro', html: 'Poucos vídeos na janela escolhida. Aumente a janela de tempo para uma análise mais confiável.' }];

  // tendência
  const cron = [...v].sort((a, b) => b.data - a.data);
  if (cron.length >= 8) {
    const rec = media(cron.slice(0, 4).map(x => x.views)), ant = media(cron.slice(4, 8).map(x => x.views));
    if (ant > 0) {
      const d = (rec - ant) / ant * 100;
      out.push({ cls: d >= 10 ? 'bom' : d <= -10 ? 'ruim' : 'neutro', html: `Tendência: os 4 vídeos mais recentes têm média de <b>${fmt(rec)}</b> views contra <b>${fmt(ant)}</b> dos 4 anteriores (${deltaHtml(d)}).` });
    }
  }
  if (m.cresc !== null) out.push({ cls: m.cresc >= 0 ? 'bom' : 'ruim', html: `Views dos vídeos publicados na janela: <b>${fmt(m.views)}</b> (${deltaHtml(m.cresc)} em relação à janela anterior).` });

  // melhor dia
  const porDia = DIAS_SEM.map((nome, d) => { const s = v.filter(x => x.dow === d); return { nome, n: s.length, avg: s.length ? media(s.map(x => x.views)) : 0 }; }).filter(x => x.n >= 2);
  if (porDia.length >= 2) {
    const mel = [...porDia].sort((a, b) => b.avg - a.avg)[0], pior = [...porDia].sort((a, b) => a.avg - b.avg)[0];
    out.push({ cls: 'bom', html: `Melhor dia para postar: <b>${mel.nome}</b> (média ${fmt(mel.avg)} views em ${mel.n} vídeos). Pior: <b>${pior.nome}</b> (${fmt(pior.avg)}).` });
  }

  // faixa de horário
  const faixas = [['madrugada (0–5h)', 0, 5], ['manhã (5–12h)', 5, 12], ['tarde (12–18h)', 12, 18], ['noite (18–24h)', 18, 24]]
    .map(([nome, a, b]) => { const s = v.filter(x => x.hora >= a && x.hora < b); return { nome, n: s.length, avg: s.length ? media(s.map(x => x.views)) : 0 }; })
    .filter(x => x.n >= 2);
  if (faixas.length >= 2) {
    const mel = [...faixas].sort((a, b) => b.avg - a.avg)[0];
    out.push({ cls: 'neutro', html: `Melhor faixa de horário: <b>${mel.nome}</b> — média de ${fmt(mel.avg)} views (${mel.n} vídeos).` });
  }

  // shorts x longos
  if (m.nShorts >= 2 && m.nLongos >= 2) {
    const melhor = m.avgShorts > m.avgLongos ? 'Shorts' : 'vídeos longos';
    const r = Math.max(m.avgShorts, m.avgLongos) / Math.max(1, Math.min(m.avgShorts, m.avgLongos));
    out.push({ cls: 'neutro', html: `<b>${melhor}</b> rendem mais: ${fmt(m.avgShorts)} views/Short contra ${fmt(m.avgLongos)} views/longo (${r.toFixed(1).replace('.', ',')}×).` });
  }

  // duração
  if (v.length >= 8) {
    const md = mediana(v.map(x => x.dur));
    const curtos = v.filter(x => x.dur <= md), longos = v.filter(x => x.dur > md);
    if (curtos.length >= 3 && longos.length >= 3) {
      const a = media(curtos.map(x => x.views)), b = media(longos.map(x => x.views));
      out.push({ cls: 'neutro', html: `Vídeos mais curtos que ${fmtDur(Math.round(md))} fazem média de ${fmt(a)} views; os mais longos, ${fmt(b)}.` });
    }
  }

  // outlier
  if (m.best && m.med > 0 && m.best.views >= m.med * 3) {
    out.push({ cls: 'bom', html: `Vídeo que mais se destacou: “<b>${esc(m.best.titulo)}</b>” com ${fmt(m.best.views)} views (${(m.best.views / m.med).toFixed(1).replace('.', ',')}× a mediana). Vale replicar o formato/tema.` });
  }

  // flops
  if (m.pctFlop >= 40) out.push({ cls: 'ruim', html: `<b>${fmtPct(m.pctFlop, 0)}</b> dos vídeos ficaram abaixo de 500 views. Revise títulos, thumbnails e os 3 primeiros segundos de retenção.` });
  else if (m.pct1k >= 60) out.push({ cls: 'bom', html: `<b>${fmtPct(m.pct1k, 0)}</b> dos vídeos passaram de 1k views — canal com entrega consistente.` });

  // engajamento
  out.push({ cls: m.eng >= 4 ? 'bom' : m.eng < 1.5 ? 'ruim' : 'neutro', html: `Engajamento médio de <b>${fmtPct(m.eng)}</b> ${m.eng < 1.5 ? '— baixo; incentive comentários/likes com chamadas no vídeo.' : m.eng >= 4 ? '— ótimo, o público interage.' : '— dentro do esperado.'}` });

  // frequência
  out.push({ cls: 'neutro', html: `Ritmo de publicação: <b>${m.freq.toFixed(1).replace('.', ',')}</b> vídeos por semana.` });
  return out;
}

// ============================================================
// 12. RENDER — LISTA DE VÍDEOS
// ============================================================
function renderVideos() {
  const sel = $('flt-canal').value;
  const q = $('flt-busca').value.trim().toLowerCase();
  let rows = [];
  state.canais.forEach(c => {
    if (sel && sel !== c.id) return;
    recorte(c.videos, state.janela).forEach(v => rows.push({ ...v, canal: c }));
  });
  if (q) rows = rows.filter(r => r.titulo.toLowerCase().includes(q));
  const cols = [
    { k: 'canal', l: 'Canal', v: r => r.canal.nome, h: r => celulaCanal(r.canal) },
    { k: 'titulo', l: 'Título', v: r => r.titulo, h: r => `<a href="https://www.youtube.com/watch?v=${esc(r.id)}" target="_blank" rel="noopener">${esc(r.titulo)}</a>`, cls: 'titulo' },
    { k: 'data', l: 'Publicado', v: r => r.data.getTime(), h: r => r.data.toLocaleDateString('pt-BR') },
    { k: 'tipo', l: 'Tipo', v: r => r.short ? 1 : 0, h: r => r.short ? '<span class="tag short">Short</span>' : '<span class="tag long">Longo</span>' },
    { k: 'dur', l: 'Duração', v: r => r.dur, h: r => fmtDur(r.dur) },
    { k: 'views', l: 'Views', v: r => r.views, h: r => fmtFull(r.views) },
    { k: 'vpd', l: 'Views/dia', v: r => r.views / Math.max(1, (Date.now() - r.data) / DIA), h: r => fmt(r.views / Math.max(1, (Date.now() - r.data) / DIA)) },
    { k: 'likes', l: 'Likes', v: r => r.likes, h: r => fmtFull(r.likes) },
    { k: 'comments', l: 'Comentários', v: r => r.comments, h: r => fmtFull(r.comments) },
    { k: 'eng', l: 'Engaj.', v: r => r.eng, h: r => fmtPct(r.eng) }
  ];
  tabela('tb-videos', cols, rows, { ordem: 'views', limite: 400 });
}

// ============================================================
// 13. ORQUESTRAÇÃO
// ============================================================
function renderTudo() {
  const ms = state.canais.map(c => ({ c, m: metricas(c) }));
  renderGeral(ms);
  renderComparar(ms);
  renderCanal();
  renderVideos();
  const erros = state.canais.filter(c => c.erro);
  const aviso = $('aviso');
  if (erros.length) {
    const auth = erros.some(c => c.erroStatus === 401 || c.erroStatus === 403);
    aviso.hidden = false;
    aviso.innerHTML = `<span>⚠️ ${erros.length} canal(is) com erro de leitura: ${erros.map(c => esc(c.nome)).join(', ')}.
      ${auth ? CONFIG.YT_API_KEY ? 'Verifique se a chave da API é válida e se a YouTube Data API v3 está ativada.' : 'O token OAuth salvo expirou (dura 1h). Preencha <code>YT_API_KEY</code> no app.js para não depender dele, ou reconecte.' : esc(erros[0].erro)}</span>
      ${!CONFIG.YT_API_KEY && auth ? '<button class="btn sec" id="btn-reconectar">Reconectar Google</button>' : ''}`;
    const br = $('btn-reconectar');
    if (br) br.onclick = reconectar;
  } else aviso.hidden = true;
}

async function carregarTudo(force = false) {
  $('loading').classList.remove('off');
  try {
    let n = 0;
    await Promise.all(state.canais.map(async (c) => {
      await carregarCanal(c, force);
      $('loading-txt').textContent = `Carregando canais… ${++n}/${state.canais.length}`;
    }));
    Store.salvarSnapshot(state.canais);
    renderTudo();
    const ts = new Date().toLocaleTimeString('pt-BR');
    $('status').textContent = `Atualizado às ${ts} · ${soma(state.canais, c => c.videos.length)} vídeos analisados · *Δ inscritos = variação desde o primeiro registro neste navegador`;
  } finally {
    $('loading').classList.add('off');
  }
}

async function reconectar() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/youtube.readonly',
      queryParams: { access_type: 'offline', prompt: 'consent' },
      redirectTo: window.location.origin + window.location.pathname
    }
  });
}

async function iniciar() {
  // abas
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('#tabs button').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('tab-' + b.dataset.tab).classList.add('active');
  });
  $('sel-janela').onchange = (e) => { state.janela = parseInt(e.target.value); renderTudo(); };
  $('btn-refresh').onclick = () => { Store.clearCache(); carregarTudo(true); };
  $('sel-canal').onchange = (e) => { state.canalSel = e.target.value; renderCanal(); };
  $('flt-canal').onchange = renderVideos;
  $('flt-busca').oninput = renderVideos;

  if (!supabaseClient) {
    $('loading').classList.add('off');
    $('aviso').hidden = false;
    $('aviso').textContent = '⚠️ Biblioteca do Supabase não carregou. Verifique sua conexão.';
    return;
  }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.provider_token) { state.sessionToken = session.provider_token; sessionStorage.setItem('yt_token', session.provider_token); }
  } catch { /* sem sessão */ }

  const { data, error } = await supabaseClient.from('canais_youtube').select('*');
  if (error || !data?.length) {
    $('loading').classList.add('off');
    $('aviso').hidden = false;
    $('aviso').textContent = error ? ('⚠️ Erro ao ler canais no Supabase: ' + error.message) : '⚠️ Nenhum canal encontrado na tabela canais_youtube.';
    return;
  }

  state.canais = data
    .sort((a, b) => (a.nome_canal || '').localeCompare(b.nome_canal || ''))
    .map((db, i) => ({
      id: db.canal_id_youtube, nome: db.nome_canal || db.canal_id_youtube, foto: db.foto_perfil || '',
      cor: CORES[i % CORES.length],
      subs: db.subscriber_count ?? null, views: db.view_count ?? 0, nVideos: db.video_count ?? 0,
      videos: [], erro: null, db
    }));

  const opts = state.canais.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
  $('sel-canal').innerHTML = opts;
  $('flt-canal').innerHTML = '<option value="">Todos os canais</option>' + opts;
  state.canalSel = localStorage.getItem('ytp_canal') || state.canais[0].id;
  if (!state.canais.find(c => c.id === state.canalSel)) state.canalSel = state.canais[0].id;
  $('sel-canal').addEventListener('change', (e) => localStorage.setItem('ytp_canal', e.target.value));

  await carregarTudo(false);
}

document.addEventListener('DOMContentLoaded', iniciar);
