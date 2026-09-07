/**
 * Recalibrador Dinâmico Inteligente (Padrão vs. Campanhas Estendidas)
 * - 1 a 3 vídeos: Ativa a grade padrão.
 * - 4 a 8 vídeos: Ativa os horários de campanha estendidos dinamicamente para qualquer canal.
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
   * Horários iniciais absolutos de cada slot (Vídeo 1 ao 8) para campanhas estendidas.
   * O sistema calcula a progressão de 20 em 20 minutos dinamicamente para cada canal cadastrado.
   */
  const INICIOS_SLOTS_CAMPANHA = {
    1: "05:00",
    2: "07:00",
    3: "09:00",
    4: "11:00",
    5: "13:00",
    6: "15:00",
    7: "17:00",
    8: "19:00"
  };

  /**
   * Agrupa os vídeos arrastados para a interface direcionando-os ao canal correto.
   */
  async function distribuirMultiplosVideosDinamicos(videos) {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) return;
    if (!videos || !videos.length) return;

    const videosPorCanal = {};
    CANAIS_DINAMICOS.forEach(c => { videosPorCanal[c.id] = []; });

    videos.forEach(video => {
      const nomeLow = video.name.toLowerCase();
      let canalEncontrado = CANAIS_DINAMICOS.find(c => 
        nomeLow.includes(c.id.toLowerCase()) || nomeLow.includes(c.nome.toLowerCase())
      );

      if (canalEncontrado) {
        videosPorCanal[canalEncontrado.id].push(video);
      }
    });

    let totalProcessados = 0;

    for (const canalId of Object.keys(videosPorCanal)) {
      const listaVideos = videosPorCanal[canalId];
      if (listaVideos.length === 0) continue;

      // O 1º vídeo vai para o card principal
      if (typeof processarArquivo === "function" && listaVideos[0]) {
        await processarArquivo(canalId, listaVideos[0]);
        totalProcessados++;
      }

      // Demais vídeos vão para os slots extras do estado do canal
      if (listaVideos.length > 1) {
        if (typeof estadoCanais !== "undefined" && estadoCanais[canalId]) {
          estadoCanais[canalId].videosExtras = listaVideos.slice(1);
          totalProcessados += listaVideos.length - 1;
        }
      }
    }

    recalibrarHorariosDinamicos();

    if (typeof setMsg === "function") {
      setMsg(`${totalProcessados} vídeo(s) alocados e horários calibrados com sucesso!`);
    }
  }

  /**
   * Recalibra os horários de forma dinâmica e escalável:
   * - Identifica se a campanha é padrão (<= 3 vídeos) ou estendida (4 a 8 vídeos).
   * - Aplica o cálculo proporcional para qualquer quantidade de canais vindos do Supabase.
   */
  function recalibrarHorariosDinamicos() {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) return;

    // Ordena os canais de forma consistente por ID
    const canaisOrdenados = [...CANAIS_DINAMICOS].sort((a, b) => a.id.localeCompare(b.id));
    const intervaloMinutos = 20;
    let houveAlteracao = false;

    // Descobre o maior número de vídeos em um único canal na tela para definir o modo
    let maxVideosNoCanal = 1;
    if (typeof estadoCanais !== "undefined") {
      Object.entries(estadoCanais).forEach(([idCanal, estado]) => {
        if (estado && estado.videosExtras) {
          const total = estado.videosExtras.length + 1;
          if (total > maxVideosNoCanal) maxVideosNoCanal = total;
        }
      });
    }

    if (maxVideosNoCanal <= 3) {
      // MODO PADRÃO (Até 3 vídeos): Usa a grade padrão por faixa (manhã / noite)
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
      // MODO CAMPANHA ESTENDIDA (4 a 8 vídeos): Dinâmico e proporcional para novos canais
      // Usa como base o slot 1 (ex: começa às 05:00 para o primeiro canal e espaça 20 min para os próximos)
      let horarioBaseStr = INICIOS_SLOTS_CAMPANHA[1] || "05:00";
      let baseMinutos = hhmmParaMinutos(horarioBaseStr);

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
      console.log(`[Recalibrador Dinâmico] Grade ajustada para campanha de ${maxVideosNoCanal} vídeo(s) por canal.`);
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
