/**
 * TradeWR Social - Versão 2.1 Blindada (Estável)
 */

// 1. Configurações e Estado Global
const CONFIG = {
    SUPABASE_URL: 'https://abdliioyzkylccfylils.supabase.co',
    SUPABASE_KEY: 'sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n'
};

let supabaseClient;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

// 2. Módulo de Utilidades (Com Cache Blindado e Controle de Expiração)
const Utils = {
    formatarNumero: (num) => {
        if (!num) return 0;
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num;
    },
    // Modificado: Salva o token e guarda o timestamp de quando foi criado
    setToken: (token) => {
        sessionStorage.setItem('yt_token', token);
        sessionStorage.setItem('yt_token_created_at', Date.now().toString());
    },
    // Modificado: Se o token tiver mais de 55 minutos (3300000 ms), considera expirado
    getToken: () => {
        const token = sessionStorage.getItem('yt_token');
        const createdAt = sessionStorage.getItem('yt_token_created_at');
        
        if (!token || !createdAt) return null;

        const expirou = Date.now() - parseInt(createdAt) > 55 * 60 * 1000; 
        if (expirou) {
            sessionStorage.removeItem('yt_token');
            sessionStorage.removeItem('yt_token_created_at');
            return null;
        }
        return token;
    },
    
    // Sistema de Cache para economizar Cota
    saveVideoCache: (channelId, videos) => {
        const data = { timestamp: Date.now(), videos };
        sessionStorage.setItem(`cache_v_${channelId}`, JSON.stringify(data));
    },
    getVideoCache: (channelId) => {
        const cache = sessionStorage.getItem(`cache_v_${channelId}`);
        if (!cache) return null;
        const parsed = JSON.parse(cache);
        if (Date.now() - parsed.timestamp < 30 * 60 * 1000) return parsed.videos;
        return null;
    }
};

// 3. Módulo de Interface (UI)
const UI = {
    elementos: {
        bar: document.getElementById('canal-selector-bar'),
        listaCanais: document.getElementById('lista-canais-conectados'),
        listaVideos: document.getElementById('lista-videos'),
        modal: document.getElementById('modalConexao'),
        btnConectar: document.querySelector('.btn-conectar'),
        btnFecharModal: document.querySelector('.fechar-modal'),
        linksMenu: document.querySelectorAll('.nav-links a')
    },

// Adicione dentro de UI:
// Adicione/Substitua dentro do objeto UI:
renderizarGradeDinamica(canais) {
    const containerManha = document.getElementById('grade-manha');
    const containerNoite = document.getElementById('grade-noite');
    
    if (!containerManha || !containerNoite || !canais) return;

    // 1. Definição fixa dos horários da sua grade
    const horariosManha = ["18:00", "18:00", "18:00", "18:00", "18:00"];
    const horariosNoite = ["12:00", "12:00", "12:00", "12:00", "12:00"];

    // 2. Ordena os canais por nome (ou data) para que a ordem não mude do nada
    const canaisOrdenados = [...canais].sort((a, b) => a.nome_canal.localeCompare(b.nome_canal));

    // 3. Renderiza a parte da Manhã (Canais de 1 a 5)
    containerManha.innerHTML = horariosManha.map((hora, index) => {
        const canal = canaisOrdenados[index];
        return this.gerarHtmlCardGrade(canal, hora);
    }).join('');

    // 4. Renderiza a parte da Noite (Canais de 6 a 10)
    containerNoite.innerHTML = horariosNoite.map((hora, index) => {
        const canal = canaisOrdenados[index + 5]; // Começa a pegar do sexto canal
        return this.gerarHtmlCardGrade(canal, hora);
    }).join('');
},

// Função auxiliar para não repetir código
gerarHtmlCardGrade(canal, hora) {
    if (!canal) {
        // Se não houver canal para esse horário, mostra um card vazio ou apagado
        return `
            <div class="horario-card vazio" style="opacity: 0.4;">
                <div class="canal-foto-container"></div>
                <span class="hora">${hora}</span>
                <span class="canal-nome">Livre</span>
            </div>`;
    }
    return `
        <div class="horario-card">
            <div class="canal-foto-container">
                <img src="${canal.foto_perfil}" class="grade-canal-thumb">
            </div>
            <span class="hora">${hora}</span>
            <span class="canal-nome">${canal.nome_canal}</span>
        </div>
    `;
},

// Dentro do objeto UI:
renderizarPodio(ranking) {
    const posicoes = [
        { seletorImg: '.lugar-1 .podio-avatar', seletorViews: '#podio-views-1', index: 0 },
        { seletorImg: '.lugar-2 .podio-avatar', seletorViews: '#podio-views-2', index: 1 },
        { seletorImg: '.lugar-3 .podio-avatar', seletorViews: '#podio-views-3', index: 2 }
    ];

    posicoes.forEach(pos => {
        const imgElemento = document.querySelector(pos.seletorImg);
        const viewsElemento = document.querySelector(pos.seletorViews);
        const dadosCanal = ranking[pos.index];

        if (dadosCanal) {
            // Atualiza a imagem
            if (imgElemento) {
                imgElemento.src = dadosCanal.foto_perfil;
                imgElemento.style.opacity = "1";
                imgElemento.title = dadosCanal.nome_canal;
            }
            // Atualiza as views com o ícone (O Pulo do Gato)
            if (viewsElemento) {
                viewsElemento.innerHTML = `
                    <i class="fas fa-eye" style="font-size: 0.7rem; color: var(--azul-link); margin-right: 4px;"></i>
                    ${Utils.formatarNumero(dadosCanal.viewsRanking)}
                `;
                viewsElemento.parentElement.style.opacity = "1";
            }
        } else {
            if (imgElemento) imgElemento.style.opacity = "0.3";
            if (viewsElemento) viewsElemento.parentElement.style.opacity = "0";
        }
    });
},

async renderizarPlacarCampeonato(canais) {
    const containerPlacar = document.getElementById('lista-ranking-home');
    if (!containerPlacar || !canais) return;

    try {
        const token = Utils.getToken();
        const agora = Date.now();

        const promessas = canais.map(async (canal) => {
            try {
                const atualizadoRecentemente = canal.last_updated && 
                    (agora - new Date(canal.last_updated).getTime() < 10 * 60 * 1000);

                if (atualizadoRecentemente && canal.last_video_views) {
                    return { ...canal, viewsRanking: canal.last_video_views, tituloRanking: canal.last_video_title };
                }

                if (token && (window.apiCalls || 0) < 50) { 
                    window.apiCalls = (window.apiCalls || 0) + 1;
                    
                    const videoAPI = await Promise.race([
                        DataService.getVideosRecentes(canal.canal_id_youtube, token),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                    ]);

                    if (videoAPI?.length > 0) {
                        const stats = videoAPI[0].statistics;
                        const views = parseInt(stats.viewCount);
                        const likes = parseInt(stats.likeCount || 0);
                        const comments = parseInt(stats.commentCount || 0);
                        const titulo = videoAPI[0].snippet.title;

                        Utils.saveVideoCache(canal.canal_id_youtube, videoAPI);
                        DataService.atualizarDadosVideoNoBanco(canal.canal_id_youtube, titulo, views, likes, comments);

                        return { ...canal, viewsRanking: views, likesRanking: likes, commentsRanking: comments, tituloRanking: titulo };
                    }
                }
            } catch (err) {
                console.warn(`⚠️ Canal ${canal.nome_canal} falhou, usando fallback.`, err);
            }

            return { 
                ...canal, 
                viewsRanking: canal.last_video_views || 0, 
                tituloRanking: canal.last_video_title || "Sem dados" 
            };
        });

        const resultadosRaw = await Promise.allSettled(promessas);
        const resultados = resultadosRaw
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        const rankingOrdenado = resultados.sort((a, b) => b.viewsRanking - a.viewsRanking);
        this.renderizarPodio(rankingOrdenado);

        const placarRestante = rankingOrdenado.slice(3);

        const somaViewsDia = rankingOrdenado.slice(0, 10).reduce((acc, canal) => acc + (canal.viewsRanking || 0), 0);
        const elementoViewsDia = document.getElementById('yt-views-dia');
        if (elementoViewsDia) elementoViewsDia.innerText = Utils.formatarNumero(somaViewsDia);

        containerPlacar.innerHTML = placarRestante.map((canal, index) => {
            const posicaoReal = index + 4;
            return `
            <div class="ranking-item-compacto">
                <div class="ranking-posicao">#${posicaoReal}</div>
                <img src="${canal.foto_perfil}" class="ranking-canal-thumb">
                <div class="ranking-canal-info">
                    <span class="ranking-canal-nome">${canal.nome_canal}</span>
                    <span class="ranking-canal-video">${canal.tituloRanking}</span>
                    <div style="display: flex; gap: 10px; margin-top: 4px;">
                        <span style="font-size: 0.65rem; color: #ff4b4b; display: flex; align-items: center; gap: 3px;">
                            <i class="fas fa-heart"></i> ${Utils.formatarNumero(canal.likesRanking || 0)}
                        </span>
                        <span style="font-size: 0.65rem; color: #aaa; display: flex; align-items: center; gap: 3px;">
                            <i class="fas fa-comment"></i> ${Utils.formatarNumero(canal.commentsRanking || 0)}
                        </span>
                    </div>
                </div>
                <div class="ranking-views-destaque">${Utils.formatarNumero(canal.viewsRanking)} views</div>
            </div>`;
        }).join('');

        if (placarRestante.length === 0) {
            containerPlacar.innerHTML = '<p style="text-align:center; padding:20px; color:var(--texto-cinza); font-size:0.8rem;">Aguardando mais competidores...</p>';
        }

    } catch (error) {
        console.error("Erro crítico no ranking:", error);
    }
},
  // Dentro do objeto UI:
initNavegacao() {
    // Agora pega os links do menu superior E da sidebar lateral
    const links = document.querySelectorAll('.nav-links a, .sidebar-links a');
    
    links.forEach(link => {
        link.onclick = (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const abaNome = href.replace('#', '');
                this.trocarAba(abaNome);
            }
        };
    });
},


trocarAba(alvo) {
    // 1. Esconde TODAS as seções possíveis usando os dois seletores
    const abas = document.querySelectorAll('.secao-aba, .tab-content');
    abas.forEach(aba => {
        aba.style.display = 'none';
    });

    // 2. Encontra a aba alvo
    const abaAlvo = document.getElementById(`aba-${alvo}`);
    
    if (abaAlvo) {
        // AJUSTE AQUI: Se for dashboard, usa grid, senão usa block
        if (alvo === 'dashboard') {
            abaAlvo.style.display = 'grid';
        } else {
            abaAlvo.style.display = 'block';
        }
        
        // 3. Feedback visual nos links (remove de todos e põe no certo)
        document.querySelectorAll('.nav-links a, .sidebar-links a').forEach(l => l.classList.remove('active'));
        const linksAtivos = document.querySelectorAll(`a[href="#${alvo}"]`);
        linksAtivos.forEach(link => link.classList.add('active'));

        // 4. Fecha a sidebar automaticamente ao clicar (para mobile)
        const sidebar = document.getElementById("sidebar-menu");
        if (sidebar) sidebar.classList.remove("sidebar-open");

    } else {
        console.warn(`⚠️ A seção "#aba-${alvo}" não foi encontrada.`);
    }
},


   initModal() {
    // Busca o botão no momento da inicialização
    const btnAbrir = document.querySelector('.btn-conectar');
    const modal = document.getElementById('modalConexao');
    const btnFechar = document.querySelector('.fechar-modal');

    if (btnAbrir && modal) {
        btnAbrir.onclick = () => {
            modal.style.display = 'block';
            console.log("Modal de conexão aberto");
        };
    }

    if (btnFechar && modal) {
        btnFechar.onclick = () => modal.style.display = 'none';
    }

    // Fecha o modal ao clicar fora dele
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
},


async atualizarBarraCanais(canais) {
    if (!this.elementos.bar || !canais) return;
    this.elementos.bar.innerHTML = '';
    
    // Recupera o ID do canal que você salvou por último
    const canalSalvoId = localStorage.getItem('canalAtivoId');

    canais.forEach((canal, index) => {
        // --- 1. LÓGICA DE DETECÇÃO ---
        const videosCache = Utils.getVideoCache(canal.canal_id_youtube) || [];
        let temVideoZerado = videosCache.length > 0 && parseInt(videosCache[0].statistics?.viewCount) === 0;

        // --- 2. CRIAÇÃO DOS ELEMENTOS ---
        const container = document.createElement('div');
        container.className = 'canal-avatar-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        container.style.cursor = 'pointer';

        const img = document.createElement('img');
        img.src = canal.foto_perfil;
        img.title = canal.nome_canal;
        img.className = 'canal-thumb-circular';
        
        // Verifica se é o canal ativo para já marcar como selecionado ao carregar
        if (canal.canal_id_youtube === canalSalvoId) {
            img.classList.add('selecionado');
        }

        if (temVideoZerado) img.style.border = '2px solid #ff3333';

        if (temVideoZerado) {
            const badge = document.createElement('span');
            badge.className = 'badge-video-zerado';
            badge.style.position = 'absolute';
            badge.style.top = '-2px';
            badge.style.right = '-2px';
            badge.style.width = '12px';
            badge.style.height = '12px';
            badge.style.backgroundColor = '#ff3333';
            badge.style.borderRadius = '50%';
            badge.style.animation = 'pulsarAlerta 2s infinite';
            container.appendChild(badge);
        }
        container.appendChild(img);

        // --- 3. LÓGICA DO CLIQUE ---
        container.onclick = async () => {
            // 1. Busca dados frescos do banco
            const { data: canalFresh } = await supabaseClient
                .from('canais_youtube')
                .select('*')
                .eq('canal_id_youtube', canal.canal_id_youtube)
                .single();

            // Define o canal ativo priorizando os dados frescos
            this.canalAtivo = canalFresh || canal; 
            localStorage.setItem('canalAtivoId', this.canalAtivo.canal_id_youtube);

            // 2. UI: Atualiza visual da barra
            this.elementos.bar.querySelectorAll('.canal-thumb-circular').forEach(i => i.classList.remove('selecionado'));
            img.classList.add('selecionado');

            // 3. UI: Preenche dados no painel
            document.getElementById('nome-canal-ativo').textContent = this.canalAtivo.nome_canal;
            document.getElementById('yt-subs').textContent = Utils.formatarNumero(this.canalAtivo.subscriber_count);
            document.getElementById('yt-views').textContent = Utils.formatarNumero(this.canalAtivo.view_count);
            document.getElementById('yt-videos').textContent = this.canalAtivo.video_count;
            
            this.elementos.listaVideos.innerHTML = `<p style="color: var(--texto-cinza);"><i class="fas fa-spinner fa-spin"></i> Carregando...</p>`;
            
            // 4. Lógica de API
            const videosCacheClick = Utils.getVideoCache(this.canalAtivo.canal_id_youtube);
            if (videosCacheClick) {
                this.renderizarVideos(videosCacheClick);
                return;
            }

            try {
                let token = this.canalAtivo.google_access_token || Utils.getToken();
                
                if (!token) {
                    const { data: { session } } = await supabaseClient.auth.getSession();
                    token = session?.provider_token;
                    if (token) Utils.setToken(token);
                }

                if (!token) throw new Error("Token não encontrado.");

                const videos = await DataService.getVideosRecentes(this.canalAtivo.canal_id_youtube, token);
                
                if (videos && videos.length > 0) {
                    Utils.saveVideoCache(this.canalAtivo.canal_id_youtube, videos);
                    this.renderizarVideos(videos);
                } else {
                    this.elementos.listaVideos.innerHTML = `<p style="color: var(--texto-cinza);">Nenhum vídeo recente encontrado.</p>`;
                }
            } catch (err) {
                console.error("Erro ao buscar dados:", err);
                this.elementos.listaVideos.innerHTML = `
                    <div style="color: #ffaa00; text-align: center; padding: 20px;">
                        <p>Falha ao carregar vídeos.</p>
                        <button class="btn-conectar" onclick="UI.elementos.modal.style.display='block'">
                            Reconectar Conta
                        </button>
                    </div>`;
            }
        };

        // --- 4. INSERÇÃO NO DOM ---
        this.elementos.bar.appendChild(container);
    }); 
},


renderizarVideos(videos) {
    // 1. Busca todos os containers de vídeo nas duas abas (Dashboard e Programação)
    const containers = document.querySelectorAll('#lista-videos');
    
    if (containers.length === 0) return;

    if (!videos || videos.length === 0) {
        const msgVazio = `<p style="color: var(--texto-cinza); padding: 20px;">Nenhum vídeo disponível ou limite atingido.</p>`;
        containers.forEach(c => c.innerHTML = msgVazio);
        return;
    }

    // =========================================================================
    // 📊 ALGORITMO AVANÇADO: ISOLAMENTO DE CANAIS NOVOS E FLOP DE RETENÇÃO (ATUALIZADO 500 VIEWS)
    // =========================================================================
    let indicadorStatus = 'amarelo'; 
    let textoDica = 'Analisando comportamento do algoritmo...';
    let corGlow = '#ffcc00';

    if (videos.length >= 1) {
        const videoAtual = videos[0];
        const viewsAtual = parseInt(videoAtual.statistics?.viewCount) || 0;
        const dataPublicacao = new Date(videoAtual.snippet?.publishedAt);

        if (videos.length >= 2) {
            const videoAnterior = videos[1];
            const viewsAnterior = parseInt(videoAnterior.statistics?.viewCount) || 0;

            // 🔴 REGRA 1 ATUALIZADA: FLOP REAL / METADADO OU CANAL TRAVADO (Menos de 500 views)
            if (viewsAtual < 500) {
                indicadorStatus = 'vermelho';
                corGlow = '#ff3333';
                
                const dataLib = new Date(dataPublicacao);
                dataLib.setDate(dataLib.getDate() + 3);
                const dataFormatada = dataLib.toLocaleDateString('pt-BR');
                
                textoDica = `Bloqueio de Entrega Severo (${viewsAtual} views). O algoritmo travou abaixo de 500 views. Possível erro de metadados ou retenção. Forçar repouso absoluto de 2 dias inteiros. Próxima postagem em: <strong>${dataFormatada}</strong>.`;
            }
            
            // 🟡 REGRA 2: CANAL EM MATURAÇÃO (Entre 500 e 999 views)
            else if (viewsAtual < 1000) {
                indicadorStatus = 'amarelo';
                corGlow = '#ffcc00';
                
                const dataLib = new Date(dataPublicacao);
                dataLib.setDate(dataLib.getDate() + 2);
                const dataFormatada = dataLib.toLocaleDateString('pt-BR');
                
                textoDica = `Canal em Maturação (${viewsAtual} views). Fora do perigo, mas abaixo de 1k estável. Intercalar dias de postagem (Dia sim, Dia não). Próxima postagem recomendada em: <strong>${dataFormatada}</strong>.`;
            }

            // 🟢 REGRA 3: TRAÇÃO DE ALTA PERFORMANCE (1000+ views e estável/crescendo)
            else if (viewsAtual >= viewsAnterior && viewsAtual >= 1000) {
                indicadorStatus = 'verde';
                corGlow = '#00ff66';
                
                const dataLib = new Date(dataPublicacao);
                dataLib.setDate(dataLib.getDate() + 1);
                const dataFormatada = dataLib.toLocaleDateString('pt-BR');
                
                textoDica = `Alta Performance Destravada! (${viewsAtual} views). Canal aquecido e pronto para receber conteúdo diário sequencial. Próxima postagem recomendada em: <strong>${dataFormatada}</strong>.`;
            }
            
            // Passou de 1k mas caiu em relação ao anterior
            else {
                indicadorStatus = 'amarelo';
                corGlow = '#ffcc00';
                
                const dataLib = new Date(dataPublicacao);
                dataLib.setDate(dataLib.getDate() + 2);
                const dataFormatada = dataLib.toLocaleDateString('pt-BR');
                
                textoDica = `Alerta de Desaceleração (${viewsAtual} views). Rompeu o piso de 1k, mas rendeu menos que o anterior. Recomenda-se ritmo intercalado. Próxima postagem recomendada em: <strong>${dataFormatada}</strong>.`;
            }

        } else {
            // Tratamento básico para canais com apenas 1 vídeo na conta
            if (viewsAtual < 500) {
                indicadorStatus = 'vermelho';
                corGlow = '#ff3333';
            } else {
                indicadorStatus = viewsAtual >= 1000 ? 'verde' : 'amarelo';
                corGlow = indicadorStatus === 'verde' ? '#00ff66' : '#ffcc00';
            }
            
            const dataLib = new Date(dataPublicacao);
            dataLib.setDate(dataLib.getDate() + (indicadorStatus === 'verde' ? 1 : (indicadorStatus === 'vermelho' ? 3 : 2)));
            const dataFormatada = dataLib.toLocaleDateString('pt-BR');

            if (indicadorStatus === 'vermelho') {
                textoDica = `Vídeo único travado abaixo de 500 views (${viewsAtual}). Aguarde o reset do canal de 2 dias. Próxima postagem em: <strong>${dataFormatada}</strong>.`;
            } else {
                textoDica = indicadorStatus === 'verde' 
                    ? `Bom início! Passou de 1k. Canal liberado para ritmo diário. Próxima postagem em: <strong>${dataFormatada}</strong>.` 
                    : `Vídeo único em análise abaixo de 1k. Intercale o próximo envio. Próxima postagem recomendada em: <strong>${dataFormatada}</strong>.`;
            }
        }
    }

    // HTML do bloco de alerta em Glassmorphism (Preservado)
    const htmlStatusPostagem = `
        <div class="status-postagem-alerta" style="
            display: flex; 
            align-items: center; 
            gap: 12px; 
            margin-bottom: 20px; 
            padding: 14px 18px; 
            border-radius: 16px; 
            background: rgba(255,255,255,0.01);
            border: 0.5px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            box-shadow: inset 0 1px 1px rgba(255,255,255,0.1), 0 8px 20px rgba(0,0,0,0.2);
        ">
            <div style="
                width: 14px; 
                height: 14px; 
                border-radius: 4px; 
                background-color: ${corGlow};
                box-shadow: 0 0 14px ${corGlow}, 0 0 4px ${corGlow};
                flex-shrink: 0;
            "></div>
            <span style="font-size: 13px; color: #ffffff; font-weight: 500; line-height: 1.4;">
                <strong>Diagnóstico do Algoritmo:</strong> ${textoDica}
            </span>
        </div>
    `;
    // =========================================================================

    // Ícone de visualizações padronizado
    const iconeOlhoSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width:14px; height:14px;"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"></path><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.147.826 0 1.207A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path></svg>`;

    // 3. Mapeamento e geração do HTML (Modificado com o botão integrado)
    const htmlVideos = videos.map(v => {
        const views = v.statistics ? Utils.formatarNumero(v.statistics.viewCount) : '0';
        const likes = v.statistics ? Utils.formatarNumero(v.statistics.likeCount || 0) : '0';
        const comments = v.statistics ? Utils.formatarNumero(v.statistics.commentCount || 0) : '0';
        const dataPostagem = new Date(v.snippet.publishedAt).toLocaleDateString('pt-BR');
        const urlVideo = `https://www.youtube.com/watch?v=${v.id}`;
        
        return `
        <div class="video-card" style="position: relative; display: flex; text-decoration: none; cursor: default;">
            <a href="${urlVideo}" target="_blank" style="display: flex; gap: inherit; text-decoration: none; color: inherit; width: 100%; flex: 1;">
                <img src="${v.snippet.thumbnails.medium.url}" class="video-thumb" alt="Thumbnail">
                <div class="video-detalhes" style="flex: 1; padding-right: 40px;">
                    <span class="video-titulo" title="${v.snippet.title}">${v.snippet.title}</span>
                    
                    <div style="display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap;">
                        <span class="video-meta">${dataPostagem}</span>
                        
                        <span style="display:flex; align-items:center; gap:4px; color:#3fb950; font-size:11px; font-weight:bold;">
                            ${iconeOlhoSVG} ${views}
                        </span>
                        
                        <span style="display:flex; align-items:center; gap:4px; color:#ff4b4b; font-size:11px; font-weight:bold;">
                            <i class="fas fa-heart" style="font-size: 10px;"></i> ${likes}
                        </span>
                        
                        <span style="display:flex; align-items:center; gap:4px; color:#aaa; font-size:11px; font-weight:bold;">
                            <i class="fas fa-comment" style="font-size: 10px;"></i> ${comments}
                        </span>
                    </div>
                </div>
            </a>

            <button class="btn-copiar-link" 
                    data-url="${urlVideo}"
                    title="Copiar link do vídeo"
                    onclick="navigator.clipboard.writeText(this.getAttribute('data-url')).then(() => {
                        const icon = this.querySelector('i');
                        const text = this.querySelector('.tooltip-copiar');
                        icon.className = 'fas fa-check';
                        this.style.color = '#3fb950';
                        this.style.background = 'rgba(63, 185, 80, 0.15)';
                        text.innerText = 'Copiado!';
                        setTimeout(() => {
                            icon.className = 'fas fa-copy';
                            this.style.color = '#aaa';
                            this.style.background = 'rgba(255, 255, 255, 0.05)';
                            text.innerText = 'Copiar Link';
                        }, 2000);
                    })"
                    style="
                        position: absolute;
                        right: 16px;
                        top: 50%;
                        transform: translateY(-50%);
                        width: 32px;
                        height: 32px;
                        border-radius: 8px;
                        background: rgba(255, 255, 255, 0.05);
                        border: 0.5px solid rgba(255, 255, 255, 0.1);
                        color: #aaa;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s ease;
                        z-index: 10;
                    "
                    onmouseenter="this.style.background='rgba(255,255,255,0.12)'; this.style.color='#fff'; this.querySelector('.tooltip-copiar').style.opacity='1'; this.querySelector('.tooltip-copiar').style.transform='translateX(0) translateY(-50%)';"
                    onmouseleave="if(this.querySelector('i').className !== 'fas fa-check') { this.style.background='rgba(255,255,255,0.05)'; this.style.color='#aaa'; } this.querySelector('.tooltip-copiar').style.opacity='0'; this.querySelector('.tooltip-copiar').style.transform='translateX(8px) translateY(-50%)';"
            >
                <i class="fas fa-copy" style="font-size: 13px; transition: transform 0.1s;"></i>
                
                <span class="tooltip-copiar" style="
                    position: absolute;
                    right: 42px;
                    top: 50%;
                    transform: translateX(8px) translateY(-50%);
                    background: #161b22;
                    border: 0.5px solid rgba(255,255,255,0.15);
                    color: #fff;
                    padding: 5px 9px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    white-space: nowrap;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.2s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                ">Copiar Link</span>
            </button>
        </div>`;
    }).join('');

    // 4. Injeção Final
    containers.forEach(container => {
        container.innerHTML = htmlStatusPostagem + htmlVideos;
    });
},

renderizarAbaEstrategia(listaCanais) {
    const tabelaCorpo = document.getElementById('tabela-estrategia-corpo');
    if (!tabelaCorpo) return;
    tabelaCorpo.innerHTML = '';

    listaCanais.forEach(canal => {
        // Busca os vídeos do canal armazenados no cache do seu sistema
        const videos = Utils.getVideoCache(canal.canal_id_youtube) || [];
        
        let viewsAtual = 0;
        let viewsAnterior = 0;
        let indicadorStatus = 'amarelo';
        let corGlow = '#ffcc00';
        let textoStatus = 'Aguardar Respiro';
        
        // Data base padrão caso não tenha vídeos (inicia com hoje)
        let dataLiberada = new Date(); 

        if (videos.length >= 1) {
            viewsAtual = parseInt(videos[0].statistics?.viewCount) || 0;
            const dataPublicacao = new Date(videos[0].snippet?.publishedAt);

            // A data base de cálculo é o dia da postagem do vídeo
            dataLiberada = new Date(dataPublicacao);

            if (videos.length >= 2) {
                viewsAnterior = parseInt(videos[1].statistics?.viewCount) || 0;

                // 🔴 CRITÉRIO VERMELHO ATUALIZADO: Abaixo de 500 views = Flop/Gargalo de algoritmo. 
                // Exige 2 dias inteiros de descanso (Soma 3 dias à postagem original: Ex: 24 + 3 = 27)
                if (viewsAtual < 500) {
                    indicadorStatus = 'vermelho';
                    textoStatus = 'Bloqueado / Flop';
                    corGlow = '#ff3333';
                    dataLiberada.setDate(dataLiberada.getDate() + 3); 
                } 
                // 🟡 CRITÉRIO AMARELO: Entre 500 e 999 views = Maturação (Intercalar - Soma 2 dias à postagem)
                else if (viewsAtual < 1000) {
                    indicadorStatus = 'amarelo';
                    textoStatus = 'Maturação (Intercalar)';
                    corGlow = '#ffcc00';
                    dataLiberada.setDate(dataLiberada.getDate() + 2); 
                } 
                // 🟢 CRITÉRIO VERDE: 1000+ views e subindo = Alta Performance (Diário - Soma 1 dia à postagem)
                else if (viewsAtual >= viewsAnterior && viewsAtual >= 1000) {
                    indicadorStatus = 'verde';
                    textoStatus = 'Alta Performance';
                    corGlow = '#00ff66';
                    dataLiberada.setDate(dataLiberada.getDate() + 1); 
                } 
                // Passou de 1k mas rendeu menos que o vídeo anterior
                else {
                    indicadorStatus = 'amarelo';
                    textoStatus = 'Desaceleração';
                    corGlow = '#ffcc00';
                    dataLiberada.setDate(dataLiberada.getDate() + 2);
                }
            } else {
                // Caso o canal só tenha 1 vídeo cadastrado
                if (viewsAtual < 500) {
                    indicadorStatus = 'vermelho';
                    textoStatus = 'Bloqueado / Flop';
                    corGlow = '#ff3333';
                    dataLiberada.setDate(dataLiberada.getDate() + 3);
                } else if (viewsAtual < 1000) {
                    indicadorStatus = 'amarelo';
                    textoStatus = 'Maturação (Intercalar)';
                    dataLiberada.setDate(dataLiberada.getDate() + 2);
                } else {
                    indicadorStatus = 'verde';
                    textoStatus = 'Alta Performance';
                    corGlow = '#00ff66';
                    dataLiberada.setDate(dataLiberada.getDate() + 1);
                }
            }
        } else {
            // Se o canal não tiver histórico no cache do navegador ainda
            indicadorStatus = 'cinza';
            textoStatus = 'Pendente (Carregar)';
            corGlow = '#aaaaaa'; 
        }

        // Formata as datas para exibição e validação no padrão brasileiro (dd/mm/aaaa)
        const dataFormatada = dataLiberada.toLocaleDateString('pt-BR');
        
        // Zera as horas para fazer uma comparação justa de calendário (Dia com Dia)
        const apenasDataLiberada = new Date(dataLiberada).setHours(0,0,0,0);
        const apenasDataHoje = new Date().setHours(0,0,0,0);
        
        let badgeData = '';
        if (indicadorStatus === 'cinza') {
            badgeData = `<span style="color: #666; font-style: italic;"><i class="fas fa-sync"></i> Abra o card na dashboard</span>`;
        } else {
            // Se o dia calculado é hoje ou já passou, o canal está oficialmente livre
            const prazoVencidoOuHoje = apenasDataLiberada <= apenasDataHoje;
            
            badgeData = prazoVencidoOuHoje 
                ? `<span style="background: rgba(0,255,102,0.15); color: #00ff66; padding: 4px 8px; border-radius: 6px; font-weight: bold; border: 0.5px solid rgba(0,255,102,0.3);"><i class="fas fa-check-circle"></i> LIBERADO HOJE</span>`
                : `<span style="color: #aaa; font-weight: 500;"><i class="far fa-calendar-alt"></i> ${dataFormatada}</span>`;
        }

        // Monta a linha da tabela para o canal correspondente
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        
        tr.innerHTML = `
            <td style="padding: 14px; display: flex; align-items: center; gap: 12px;">
                <img src="${canal.foto_perfil}" style="width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.2);">
                <span style="font-weight: 600;">${canal.nome_canal}</span>
            </td>
            <td style="padding: 14px; color: ${indicadorStatus === 'cinza' ? '#666' : (viewsAtual < 500 ? '#ff4b4b' : '#fff')}">
                ${indicadorStatus === 'cinza' ? '---' : Utils.formatarNumero(viewsAtual) + ' views'}
            </td>
            <td style="padding: 14px; color: #aaa;">
                ${indicadorStatus === 'cinza' ? '---' : Utils.formatarNumero(viewsAnterior) + ' views'}
            </td>
            <td style="padding: 14px; text-align: center;">
                <span style="
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: bold;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid ${corGlow};
                    color: ${corGlow};
                    text-shadow: 0 0 8px ${corGlow}44;
                ">${textoStatus}</span>
            </td>
            <td style="padding: 14px; font-size: 13px;">${badgeData}</td>
        `;
        tabelaCorpo.appendChild(tr);
    });
},


atualizarListaGerenciamento(canais) {
    if (!this.elementos.listaCanais || !canais) return;
    
    // O .map cria o HTML de cada card e o .join('') transforma o array em uma única string
    this.elementos.listaCanais.innerHTML = canais.map(canal => `
        <div class="canal-card">
            <div class="canal-info">
                <img src="${canal.foto_perfil}" alt="${canal.nome_canal}">
                <div class="canal-detalhes">
                    <h3 class="canal-nome">${canal.nome_canal}</h3>
                    <span class="status conectado">${Utils.formatarNumero(canal.subscriber_count)} inscritos</span>
                </div>
            </div>
            <button class="btn-acao" onclick="UI.trocarAba('dashboard')">Ver Estatísticas</button>
        </div>
    `).join('');
}
};

//=============================
// 4. MODULO DE DADOS
//=============================
const DataService = {
    async getCanais() {
        const { data } = await supabaseClient.from('canais_youtube').select('*');
        return data;
    },

    async atualizarDadosVideoNoBanco(canalId, titulo, views, likes, comentarios) {
        await supabaseClient
            .from('canais_youtube')
            .update({ 
                last_video_title: titulo, 
                last_video_views: views,
                last_video_likes: likes,        
                last_video_comments: comentarios, 
                last_updated: new Date().toISOString()
            })
            .eq('canal_id_youtube', canalId);
    },

    async getVideosRecentes(channelId, token) {
        if (!channelId) return [];
        try {
            const uploadsPlaylistId = channelId.replace('UC', 'UU');
            const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const playlistData = await playlistRes.json();
            
            if (playlistData.error) throw new Error(playlistData.error.message);
            if (!playlistData.items) return [];

            const videoIds = playlistData.items.map(item => item.contentDetails.videoId).join(',');
            const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statsData = await statsRes.json();
            return statsData.items || [];
        } catch (e) {
            console.error("Erro API YouTube:", e);
            return [];
        }
    },

    async salvarCanalYouTube(session) {
        if (!session || !session.provider_token) return false;
        const token = session.provider_token;

        try {
            const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            const data = await response.json();

            if (!response.ok || !data.items || data.items.length === 0) {
                console.error("❌ Erro na API do YouTube ou nenhum canal encontrado");
                return false;
            }

            const canal = data.items[0];
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            
            if (userError || !user) {
                console.error("❌ Erro ao obter usuário do Supabase:", userError);
                return false;
            }

            console.log("📤 Salvando canal e vinculando Tokens para:", canal.snippet.title);

            const dadosParaSalvar = {
                user_id: user.id,
                canal_id_youtube: canal.id,
                nome_canal: canal.snippet.title,
                foto_perfil: canal.snippet.thumbnails.default.url,
                subscriber_count: parseInt(canal.statistics.subscriberCount) || 0,
                view_count: parseInt(canal.statistics.viewCount) || 0,
                video_count: parseInt(canal.statistics.videoCount) || 0,
                google_access_token: session.provider_token, 
                google_refresh_token: session.provider_refresh_token || null, 
                last_updated: new Date().toISOString() 
            };

            if (!dadosParaSalvar.google_refresh_token) {
                delete dadosParaSalvar.google_refresh_token;
            }

            const { error: upsertError } = await supabaseClient
                .from('canais_youtube')
                .upsert(dadosParaSalvar, { onConflict: 'canal_id_youtube' });

            if (upsertError) {
                console.error("❌ Erro no Upsert (400):", upsertError.message);
                return false;
            }

            return true;
        } catch (e) {
            console.error("❌ Erro Crítico no Processo:", e);
        }
        return false;
    },

    async forcarAtualizacaoGlobal() {
        const icone = document.getElementById('icone-recarga');
        const botao = document.getElementById('btn-atualizar-youtube');
        
        if (icone && icone.classList.contains('fa-spin')) return;

        if (icone) icone.classList.add('fa-spin');
        if (botao) botao.style.pointerEvents = 'none'; 

        console.log("🔄 [TradeWR] Forçando atualização em tempo real com segurança...");
        
        try {
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('cache_v_')) {
                    sessionStorage.removeItem(key);
                }
            });

            if (typeof window.apiCalls !== 'undefined') window.apiCalls = 0; 

            const canalAtivo = document.querySelector('.canal-thumb-circular.selecionado');
            if (canalAtivo) {
                canalAtivo.click(); 
            }

            const todosCanais = await this.getCanais();
            if (todosCanais && typeof UI !== 'undefined' && typeof UI.renderizarPlacarCampeonato === 'function') {
                const canaisForcados = todosCanais.map(c => ({...c, last_updated: null}));
                
                UI.renderizarPlacarCampeonato(canaisForcados).catch(err => 
                    console.error("❌ Erro ao renderizar placar:", err)
                );
            }

        } catch (error) {
            console.error("❌ Erro crítico durante a atualização forçada:", error);
        } finally {
            setTimeout(() => {
                if (icone) icone.classList.remove('fa-spin');
                if (botao) botao.style.pointerEvents = 'auto'; 
                console.log("✅ [TradeWR] Processo de atualização concluído e travas liberadas.");
            }, 1200);
        }
    },

 //=======================================================
    // ATUALIZADO: ENVIAR OU PROGRAMAR VÍDEO / SHORTS COM AUTO-REFRESH
    //=======================================================
   async fazerUploadVideo(canalObjeto, arquivoVideo, dadosVideo) {
    // Busca no Supabase o registro mais atual do canal antes de subir
    const { data: canalAtualizado } = await supabaseClient
        .from('canais_youtube')
        .select('google_access_token, google_refresh_token')
        .eq('canal_id_youtube', canalObjeto.canal_id_youtube)
        .single();

    // Use o token mais recente, se existir
    let tokenAtual = canalAtualizado?.google_access_token || canalObjeto.google_access_token;
        let tentouRenovar = false;

        // Função interna para disparar a requisição de upload
        const executarRequisicaoUpload = async (tokenParaUso) => {
            console.log("🎬 Iniciando processo de envio para o YouTube...");
            const statusPrivacidade = dadosVideo.dataAgendamento ? "private" : (dadosVideo.privacidade || "public");

            const metadata = {
                snippet: {
                    title: dadosVideo.titulo || "Novo Vídeo Automatizado",
                    description: dadosVideo.descricao || "Enviado via TradeWR Posting App. #Shorts",
                    tags: dadosVideo.tags || ["shorts", "clips"],
                    categoryId: "22" 
                },
                status: {
                    privacyStatus: statusPrivacidade
                }
            };

            if (dadosVideo.dataAgendamento) {
                metadata.status.publishAt = new Date(dadosVideo.dataAgendamento).toISOString();
                console.log(`📅 Configurando publicação automática para: ${metadata.status.publishAt}`);
            }

            const boundary = "----TradeWRFormBoundary" + Math.random().toString(16).substring(2);
            const delimiter = `\r\n--${boundary}\r\n`;
            const closeDelimiter = `\r\n--${boundary}--`;

            const metadataPart = 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata);

            const carregarArquivoAsArrayBuffer = (file) => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = (err) => reject(err);
                    reader.readAsArrayBuffer(file);
                });
            };

            const arrayBufferVideo = await carregarArquivoAsArrayBuffer(arquivoVideo);
            const bytesVideo = new Uint8Array(arrayBufferVideo);

            const encoder = new TextEncoder();
            const inicioMultipart = encoder.encode(`${delimiter}${metadataPart}${delimiter}Content-Type: ${arquivoVideo.type}\r\n\r\n`);
            const fimMultipart = encoder.encode(closeDelimiter);

            const corpoFinal = new Uint8Array(inicioMultipart.length + bytesVideo.length + fimMultipart.length);
            corpoFinal.set(inicioMultipart, 0);
            corpoFinal.set(bytesVideo, inicioMultipart.length);
            corpoFinal.set(fimMultipart, inicioMultipart.length + bytesVideo.length);

            console.log("📤 Enviando pacotes de dados para os servidores do Google...");
            return await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenParaUso}`,
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Accept': 'application/json'
                },
                body: corpoFinal
            });
        };

        try {
            let response = await executarRequisicaoUpload(tokenAtual);

            // 🔄 Se der erro 401 (Token Expirou) e tivermos a chave mestre (Refresh Token)
            if (response.status === 401 && canalObjeto.google_refresh_token && !tentouRenovar) {
                console.warn("⚠️ Access Token de 1 hora expirou! Tentando renovação automática nos bastidores...");
                tentouRenovar = true;

                // Solicita novo access token diretamente ao Supabase OAuth
                const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession();
                
                if (!refreshError && refreshData?.session?.provider_token) {
                    tokenAtual = refreshData.session.provider_token;
                    console.log("✅ Novo Access Token gerado com sucesso via Supabase!");
                    
                    // Sincroniza e atualiza a linha do canal ativo na memória para o app não quebrar nas próximas ações
                    canalObjeto.google_access_token = tokenAtual;
                    if (UI.canalAtivo) UI.canalAtivo.google_access_token = tokenAtual;

                    // Tenta o upload novamente com o token novo zerado
                    response = await executarRequisicaoUpload(tokenAtual);
                } else {
                    console.error("❌ Supabase não conseguiu renovar o provider token automaticamente:", refreshError);
                }
            }

            const data = await response.json();

            if (!response.ok) {
                console.error("❌ Erro no upload da API do YouTube:", data.error);
                return { sucesso: false, erro: data.error?.message || "Erro desconhecido na API do YouTube" };
            }

            console.log("✅ Processo concluído com sucesso no YouTube! ID:", data.id);
            return { sucesso: true, videoId: data.id };

        } catch (error) {
            console.error("❌ Erro crítico no upload do vídeo:", error);
            return { sucesso: false, erro: error.message };
        }
    }
}; 


//=========================================
// 5. FUNÇÕES GLOBAIS
//=========================================
window.iniciarAuth = async (plataforma) => {
    if (plataforma === 'youtube' && supabaseClient) {
        await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                scopes: 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload', 
                queryParams: { 
                    access_type: 'offline', 
                    prompt: 'consent' // 🔥 Correto! Isto sozinho já força o ecrã de consentimento e traz o Refresh Token sem gerar Erro 400
                },
                redirectTo: window.location.origin
            }
        });
    }
};

window.sincronizarSistema = async () => {
    const btn = document.getElementById('btn-sync');
    if (!btn || btn.disabled) return;

    btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Renovando Acesso...';
    btn.disabled = true;

    try {
        console.log("🚀 Disparando renovação forçada via OAuth...");
        await window.iniciarAuth('youtube');
        btn.innerHTML = '<i class="fas fa-check"></i> Redirecionando...';
        
    } catch (err) {
        console.error("❌ Erro ao tentar sincronizar:", err);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro ao Abrir';
        btn.style.color = "#ff4444";
        
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Sincronizar Dados';
            btn.style.color = "";
            btn.disabled = false;
        }, 3000);
    }
};

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar-menu");
    if (sidebar) {
        sidebar.classList.toggle("sidebar-open");
    }
}


// ==================================================
// 6. INICIALIZAÇÃO ÚNICA E ESCUTADORES DE EVENTOS
// ==================================================
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializações Básicas da Interface
    UI.initNavegacao();
    UI.initModal();

    // ----------------------------------------------
    // 6.1. LOGICA DO DRAG & DROP E PREVIEW DE VÍDEO
    // ----------------------------------------------
    const dropzone = document.getElementById('dropzone-video');
    const inputArquivo = document.getElementById('input-video-arquivo');
    const containerVazio = document.getElementById('dropzone-vazio');
    const containerPreview = document.getElementById('dropzone-com-preview');
    const videoPlayer = document.getElementById('preview-video-player');
    const nomeArquivoTxt = document.getElementById('nome-arquivo-selecionado');
    const btnRemover = document.getElementById('btn-remover-video');

    if (dropzone && inputArquivo) {
        // Ao clicar na caixa de dropzone, dispara o clique do input oculto
        dropzone.addEventListener('click', (e) => {
            if (e.target.closest('#btn-remover-video') || e.target.closest('video')) return;
            inputArquivo.click();
        });

        // Quando o usuário seleciona o arquivo manualmente
        inputArquivo.addEventListener('change', () => {
            exibirVideoSelecionado(inputArquivo.files[0]);
        });

        // Eventos de Arrastar por cima da caixa (Drag & Drop)
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
            }, false);
        });

        // Quando o usuário solta o arquivo na caixa
        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const arquivos = dt.files;
            
            if (arquivos.length > 0 && arquivos[0].type.startsWith('video/')) {
                inputArquivo.files = arquivos; // Associa o arquivo ao input
                exibirVideoSelecionado(arquivos[0]);
            } else {
                alert('⚠️ Por favor, selecione apenas arquivos de vídeo válidos!');
            }
        });
    }

    // Função interna para renderizar o vídeo dentro da miniatura
    function exibirVideoSelecionado(arquivo) {
        if (!arquivo) return;
        if (nomeArquivoTxt) nomeArquivoTxt.textContent = arquivo.name;
        
        const urlBlob = URL.createObjectURL(arquivo);
        if (videoPlayer) videoPlayer.src = urlBlob;
        
        if (containerVazio) containerVazio.style.display = 'none';
        if (containerPreview) containerPreview.style.display = 'flex';
    }

    // Ação do botão remover (X) na miniatura
    if (btnRemover) {
        btnRemover.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inputArquivo) inputArquivo.value = ''; 
            if (videoPlayer) videoPlayer.src = '';
            if (containerPreview) containerPreview.style.display = 'none';
            if (containerVazio) containerVazio.style.display = 'block';
        });
    }


    // ====== AQUI NO FINAL DA 6.1, JUNTO COM OS OUTROS ELEMENTOS DE TELA ======
    const campoData = document.getElementById('input-agendamento');
    const wrapperAgendamento = document.getElementById('wrapper-agendamento');

    // 📅 Força a abertura do calendário ao clicar em qualquer lugar da caixa do input
    if (campoData) {
        campoData.addEventListener('click', () => {
            if (typeof campoData.showPicker === 'function') {
                try { campoData.showPicker(); } catch (err) { console.log(err); }
            }
        });
    }

    // Se clicar no Label "Programar Publicação", foca e abre também!
    if (wrapperAgendamento && campoData) {
        const labelAgendamento = wrapperAgendamento.querySelector('label');
        if (labelAgendamento) {
            labelAgendamento.addEventListener('click', (e) => {
                e.preventDefault(); 
                campoData.focus();
                if (typeof campoData.showPicker === 'function') { campoData.showPicker(); }
            });
        }
    }



    // ----------------------------------------------
    // 6.2. CONFIGURAÇÃO DO BOTÃO DE PUBLICAR (UPLOAD)
    // ----------------------------------------------
    const botaoPostar = document.getElementById('btn-enviar-video');
    if (botaoPostar) {
        botaoPostar.addEventListener('click', async () => {
            const canalSelecionado = UI.canalAtivo; 

            if (!canalSelecionado) {
                alert("⚠️ Por favor, selecione um canal na barra superior antes de postar!");
                return;
            }

            // 🔑 Pega o token exclusivo salvo na linha deste canal!
            const tokenGoogle = canalSelecionado.google_access_token; 
            
            const inputVideo = inputArquivo ? inputArquivo.files[0] : null; 
            const tituloVal = document.getElementById('input-titulo').value;
            const descricaoVal = document.getElementById('input-descricao').value;
            
            const campoData = document.getElementById('input-agendamento'); 
            const dataAgendamentoVal = campoData ? campoData.value : null;

            if (!tokenGoogle) {
                alert(`⚠️ Token para este canal não encontrado no banco. Reconecte este canal uma vez.`);
                return;
            }
            if (!inputVideo) {
                alert("⚠️ Por favor, selecione ou arraste um arquivo de vídeo.");
                return;
            }
            if (!tituloVal.trim()) {
                alert("⚠️ O título do vídeo é obrigatório.");
                return;
            }

            if (dataAgendamentoVal && new Date(dataAgendamentoVal) <= new Date()) {
                alert("⚠️ A data e hora de agendamento precisam ser no futuro!");
                return;
            }

            botaoPostar.disabled = true;
            
            if (dataAgendamentoVal) {
                botaoPostar.innerHTML = `<i class="fas fa-calendar-alt fa-spin"></i> Agendando para ${canalSelecionado.nome_canal || 'YouTube'}...`;
            } else {
                botaoPostar.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando para ${canalSelecionado.nome_canal || 'YouTube'}...`;
            }

            const dadosDoPost = {
                titulo: tituloVal,
                descricao: descricaoVal,
                tags: ['cortes', 'clips', 'viral'],
                privacidade: 'public',
                dataAgendamento: dataAgendamentoVal 
            };

            const resultado = await DataService.fazerUploadVideo(canalSelecionado, inputVideo, dadosDoPost);

            botaoPostar.disabled = false;
            botaoPostar.innerHTML = '<i class="fas fa-upload"></i> Postar no YouTube';

            if (resultado.sucesso) {
                if (dataAgendamentoVal) {
                    const dataFormatada = new Date(dataAgendamentoVal).toLocaleString('pt-BR');
                    alert(`📅 Vídeo AGENDADO com sucesso para o canal: ${canalSelecionado.nome_canal || ''}!\nEle vai ao ar em: ${dataFormatada}`);
                } else {
                    alert(`🚀 Vídeo postado IMEDIATAMENTE no canal: ${canalSelecionado.nome_canal || ''}!\nID do Vídeo: ${resultado.videoId}`);
                }
                
                document.getElementById('input-titulo').value = '';
                document.getElementById('input-descricao').value = '';
                if (inputArquivo) inputArquivo.value = '';
                if (videoPlayer) videoPlayer.src = '';
                if (containerPreview) containerPreview.style.display = 'none';
                if (containerVazio) containerVazio.style.display = 'block';
                if (campoData) campoData.value = ''; 
            } else {
                alert(`❌ Falha no Envio: ${resultado.erro}`);
            }
        });
    }


    // ----------------------------------------------
    // 6.3. ADICIONA EVENTOS DE NAVEGAÇÃO DE REDES
    // ----------------------------------------------
    const botoesRede = document.querySelectorAll('.social-nav-container .social-nav-btn');
    botoesRede.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const urlDestino = btn.getAttribute('data-url');
            if (!urlDestino || urlDestino.trim() === "" || btn.classList.contains('ativo')) return;
            window.location.href = urlDestino;
        });
    });


    // ----------------------------------------------
    // 6.4. CONTROLE DE SESSÃO E CARREGAMENTO SUPABASE
    // ----------------------------------------------
    if (supabaseClient) {
        const obterTokenValido = async () => {
            try {
                const { data: { session }, error } = await supabaseClient.auth.refreshSession();
                if (error || !session) return Utils.getToken();

                if (session.provider_token) {
                    console.log("🔄 Token do Google renovado automaticamente via Supabase!");
                    Utils.setToken(session.provider_token);
                    return session.provider_token;
                }
            } catch (err) {
                console.error("❌ Erro na tentativa de auto-refresh:", err);
            }
            return Utils.getToken();
        };

        const carregarUI = async () => {
            console.log("📥 Carregando dashboard principal...");
            const canais = await DataService.getCanais();
            
            UI.atualizarBarraCanais(canais);
            UI.atualizarListaGerenciamento(canais);
            UI.renderizarGradeDinamica(canais);
            UI.renderizarAbaEstrategia(canais);

            UI.renderizarPlacarCampeonato(canais).then(() => {
                console.log("✅ Placar do campeonato updated.");
            });
        };

        // Captura inicial da sessão
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session?.provider_token) {
            console.log("🎫 Token inicial detectado!");
            Utils.setToken(session.provider_token);
            await DataService.salvarCanalYouTube(session);
        } else {
            await obterTokenValido();
        }
        
        await carregarUI();

        // Monitor de mudanças de autenticação
        supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (session?.provider_token && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
                Utils.setToken(session.provider_token);
                const sucesso = await DataService.salvarCanalYouTube(session);
                if (sucesso) await carregarUI();
            }
        });
    }
    
    UI.trocarAba('dashboard');
});
