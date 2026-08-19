/**
 * TradeWR Social - TikTok Only
 * Versão corrigida, blindada e otimizada
 */

// ==========================================
// 1. CONFIG
// ==========================================

const CONFIG = {
    SUPABASE_URL: 'https://abdliioyzkylccfylils.supabase.co',

    SUPABASE_KEY:
        'sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n',

    TIKTOK_CLIENT_KEY:
        'sbawbkvq7hg50p5g0g',

    TIKTOK_CLIENT_SECRET:
        'FajKybADLH4RH78riEekwn5hithtvxJC',

    TIKTOK_REDIRECT_URI:
        'https://www.evrix.shop/menu/tiktok/'
};

// ==========================================
// 2. SUPABASE
// ==========================================

let supabaseClient = null;

try {
    if (
        typeof supabase !== 'undefined' &&
        supabase?.createClient
    ) {
        supabaseClient = supabase.createClient(
            CONFIG.SUPABASE_URL,
            CONFIG.SUPABASE_KEY
        );

        console.log('✅ Supabase iniciado');
    } else {
        console.error(
            '❌ SDK do Supabase não carregado'
        );
    }
} catch (err) {
    console.error(
        '❌ Erro iniciando Supabase:',
        err
    );
}

// ==========================================
// 3. UTILS
// ==========================================

const Utils = {
    formatarNumero(num) {
        const numero = Number(num || 0);

        if (numero >= 1000000) {
            return (
                (numero / 1000000).toFixed(1) + 'M'
            );
        }

        if (numero >= 1000) {
            return (
                (numero / 1000).toFixed(1) + 'k'
            );
        }

        return numero.toString();
    },

    setToken(token) {
        try {
            sessionStorage.setItem(
                'tk_token',
                token
            );
        } catch (err) {
            console.error(err);
        }
    },

    getToken() {
        try {
            return sessionStorage.getItem(
                'tk_token'
            );
        } catch (err) {
            console.error(err);
            return null;
        }
    },

    saveVideoCache(channelId, videos) {
        try {
            const data = {
                timestamp: Date.now(),
                videos
            };

            sessionStorage.setItem(
                `cache_tk_${channelId}`,
                JSON.stringify(data)
            );
        } catch (err) {
            console.error(
                '❌ Erro salvando cache:',
                err
            );
        }
    },

    getVideoCache(channelId) {
        try {
            const cache =
                sessionStorage.getItem(
                    `cache_tk_${channelId}`
                );

            if (!cache) return null;

            const parsed = JSON.parse(cache);

            const expirado =
                Date.now() -
                    parsed.timestamp >
                30 * 60 * 1000;

            if (expirado) {
                sessionStorage.removeItem(
                    `cache_tk_${channelId}`
                );

                return null;
            }

            return parsed.videos || null;
        } catch (err) {
            console.error(
                '❌ Cache inválido:',
                err
            );

            return null;
        }
    },

    escapeHtml(text = '') {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

// ==========================================
// 4. UI
// ==========================================

const UI = {
    elementos: {
        bar: document.getElementById(
            'canal-selector-bar'
        ),

        listaCanais: document.getElementById(
            'lista-canais-conectados'
        ),

        listaVideos: document.getElementById(
            'lista-videos'
        ),

        modal: document.getElementById(
            'modalConexao'
        ),

        btnConectar:
            document.querySelector(
                '.btn-conectar'
            ),

        btnFecharModal:
            document.querySelector(
                '.fechar-modal'
            )
    },

    // ======================================
    // NAVEGAÇÃO
    // ======================================

    initNavegacao() {
        const links =
            document.querySelectorAll(
                '.nav-links a, .sidebar-links a'
            );

        links.forEach(link => {
            link.addEventListener(
                'click',
                e => {
                    const href =
                        link.getAttribute(
                            'href'
                        );

                    if (
                        href &&
                        href.startsWith('#')
                    ) {
                        e.preventDefault();

                        this.trocarAba(
                            href.replace(
                                '#',
                                ''
                            )
                        );
                    }
                }
            );
        });
    },

    trocarAba(alvo) {
        document
            .querySelectorAll(
                '.secao-aba'
            )
            .forEach(aba => {
                aba.style.display =
                    'none';
            });

        const abaAlvo =
            document.getElementById(
                `aba-${alvo}`
            );

        if (!abaAlvo) return;

        abaAlvo.style.display =
            alvo === 'dashboard'
                ? 'grid'
                : 'block';

        document
            .querySelectorAll(
                '.nav-links a, .sidebar-links a'
            )
            .forEach(link => {
                link.classList.remove(
                    'active'
                );
            });

        document
            .querySelectorAll(
                `a[href="#${alvo}"]`
            )
            .forEach(link => {
                link.classList.add(
                    'active'
                );
            });
    },

    // ======================================
    // MODAL
    // ======================================

    initModal() {
        const {
            btnConectar,
            modal,
            btnFecharModal
        } = this.elementos;

        if (btnConectar && modal) {
            btnConectar.addEventListener(
                'click',
                () => {
                    modal.style.display =
                        'block';
                }
            );
        }

        if (
            btnFecharModal &&
            modal
        ) {
            btnFecharModal.addEventListener(
                'click',
                () => {
                    modal.style.display =
                        'none';
                }
            );
        }

        window.addEventListener(
            'click',
            e => {
                if (e.target === modal) {
                    modal.style.display =
                        'none';
                }
            }
        );
    },

    // ======================================
    // GRADE
    // ======================================

    renderizarGradeDinamica(
        canais = []
    ) {
        const containerManha =
            document.getElementById(
                'grade-manha'
            );

        const containerNoite =
            document.getElementById(
                'grade-noite'
            );

        if (
            !containerManha ||
            !containerNoite
        ) {
            return;
        }

       const horariosManha = [
            '09:00',
            '10:00',
            '11:00',
            '12:00',
            '13:00'
        ];

        const horariosNoite = [
            '16:00',
            '17:00',
            '18:00',
            '19:00',
            '20:00'
        ];

        const canaisOrdenados = [
            ...canais
        ].sort((a, b) =>
            (
                a.nome_canal || ''
            ).localeCompare(
                b.nome_canal || ''
            )
        );

        containerManha.innerHTML =
            horariosManha
                .map((hora, index) =>
                    this.gerarHtmlCardGrade(
                        canaisOrdenados[
                            index
                        ],
                        hora
                    )
                )
                .join('');

        containerNoite.innerHTML =
            horariosNoite
                .map((hora, index) =>
                    this.gerarHtmlCardGrade(
                        canaisOrdenados[
                            index + 5
                        ],
                        hora
                    )
                )
                .join('');
    },

    gerarHtmlCardGrade(
        canal,
        hora
    ) {
        if (!canal) {
            return `
                <div class="horario-card vazio" style="opacity:0.4;">
                    <div class="canal-foto-container"></div>
                    <span class="hora">${hora}</span>
                    <span class="canal-nome">Livre</span>
                </div>
            `;
        }

        return `
            <div 
                class="horario-card"
                data-canal-id="${canal.canal_id}"
            >
                <div class="canal-foto-container">
                    <img 
                        src="${canal.foto_perfil || ''}" 
                        class="grade-canal-thumb"
                        alt="${Utils.escapeHtml(
                            canal.nome_canal
                        )}"
                    >
                </div>

                <span class="hora">
                    ${hora}
                </span>

                <span class="canal-nome">
                    ${Utils.escapeHtml(
                        canal.nome_canal
                    )}
                </span>
            </div>
        `;
    },

    async selecionarCanalProgramacao(
        canalId,
        accessToken
    ) {
        try {
            const listaVideos =
                document.querySelectorAll('#lista-videos').forEach(el => {
    el.innerHTML = '<p style="padding:20px;">Carregando vídeos...</p>';
});

            if (listaVideos) {
                listaVideos.innerHTML =
                    '<p style="padding:20px;">Carregando vídeos...</p>';
            }

            const cache =
                Utils.getVideoCache(
                    canalId
                );

            if (cache) {
                this.renderizarVideos(
                    cache
                );

                return;
            }

            const videos =
                await DataService.getVideosRecentes(
                    accessToken
                );

            Utils.saveVideoCache(
                canalId,
                videos
            );

            this.renderizarVideos(
                videos
            );
        } catch (err) {
            console.error(
                '❌ Erro seleção programação:',
                err
            );
        }
    },

    // ======================================
    // PÓDIO
    // ======================================

    renderizarPodio(
        ranking = []
    ) {
        const posicoes = [
            {
                seletorImg:
                    '.lugar-1 .podio-avatar',

                seletorViews:
                    '#podio-views-1',

                index: 0
            },

            {
                seletorImg:
                    '.lugar-2 .podio-avatar',

                seletorViews:
                    '#podio-views-2',

                index: 1
            },

            {
                seletorImg:
                    '.lugar-3 .podio-avatar',

                seletorViews:
                    '#podio-views-3',

                index: 2
            }
        ];

        posicoes.forEach(pos => {
            const imgElemento =
                document.querySelector(
                    pos.seletorImg
                );

            const viewsElemento =
                document.querySelector(
                    pos.seletorViews
                );

            const dadosCanal =
                ranking[pos.index];

            if (!dadosCanal) return;

            if (imgElemento) {
                imgElemento.src =
                    dadosCanal.foto_perfil ||
                    '';

                imgElemento.style.opacity =
                    '1';

                imgElemento.title =
                    dadosCanal.nome_canal;
            }

            if (viewsElemento) {
                viewsElemento.innerHTML = `
                    <i
                        class="fas fa-eye"
                        style="
                            font-size:0.7rem;
                            color:#3fb950;
                            margin-right:4px;
                        "
                    ></i>

                    ${Utils.formatarNumero(
                        dadosCanal.viewsRanking
                    )}
                `;

                if (
                    viewsElemento.parentElement
                ) {
                    viewsElemento.parentElement.style.opacity =
                        '1';
                }
            }
        });
    },

async renderizarPlacarCampeonato(
        canais = []
    ) {
        const containerPlacar =
            document.getElementById(
                'lista-ranking-home'
            );

        if (!containerPlacar)
            return;

        console.log("🏆 Atualizando placar do campeonato...");

        // 🔄 MAP ASSÍNCRONO: Pega do cache ou busca na API automaticamente em segundo plano
        const listaPromessas = canais.map(async (canal) => {
            let videosCache = Utils.getVideoCache(canal.canal_id);

            // ⚡ Se NÃO tem cache para este canal, faz o fetch automático em segundo plano
            if (!videosCache || videosCache.length === 0) {
                try {
                    console.log(`📡 Carregando dados automáticos para o placar: ${canal.nome_canal}`);
                    const token = await DataService.getValidAccessToken(canal);
                    if (token) {
                        const videos = await DataService.getVideosRecentes(token);
                        if (videos && videos.length > 0) {
                            Utils.saveVideoCache(canal.canal_id, videos);
                            videosCache = videos;
                        }
                    }
                } catch (err) {
                    console.error(`❌ Erro ao buscar dados automáticos do canal ${canal.nome_canal}:`, err);
                }
            }

            const listaVideos = videosCache || [];
            
            // O primeiro vídeo ([0]) é o mais recente postado
            const ultimoVideo = listaVideos.length > 0 ? listaVideos[0] : null;

            // Extrai as views do último vídeo testando todas as estruturas possíveis
            const viewsUltimoVideo = ultimoVideo ? parseInt(
                ultimoVideo.statistics?.viewCount || 
                ultimoVideo.statistics?.view_count || 
                ultimoVideo.stats?.view_count || 
                ultimoVideo.metrics?.view_count || 0
            ) : 0;

            // Define o título do último vídeo
            const tituloUltimoVideo = ultimoVideo ? (
                ultimoVideo.snippet?.title || 
                ultimoVideo.title || 'Sem título'
            ) : 'Sem postagem recente';

            return {
                ...canal,
                viewsRanking: viewsUltimoVideo,
                tituloRanking: tituloUltimoVideo
            };
        });

        // Aguarda a resolução em paralelo de todos os canais (sejam vindos do cache ou da API)
        const rankingOrdenado = (await Promise.all(listaPromessas))
            // Ordena do maior número de views para o menor
            .sort((a, b) => b.viewsRanking - a.viewsRanking);

        // Alimenta os 3 primeiros lugares do pódio de forma corrigida
        this.renderizarPodio(
            rankingOrdenado
        );

        // Renderiza do 4º ao 10º lugar no Placar dos Campeonatos
        const placarRestante =
            rankingOrdenado.slice(3, 10); // Limita até o 10º lugar total

        containerPlacar.innerHTML =
            placarRestante
                .map(
                    (canal, index) => `
                <div class="ranking-item-compacto">

                    <div class="ranking-posicao">
                        #${index + 4}
                    </div>

                    <img
                        src="${canal.foto_perfil || ''}"
                        class="ranking-canal-thumb"
                    >

                    <div class="ranking-canal-info">

                        <span class="ranking-canal-nome">
                            ${Utils.escapeHtml(
                                canal.nome_canal
                            )}
                        </span>

                        <span class="ranking-canal-video">
                            ${Utils.escapeHtml(
                                canal.tituloRanking
                            )}
                        </span>

                    </div>

                    <div class="ranking-views-destaque">
                        ${Utils.formatarNumero(
                            canal.viewsRanking
                        )} views
                    </div>

                </div>
            `
                )
                .join('');
    },

    // ======================================
    // VÍDEOS
    // ======================================
renderizarVideos(videos = []) {
    const containers = document.querySelectorAll('#lista-videos');
    if (containers.length === 0) return;

    let htmlContent = '';

    if (!Array.isArray(videos) || videos.length === 0) {
        htmlContent = `<p style="padding:20px; color:#86868b;">Nenhum vídeo encontrado.</p>`;
    } else {
        htmlContent = videos.map(video => {
            // Tenta pegar o dado de várias estruturas possíveis (YouTube, TikTok, Banco, etc.)
            const viewsRaw = video.statistics?.viewCount || video.statistics?.view_count || video.stats?.view_count || video.metrics?.view_count || 0;
            const likesRaw = video.statistics?.likeCount || video.statistics?.like_count || video.stats?.digg_count || video.metrics?.like_count || 0;
            const commentsRaw = video.statistics?.commentCount || video.statistics?.comment_count || video.stats?.comment_count || video.metrics?.comment_count || 0;

            const views = Utils.formatarNumero(viewsRaw);
            const likes = Utils.formatarNumero(likesRaw);
            const comments = Utils.formatarNumero(commentsRaw);
            
            let data = '-';
            try {
                data = new Date(video.snippet?.publishedAt || video.created_at).toLocaleDateString('pt-BR');
            } catch {}

            const urlVideo = video.link || '#';

            return `
                <div class="video-card" style="position: relative; display: flex; text-decoration: none; cursor: default;">
                    <a href="${urlVideo}" target="_blank" rel="noopener noreferrer" style="display: flex; gap: inherit; text-decoration: none; color: inherit; width: 100%; flex: 1;">
                        <img src="${video.snippet?.thumbnails?.medium?.url || video.cover_image_url || ''}" class="video-thumb">
                        <div class="video-detalhes" style="flex: 1; padding-right: 40px;">
                            <span class="video-titulo" title="${Utils.escapeHtml(video.snippet?.title || video.title || '')}" style="color:#f5f5f7; font-size:14px; font-weight:500;">
                                ${Utils.escapeHtml(video.snippet?.title || video.title || '')}
                            </span>
                            <div style="display:flex; gap:16px; margin-top:8px; flex-wrap:wrap; align-items:center; font-size:12px;">
                                <span class="video-meta" style="color:#86868b;">${data}</span>
                                
                                <span style="color:#86868b; display:flex; align-items:center; gap:5px;" title="${viewsRaw} visualizações">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    <span style="color:#e8e8ed; font-weight:500;">${views}</span>
                                </span>

                                <span style="color:#86868b; display:flex; align-items:center; gap:5px;" title="${likesRaw} curtidas">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                    <span style="color:#e8e8ed; font-weight:500;">${likes}</span>
                                </span>

                                <span style="color:#86868b; display:flex; align-items:center; gap:5px;" title="${commentsRaw} comentários">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                    <span style="color:#e8e8ed; font-weight:500;">${comments}</span>
                                </span>
                            </div>
                        </div>
                    </a>

                    <button class="btn-copiar-link" 
                            data-url="${urlVideo}"
                            title="Copiar link do vídeo"
                            onclick="if(this.getAttribute('data-url') === '#') return; navigator.clipboard.writeText(this.getAttribute('data-url')).then(() => {
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
                        <i class="fas fa-copy" style="font-size: 13px;"></i>
                        
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
                        ">${urlVideo === '#' ? 'Link indisponível' : 'Copiar Link'}</span>
                    </button>
                </div>
            `;
        }).join('');
    }

    containers.forEach(container => {
        container.innerHTML = htmlContent;
    });
},

// ======================================
    // CARDS DE STATUS (TikTok)
    // ======================================
    async atualizarCards(canal, videos = []) { // 🔥 ADICIONADO 'async' AQUI!
        const elementos = {
            subs: document.getElementById('yt-subs'),
            views: document.getElementById('yt-views'),
            videos: document.getElementById('yt-videos'),
            viewsDia: document.getElementById('yt-views-dia') // Seu elemento do card "Views do Dia"
        };

        // Inscritos (Pega do banco)
        if (elementos.subs) {
            elementos.subs.innerText = Utils.formatarNumero(canal.subscriber_count || 0);
        }

        // Se o banco estiver zerado, calculamos com base nos vídeos carregados
        if (elementos.views) {
            const totalViewsLista = videos.reduce((acc, v) => acc + parseInt(v.statistics?.viewCount || 0), 0);
            const viewsExibir = canal.view_count > 0 ? canal.view_count : totalViewsLista;
            elementos.views.innerText = Utils.formatarNumero(viewsExibir);
        }

        if (elementos.videos) {
            const totalVideos = canal.video_count > 0 ? canal.video_count : videos.length;
            elementos.videos.innerText = Utils.formatarNumero(totalVideos);
        }

        // 📊 SOLUÇÃO DO BO: Busca a soma dos últimos vídeos de TODOS os canais direto do Supabase
        if (elementos.viewsDia) {
            try {
                const totalViewsDia = await DataService.obterTotalViewsUltimosVideos();
                elementos.viewsDia.innerText = Utils.formatarNumero(totalViewsDia);
            } catch (err) {
                console.error('Erro ao atualizar views do dia nos cards:', err);
                elementos.viewsDia.innerText = '0';
            }
        }
    },


    // ======================================
    // BARRA CANAIS
    // ======================================

// ======================================
// BARRA CANAIS (TikTok) - CORRIGIDA 🎯
// ======================================
async atualizarBarraCanais(canais = []) {
    if (!this.elementos.bar) return;

    this.elementos.bar.innerHTML = '';

    canais.forEach((canal, index) => {
        // --- INÍCIO DA LÓGICA DE DETECÇÃO DO VÍDEO ZERADO MISTO (BANCO + CACHE) ---
        let temVideoZerado = false;

        // 1. Primeiro verifica se temos os dados frescos direto no cache local
        const videosCache = Utils.getVideoCache(canal.canal_id) || [];
        
        if (videosCache.length > 0) {
            const ultimoVideoPostado = videosCache[0];
            const viewsDoUltimo = ultimoVideoPostado.statistics?.viewCount !== undefined ? 
                                  parseInt(ultimoVideoPostado.statistics.viewCount) : 0;
            
            if (viewsDoUltimo === 0) {
                temVideoZerado = true;
            }
        } else {
            // 2. CASO NÃO TENHA CACHE AINDA (Carga inicial da página):
            // Usamos o 'last_video_views' que veio do Supabase para o canal!
            // Só ativamos o alerta se o canal de fato já possuir vídeos cadastrados (video_count > 0 ou last_video_title preenchido)
            const respondeuViews = canal.last_video_views !== undefined && canal.last_video_views !== null;
            const temVideosNoCanal = (parseInt(canal.video_count) > 0) || canal.last_video_title;

            if (respondeuViews && parseInt(canal.last_video_views) === 0 && temVideosNoCanal) {
                temVideoZerado = true;
            }
        }
        // --- FIM DA LÓGICA DE DETECÇÃO ---

        // Criamos o container do Avatar do TikTok
        const container = document.createElement('div');
        container.className = 'canal-avatar-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        container.style.cursor = 'pointer';
        container.style.marginRight = '10px'; // Espaçamento elegante entre as bolinhas

        const img = document.createElement('img');
        img.src = canal.foto_perfil || '';
        img.className = 'canal-thumb-circular';
        img.alt = canal.nome_canal || '';

        // Se o último vídeo do canal estiver flopado em 0 views, aplica a borda vermelha na foto
        if (temVideoZerado) {
            img.style.border = '2px solid #ff3333';
        }

        // Injeta a bolinha de alerta flutuante
        if (temVideoZerado) {
            const badge = document.createElement('span');
            badge.className = 'badge-video-zerado';
            badge.title = `Alerta: O último vídeo do canal ${canal.nome_canal || ''} está travado em 0 views!`;
            badge.style.position = 'absolute';
            badge.style.top = '-2px';
            badge.style.right = '-2px';
            badge.style.width = '12px';
            badge.style.height = '12px';
            badge.style.backgroundColor = '#ff3333';
            badge.style.border = '2px solid #1c1c1e'; // Recorte perfeito no tema escuro do Evrix
            badge.style.borderRadius = '50%';
            badge.style.zIndex = '10';
            badge.style.animation = 'pulsarAlerta 2s infinite';
            
            container.appendChild(badge);
        }

        container.appendChild(img);

        // Evento de clique para carregar o canal
        container.addEventListener('click', async () => {
            try {
                // Remove a classe selecionado limpando as bordas
                this.elementos.bar.querySelectorAll('.canal-thumb-circular').forEach(i => {
                    i.classList.remove('selecionado');
                });
                img.classList.add('selecionado');

                this.canalSelecionadoAtivo = canal;

                const nomeCanal = document.getElementById('nome-canal-ativo');
                if (nomeCanal) nomeCanal.textContent = canal.nome_canal;

                // 1. TENTA RECURSO DO CACHE
                const videosCacheClick = Utils.getVideoCache(canal.canal_id);
                if (videosCacheClick) {
                    this.renderizarVideos(videosCacheClick);
                    this.atualizarCards(canal, videosCacheClick);
                    return;
                }

                // 2. SE NÃO HOUVER CACHE, REALIZA REQUEST NA API
                if (this.elementos.listaVideos) {
                    this.elementos.listaVideos.innerHTML = '<p style="padding:20px;"><i class="fas fa-spinner fa-spin"></i> Buscando vídeos do TikTok...</p>';
                }

                const token = await DataService.getValidAccessToken(canal);
                const videos = await DataService.getVideosRecentes(token);
                
                Utils.saveVideoCache(canal.canal_id, videos);
                
                this.renderizarVideos(videos);
                this.atualizarCards(canal, videos);

                // Força re-renderização caso o vídeo tenha saído de 0 views após a carga fresca
                if (videos && videos.length > 0) {
                    const viewsFrequinhas = videos[0].statistics?.viewCount !== undefined ? 
                                            parseInt(videos[0].statistics.viewCount) : 0;
                    if (viewsFrequinhas > 0 && temVideoZerado) {
                        setTimeout(() => { this.atualizarBarraCanais(canais); }, 300);
                    }
                }

            } catch (err) {
                console.error('Erro ao trocar canal:', err);
            }
        });

        this.elementos.bar.appendChild(container);

        // Mantém a execução padrão de selecionar o primeiro automaticamente
        if (index === 0) {
            container.click();
        }
    });
},

    // ======================================
    // GERENCIAMENTO
    // ======================================

    atualizarListaGerenciamento(
        canais = []
    ) {
        if (
            !this.elementos
                .listaCanais
        ) {
            return;
        }

        this.elementos.listaCanais.innerHTML =
            canais
                .map(
                    canal => `
                <div class="canal-card">

                    <div class="canal-info">

                        <img
                            src="${canal.foto_perfil || ''}"
                            alt="${Utils.escapeHtml(
                                canal.nome_canal
                            )}"
                        >

                        <div class="canal-detalhes">

                            <h3 class="canal-nome">
                                ${Utils.escapeHtml(
                                    canal.nome_canal
                                )}
                            </h3>

                            <span class="status conectado">
                                TikTok conectado
                            </span>

                        </div>

                    </div>

                    <button
                        class="btn-acao"
                        onclick="UI.trocarAba('dashboard')"
                    >
                        Ver Estatísticas
                    </button>

                </div>
            `
                )
                .join('');
    }
};

// ==========================================
// 5. DATA SERVICE
// ==========================================
const DataService = {
    async getCanais() {
        try {
            if (!supabaseClient) return [];
            const { data, error } = await supabaseClient
                .from('canais_conectados')
                .select('*')
                .eq('plataforma', 'tiktok');

            if (error) {
                console.error('❌ Erro canais:', error);
                return [];
            }
            return data || [];
        } catch (err) {
            console.error('❌ Erro getCanais:', err);
            return [];
        }
    },

    async trocarCodePorTokenTikTok(code) {
        try {
            console.log('📡 Trocando code por token e salvando avatar permanente...');
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/smart-responder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${CONFIG.SUPABASE_KEY}`
                },
                body: JSON.stringify({ action: 'token_exchange', code, redirect_uri: CONFIG.TIKTOK_REDIRECT_URI })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data && data.user && data.user.avatar_url) {
                try {
                    console.log('🔄 Clonando avatar do TikTok para o Supabase Storage...');
                    const proxyUrl = `${CONFIG.SUPABASE_URL}/functions/v1/smart-responder?proxy_url=${encodeURIComponent(data.user.avatar_url)}`;
                    const imageRes = await fetch(proxyUrl, { headers: { Authorization: `Bearer ${CONFIG.SUPABASE_KEY}` } });

                    if (imageRes.ok) {
                        const blob = await imageRes.blob();
                        const userId = data.user.open_id || data.user.union_id || Date.now();
                        const fileName = `${userId}.jpg`;

                        const uploadRes = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
                                'x-upsert': 'true' 
                            },
                            body: blob
                        });

                        if (uploadRes.ok) {
                            const permanentUrl = `${CONFIG.SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
                            console.log('✅ Avatar saved to Supabase:', permanentUrl);
                            data.user.avatar_url = permanentUrl;
                            data.avatar_permanente = permanentUrl;
                        }
                    }
                } catch (storageErr) {
                    console.error('❌ Erro na rotina de salvamento do avatar:', storageErr);
                }
            }
            return data;
        } catch (err) {
            console.error('❌ Erro token exchange:', err);
            return null;
        }
    },

    async refreshTikTokToken(canal) {
        try {
            console.log('🔄 Despachando renovação de token para a Edge Function...');
            if (!canal?.refresh_token) {
                console.error('❌ Canal sem refresh token');
                return canal.access_token || null;
            }

            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/smart-responder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${CONFIG.SUPABASE_KEY}`
                },
                body: JSON.stringify({
                    action: 'refresh_token',
                    refresh_token: canal.refresh_token
                })
            });

            const tokenData = await response.json();
            if (!response.ok || !tokenData?.access_token) {
                console.error('❌ Falha no refresh do TikTok via Edge Function');
                return null;
            }

            const { error } = await supabaseClient
                .from('canais_conectados')
                .update({
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token || canal.refresh_token,
                    expires_in: tokenData.expires_in,
                    token_created_at: new Date().toISOString()
                })
                .eq('canal_id', canal.canal_id);

            if (error) {
                console.error('❌ Erro salvando token atualizado no banco:', error);
                return null;
            }

            return tokenData.access_token;
        } catch (err) {
            console.error('❌ Erro refresh token:', err);
            return null;
        }
    },

    async getValidAccessToken(canal) {
        try {
            if (!canal?.access_token) return null;
            if (!canal?.refresh_token) return canal.access_token;
            if (!canal?.token_created_at) return await this.refreshTikTokToken(canal);

            const criadoEm = new Date(canal.token_created_at).getTime();
            const expiraEm = criadoEm + ((canal.expires_in || 86400) * 1000);
            const expirado = Date.now() >= (expiraEm - 300000); // 5 min de margem

            if (!expirado) return canal.access_token;

            return await this.refreshTikTokToken(canal);
        } catch (err) {
            console.error('❌ Erro validando token:', err);
            return null;
        }
    },

    async obterTotalViewsUltimosVideos() {
        try {
            if (!supabaseClient) return 0;
            const { data: canais, error } = await supabaseClient
                .from('canais_conectados')
                .select('last_video_views');

            if (error) return 0;

            return canais.reduce((soma, canal) => soma + Number(canal.last_video_views || 0), 0);
        } catch (err) {
            return 0;
        }
    },

    async getPerfilTikTok(accessToken) {
        try {
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/smart-responder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${CONFIG.SUPABASE_KEY}`
                },
                body: JSON.stringify({ action: 'get_profile', access_token: accessToken })
            });
            const result = await response.json();
            return result?.user || null;
        } catch (err) {
            return null;
        }
    },

    async salvarCanalTikTok(tokenData) {
        try {
            if (!supabaseClient) return false;

            const accessToken = tokenData?.access_token || tokenData?.data?.access_token;
            const refreshToken = tokenData?.refresh_token || tokenData?.data?.refresh_token;
            const expiresIn = tokenData?.expires_in || tokenData?.data?.expires_in;

            if (!accessToken) return false;

            const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
            if (userError || !user) return false;

            const perfil = await this.getPerfilTikTok(accessToken);
            if (!perfil) return false;

            let fotoDefinitiva = tokenData?.avatar_permanente || tokenData?.user?.avatar_url;

            if (!fotoDefinitiva || fotoDefinitiva.includes('tiktokcdn.com') || fotoDefinitiva.includes('p16-sign')) {
                try {
                    const userId = perfil.open_id || Date.now();
                    const fileName = `${userId}.jpg`;
                    const proxyUrl = `${CONFIG.SUPABASE_URL}/functions/v1/smart-responder?proxy_url=${encodeURIComponent(perfil.avatar_url)}`;
                    
                    const imageRes = await fetch(proxyUrl, { headers: { Authorization: `Bearer ${CONFIG.SUPABASE_KEY}` } });
                    if (imageRes.ok) {
                        const blob = await imageRes.blob();
                        const uploadRes = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/avatars/${fileName}`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`, 'x-upsert': 'true' },
                            body: blob
                        });
                        if (uploadRes.ok) {
                            fotoDefinitiva = `${CONFIG.SUPABASE_URL}/storage/v1/object/public/avatars/${fileName}`;
                        }
                    }
                } catch (err) { }
            }

            if (!fotoDefinitiva) fotoDefinitiva = perfil.avatar_url;

            const dados = {
                user_id: user.id,
                plataforma: 'tiktok',
                canal_id: perfil.open_id,
                nome_canal: perfil.display_name,
                foto_perfil: fotoDefinitiva, 
                subscriber_count: 0,
                view_count: 0,
                video_count: 0,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: expiresIn,
                token_created_at: new Date().toISOString(),
                last_updated: new Date().toISOString()
            };

            const { error } = await supabaseClient
                .from('canais_conectados')
                .upsert(dados, { onConflict: 'canal_id' });

            if (error) return false;

            const videos = await this.getVideosRecentes(accessToken);
            if (videos && Array.isArray(videos) && videos.length > 0) {
                const ultimo = videos[0];
                await this.atualizarDadosVideoNoBanco(
                    dados.canal_id,
                    ultimo?.snippet?.title || '',
                    Number(ultimo?.statistics?.viewCount || 0),
                    Number(ultimo?.statistics?.likeCount || 0),
                    Number(ultimo?.statistics?.commentCount || 0)
                );
            }

            return true;
        } catch (err) {
            return false;
        }
    },

    async getVideosRecentes(accessToken) {
        if (!accessToken) return [];
        try {
            const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/smart-responder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${CONFIG.SUPABASE_KEY}`
                },
                body: JSON.stringify({ action: 'list_videos', access_token: accessToken })
            });
            
            const result = await response.json();
            const videos = result?.videos || [];

            return videos.map(video => ({
                id: video.id,
                snippet: {
                    title: video.title || 'Vídeo TikTok',
                    thumbnails: { medium: { url: video.cover_image_url || '' } },
                    publishedAt: new Date((video.create_time || 0) * 1000).toISOString()
                },
                statistics: {
                    viewCount: video.view_count || 0,
                    likeCount: video.like_count || 0,
                    commentCount: video.comment_count || 0
                },
                link: video.share_url || '#'
            }));
        } catch (err) {
            return [];
        }
    },

    async atualizarDadosVideoNoBanco(canalId, titulo, views, likes, comentarios) {
        try {
            if (!supabaseClient) return;
            await supabaseClient
                .from('canais_conectados')
                .update({
                    last_video_title: titulo,
                    last_video_views: views,
                    last_video_likes: likes,
                    last_video_comments: comentarios,
                    last_updated: new Date().toISOString()
                })
                .eq('canal_id', canalId);
        } catch (err) { }
    },

// ==========================================
// PIPELINE DE UPLOAD DO TIKTOK (v2 - blindado)
// ==========================================
async fazerUploadTikTok(canal, videoFile, legenda) {
    try {
        console.log(`🎬 Iniciando pipeline para: ${canal.nome_canal}`);
        
        const accessToken = await this.getValidAccessToken(canal);
        if (!accessToken) throw new Error("Token inválido ou expirado.");

        const legendaFinal = (legenda || '').trim();
        if (!legendaFinal) throw new Error("Legenda não pode estar vazia.");

        // ───── PASSO 1: init_upload ─────
        const payloadInit = {
            action: 'init_upload',
            access_token: accessToken,
            video_size: videoFile.size,           // number
            title: legendaFinal,                  // chave simplificada
            privacy_level: "PUBLIC_TO_EVERYONE",
            allow_comment: true,
            allow_duet: true,
            allow_stitch: true
        };

        console.log("📡 Enviando init_upload...", {
            video_size: videoFile.size,
            title: legendaFinal
        });

        const initResponse = await fetch(
            `${CONFIG.SUPABASE_URL}/functions/v1/smart-responder`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`
                },
                body: JSON.stringify(payloadInit)
            }
        );

        // Captura o corpo bruto ANTES de tentar parsear
        const rawText = await initResponse.text();
        console.log(`📋 Resposta init_upload (${initResponse.status}):`, rawText.substring(0, 500));

        if (!initResponse.ok) {
            throw new Error(`Servidor retornou ${initResponse.status}: ${rawText.substring(0, 200)}`);
        }

        let initResult;
        try {
            initResult = JSON.parse(rawText);
        } catch {
            throw new Error(`Resposta não é JSON válido: ${rawText.substring(0, 200)}`);
        }

        if (initResult?.error) {
            throw new Error(`Erro da Edge Function: ${initResult.error}`);
        }

        const uploadUrl = initResult?.upload_url;
        if (!uploadUrl) {
            console.error("Payload completo recebido:", initResult);
            throw new Error("upload_url não retornada. Verifique o log acima para ver o payload completo.");
        }

        // ───── PASSO 2: PUT binário ─────
        console.log("🚀 Enviando binário do vídeo...");

        const putResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Length': String(videoFile.size)  // string, não number
            },
            body: videoFile
        });

        if (putResponse.status === 200 || putResponse.status === 201) {
            return { success: true, message: "Vídeo enviado e em processamento no TikTok!" };
        }

        const putError = await putResponse.text();
        throw new Error(`Falha no PUT (${putResponse.status}): ${putError.substring(0, 200)}`);

    } catch (err) {
        console.error('❌ Erro no upload:', err);
        return { success: false, error: err.message };
    }
}
};


// ==========================================
// 6. AUTH TIKTOK
// ==========================================
window.iniciarAuth = async plataforma => {
    try {
        if (plataforma !== 'tiktok') return;

        const scopes = [
    'user.info.basic', 
    'video.list', 
    'video.publish'
].join(',');

        const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
            `?client_key=${CONFIG.TIKTOK_CLIENT_KEY}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(CONFIG.TIKTOK_REDIRECT_URI)}`;

        console.log('🚀 Redirecionando para autenticação do TikTok...');
        window.location.href = authUrl;
    } catch (err) {
        console.error('❌ Erro auth:', err);
    }
};

// ==========================================
// 7. SIDEBAR
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar-menu');
    if (sidebar) {
        sidebar.classList.toggle('sidebar-open');
    }
}
window.toggleSidebar = toggleSidebar;

// ==========================================
// 8. INIT
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Inicializando sistema...');

        // ------------------------------------------
        // CALLBACK TIKTOK DETECTADO
        // ------------------------------------------
        const urlParams = new URLSearchParams(window.location.search);
        const tiktokCode = urlParams.get('code');

        if (tiktokCode) {
            console.log('🎵 Callback TikTok detectado');
            const tokenData = await DataService.trocarCodePorTokenTikTok(tiktokCode);

            if (tokenData && tokenData.access_token) {
                const salvo = await DataService.salvarCanalTikTok(tokenData);

                if (salvo) {
                    console.log('✅ Canal conectado!');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        }

        // ------------------------------------------
        // INIT UI & ESCUTADORES DE EVENTO
        // ------------------------------------------
        UI.initNavegacao();
        UI.initModal();

        // 🎯 ESCUTADOR DO BOTÃO DE PUBLICAR (Configurado para o Textarea do TikTok)
        const btnEnviar = document.getElementById('btn-enviar-video');
        if (btnEnviar) {
            btnEnviar.addEventListener('click', async () => {
                const canalAtivo = UI.canalSelecionadoAtivo;

                if (!canalAtivo) {
                    alert('Por favor, selecione um canal na barra superior antes de postar!');
                    return;
                }

                // Captura o texto do textarea (Legenda + Hashtags)
                const tituloCampo = document.getElementById('input-titulo');
                const titulo = tituloCampo ? tituloCampo.value.trim() : '';
                const arquivoVideo = document.getElementById('input-video-arquivo').files[0];

                if (!titulo) {
                    alert('Por favor, insira uma legenda com hashtags para o seu vídeo do TikTok!');
                    return;
                }

                if (!arquivoVideo) {
                    alert('Por favor, selecione um arquivo de vídeo para upload!');
                    return;
                }

                btnEnviar.disabled = true;
                btnEnviar.textContent = 'Enviando ao TikTok...';

                try {
                    const resultado = await DataService.fazerUploadTikTok(canalAtivo, arquivoVideo, titulo);

                    if (resultado.success) {
                        alert(`🎉 ${resultado.message}`);
                        document.getElementById('input-titulo').value = '';
                        limparPreviewVideo(); // Limpa usando a função dedicada
                    } else {
                        alert(`❌ Erro ao postar: ${resultado.error}`);
                    }
                } catch (erroPost) {
                    alert(`❌ Erro crítico no envio: ${erroPost.message}`);
                } finally {
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = 'Postar no TikTok';
                }
            });
        }

        // ------------------------------------------
        // LOAD DASHBOARD DATA
        // ------------------------------------------
        if (supabaseClient) {
            const canais = await DataService.getCanais();

            await UI.atualizarBarraCanais(canais);
            UI.atualizarListaGerenciamento(canais);
            UI.renderizarGradeDinamica(canais);
            await UI.renderizarPlacarCampeonato(canais);
        }

        // ==========================================
        // CONFIGURAÇÃO DO DRAG AND DROP
        // ==========================================
        const dropZone = document.getElementById('dropzone-video'); 
        const fileInput = document.getElementById('input-video-arquivo');
        
        const dropzoneVazio = document.getElementById('dropzone-vazio');
        const dropzoneComPreview = document.getElementById('dropzone-com-preview');
        const previewVideoPlayer = document.getElementById('preview-video-player');
        const nomeArquivoSelecionado = document.getElementById('nome-arquivo-selecionado');
        const btnRemoverVideo = document.getElementById('btn-remover-video');

        function mostrarPreviewVideo(file) {
            if (!file) return;
            
            const fileURL = URL.createObjectURL(file);
            previewVideoPlayer.src = fileURL;
            nomeArquivoSelecionado.textContent = file.name;
            
            dropzoneVazio.style.display = 'none';
            dropzoneComPreview.style.display = 'flex';
        }

        function limparPreviewVideo() {
            fileInput.value = ''; 
            previewVideoPlayer.removeAttribute('src');
            previewVideoPlayer.load();
            
            dropzoneComPreview.style.display = 'none';
            dropzoneVazio.style.display = 'block';
        }

        if (dropZone && fileInput) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => e.preventDefault(), false);
                document.body.addEventListener(eventName, (e) => e.preventDefault(), false);
            });

            ['dragenter', 'dragover'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.classList.add('highlight');
                    dropZone.style.borderColor = '#00ff88';
                }, false);
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, () => {
                    dropZone.classList.remove('highlight');
                    dropZone.style.borderColor = '';
                }, false);
            });

            dropZone.addEventListener('drop', (e) => {
                const dt = e.dataTransfer;
                const files = dt.files;

                if (files.length > 0 && files[0].type.startsWith('video/')) {
                    fileInput.files = files;
                    fileInput.dispatchEvent(new Event('change'));
                    mostrarPreviewVideo(files[0]);
                    console.log('🎬 Vídeo carregado via Arraste:', files[0].name);
                } else {
                    alert('Por favor, arraste apenas arquivos de vídeo!');
                }
            });

            dropzoneVazio.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    mostrarPreviewVideo(fileInput.files[0]);
                }
            });
        }

        if (btnRemoverVideo) {
            btnRemoverVideo.addEventListener('click', (e) => {
                e.stopPropagation();
                limparPreviewVideo();
                console.log('🗑️ Vídeo removido pelo usuário');
            });
        }

        UI.trocarAba('dashboard');
        console.log('✅ Sistema iniciado com sucesso');

    } catch (err) {
        console.error('❌ Erro fatal INIT:', err);
    }
});


// ==========================================
// NAVEGAÇÃO ENTRE PAGINAS / ABAS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🌐 Script de navegação de redes carregado!');
    
    const botoesRede = document.querySelectorAll('.social-nav-container .social-nav-btn');
    
    botoesRede.forEach(btn => {
        btn.addEventListener('click', () => {
            const urlDestino = btn.getAttribute('data-url');
            console.log('Botão clicado:', btn.textContent.trim(), 'Alvo:', urlDestino);
            
            if (!urlDestino || urlDestino.trim() === "" || btn.classList.contains('ativo')) {
                console.log('📍 Você já está nessa página ou o link está vazio.');
                return;
            }
            
            window.location.href = urlDestino;
        });
    });
});
