/**
 * Recalibrador Dinâmico de Horários para o Pipeline
 * Ajusta os horários dos cards caso a execução comece após o horário padrão.
 */

(function () {
  // Função auxiliar para converter "HH:MM" em minutos totais desde a meia-noite
  function hhmmParaMinutos(hhmm) {
    if (!hhmm || hhmm === "--:--") return 0;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  // Função auxiliar para converter minutos totais de volta para "HH:MM"
  function minutosParaHHMM(totalMinutos) {
    let total = ((totalMinutos % 1440) + 1440) % 1440;
    const H = String(Math.floor(total / 60)).padStart(2, "0");
    const M = String(total % 60).padStart(2, "0");
    return `${H}:${M}`;
  }

  function recalibrarHorariosDinamicos() {
    // Certifica-se de que os canais globais já foram carregados
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) {
      return;
    }

    const agora = new Date();
    const minutosAtuais = agora.getHours() * 60 + agora.getMinutes();

    // Faixas e seus horários base originais definidos no app.js
    const basesFaixas = {
      manha: "11:00",
      noite: "18:00"
    };

    const intervaloMinutos = 20; // 20 minutos de diferença entre os cards
    let houveAlteracao = false;

    ["manha", "noite"].forEach((faixa) => {
      const baseOriginalStr = basesFaixas[faixa];
      let baseMinutos = hhmmParaMinutos(baseOriginalStr);

      // Filtra os canais desta faixa específica
      const canaisDaFaixa = CANAIS_DINAMICOS.filter((c) => c.faixa === faixa);

      canaisDaFaixa.forEach((c, index) => {
        // Horário original calculado para este card na sequência
        let horarioIdealMinutos = baseMinutos + (index * intervaloMinutos);

        // Se o horário ideal já passou e estamos no mesmo dia, ajustamos o ponto de partida
        // O primeiro card que ainda estiver no futuro (ou com margem de segurança) assume o novo corte,
        // e os seguintes respeitam o intervalo de 20 minutos em relação a ele.
        if (index === 0 && minutosAtuais > horarioIdealMinutos) {
          // Adiciona uma folga de 20 minutos a partir de agora para o primeiro card atrasado,
          // ou arredonda para o próximo slot se preferir. Aqui ajustamos para: agora + 20 min (ou o próximo múltiplo).
          let proximoSlot = minutosAtuais + 20;
          baseMinutos = proximoSlot;
          horarioIdealMinutos = baseMinutos;
        } else if (index > 0) {
          horarioIdealMinutos = baseMinutos + (index * intervaloMinutos);
        }

        const novoHorarioStr = minutosParaHHMM(horarioIdealMinutos);

        if (c.horario !== novoHorarioStr) {
          c.horario = novoHorarioStr;
          houveAlteracao = true;
        }
      });
    });

    // Se houve alteração de horários, atualiza os elementos visuais na tela
    if (houveAlteracao && typeof rerenderizarGrids === "function") {
      rerenderizarGrids();
      console.log("[Recalibrador] Horários dos cards recalibrados dinamicamente com base no horário atual.");
    }
  }

  // Executa assim que o script for injetado (dando um pequeno delay para garantir o carregamento dos canais do Supabase)
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(recalibrarHorariosDinamicos, 1500);
  });

  // Exporta caso queira chamar manualmente via botão
  window.recalibrarHorariosDinamicos = recalibrarHorariosDinamicos;
})();
