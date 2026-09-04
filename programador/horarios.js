(function () {
  "use strict";
  function normalizarNome(str) {
    return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  }
  function obterListaCanais() {
    try {
      if (typeof CANAIS_DINAMICOS !== "undefined" && Array.isArray(CANAIS_DINAMICOS)) return CANAIS_DINAMICOS;
    } catch (_) {}
    if (Array.isArray(window.CANAIS_DINAMICOS)) return window.CANAIS_DINAMICOS;
    return null;
  }
  function localizarCanalPorNome(nomeCanal) {
    const alvo = normalizarNome(nomeCanal);
    const lista = obterListaCanais();
    if (!alvo || !lista) return null;
    return lista.find((c) => normalizarNome(c.nome) === alvo) || lista.find((c) => normalizarNome(c.id) === alvo) || null;
  }
  function aplicarHorarioExtra(canal, horario) {
    if (!canal || !horario) return false;
    const horaEl = document.getElementById(`hora-${canal.id}`);
    if (!horaEl) return false;
    canal.horario = horario;
    canal._horarioValida = true;
    horaEl.value = horario;
    if (typeof window.atualizarAgendamento === "function") window.atualizarAgendamento(canal.id);
    const slotBadge = document.querySelector(`#card-${canal.id} .canal-slot`);
    if (slotBadge) slotBadge.textContent = horario;
    return true;
  }
  function finalizarAtualizacaoVisual() {
    if (typeof window.renderizarTrilho === "function") {
      window.renderizarTrilho("manha", "rail-manha");
      window.renderizarTrilho("noite", "rail-noite");
    }
    if (typeof window.atualizarFaixasRange === "function") window.atualizarFaixasRange();
  }
  function ehJsonDeHorariosExtras(objJson) {
    if (!objJson || typeof objJson !== "object") return false;
    const chaves = Object.keys(objJson).filter((k) => Array.isArray(objJson[k]) && objJson[k].length > 0);
    if (chaves.length === 0) return false;
    return chaves.some((k) => objJson[k].every((item) => item && typeof item === "object" && "canal" in item && "horario" in item));
  }
  function processarJsonHorariosExtras(objJson) {
    const chaves = Object.keys(objJson).filter((k) => Array.isArray(objJson[k]));
    let aplicados = 0;
    const naoEncontrados = [];
    chaves.forEach((chave) => {
      objJson[chave].forEach((item) => {
        const nomeCanal = item && item.canal;
        const horario = item && String(item.horario || "").trim();
        const canal = localizarCanalPorNome(nomeCanal);
        if (canal && horario) {
          if (aplicarHorarioExtra(canal, horario)) aplicados++;
        } else if (nomeCanal) {
          naoEncontrados.push(nomeCanal);
        }
      });
    });
    finalizarAtualizacaoVisual();
    let msg = `${aplicados} horário(s) aplicado(s) a partir do JSON.`;
    if (naoEncontrados.length > 0) msg += ` Canal(is) não encontrado(s): ${naoEncontrados.join(", ")}.`;
    if (typeof window.setMsg === "function") window.setMsg(msg, naoEncontrados.length > 0);
    else console.log(msg);
  }
  function lerArquivoSeForHorariosExtras(file, onNaoCorresponde) {
    const reader = new FileReader();
    reader.onload = (e) => {
      let dados;
      try {
        dados = JSON.parse(e.target.result);
      } catch (err) {
        if (typeof onNaoCorresponde === "function") onNaoCorresponde();
        return;
      }
      if (ehJsonDeHorariosExtras(dados)) processarJsonHorariosExtras(dados);
      else if (typeof onNaoCorresponde === "function") onNaoCorresponde();
    };
    reader.readAsText(file);
  }

  // --- Indicador visual opcional enquanto arrasta sobre a página ---
  let overlayEl = null;
  function mostrarOverlay() {
    if (overlayEl) return;
    overlayEl = document.createElement("div");
    overlayEl.id = "drop-overlay-horarios-extras";
    overlayEl.style.cssText = [
      "position:fixed", "inset:0", "z-index:999999",
      "background:rgba(0,0,0,0.35)",
      "border:3px dashed #4da3ff",
      "display:flex", "align-items:center", "justify-content:center",
      "color:#fff", "font:600 20px/1.4 sans-serif",
      "pointer-events:none",
    ].join(";");
    overlayEl.textContent = "Solte o arquivo JSON para aplicar os horários extras";
    document.body.appendChild(overlayEl);
  }
  function esconderOverlay() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }

  function temArquivo(e) {
    const tipos = e.dataTransfer && e.dataTransfer.types;
    return !!(tipos && Array.from(tipos).includes("Files"));
  }

  let dragCounter = 0;

  function onDragEnter(e) {
    if (!temArquivo(e)) return;
    e.preventDefault();
    dragCounter++;
    mostrarOverlay();
  }

  function onDragOver(e) {
    // ESSENCIAL: sem isto, o navegador nunca permite soltar
    // fora de uma dropzone específica — ele assume a ação padrão
    // (abrir/baixar o arquivo) em vez de disparar o "drop".
    if (!temArquivo(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(e) {
    if (!temArquivo(e)) return;
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) esconderOverlay();
  }

  function onDrop(e) {
    if (!temArquivo(e)) return;
    // Impede a ação padrão do navegador (abrir o arquivo)
    // em qualquer ponto da página, não só numa área específica.
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    esconderOverlay();

    const files = Array.from(e.dataTransfer.files || []);
    const jsonFile = files.find((f) => f.name.toLowerCase().endsWith(".json"));
    if (!jsonFile) {
      if (typeof window.setMsg === "function") {
        window.setMsg("Arquivo solto não é um .json válido.", true);
      }
      return;
    }
    lerArquivoSeForHorariosExtras(jsonFile, () => {
      if (typeof window.setMsg === "function") {
        window.setMsg("O JSON solto não corresponde ao formato de horários extras.", true);
      }
    });
  }

  function iniciar() {
    // captura=true para pegar o evento antes de qualquer outra dropzone
    // específica que já exista na página, permitindo soltar em qualquer lugar.
    document.addEventListener("dragenter", onDragEnter, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    window.addEventListener("blur", () => { dragCounter = 0; esconderOverlay(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  window.processarJsonHorariosExtras = processarJsonHorariosExtras;
  window.ehJsonDeHorariosExtras = ehJsonDeHorariosExtras;
})();
