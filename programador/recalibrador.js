/**
 * Recalibrador Dinâmico e Agrupador Preciso por Canal (v2 - corrigido)
 *
 * PROBLEMA QUE ESTE ARQUIVO RESOLVE:
 * A função `distribuirVideosCanais` do app.js, ao achar um vídeo cujo nome bate
 * com um canal, marcava aquele canal como "ocupado" e mandava qualquer vídeo
 * seguinte do MESMO canal para outro canal livre (round-robin). Resultado:
 * 3 vídeos do "alvox" viravam 1 no alvox + 1 no cris + 1 no flux.
 *
 * CORREÇÃO:
 * Sobrescrevemos (monkey-patch) `distribuirVideosCanais` e
 * `salvarAgendamentoNoBanco` no objeto global. Como são declarações de função
 * de script clássico (não módulo), tudo que chama esses nomes no app.js
 * (drop global, botão "Vídeos em Lote", "Agendar Este Canal",
 * "Disparar Programação") passa a usar automaticamente a versão corrigida
 * abaixo — sem precisar editar o app.js nem o index.html.
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

  // ---------------------------------------------------------------------
  // CONFIGURAÇÃO DAS TRILHAS DE HORÁRIO (uma trilha = uma "posição" de vídeo
  // dentro do canal: 1º vídeo do dia, 2º vídeo do dia, etc.)
  //
  // Trilha 1 mantém o padrão atual do sistema (11:00 manhã / 18:00 noite).
  // Trilhas 2 em diante seguem a progressão que você passou (+2h por trilha,
  // noite = manhã + 3h), com 20min de intervalo entre canais da mesma faixa.
  //
  // Ajuste os valores abaixo se os horários exatos não ficarem do jeito
  // que você quer — é só mexer nessas constantes, não precisa mexer no
  // resto da lógica.
  // ---------------------------------------------------------------------
  const INTERVALO_ENTRE_CANAIS_MIN = 20;
  const BASE_TRILHA_1_MANHA = "05:00"; // usado apenas como referência para as trilhas 2+
  const SALTO_ENTRE_TRILHAS_MIN = 120; // +2h por trilha (video_2, video_3, ...)
  const SALTO_MANHA_NOITE_MIN = 180;   // noite = manhã + 3h

  // Trilhas com horário fixo manual (sobrepõe o cálculo automático acima)
  const TRILHAS_MANUAIS = {
    1: { manha: "11:00", noite: "18:00" }
  };

  function baseDaTrilha(faixa, trilha) {
    if (TRILHAS_MANUAIS[trilha]) {
      return hhmmParaMinutos(TRILHAS_MANUAIS[trilha][faixa]);
    }
    const baseManha = hhmmParaMinutos(BASE_TRILHA_1_MANHA) + (trilha - 1) * SALTO_ENTRE_TRILHAS_MIN;
    return faixa === "manha" ? baseManha : baseManha + SALTO_MANHA_NOITE_MIN;
  }

  /**
   * Calcula o horário de um vídeo específico (pela sua posição/trilha dentro
   * do canal), considerando a posição do canal dentro da sua própria faixa
   * (manhã/noite). Isso é recalculado a cada chamada a partir de
   * CANAIS_DINAMICOS, então se adapta automaticamente quando você adiciona
   * ou remove canais.
   */
  function calcularHorarioDoVideo(canal, trilha) {
    const canaisMesmaFaixa = CANAIS_DINAMICOS
      .filter((c) => c.faixa === canal.faixa)
      .sort((a, b) => a.id.localeCompare(b.id));
    const posicao = Math.max(0, canaisMesmaFaixa.findIndex((c) => c.id === canal.id));
    const base = baseDaTrilha(canal.faixa, trilha);
    return minutosParaHHMM(base + posicao * INTERVALO_ENTRE_CANAIS_MIN);
  }

  // ---------------------------------------------------------------------
  // AGRUPAMENTO CORRIGIDO
  // ---------------------------------------------------------------------

  function encontrarCanalPorNomeArquivo(nomeArquivo) {
    const nomeLow = nomeArquivo.toLowerCase();
    return CANAIS_DINAMICOS.find((c) => {
      const idLower = c.id.toLowerCase();
      const nomeLower = c.nome ? c.nome.toLowerCase() : "";
      return nomeLow.includes(idLower) || (nomeLower && nomeLow.includes(nomeLower));
    });
  }

  function atualizarMetaMultiVideo(canalId) {
    const slots = (estadoCanais[canalId] && estadoCanais[canalId].videosSlots) || [];
    const meta = document.getElementById(`meta-${canalId}`);
    if (!meta) return;
    const antigoAviso = meta.querySelector(".aviso-multi-video");
    if (antigoAviso) antigoAviso.remove();
    if (slots.length <= 1) return;
    const extra = document.createElement("div");
    extra.className = "url-meta aviso-multi-video";
    extra.style.marginTop = "4px";
    extra.textContent = `+${slots.length - 1} vídeo(s) extra(s): ${slots
      .slice(1)
      .map((s) => s.horario)
      .join(", ")}`;
    meta.appendChild(extra);
  }

  /**
   * Substitui a distribuirVideosCanais original do app.js.
   * Agrupa TODOS os vídeos que casam com um canal no MESMO card (nunca
   * espalha excedentes para outros canais), faz upload de cada um deles e
   * calcula um horário por vídeo com base na trilha (1º, 2º, 3º... vídeo
   * daquele canal).
   */
  async function distribuirVideosCanaisCorrigido(videos) {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) {
      setMsg("Nenhum canal carregado ainda.", true);
      return;
    }
    if (!videos || !videos.length) return;

    const grupos = {};
    CANAIS_DINAMICOS.forEach((c) => (grupos[c.id] = []));
    const naoIdentificados = [];

    videos.forEach((video) => {
      const canal = encontrarCanalPorNomeArquivo(video.name);
      if (canal) grupos[canal.id].push(video);
      else naoIdentificados.push(video);
    });

    // Ordena os vídeos de cada canal na ordem natural do nome do arquivo
    // (ex: alvox_1.mp4, alvox_2.mp4, alvox_10.mp4 na ordem certa).
    Object.keys(grupos).forEach((id) => {
      grupos[id].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
    });

    let totalDistribuidos = 0;

    for (const canal of CANAIS_DINAMICOS) {
      const lista = grupos[canal.id];
      if (!lista || !lista.length) continue;

      if (!estadoCanais[canal.id].videosSlots) estadoCanais[canal.id].videosSlots = [];

      for (const file of lista) {
        const trilha = estadoCanais[canal.id].videosSlots.length + 1;
        setCardStatus(canal.id, `Enviando vídeo ${trilha} de ${canal.nome}...`, "info");
        try {
          const url = await uploadVideo(canal.id, file);
          const horario = calcularHorarioDoVideo(canal, trilha);
          estadoCanais[canal.id].videosSlots.push({
            arquivo: file.name,
            videoUrl: url,
            horario,
            trilha
          });
          totalDistribuidos++;
        } catch (e) {
          setCardStatus(canal.id, `Erro no upload do vídeo ${trilha}: ${e.message}`, "erro");
        }
      }

      // Sincroniza o 1º vídeo com os campos padrão do card, mantendo
      // compatibilidade com a interface atual (que só mostra 1 slot visível).
      const primeiro = estadoCanais[canal.id].videosSlots[0];
      if (primeiro) {
        estadoCanais[canal.id].arquivo = primeiro.arquivo;
        estadoCanais[canal.id].videoUrl = primeiro.videoUrl;
        const horaEl = document.getElementById(`hora-${canal.id}`);
        if (horaEl) {
          horaEl.value = primeiro.horario;
          atualizarAgendamento(canal.id);
        }
      }

      atualizarVisualContainer(canal.id);
      atualizarMetaMultiVideo(canal.id);
      setCardStatus(
        canal.id,
        `${estadoCanais[canal.id].videosSlots.length} vídeo(s) prontos para agendar.`,
        "ok"
      );
    }

    if (naoIdentificados.length > 0) {
      setMsg(
        `${totalDistribuidos} vídeo(s) alocados corretamente. ${naoIdentificados.length} vídeo(s) não bateram com nenhum canal (confira se o nome do arquivo contém o id do canal).`,
        true
      );
    } else {
      setMsg(`${totalDistribuidos} vídeo(s) alocados corretamente por canal!`);
    }
  }

  // ---------------------------------------------------------------------
  // AGENDAMENTO COM MÚLTIPLOS VÍDEOS POR CANAL
  // ---------------------------------------------------------------------

  async function enviarSlotsDeAgendamento(canalId) {
    const st = estadoCanais[canalId];
    const slots =
      st.videosSlots && st.videosSlots.length
        ? st.videosSlots
        : st.videoUrl
        ? [{ videoUrl: st.videoUrl, horario: document.getElementById(`hora-${canalId}`)?.value, trilha: 1 }]
        : [];

    if (!slots.length) throw new Error("Nenhum vídeo pronto para agendar.");

    const plataformasAtivas = PLATAFORMAS.filter((p) => st.plataformas[p]);
    if (plataformasAtivas.length === 0) {
      throw new Error("Selecione ao menos uma plataforma ativa para agendar.");
    }
    if (!temTitulo(st)) {
      throw new Error("Preencha ao menos um título antes de agendar.");
    }

    const dataEl = document.getElementById(`data-${canalId}`);
    const data = dataEl ? dataEl.value : "";
    if (!data) throw new Error("Selecione a data de agendamento.");

    const primeiroTituloDisponivel =
      PLATAFORMAS.map((p) => st.titulo?.[p]).find((t) => typeof t === "string" && t.trim() !== "") || "";

    const titulosLimpos = {};
    PLATAFORMAS.forEach((p) => {
      let txt =
        st.titulo && typeof st.titulo[p] === "string" && st.titulo[p].trim() !== ""
          ? st.titulo[p].trim()
          : primeiroTituloDisponivel;
      if (p === "youtube" && txt.length > 100) txt = txt.substring(0, 97) + "...";
      titulosLimpos[p] = txt;
    });

    const { url, key } = getCreds();
    let ok = 0;
    let falhas = 0;

    for (const slot of slots) {
      const horario = slot.horario && slot.horario !== "--:--" ? slot.horario : "00:00";
      const [ano, mes, dia] = data.split("-").map(Number);
      const [h, m] = horario.split(":").map(Number);
      const agendadoPara = new Date(ano, mes - 1, dia, h, m, 0).toISOString();

      const payload = {
        canal_id: canalId,
        video_url: slot.videoUrl || "",
        titulo: titulosLimpos,
        plataformas: plataformasAtivas,
        agendado_para: agendadoPara,
        status: "pendente"
      };

      try {
        const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/posts_agendados`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
            Authorization: `Bearer ${key}`,
            Prefer: "return=minimal"
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        ok++;
      } catch (e) {
        falhas++;
        console.error(`[Recalibrador] Erro ao agendar vídeo (${canalId}, trilha ${slot.trilha}):`, e.message);
      }
    }

    st.videosSlots = [];
    if (typeof limparCard === "function") limparCard(canalId);
    return { ok, falhas, total: slots.length };
  }

  // ---------------------------------------------------------------------
  // MONKEY-PATCH: substitui as funções globais sem tocar no app.js
  // ---------------------------------------------------------------------

  const salvarAgendamentoNoBancoOriginal =
    typeof window.salvarAgendamentoNoBanco === "function" ? window.salvarAgendamentoNoBanco : null;

  window.distribuirVideosCanais = distribuirVideosCanaisCorrigido;

  window.salvarAgendamentoNoBanco = async function (canalId) {
    const st = estadoCanais[canalId];
    if (st && st.videosSlots && st.videosSlots.length > 1) {
      const r = await enviarSlotsDeAgendamento(canalId);
      if (r.falhas > 0) {
        throw new Error(`${r.falhas} de ${r.total} vídeo(s) falharam ao agendar (${r.ok} ok).`);
      }
      return true;
    }
    if (salvarAgendamentoNoBancoOriginal) {
      return salvarAgendamentoNoBancoOriginal(canalId);
    }
    return enviarSlotsDeAgendamento(canalId).then((r) => r.falhas === 0);
  };

  // ---------------------------------------------------------------------
  // Mantido do arquivo original: recalibra o horário do CARD (modo padrão)
  // para canais com apenas 1 vídeo. Como agora usamos `videosSlots` (e não
  // `videosExtras`), esta função nunca entra em "modo estendido" sozinha —
  // ela só cuida do posicionamento padrão por canal, sem conflitar com o
  // agendamento multi-vídeo acima.
  // ---------------------------------------------------------------------
  function recalibrarHorariosDinamicos() {
    if (typeof CANAIS_DINAMICOS === "undefined" || !CANAIS_DINAMICOS.length) return;

    const canaisOrdenados = [...CANAIS_DINAMICOS].sort((a, b) => a.id.localeCompare(b.id));
    let houveAlteracao = false;
    const basesFaixas = { manha: TRILHAS_MANUAIS[1].manha, noite: TRILHAS_MANUAIS[1].noite };

    ["manha", "noite"].forEach((faixa) => {
      let baseMinutos = hhmmParaMinutos(basesFaixas[faixa]);
      const canaisDaFaixa = canaisOrdenados.filter((c) => c.faixa === faixa);

      canaisDaFaixa.forEach((c, index) => {
        let horarioIdealMinutos = baseMinutos + index * INTERVALO_ENTRE_CANAIS_MIN;
        const novoHorarioStr = minutosParaHHMM(horarioIdealMinutos);
        if (c.horario !== novoHorarioStr) {
          c.horario = novoHorarioStr;
          c._horarioValida = true;
          houveAlteracao = true;
        }
      });
    });

    if (houveAlteracao && typeof rerenderizarGrids === "function") {
      rerenderizarGrids();
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      recalibrarHorariosDinamicos();
    }, 1800);
  });

  window.recalibrarHorariosDinamicos = recalibrarHorariosDinamicos;
  window.calcularHorarioDoVideo = calcularHorarioDoVideo;
})();
