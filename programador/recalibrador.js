/**
 * Recalibrador Dinâmico e Agrupador Preciso por Canal
 * Garante o agrupamento exclusivo de múltiplos vídeos no mesmo card e aplica os horários.
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
   * Agrupa os vídeos estritamente para o canal correspondente baseado no nome do arquivo,
   * evitando qualquer distribuição errônea para outros cards.
   */
  async function distribuirMultiplosVideosDinamicos(videos) {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) return;
    if (!videos || !videos.length) return;

    const videosPorCanal = {};
    CANAIS_DINAMICOS.forEach(c => { videosPorCanal[c.id] = []; });

    // Varre cada arquivo solto na interface e identifica o canal exato pelo ID ou nome
    videos.forEach(video => {
      const nomeLow = video.name.toLowerCase();
      
      // Procura o canal cujo ID (ex: "alvox") apareça de forma clara no nome do arquivo
      let canalEncontrado = CANAIS_DINAMICOS.find(c => {
        const idLower = c.id.toLowerCase();
        const nomeLower = c.nome ? c.nome.toLowerCase() : "";
        return nomeLow.includes(idLower) || (nomeLower && nomeLow.includes(nomeLower));
      });

      if (canalEncontrado) {
        videosPorCanal[canalEncontrado.id].push(video);
      }
    });

    let totalProcessados = 0;

    // Envia os vídeos agrupados exclusivamente para o card do respectivo canal
    for (const canalId of Object.keys(videosPorCanal)) {
      const listaVideos = videosPorCanal[canalId];
      if (listaVideos.length === 0) continue;

      // O primeiro vídeo vai para o slot principal do card
      if (typeof processarArquivo === "function" && listaVideos[0]) {
        await processarArquivo(canalId, listaVideos[0]);
        totalProcessados++;
      }

      // Os vídeos excedentes (2º, 3º, etc.) vão estritamente para os slots extras deste mesmo canal
      if (listaVideos.length > 1) {
        if (typeof estadoCanais !== "undefined" && estadoCanais[canalId]) {
          estadoCanais[canalId].videosExtras = listaVideos.slice(1);
          totalProcessados += listaVideos.length - 1;
        }
      }
    }

    recalibrarHorariosDinamicos();

    if (typeof setMsg === "function") {
      setMsg(`${totalProcessados} vídeo(s) alocados com sucesso no canal correspondente!`);
    }
  }

  /**
   * Recalibra os horários mantendo a grade padrão para até 3 vídeos por canal
   * ou expandindo caso seja uma campanha com mais de 3 vídeos.
   */
  function recalibrarHorariosDinamicos() {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) return;

    const canaisOrdenados = [...CANAIS_DINAMICOS].sort((a, b) => a.id.localeCompare(b.id));
    const intervaloMinutos = 20;
    let houveAlteracao = false;

    // Verifica se há algum canal com mais de 3 vídeos para definir se ativa o modo estendido
    let maxVideosNoCanal = 1;
    if (typeof estadoCanais !== "undefined") {
      Object.values(estadoCanais).forEach(estado => {
        if (estado && estado.videosExtras) {
          const total = estado.videosExtras.length + 1;
          if (total > maxVideosNoCanal) maxVideosNoCanal = total;
        }
      });
    }

    if (maxVideosNoCanal <= 3) {
      // MODO PADRÃO (Até 3 vídeos): Mantém a grade padrão por faixa (manhã / noite)
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
      // MODO CAMPANHA ESTENDIDA (4 a 8 vídeos): Progressão dinâmica a partir das 05:00
      let baseMinutos = hhmmParaMinutos("05:00");

      canaisOrdenados.forEach((c, index) => {
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
      console.log(`[Recalibrador] Grade ajustada para ${maxVideosNoCanal} vídeo(s) por canal.`);
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
