/**
 * TradeWR Social - Instagram Core Engine
 * Versão corrigida, blindada e otimizada para o ecossistema Meta/Supabase
 */

// ==========================================
// 1. CONFIG
// ==========================================

const CONFIG = {
    // Credenciais do seu Supabase
    SUPABASE_URL: 'https://abdliioyzkylccfylils.supabase.co',
    SUPABASE_KEY: 'sb_publishable_g6l6_QmwE4Tj85_KF_XHfQ_I4gFlY_n',

    // ==========================================
    // CONFIGURAÇÕES DO SEU APP NA META (INSTAGRAM)
    // ==========================================
    META_APP_ID: '1610537103353620', 
    META_APP_SECRET: 'a6975f090ec9611b84f8f288a61d6a87', 

    // Estrutura mantida para leitura do motor
 
};

let TOTAL_VIEWS_DIA_GLOBAL = 0;
// 🚨 NOVIDADE: Variável global para rastrear com precisão cirúrgica o canal selecionado pelo usuário
let CANAL_SELECIONADO_OBJ = null;

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

    text = String(text || '');
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

// ==========================================
// 4. UI (VERSÃO CORRIGIDA - SEM ACÚMULO DE FEEDS)
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

    // Auxiliar exclusivo para garantir que a lista de vídeos seja zerada de verdade
    limparListaVideos() {
        if (this.elementos.listaVideos) {
            this.elementos.listaVideos.innerHTML = '';
        }
    },

async renderizarPlacarCampeonato(canais = []) {
    try {
        const ranking = [];
        // 🎯 Variável para acumular o total de views dos últimos vídeos de toda a frota
        let totalViewsUltimosVideos = 0;

        for (const canal of canais) {
            const videos = await DataService.getVideosRecentes(
                canal.acesso_token,
                canal.canal_nome
            );

            let viewsUltimoVideo = 0;

            if (Array.isArray(videos) && videos.length > 0) {
                // Força a ordenação: do vídeo mais recente para o mais antigo
                const videosOrdenados = [...videos].sort((a, b) => {
                    return new Date(b.created_at || b.snippet?.publishedAt || 0) - new Date(a.created_at || a.snippet?.publishedAt || 0);
                });

                // Isolamos apenas as views do primeiro vídeo (o último postado)
                viewsUltimoVideo = Number(videosOrdenados[0].views_count || videosOrdenados[0].statistics?.viewCount || 0);
            }

            // ➕ Soma o valor deste canal ao total geral da frota
            totalViewsUltimosVideos += viewsUltimoVideo;

            ranking.push({
                ...canal,
                viewsRanking: viewsUltimoVideo // Pluga apenas o valor do último post
            });
        }

        // ORDENA DESC pelo rendimento do último vídeo de cada canal
        ranking.sort((a, b) => b.viewsRanking - a.viewsRanking);

        // 🔥 PÓDIO (TOP 3)
        this.renderizarPodio(ranking);

        // 🎯 PLACAR COMPLETO (Do 4º para baixo)
        this.renderizarTabelaRanking(ranking);

        // 🚨 NOVIDADE: Alimenta a memória global antes de injetar na tela
        TOTAL_VIEWS_DIA_GLOBAL = totalViewsUltimosVideos;

        // 📊 ATUALIZA O CARD "VIEWS DO DIA" WITH THE TOTAL SOMA
        const cardViewsDia = document.getElementById('yt-views-dia');
        if (cardViewsDia) {
            // Usa o seu utilitário de formatação para ficar bonito (ex: 1.500 em vez de 1500)
            cardViewsDia.textContent = Utils.formatarNumero(TOTAL_VIEWS_DIA_GLOBAL);
        }

        console.log(`🏆 Placar atualizado! Memória global salva com: ${TOTAL_VIEWS_DIA_GLOBAL} views.`);

    } catch (err) {
        console.error('❌ erro renderizarPlacarCampeonato:', err);
    }
},

renderizarTabelaRanking(ranking = []) {
    const tabelaCorpo = document.getElementById('lista-ranking-home');
    if (!tabelaCorpo) {
        console.warn('⚠️ Contêiner "#lista-ranking-home" não foi encontrado no HTML.');
        return;
    }

    tabelaCorpo.innerHTML = '';

    // Pega do 4º canal em diante (índice 3 para frente)
    const restante = ranking.slice(3);

    if (restante.length === 0) {
        tabelaCorpo.innerHTML = `
            <div style="padding: 20px; text-align: center; opacity: 0.5; font-size: 0.9rem;">
                Sem canais adicionais no ranking.
            </div>`;
        return;
    }

    // Renderiza os próximos colocados da frota
    tabelaCorpo.innerHTML = restante.map((canal, index) => {
        const posicaoAoVivo = index + 4;
        const nomeCanal = canal.canal_nome || canal.nome_canal || 'Sem Nome';
        const fotoPerfil = canal.foto_perfil || canal.media_url || '';
        const views = canal.viewsRanking || canal.views || 0;

        return `
            <div class="ranking-linha-item" style="display: flex; align-items: center; justify-content: space-between; padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.95rem;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="ranking-posicao" style="font-weight: bold; width: 25px; color: rgba(255,255,255,0.4);">#${posicaoAoVivo}</span>
                    <img src="${fotoPerfil}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; border: 1px solid rgba(255,255,255,0.1);" alt="${nomeCanal}">
                    <span class="ranking-nome-canal" style="font-weight: 500; color: #fff;">${Utils.escapeHtml(nomeCanal)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; color: rgba(255,255,255,0.6);">
                    <i class="fas fa-eye" style="font-size: 0.8rem;"></i>
                    <span style="font-weight: bold; color: #00ff88;">${Utils.formatarNumero(views)}</span>
                </div>
            </div>
        `;
    }).join('');
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
        ].sort((a, b) => {
            const nomeA = a.canal_nome || a.nome_canal || '';
            const nomeB = b.canal_nome || b.nome_canal || '';
            return nomeA.localeCompare(nomeB);
        });

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

        const nomeCanal = canal.canal_nome || canal.nome_canal || 'Sem Nome';
        const fotoPerfil = canal.media_url || canal.foto_perfil || '';

        return `
            <div 
                class="horario-card"
                data-canal-id="${canal.canal_id || canal.instagram_user_id}"
            >
                <div class="canal-foto-container">
                    <img 
                        src="${fotoPerfil}" 
                        class="grade-canal-thumb"
                        alt="${Utils.escapeHtml(nomeCanal)}"
                    >
                </div>

                <span class="hora">
                    ${hora}
                </span>

                <span class="canal-nome">
                    ${Utils.escapeHtml(nomeCanal)}
                </span>
            </div>
        `;
    },

    async selecionarCanalProgramacao(
        canalId,
        accessToken
    ) {
        try {
            // Limpa o feed completamente antes de iniciar
            this.limparListaVideos();

            document.querySelectorAll('#lista-videos').forEach(el => {
                el.innerHTML = '<p style="padding:20px;">Carregando vídeos...</p>';
            });

            const cache =
                Utils.getVideoCache(
                    canalId
                );

           if (cache) {
                this.limparListaVideos(); // Garante limpeza pré-render do cache
                await carregarVideosInstagram(canal.canal_nome);
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

            this.limparListaVideos(); // Garante limpeza pré-render dos dados novos
            await carregarVideosInstagram(canal.canal_nome);
        } catch (err) {
            console.error(
                '❌ Erro seleção programação:',
                err
            );
        }
    },

    // ======================================
    // PÓDIO (CORRIGIDO E MAPEADO)
    // ======================================

  renderizarPodio(ranking = []) {

    const posicoes = [
        {
            index: 0,
            img: 'podio-img-1',
            nome: 'podio-nome-1',
            views: 'podio-views-1'
        },
        {
            index: 1,
            img: 'podio-img-2',
            nome: 'podio-nome-2',
            views: 'podio-views-2'
        },
        {
            index: 2,
            img: 'podio-img-3',
            nome: 'podio-nome-3',
            views: 'podio-views-3'
        }
    ];

    posicoes.forEach(pos => {

        const canal =
            ranking[pos.index];

        if (!canal) return;

        // ELEMENTOS
        const img =
            document.getElementById(
                pos.img
            );

        const nome =
            document.getElementById(
                pos.nome
            );

        const views =
            document.getElementById(
                pos.views
            );

        // DADOS
        const foto =
            canal.foto_perfil ||
            canal.media_url ||
            '';

        const nomeCanal =
            canal.canal_nome ||
            canal.nome_canal ||
            'Sem Nome';

        const totalViews =
            canal.viewsRanking || 0;

        // IMAGEM
        if (img) {
            img.src = foto;
            img.alt = nomeCanal;
            img.title = nomeCanal;
        }

        // VIEWS
        if (views) {
            views.innerHTML = `
                <i class="fas fa-eye"></i>
                ${Utils.formatarNumero(
                    totalViews
                )}
            `;
        }
    });
},

   
// ======================================
// CARDS DE STATUS (CORRIGIDO E OTIMIZADO)
// ======================================
async atualizarCards(canal, videos = [], todosOsCanais = []) { 
    const elementos = {
        subs: document.getElementById('yt-subs'),
        views: document.getElementById('yt-views'),
        videos: document.getElementById('yt-videos'),
        viewsDia: document.getElementById('yt-views-dia')
    };

    // 1. Inscritos (Seguidores do canal selecionado)
    if (elementos.subs) {
        const seguidores = Number(canal.followers_count || canal.subscriber || 0);
        elementos.subs.innerText = Utils.formatarNumero(seguidores);
    }

    // 2. Visualizações Acumuladas do canal selecionado
    if (elementos.views) {
        const totalViewsLista = videos.reduce((acc, v) => acc + parseInt(v.views_count || 0), 0);
        const viewsExibir = (canal.view_count && canal.view_count > 0) ? canal.view_count : totalViewsLista;
        elementos.views.innerText = Utils.formatarNumero(viewsExibir);
    }

    // 3. Total de mídias do canal selecionado
    if (elementos.videos) {
        const totalVideos = (canal.video_count && canal.video_count > 0) ? canal.video_count : videos.length;
        elementos.videos.innerText = Utils.formatarNumero(totalVideos);
    }

    // 🔥 4. VIEWS DO DIA (Mantém fixo o total do ecossistema sem resetar no clique)
    if (elementos.viewsDia) {
        // Se a variável global tiver valor (calculado pelo Placar), exibe ele.
        // Caso contrário, mostra o do canal atual como plano de fundo.
        const viewsParaExibir = TOTAL_VIEWS_DIA_GLOBAL > 0 ? TOTAL_VIEWS_DIA_GLOBAL : 0;
        elementos.viewsDia.innerText = Utils.formatarNumero(viewsParaExibir);
    }
},


 // ======================================
 // BARRA CANAIS (CORRIGIDA - INSTAGRAM)
 // ======================================
async atualizarBarraCanais(canais = []) {
    if (!this.elementos.bar) return;

    this.elementos.bar.innerHTML = '';

    canais.forEach((canalRaw, index) => {
        const canal = {
            canal_id: canalRaw.canal_id || `PERFIL_${canalRaw.instagram_user_id}`,
            nome_canal: canalRaw.canal_nome || canalRaw.nome_canal || 'Sem Nome',
            foto_perfil: canalRaw.media_url || canalRaw.foto_perfil || 'https://www.instagram.com/static/images/ico/favicon.ico/36b30dd221b6.ico',
            access_token: canalRaw.acesso_token || canalRaw.access_token || '',
            subscriber: canalRaw.followers_count || canalRaw.subscriber || 0,
            video_count: canalRaw.video_count || 0
        };

        // --- INÍCIO DA LÓGICA DE DETECÇÃO DO VÍDEO ZERADO (INSTAGRAM) ---
        let temVideoZerado = false;

        // 1. Tenta buscar do cache local primeiro
        const videosCache = Utils.getVideoCache(canal.canal_id) || [];
        
        if (videosCache.length > 0) {
            const ultimoVideoPostado = videosCache[0];
            const viewsDoUltimo = ultimoVideoPostado.views_count !== undefined ? parseInt(ultimoVideoPostado.views_count) :
                                  ultimoVideoPostado.view_count !== undefined ? parseInt(ultimoVideoPostado.view_count) :
                                  (ultimoVideoPostado.statistics?.viewCount !== undefined ? parseInt(ultimoVideoPostado.statistics.viewCount) : 0);
            
            if (viewsDoUltimo === 0) {
                temVideoZerado = true;
            }
        } else {
            // 2. Carga inicial: Usa o last_video_views calculado dinamicamente pelo getCanais
            const possuiHistoricoDeViews = canalRaw.last_video_views !== undefined && canalRaw.last_video_views !== null;
            
            if (possuiHistoricoDeViews && Number(canalRaw.last_video_views) === 0 && Number(canal.video_count) > 0) {
                temVideoZerado = true;
            }
        }
        // --- FIM DA LÓGICA DE DETECÇÃO ---

        // Criamos o container para isolar a imagem e a bolinha flutuante do Instagram
        const container = document.createElement('div');
        container.className = 'canal-avatar-container';
        container.style.position = 'relative';
        container.style.display = 'inline-block';
        container.style.cursor = 'pointer';
        container.style.marginRight = '14px'; // Espaçamento elegante entre os perfis

        const img = document.createElement('img');
        img.src = canal.foto_perfil;
        img.className = 'canal-thumb-circular';
        img.alt = canal.nome_canal;

        // Aplica borda vermelha na imagem se estiver com o último vídeo travado em 0 views
        if (temVideoZerado) {
            img.style.border = '2px solid #ff3333';
            img.style.boxShadow = '0 0 8px rgba(255, 51, 51, 0.4)';
        }

        // Injeta o badge da bolinha vermelha piscando
        if (temVideoZerado) {
            const badge = document.createElement('span');
            badge.className = 'badge-video-zerado';
            badge.title = `Alerta: O último vídeo do Instagram de @${canal.nome_canal} está travado em 0 views!`;
            badge.style.position = 'absolute';
            badge.style.top = '-2px';
            badge.style.right = '-2px';
            badge.style.width = '12px';
            badge.style.height = '12px';
            badge.style.backgroundColor = '#ff3333';
            badge.style.border = '2px solid #1c1c1e'; // Recorte perfeito integrado ao fundo escuro do Evrix
            badge.style.borderRadius = '50%';
            badge.style.zIndex = '10';
            badge.style.animation = 'pulsarAlerta 2s infinite';
            
            container.appendChild(badge);
        }

        container.appendChild(img);

        container.addEventListener('click', async () => {
            try {
                // Remove o destaque de seleção dos outros canais
                this.elementos.bar.querySelectorAll('.canal-thumb-circular').forEach(i => {
                    i.classList.remove('selecionado');
                });
                img.classList.add('selecionado');

                // 🚨 CORREÇÃO CRÍTICA AQUI: Salva o objeto completo na memória global
                // garantindo que as chaves canal_nome e acesso_token fiquem salvas sem depender de DOM
                CANAL_SELECIONADO_OBJ = canalRaw;

                // Atualiza título do canal ativo no topo de forma limpa
                const nomeCanalHtml = document.getElementById('nome-canal-ativo');
                if (nomeCanalHtml) nomeCanalHtml.textContent = `@${canal.nome_canal}`;

                // 🚨 PASSO CRÍTICO: Limpa a tela imediatamente no momento do clique
                this.limparListaVideos();

                // 1. TENTA PEGAR DO CACHE
                const videosCacheClick = Utils.getVideoCache(canal.canal_id);

                if (videosCacheClick) {
                    this.limparListaVideos(); 
                    await carregarVideosInstagram(canal.nome_canal);
                    this.atualizarCards(canalRaw, videosCacheClick);
                    return;
                }

                // 2. SE NÃO TIVER CACHE, MOSTRA CARREGANDO
                if (this.elementos.listaVideos) {
                    this.elementos.listaVideos.innerHTML = '<p style="padding:20px;"><i class="fas fa-spinner fa-spin"></i> Buscando publicações do Instagram...</p>';
                }

                let videos = [];
                if (typeof DataService !== 'undefined' && typeof DataService.getVideosRecentes === 'function') {
                    videos = await DataService.getVideosRecentes(
                        canal.access_token,
                        canal.nome_canal
                    );
                } else {
                    // Busca direto da tabela instagram_metrics do Supabase
                    const { data, error } = await supabaseClient
                        .from('instagram_metrics')
                        .select('*')
                        .eq('canal_nome', canal.nome_canal)
                        .neq('media_id', `PERFIL_${canalRaw.instagram_user_id}`);
                    
                    if (error) throw error;
                    videos = data || [];
                }
                
                Utils.saveVideoCache(canal.canal_id, videos);
                
                // 🚨 PASSO CRÍTICO: Limpa a tela novamente antes de mandar renderizar os vídeos finais
                this.limparListaVideos();
                
                await carregarVideosInstagram(canal.nome_canal);
                this.atualizarCards(canalRaw, videos);

                // Força atualização da barra caso as views frescas tenham atualizado e saído de 0
                if (videos && videos.length > 0) {
                    const viewsFrequinhas = videos[0].views_count !== undefined ? parseInt(videos[0].views_count) :
                                            videos[0].view_count !== undefined ? parseInt(videos[0].view_count) : 0;
                    if (viewsFrequinhas > 0 && temVideoZerado) {
                        setTimeout(() => { this.atualizarBarraCanais(canais); }, 300);
                    }
                }

            } catch (err) {
                console.error('Erro ao trocar canal:', err);
            }
        });

        // Adiciona o container completo (Foto + Bolinha) na barra lateral
        this.elementos.bar.appendChild(container);

        // Se for o primeiro canal da lista, força o clique inicial usando o container
        if (index === 0) {
            container.click();
        }
    });
},

// ======================================
// GERENCIAMENTO 
// ======================================
atualizarListaGerenciamento(canais = []) {
    if (!this.elementos.listaCanais) {
        return;
    }

    this.elementos.listaCanais.innerHTML = canais
        .map(canal => {
            const nome = canal.canal_nome || canal.nome_canal || 'Sem Nome';
            const foto = canal.media_url || canal.foto_perfil || 'https://www.instagram.com/static/images/ico/favicon.ico/36b30dd221b6.ico';

            return `
                <div class="canal-card">
                    <div class="canal-info">
                        <img 
                            src="${foto}" 
                            alt="${Utils.escapeHtml(nome)}"
                            style="border-radius: 50%; object-fit: cover;"
                        >
                        <div class="canal-detalhes">
                            <h3 class="canal-nome">
                                ${Utils.escapeHtml(nome)}
                            </h3>
                            <span class="status conectado" style="background: rgba(225, 48, 108, 0.1); color: #e1306c;">
                                Instagram conectado
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
            `;
        })
        .join('');
}
};

// ==========================================
// 5. DATA SERVICE (ADAPTADO PARA INSTAGRAM)
// ==========================================
const DataService = {

    // ======================================
    // 1. BUSCAR CANAIS (OTIMIZADO COM VIEWS RECENTES)
    // ======================================
    async getCanais() {
        try {
            if (!supabaseClient) {
                return [];
            }

            // 1. Busca apenas os registros de perfil (as bolinhas)
            const { data: perfis, error: errorPerfis } = await supabaseClient
                .from('instagram_metrics')
                .select('*')
                .like('media_id', 'PERFIL_%')
                .order('created_at', { ascending: false });

            if (errorPerfis) {
                console.error('❌ Erro ao buscar canais:', errorPerfis);
                return [];
            }

            if (!perfis || perfis.length === 0) return [];

            // 2. Busca TODAS as mídias (vídeos) para cruzar as views do último post
            const { data: todasMidias, error: errorMidias } = await supabaseClient
                .from('instagram_metrics')
                .select('canal_nome, views_count, created_at')
                .not('media_id', 'like', 'PERFIL_%')
                .order('created_at', { ascending: false });

            // 3. Injeta dinamicamente o 'last_video_views' combinando os dados
            const perfisProcessados = perfis.map(perfil => {
                const nomeDoCanal = perfil.canal_nome;
                
                // Filtra as mídias filtrando apenas as deste canal (já ordenadas por data decrescente)
                const midiasDoCanal = (todasMidias || []).filter(m => m.canal_nome === nomeDoCanal);
                
                // Pega a views_count do primeiro item (mais recente) se existir
                let viewsUltimoVideo = null;
                if (midiasDoCanal.length > 0) {
                    viewsUltimoVideo = midiasDoCanal[0].views_count !== undefined ? Number(midiasDoCanal[0].views_count) : 0;
                }

                return {
                    ...perfil,
                    last_video_views: viewsUltimoVideo, // Agora sim o dado existe em tempo de execução!
                    video_count: midiasDoCanal.length // Garante um contador real de vídeos ativos
                };
            });

            return perfisProcessados;

        } catch (err) {
            console.error('❌ Erro getCanais:', err);
            return [];
        }
    },

    // ======================================
    // 2. BUSCAR VÍDEOS RECENTES
    // ======================================
    async getVideosRecentes(accessToken, canalNome = '') {
        try {
            if (!supabaseClient) {
                return [];
            }

            const query = supabaseClient
                .from('instagram_metrics')
                .select('*')
                .not('media_id', 'like', 'PERFIL_%')
                .order('created_at', { ascending: false });

            if (canalNome) {
                query.eq('canal_nome', canalNome);
            }

            const { data, error } = await query;

            if (error) {
                console.error('❌ Erro vídeos:', error);
                return [];
            }

            return data || [];

        } catch (err) {
            console.error('❌ getVideosRecentes:', err);
            return [];
        }
    },

    // ======================================
    // 2. TOTAL VIEWS
    // ======================================
    async obterTotalViewsUltimosVideos() {
        try {
            if (!supabaseClient) {
                return 0;
            }

            const { data, error } = await supabaseClient
                .from('instagram_metrics')
                .select('views_count');

            if (error) {
                console.error('❌ Erro total views:', error);
                return 0;
            }

            const total = (data || []).reduce((acc, item) => acc + Number(item.views_count || 0), 0);
            return total;

        } catch (err) {
            console.error('❌ obterTotalViewsUltimosVideos:', err);
            return 0;
        }
    },

    // ======================================
    // 3. SINCRONIZAR INSTAGRAM (CONTROLE ESTRITO DE LINHAS)
    // ======================================
    async sincronizarInstagram() {
        try {
            console.log('Base: Sincronizando Instagram com controle de limite...');

            // PEGA OS CANAIS DO BANCO
            const canais = await this.getCanais();

            for (const canal of canais) {
                const accessToken = canal.acesso_token;
                const instagramUserId = canal.instagram_user_id;
                const nomeCanal = canal.canal_nome;

                // VALIDAÇÃO
                if (!accessToken || !instagramUserId) {
                    console.warn('⚠️ Canal inválido:', nomeCanal);
                    continue;
                }

                console.log(`🎬 Atualizando @${nomeCanal}`);

                // ======================================
                // BUSCAR MÍDIAS
                // ======================================
                const urlMedia = `https://graph.facebook.com/v20.0/${instagramUserId}/media` +
                                 `?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp` +
                                 `&access_token=${accessToken}`;

                const responseMedia = await fetch(urlMedia);

                if (!responseMedia.ok) {
                    console.error(`❌ Erro API Meta para @${nomeCanal}`);
                    continue;
                }

                const resultMedia = await responseMedia.json();
                const midias = resultMedia.data || [];

                // FILTRA SOMENTE VÍDEOS/REELS
                const videos = midias.filter(midia => midia.media_type === 'VIDEO' || midia.media_type === 'REELS');

                // PEGA OS 5 MAIS RECENTES
                const ultimosVideos = videos.slice(0, 5);

                if (ultimosVideos.length === 0) {
                    console.log(`ℹ️ @${nomeCanal} não possui mídias de vídeo recentes.`);
                    continue;
                }

                // AJUSTE AQUI: Formata os IDs como strings encapsuladas em aspas para a cláusula SQL 'in'
                const idsManter = ultimosVideos.map(v => `'${v.id}'`);

                // ======================================
                // CONTROLE DE LIMITE: LIMPA VÍDEOS ANTIGOS
                // ======================================
                const { error: deleteError } = await supabaseClient
                    .from('instagram_metrics')
                    .delete()
                    .eq('canal_nome', nomeCanal)
                    .not('media_id', 'like', 'PERFIL_%') // Preserva a linha de controle do perfil
                    .not('media_id', 'in', `(${idsManter.join(',')})`);

                if (deleteError) {
                    console.error(`⚠️ Erro ao limpar histórico acumulado de @${nomeCanal}:`, deleteError);
                }

                // ======================================
                // ÚLTIMO LINK
                // ======================================
                let ultimoLink = '';
                if (ultimosVideos.length > 0) {
                    ultimoLink = ultimosVideos[0].permalink || '';
                }

                // ======================================
                // PROCESSAMENTO EM PARALELO (MÍDIAS)
                // ======================================
                await Promise.all(ultimosVideos.map(async (midia) => {
                    let viewsCount = 0;
                    let likeCount = 0;
                    let commentsCount = 0;

                    try {
                        const urlDados = `https://graph.facebook.com/v20.0/${midia.id}?fields=like_count,comments_count&access_token=${accessToken}`;
                        const urlInsights = `https://graph.facebook.com/v20.0/${midia.id}/insights?metric=views&access_token=${accessToken}`;

                        const [resDados, resInsights] = await Promise.all([
                            fetch(urlDados),
                            fetch(urlInsights)
                        ]);

                        if (resDados.ok) {
                            const dados = await resDados.json();
                            likeCount = dados.like_count || 0;
                            commentsCount = dados.comments_count || 0;
                        }

                        if (resInsights.ok) {
                            const insights = await resInsights.json();
                            viewsCount = insights?.data?.[0]?.values?.[0]?.value || 0;
                        }

                    } catch (e) {
                        console.error(`❌ Erro ao buscar métricas da mídia ${midia.id}:`, e);
                    }

                    const dadosParaSalvar = {
                        canal_nome: nomeCanal,
                        instagram_user_id: instagramUserId,
                        media_id: midia.id,
                        permalink: midia.permalink || '',
                        media_url: midia.media_url || '',
                        thumbnail_url: midia.thumbnail_url || '',
                        caption: midia.caption || '',
                        views_count: Number(viewsCount),
                        like_count: Number(likeCount),
                        comments_count: Number(commentsCount),
                        created_at: midia.timestamp || new Date().toISOString()
                    };

                    const { error: upsertError } = await supabaseClient
                        .from('instagram_metrics')
                        .upsert(dadosParaSalvar, { onConflict: 'media_id' });

                    if (upsertError) {
                        console.error(`❌ Erro salvar ${midia.id}:`, upsertError);
                    } else {
                        console.log(`✅ ${midia.id} atualizado`);
                    }
                }));

                // ======================================
                // ATUALIZA LAST_VIDEO DO PERFIL (LINHA FIXA ÚNICA)
                // ======================================
                if (ultimoLink) {
                    const dadosPerfil = {
                        media_id: `PERFIL_${instagramUserId}`,
                        canal_nome: nomeCanal,
                        instagram_user_id: instagramUserId,
                        last_video: ultimoLink,
                        created_at: new Date().toISOString()
                    };

                    const { error: perfilError } = await supabaseClient
                        .from('instagram_metrics')
                        .upsert(dadosPerfil, { onConflict: 'media_id' });

                    if (perfilError) {
                        console.error(`❌ Erro ao atualizar linha fixa do perfil @${nomeCanal}:`, perfilError);
                    } else {
                        console.log(`✅ Linha fixa do perfil @${nomeCanal} updated!`);
                    }
                }
            }

            console.log('✅ Sincronização finalizada com banco enxuto!');
            return true;

        } catch (err) {
            console.error('❌ sincronizarInstagram:', err);
            return false;
        }
    },

    // ======================================
    // 4. POSTAR REELS NO INSTAGRAM (NOVA FUNÇÃO)
    // ======================================
    async postarReels(canal, videoUrl, legenda = '') {
        try {
            const accessToken = canal.acesso_token;
            const instagramUserId = canal.instagram_user_id;
            const nomeCanal = canal.canal_nome;

            if (!accessToken || !instagramUserId) {
                console.error("❌ Token ou ID do Instagram ausentes.");
                return { sucesso: false, erro: "Credenciais inválidas." };
            }

            console.log(`🎬 Iniciando envio de Reels para @${nomeCanal}...`);

            // --- PASSO 1: CRIAR O CONTAINER DE MÍDIA ---
            const urlContainer = `https://graph.facebook.com/v20.0/${instagramUserId}/media`;
            const paramsContainer = new URLSearchParams({
                media_type: 'REELS',
                video_url: videoUrl,
                caption: legenda,
                access_token: accessToken
            });

            const resContainer = await fetch(`${urlContainer}?${paramsContainer.toString()}`, { method: 'POST' });
            const dadosContainer = await resContainer.json();

            if (!resContainer.ok || !dadosContainer.id) {
                throw new Error(dadosContainer.error?.message || "Erro ao criar container de mídia.");
            }

            const creationId = dadosContainer.id;
            console.log(`✅ Container criado com ID: ${creationId}. Aguardando processamento da Meta...`);

            // --- PASSO OBRIGATÓRIO: AGUARDAR O INSTAGRAM PROCESSAR O VÍDEO ---
            let processado = false;
            let tentativas = 0;
            
            while (!processado && tentativas < 6) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                tentativas++;

                const resStatus = await fetch(`https://graph.facebook.com/v20.0/${creationId}?fields=status_code&access_token=${accessToken}`);
                const dadosStatus = await resStatus.json();

                if (dadosStatus.status_code === 'FINISHED') {
                    processado = true;
                    console.log("🚀 Vídeo processado com sucesso pela Meta!");
                } else if (dadosStatus.status_code === 'ERROR') {
                    throw new Error("A Meta falhou ao processar o arquivo de vídeo enviado.");
                } else {
                    console.log(`⏳ Vídeo ainda processando (Tentativa ${tentativas}/6)...`);
                }
            }

            if (!processado) throw new Error("Tempo limite de processamento do vídeo esgotado.");

            // --- PASSO 2: PUBLICAR O REELS ---
            const urlPublish = `https://graph.facebook.com/v20.0/${instagramUserId}/media_publish`;
            const paramsPublish = new URLSearchParams({
                creation_id: creationId,
                access_token: accessToken
            });

            const resPublish = await fetch(`${urlPublish}?${paramsPublish.toString()}`, { method: 'POST' });
            const dadosPublish = await resPublish.json();

            if (!resPublish.ok || !dadosPublish.id) {
                throw new Error(dadosPublish.error?.message || "Erro ao publicar o Reels.");
            }

            const mediaIdId = dadosPublish.id;
            console.log(`🔥 Reels publicado com sucesso! ID da Mídia: ${mediaIdId}`);

            // --- PASSO 3: SALVAR NO SUPABASE PARA ATUALIZAR O FEED IMEDIATAMENTE ---
            const clientAtivo = supabaseClient || (typeof DataService !== 'undefined' && DataService.supabase);

            if (clientAtivo) {
                const dadosParaSalvar = {
                    canal_nome: nomeCanal,
                    instagram_user_id: instagramUserId,
                    media_id: mediaIdId,
                    permalink: `https://www.instagram.com/p/${mediaIdId}/`,
                    media_url: videoUrl,
                    caption: legenda,
                    views_count: 0,
                    like_count: 0,
                    comments_count: 0,
                    created_at: new Date().toISOString()
                };

                const { error: videoSaveError } = await clientAtivo
                    .from('instagram_metrics')
                    .upsert(dadosParaSalvar, { onConflict: 'media_id' });

                if (!videoSaveError) {
                    console.log(`📌 Novo Reels registrado no banco de dados com sucesso!`);
                } else {
                    console.error(`❌ Erro ao registrar mídia no banco:`, videoSaveError);
                }
            } else {
                console.warn("⚠️ Cliente Supabase não encontrado. O post foi feito na Meta, mas não salvo localmente.");
            }

            return { sucesso: true, mediaId: mediaIdId };

        } catch (error) {
            console.error("❌ Falha no envio do Reels:", error.message);
            return { sucesso: false, erro: error.message };
        }
    }
};

// ==========================================
// 6. RENDERIZAR VÍDEOS INSTAGRAM (CORRIGIDO)
// ==========================================
async function carregarVideosInstagram(canalNome = '') {
    try {
        console.log(`📺 Carregando vídeos para o canal: ${canalNome || 'Todos'}`);

        // Busca TODOS os containers na tela
        const containers = [
            document.getElementById('lista-videos'),
            document.getElementById('lista-videos-programacao')
        ].filter(Boolean);

        if (containers.length === 0) {
            console.error('❌ Nenhum container de vídeos encontrado na árvore do HTML.');
            return;
        }

        // 🔥 PASSO 1: LIMPA TOTALMENTE OS CONTAINERS ANTES DE EXIBIR O SINAL DE CARREGANDO
        containers.forEach(container => {
            container.innerHTML = '<p style="padding:20px; color:#86868b;">Carregando vídeos...</p>';
        });

        // Mapeador de busca de vídeos seguros
        const fetchVideosParaCanal = async (nome) => {
            if (typeof DataService.getVideosRecentes === 'function') {
                return await DataService.getVideosRecentes('', nome);
            } else if (typeof DataService.getVideos === 'function') {
                return await DataService.getVideos(nome);
            } else {
                const { data } = await supabaseClient
                    .from('instagram_metrics')
                    .select('*')
                    .eq('canal_nome', nome)
                    .not('media_id', 'like', 'PERFIL_%')
                    .order('created_at', { ascending: false })
                    .limit(5);
                return data || [];
            }
        };

        let videos = [];

        // SE CANALNOME FOR VAZIO (ABA "TODOS")
        if (!canalNome || canalNome.trim() === '') {
            const listaCanais = await DataService.getCanais();
            
            if (listaCanais && listaCanais.length > 0) {
                // Roda as requisições de todos os canais em paralelo (Garante a velocidade máxima)
                const arraysDeVideos = await Promise.all(
                    listaCanais.map(canal => fetchVideosParaCanal(canal.canal_nome))
                );
                
                // Concatena todos os arrays de vídeos retornados em uma única lista limpa
                videos = arraysDeVideos.flat();
                
                // Re-ordena de forma decrescente para misturar cronologicamente os canais no feed unificado
                videos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            }
        } else {
            // SE FOR UM CANAL ESPECÍFICO
            videos = await fetchVideosParaCanal(canalNome);
        }

        // Sem vídeos ou se o retorno falhar
        if (!videos || videos.length === 0) {
            containers.forEach(c => {
                c.innerHTML = `<p style="padding:20px; color:#86868b;">Nenhum vídeo encontrado para o canal @${canalNome || 'selecionado'}.</p>`;
            });
            return;
        }

        // Gera HTML com a MESMA disposição de elementos, classes e ícones SVGs corrigidos
        const htmlGerado = videos.map(video => {
            const viewsRaw = video.views_count || 0;
            const likesRaw = video.like_count || 0;
            const commentsRaw = video.comments_count || 0;

            const views = Utils.formatarNumero(viewsRaw);
            const likes = Utils.formatarNumero(likesRaw);
            const comments = Utils.formatarNumero(commentsRaw);

            let dataPostagem = '-';
            try {
                dataPostagem = new Date(video.created_at).toLocaleDateString('pt-BR');
            } catch {}

            const tituloVideo = video.caption || `Reels - ${video.canal_nome || 'Instagram'}`;
            const capaVideo = video.thumbnail_url || video.media_url || 'https://placehold.co/600x800?text=Instagram';
            const linkVideo = video.permalink || '#';

            return `
                <div class="video-card" style="position: relative; display: flex; text-decoration: none; cursor: default;">
                    <a href="${linkVideo}" target="_blank" rel="noopener noreferrer" style="display: flex; gap: inherit; text-decoration: none; color: inherit; width: 100%; flex: 1;">
                        <img src="${capaVideo}" class="video-thumb" alt="Thumbnail">
                        <div class="video-detalhes" style="flex: 1; padding-right: 40px;">
                            <span class="video-titulo" title="${Utils.escapeHtml(tituloVideo)}" style="color:#f5f5f7; font-size:14px; font-weight:500;">
                                ${Utils.escapeHtml(tituloVideo)}
                            </span>
                            <div style="display:flex; gap:16px; margin-top:8px; flex-wrap:wrap; align-items:center; font-size:12px;">
                                <span class="video-meta" style="color:#86868b;">${dataPostagem}</span>
                                
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
                            data-url="${linkVideo}"
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
                            onmouseleave="if(this.querySelector('i').className !== 'fas fa-check') { this.style.background='rgba(255, 255, 255, 0.05)'; this.style.color='#aaa'; } this.querySelector('.tooltip-copiar').style.opacity='0'; this.querySelector('.tooltip-copiar').style.transform='translateX(8px) translateY(-50%)';"
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
                        ">${linkVideo === '#' ? 'Link indisponível' : 'Copiar Link'}</span>
                    </button>
                </div>
            `;
        }).join('');

        // 🔥 PASSO 2: MONTA O CONTEÚDO LIMPINHO NO FEED
        containers.forEach(container => {
            container.innerHTML = htmlGerado;
        });

        console.log(`✅ Feed updated exclusively para o canal: @${canalNome || 'Todos'}`);

    } catch (err) {
        console.error('❌ erro carregarVideosInstagram:', err);
    }
}

// ==========================================
// 6. AUTH INSTAGRAM VIA FACEBOOK DIALOG (MODIFICADO - RESET TOTAL DA TABELA)
// ==========================================

window.iniciarAuth = async plataforma => {
    try {
        if (plataforma !== 'instagram') {
            return;
        }

        // 🚨 LOGICA DE LIMPEZA: RESET TOTAL DO BANCO ANTES DE IR PARA A META
        if (supabaseClient) {
            console.log('🧹 REALIZANDO RESET TOTAL: Apagando todas as linhas de instagram_metrics...');
            
            // Apaga absolutamente TUDO (perfis, tokens e vídeos antigos)
            const { error: deleteError } = await supabaseClient
                .from('instagram_metrics')
                .delete()
                .neq('media_id', ''); // Filtro universal para forçar a limpeza completa da tabela

            if (deleteError) {
                console.error('❌ Erro crítico ao zerar a tabela no Supabase:', deleteError);
            } else {
                console.log('✅ Tabela instagram_metrics zerada com sucesso! Pronto para novos dados.');
            }
        }

        // Escopos profissionais para ler os Reels e Insights
        const scopes = [
            'instagram_basic',
            'instagram_manage_insights',
            'pages_show_list',
            'pages_read_engagement'
        ].join(',');

        const REDIRECT_URI = 'https://www.evrix.shop/menu/instagram/'; 
        const APP_ID = CONFIG.META_APP_ID; 

        if (!APP_ID || APP_ID === 'undefined') {
            console.error('❌ Erro: CONFIG.META_APP_ID não foi definido.');
            alert('Erro de configuração: ID do aplicativo não encontrado.');
            return;
        }

        // Experiência de login do Instagram profissional direto
        const extras = JSON.stringify({
            setup: {
                channel: 'IG_BUSINESS'
            }
        });

        const authUrl = 
            `https://www.facebook.com/v20.0/dialog/oauth` +
            `?client_id=${APP_ID}` +
            `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&response_type=code` +
            `&extras=${encodeURIComponent(extras)}`;

        console.log('🚀 Redirecionando para o fluxo otimizado do Instagram...');
        window.location.href = authUrl;

    } catch (err) {
        console.error('❌ Erro ao iniciar autenticação do Instagram:', err);
    }
};

// ==========================================
// 7. SIDEBAR
// ==========================================

function toggleSidebar() {
    const sidebar =
        document.getElementById(
            'sidebar-menu'
        );

    if (sidebar) {
        sidebar.classList.toggle(
            'sidebar-open'
        );
    }
}

window.toggleSidebar =
    toggleSidebar;

// ==========================================
// 8. INIT (ADAPTADO COMPLETO PARA INSTAGRAM GRAPH API)
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const metaCode = urlParams.get('code');

        if (metaCode) {
            console.log('📸 Callback da Meta detectado! Iniciando troca de tokens...');

            const APP_ID = CONFIG.META_APP_ID;
            const APP_SECRET = CONFIG.META_APP_SECRET;
            const REDIRECT_URI = 'https://www.evrix.shop/menu/instagram/';

            // PASSO A: Trocar o 'code' pelo Token de Curta Duração
            const urlTokenCurto = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${metaCode}`;
            
            const resTokenCurto = await fetch(urlTokenCurto);
            const dataTokenCurto = await resTokenCurto.json();

            if (dataTokenCurto && dataTokenCurto.access_token) {
                const tokenCurto = dataTokenCurto.access_token;
                console.log('✅ Token de curta duração obtido. Gerando token de 60 dias...');

                // PASSO B: Gerar Token de Longa Duração (60 dias)
                const urlTokenLongo = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${tokenCurto}`;
                
                const resTokenLongo = await fetch(urlTokenLongo);
                const dataTokenLongo = await resTokenLongo.json();

                if (dataTokenLongo && dataTokenLongo.access_token) {
                    const tokenLongo = dataTokenLongo.access_token;
                    console.log('🔥 Token de Longa Duração gerado com sucesso!');

                    // PASSO C: Buscar id do Instagram através de todas as páginas
                    console.log('📡 Identificando contas vinculadas...');
                    const urlContas = `https://graph.facebook.com/v20.0/me/accounts?fields=name,access_token,instagram_business_account{id,username}&access_token=${tokenLongo}`;
                    
                    const resContas = await fetch(urlContas);
                    const dataContas = await resContas.json();
                    const paginas = dataContas?.data || [];
                    
                    let canaisProcessadosComSucesso = 0;

                    // Pegar usuário logado na Evrix (Supabase) uma única vez antes do laço
                    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

                    if (userError || !user) {
                        console.error('❌ Usuário não autenticado no Supabase.');
                        alert('Erro: Usuário não autenticado no sistema.');
                        return;
                    }
                    
                    // 🔥 LOOP COMPLETO POR TODAS AS PÁGINAS AUTORIZADAS
                    for (const pg of paginas) {
                        if (pg.instagram_business_account && pg.instagram_business_account.id) {
                            const idInstaEncontrado = pg.instagram_business_account.id;
                            const usernameEncontrado = pg.instagram_business_account.username || '';
                            
                            console.log(`📊 Puxando contadores oficiais para a conta: @${usernameEncontrado || idInstaEncontrado}`);
                            
                            try {
                                // PASSO D: Buscar os dados consolidados de CADA perfil no Instagram
                                const urlDadosPerfil = `https://graph.facebook.com/v20.0/${idInstaEncontrado}?fields=username,name,profile_picture_url,followers_count,media_count&access_token=${tokenLongo}`;
                                
                                const resPerfil = await fetch(urlDadosPerfil);
                                const dataPerfil = await resPerfil.json();

                                const dadosCanal = {
                                    id_user: user.id,
                                    instagram_user_id: idInstaEncontrado,
                                    media_id: `PERFIL_${idInstaEncontrado}`, // Chave única por canal
                                    canal_nome: dataPerfil.username || usernameEncontrado || 'instagram',
                                    permalink: `https://instagram.com/${dataPerfil.username || usernameEncontrado || 'instagram'}`,
                                    media_url: dataPerfil.profile_picture_url || 'https://www.instagram.com/static/images/ico/favicon.ico/36b30dd221b6.ico',
                                    caption: 'PERFIL_CANAL',
                                    views_count: 0,
                                    like_count: 0,
                                    comments_count: 0,
                                    followers_count: Number(dataPerfil.followers_count || 0),
                                    subscriber: Number(dataPerfil.followers_count || 0),
                                    video_count: Number(dataPerfil.media_count || 0),
                                    acesso_token: tokenLongo,
                                    country_count: 0,
                                    last_video: '',
                                    created_at: new Date().toISOString()
                                };

                                console.log(`💾 Salvando canal @${dadosCanal.canal_nome} no Supabase...`);

                                // 🔥 CÓDIGO ALINHADO COM A TRAVA EXCLUSIVA DO BANCO DE DADOS
                                const { error: saveError } = await supabaseClient
                                    .from('instagram_metrics')
                                    .upsert(dadosCanal, { onConflict: 'media_id' }); // 🎯 Usando a Chave Primária direto para evitar o erro 42P10

                                if (!saveError) {
                                    console.log(`🎉 Canal @${dadosCanal.canal_nome} gravado com sucesso!`);
                                    canaisProcessadosComSucesso++;
                                } else {
                                    console.error(`❌ Erro ao salvar o canal @${dadosCanal.canal_nome}:`, saveError);
                                }

                            } catch (erroPerfil) {
                                console.error(`❌ Erro ao processar perfil do ID ${idInstaEncontrado}:`, erroPerfil);
                            }
                        }
                    }

                    if (canaisProcessadosComSucesso === 0) {
                        console.warn('⚠️ Nenhuma conta comercial do Instagram vinculada foi encontrada ou salva.');
                    } else {
                        console.log(`🚀 Varredura concluída. ${canaisProcessadosComSucesso} canais prontos na base.`);
                    }
                }
            } else {
                console.error('❌ Falha na autenticação com os servidores da Meta:', dataTokenCurto);
            }

            // Limpa o '?code=...' da URL de forma limpa após o processamento do callback
            window.history.replaceState({}, document.title, window.location.pathname);

            // Dispara o Auto Sync inicial após 3 segundos caso tenha vindo do login
            setTimeout(async () => {
                try {
                    console.log('🔄 Auto Sync iniciado...');
                    await DataService.sincronizarInstagram();
                    const canaisAtualizados = await DataService.getCanais();

                    await UI.atualizarBarraCanais(canaisAtualizados);
                    UI.renderizarGradeDinamica(canaisAtualizados);
                    UI.atualizarListaGerenciamento(canaisAtualizados);
                    await UI.renderizarPlacarCampeonato(canaisAtualizados);

                    console.log('✅ Dashboard updated.');
                } catch (err) {
                    console.error('❌ Auto Sync:', err);
                }
            }, 3000);
        }

        // ==============================
        // INIT UI ELEMENTS
        // ==============================
        UI.initNavegacao();
        UI.initModal();

        // ==============================
        // LOAD DASHBOARD DATA DEFAULT
        // ==============================
        if (supabaseClient) {
            // Busca todos os registros e mídias salvos do Instagram
            const canais = await DataService.getCanais();

            // Renderiza os componentes visuais com os dados novos do banco
            await UI.atualizarBarraCanais(canais);
            UI.atualizarListaGerenciamento(canais);
            UI.renderizarGradeDinamica(canais);
            
            if (typeof UI.renderizarPlacarCampeonato === 'function') {
                await UI.renderizarPlacarCampeonato(canais);
            }

            // CORREÇÃO: Se houver canais salvos, seleciona automaticamente o primeiro da lista
            if (Array.isArray(canais) && canais.length > 0) {
                console.log(`📌 Selecionando canal padrão inicial: @${canais[0].canal_nome}`);
                if (typeof UI.selecionarCanalPainel === 'function') {
                    await UI.selecionarCanalPainel(canais[0].instagram_user_id || canais[0].canal_id, canais[0].acesso_token);
                }
            }
        }

        UI.trocarAba('dashboard');
        console.log('✅ Sistema iniciado com sucesso.');

    } catch (err) {
        console.error('❌ Erro fatal INIT:', err);
    }
});

// ==========================================================================
// 9. GERENCIAMENTO DA ABA DE PUBLICAÇÃO E NAVEGAÇÃO DE REDES
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO FORMULÁRIO DE PUBLICAÇÃO ---
    const dropzone = document.getElementById('dropzone-video');
    const inputArquivo = document.getElementById('input-video-arquivo');
    const dropzoneVazio = document.getElementById('dropzone-vazio');
    const dropzonePreview = document.getElementById('dropzone-com-preview');
    const previewPlayer = document.getElementById('preview-video-player');
    const nomeArquivoSpan = document.getElementById('nome-arquivo-selecionado');
    const btnRemover = document.getElementById('btn-remover-video');
    const btnEnviar = document.getElementById('btn-enviar-video');
    const inputLegenda = document.getElementById('input-titulo');

    let arquivoSelecionado = null;

    // --- INTERAÇÃO COM DROPZONE (CLIQUE E ARRASTE) ---
    if (dropzone) {
        dropzone.addEventListener('click', (e) => {
            if (e.target !== btnRemover && !btnRemover.contains(e.target) && e.target !== previewPlayer) {
                inputArquivo.click();
            }
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '#c13584';
            dropzone.style.background = 'rgba(193, 53, 132, 0.05)';
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            dropzone.style.background = 'transparent';
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            dropzone.style.background = 'transparent';
            
            if (e.dataTransfer.files.length > 0) {
                validarEExibirVideo(e.dataTransfer.files[0]);
            }
        });
    }

    if (inputArquivo) {
        inputArquivo.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                validarEExibirVideo(e.target.files[0]);
            }
        });
    }

    function validarEExibirVideo(arquivo) {
        if (!arquivo.type.startsWith('video/')) {
            alert('Por favor, selecione um arquivo de vídeo válido (.mp4 ou .mov).');
            return;
        }
        arquivoSelecionado = arquivo;
        nomeArquivoSpan.innerText = arquivo.name;

        const urlBlobLocal = URL.createObjectURL(arquivo);
        previewPlayer.src = urlBlobLocal;

        dropzoneVazio.style.display = 'none';
        dropzonePreview.style.display = 'flex';
    }

    if (btnRemover) {
        btnRemover.addEventListener('click', (e) => {
            e.stopPropagation();
            arquivoSelecionado = null;
            inputArquivo.value = '';
            previewPlayer.src = '';
            dropzonePreview.style.display = 'none';
            dropzoneVazio.style.display = 'flex';
        });
    }


// --- GATILHO DE ENVIO / PUBLICAÇÃO COM AGENDAMENTO INTELIGENTE ---
if (btnEnviar) {
    btnEnviar.addEventListener('click', async () => {
        try {
            // 🎯 Captura a legenda usando o ID correto do seu HTML (input-titulo)
            const inputLegenda = document.getElementById('input-titulo');
            const legenda = inputLegenda ? inputLegenda.value.trim() : '';
            
            // 🎯 Captura o campo de data usando o ID exato do seu HTML (input-agendamento)
            const inputDataAgendamento = document.getElementById('input-agendamento'); 

            // Validações básicas antes de prosseguir
            if (!arquivoSelecionado) {
                alert('Selecione ou arraste um vídeo antes de publicar!');
                return;
            }
            if (!legenda) {
                alert('A legenda do Reels é obrigatória.');
                return;
            }

            const canalAtivo = CANAL_SELECIONADO_OBJ;
            if (!canalAtivo) {
                alert('Por favor, selecione um canal ativo na barra antes de continuar.');
                return;
            }

            // Identifica se o usuário preencheu uma data futura
            let dataAgendadaValue = inputDataAgendamento ? inputDataAgendamento.value : null;
            let ehAgendamento = false;

            if (dataAgendadaValue) {
                const dataHoraAlvo = new Date(dataAgendadaValue);
                const agora = new Date();

                if (dataHoraAlvo > agora) {
                    ehAgendamento = true;
                } else {
                    alert('A data de agendamento precisa ser um horário no futuro! Deixe em branco se quiser postar na hora.');
                    return;
                }
            }

            // Inicia o estado de carregamento do botão
            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando arquivo...';

            console.log(`📦 Enviando "${arquivoSelecionado.name}" para o Supabase Storage temporário...`);

            // Limpa o nome do arquivo para evitar problemas de codificação na URL
            const nomeLimpo = arquivoSelecionado.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9.\-_]/g, "_");

            const nomeArquivoFinal = `${Date.now()}_${nomeLimpo}`;
            
            // Faz o upload direto para a raiz do seu bucket 'reels_uploads'
            const { data: uploadData, error: uploadError } = await supabaseClient
                .storage
                .from('reels_uploads')
                .upload(nomeArquivoFinal, arquivoSelecionado, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) throw new Error(`Falha no armazenamento: ${uploadError.message}`);

            // Pega a URL pública do vídeo gerada no Storage
            const { data: { publicUrl } } = supabaseClient
                .storage
                .from('reels_uploads')
                .getPublicUrl(nomeArquivoFinal);

            console.log(`🔗 URL pública gerada para a Meta: ${publicUrl}`);

            // 🔀 DIVISÃO DO FLUXO: AGENDAR OU POSTAR NA HORA
            if (ehAgendamento) {
                btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando na fila...';
                
                // Grava os dados na tabela que o Cron do banco vai ler de 5 em 5 minutos
              const { error: insertError } = await supabaseClient
    .from('reels_agendados')
    .insert([{
        canal_nome: canalAtivo.canal_nome,
        instagram_business_id: canalAtivo.instagram_user_id, // ← corrigido
        access_token: canalAtivo.acesso_token,               // ← corrigido
        video_url: publicUrl,
        caption: legenda,
        agendado_para: dataAgendadaValue,
        status: 'pendente'
    }]);

                if (insertError) throw new Error(`Erro ao salvar agendamento: ${insertError.message}`);

                alert(`📅 Reels agendado com sucesso para ${new Date(dataAgendadaValue).toLocaleString('pt-BR')}!`);
                
            } else {
                // Postagem direta imediata (Fluxo tradicional)
                btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publicando no Instagram...';
                const resultado = await DataService.postarReels(canalAtivo, publicUrl, legenda);

                if (resultado.sucesso) {
                    alert('🚀 Reels publicado imediatamente com sucesso!');
                } else {
                    throw new Error(resultado.erro);
                }
            }

            // Limpa os campos do painel após o sucesso total
            if (inputLegenda) inputLegenda.value = '';
            if (inputDataAgendamento) inputDataAgendamento.value = '';
            
            // Simula o clique no botão de remover vídeo para limpar o preview da tela
            const btnRemover = document.getElementById('btn-remover-video');
            if (btnRemover) btnRemover.click();
            
            if (typeof carregarVideosInstagram === 'function') {
                carregarVideosInstagram(canalAtivo.canal_nome);
            }

        } catch (err) {
            console.error('❌ Erro no processo:', err);
            alert(`Erro crítico: ${err.message}`);
        } finally {
            btnEnviar.disabled = false;
            btnEnviar.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar Reels';
        }
    });
}

    // --- SCRIPT DE REDIRECIONAMENTO DAS REDES (UNIFICADO) ---
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
