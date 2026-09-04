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
    const horaEl = document.getElementById(hora-${canal.id});
    if (!horaEl) return false;
    canal.horario = horario;
    canal._horarioValida = true;
    horaEl.value = horario;
    if (typeof window.atualizarAgendamento === "function") window.atualizarAgendamento(canal.id);
    const slotBadge = document.querySelector(#card-${canal.id} .canal-slot);
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
    let msg = ${aplicados} horário(s) aplicado(s) a partir do JSON.;
    if (naoEncontrados.length > 0) msg +=  Canal(is) não encontrado(s): ${naoEncontrados.join(", ")}.;
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
  function onDrop(e) {
    const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
    const jsonFile = files.find((f) => f.name.toLowerCase().endsWith(".json"));
    if (!jsonFile) return;
    lerArquivoSeForHorariosExtras(jsonFile, null);
  }
  function iniciar() {
    document.addEventListener("drop", onDrop, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
  window.processarJsonHorariosExtras = processarJsonHorariosExtras;
  window.ehJsonDeHorariosExtras = ehJsonDeHorariosExtras;
})();
