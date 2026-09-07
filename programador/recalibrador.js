/**
 * Recalibrador Dinâmico Multi-Vídeos (Suporte a Campanhas de 1 até 8 vídeos por canal)
 * Adapta-se automaticamente a novos canais e ativa as faixas horárias conforme a quantidade de vídeos.
 */

(function () {
  function hhmmParaMinutos(hhmm) {
    if (!hhmm || hhmm === "--:--") return 0;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function minutosParaHHMM(totalMinutos) {
    let total = ((totalMinutos % 1440) + 1440) % 1440;
    const H = String(Math.floor(total / 60)).padStart(2, "0");
    const M = String(total % 60).padStart(2, "0");
    return `${H}:${M}`;
  }

  /**
   * Tabela base de horários iniciais para cada slot de vídeo (de 1 a 8)
   * Baseado nas suas regras de campanha.
   */
  const HORARIOS_BASE_SLOTS = {
    1: { manha: "11:00", noite: "18:00", inicioAbsoluto: "05:00" },
    2: { inicioAbsoluto: "07:00" },
    3: { inicioAbsoluto: "09:00" },
    4: { inicioAbsoluto: "11:00" },
    5: { inicioAbsoluto: "13:00" },
    6: { inicioAbsoluto: "15:00" },
    7: { inicioAbsoluto: "17:00" },
    8: { inicioAbsoluto: "19:00" }
  };

  /**
   * Distribui os vídeos dinamicamente na interface e gerencia os slots (de 1 a 8)
   * com base na quantidade de vídeos jogados por canal.
   */
  async function distribuirMultiplosVideosDinamicos(videos) {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) return;
    if (!videos || !videos.length) return;

    // Ordena os canais dinâmicos para garantir consistência na distribuição
    const canaisOrdenados = [...CANAIS_DINAMICOS].sort((a, b) => a.id.localeCompare(b.id));
    const videosPorCanal = {};
    canaisOrdenados.forEach(c => { videosPorCanal[c.id] = []; });
    const naoAlocados = [];

    // Agrupa os arquivos arrastados/selecionados por canal
    videos.forEach(video => {
      const nomeLow = video.name.toLowerCase();
      let canalEncontrado = canaisOrdenados.find(c => 
        nomeLow.includes(c.id.toLowerCase()) || nomeLow.includes(c.nome.toLowerCase())
      );

      if (canalEncontrado) {
        videosPorCanal[canalEncontrado.id].push(video);
      } else {
        naoAlocados.push(video);
      }
    });

    // Se houver vídeos sem nome explícito, distribui sequencialmente nos canais que têm menos vídeos
    if (naoAlocados.length > 0) {
      for (const video of naoAlocados) {
        let canalLivre = canaisOrdenados.find(c => videosPorCanal[c.id].length < 8);
        if (canalLivre) {
          videosPorCanal[canalLivre.id].push(video);
        }
      }
    }

    let totalDistribuidos = 0;

    // Processa a alocação para cada canal
    for (const canalId of Object.keys(videosPorCanal)) {
      const listaVideosCanal = videosPorCanal[canalId];
      if (listaVideosCanal.length === 0) continue;

      // O 1º vídeo vai para o slot principal do card
      if (typeof processarArquivo === "function" && listaVideosCanal[0]) {
        await processarArquivo(canalId, listaVideosCanal[0]);
        totalDistribuidos++;
      }

      // Se houver de 2 até 8 vídeos, armazenamos nos metadados de vídeos extras do canal
      if (listaVideosCanal.length > 1) {
        if (typeof estadoCanais !== "undefined" && estadoCanais[canalId]) {
          // Armazena do 2º vídeo em diante (índice 1 até o fim)
          estadoCanais[canalId].videosExtras = listaVideosCanal.slice(1);
        }
      }
    }

    // Dispara a recalibragem para ajustar os horários dinamicamente com base no maior número de vídeos inseridos
    recalibrarHorariosDinamicos();

    if (typeof setMsg === "function") {
      setMsg(`${totalDistribuidos} vídeo(s) alocados com suporte a campanhas dinâmicas!`);
    }
  }

  /**
   * Recalibra os horários de forma totalmente dinâmica para todos os slots ativos,
   * adaptando-se automaticamente se você adicionar novos canais.
   */
  function recalibrarHorariosDinamicos() {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) {
      return;
    }

    const canaisOrdenados = [...CANAIS_DINAMICOS].sort((a, b) => a.id.localeCompare(b.id));
    const intervaloMinutos = 20;
    let houveAlteracao = false;

    // Descobre qual é o teto máximo de vídeos extras presentes em algum canal na tela (entre 1 e 8)
    let maxVideosNoCanal = 1;
    if (typeof estadoCanais !== "undefined") {
      Object.values(estadoCanais).forEach(estado => {
        if (estado && estado.videosExtras && estado.videosExtras.length > 0) {
          const qtdTotal = estado.videosExtras.length + 1;
          if (qtdTotal > maxVideosNoCanal) maxVideosNoCanal = qtdTotal;
        }
      });
    }

    // Se a campanha for padrão (até 3 vídeos), mantém o comportamento original por faixa (manha/noite)
    if (maxVideosNoCanal <= 3) {
      const basesFaixas = { manha: "11:00", noite: "18:00" };
      ["manha", "noite"].forEach((faixa) => {
        let baseMinutos = hhmmParaMinutos(basesFaixas[faixa]);
        const canaisDaFaixa = canaisOrdenados.filter((c) => c.faixa === faixa);

        canaisDaFaixa.forEach((c, index) => {
          let horarioIdealMinutos = baseMinutos + (index * intervaloMinutos);
          const novoHorarioStr = minutosParaHHMM(horarioIdealMinutos);
          if (c.horario !== novoHorarioStr) {
            c.horario = novoHorarioStr;
            c._horarioValida = true;
            houveAlteracao = true;
          }
        });
      });
    } else {
      // Campanhas estendidas (de 4 a 8 vídeos): distribui sequencialmente por índice de canal
      canaisOrdenados.forEach((c, index) => {
        // Pega o horário inicial absoluto do primeiro canal para a faixa expandida (ex: começa às 05:00)
        let baseMinutos = hhmmParaMinutos(HORARIOS_BASE_SLOTS[1].inicioAbsoluto);
        let horarioIdealMinutos = baseMinutos + (index * intervaloMinutos);
        const novoHorarioStr = minutosParaHHMM(horarioIdealMinutos);

        if (c.horario !== novoHorarioStr) {
          c.horario = novoHorarioStr;
          c._horarioValida = true;
          houveAlteracao = true;
        }
      });
    }

    if (houveAlteracao && typeof rerenderizarGrids === "function") {
      rerenderizarGrids();
      console.log(`[Recalibrador Dinâmico] Grade recalculada para campanha de até ${maxVideosNoCanal} vídeos.`);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      recalibrarHorariosDinamicos();
    }, 1800);
  });

  window.recalibrarHorariosDinamicos = recalibrarHorariosDinamicos;
  window.distribuirMultiplosVideosDinamicos = distribuirMultiplosVideosDinamicos;
})();
