// horarios-extras-import.js
// Módulo standalone: importa um JSON de horários extras (ex.: "horarios_extras_video_2")
// e aplica o horário de cada canal diretamente nos campos de hora da interface.
// Cria uma dropzone própria (arrastar-e-soltar, com clique alternativo) no canto
// inferior direito da tela — não usa a dropzone global do script principal, para
// não conflitar com a importação de vídeos/JSON de títulos que já existe.
//
// Como usar: adicione este arquivo no index.html DEPOIS do script principal, ex:
//   <script src="programador.js"></script>
//   <script src="horarios-extras-import.js"></script>
//
// Formato de JSON esperado:
// {
//   "horarios_extras_video_2": [
//     { "canal": "Alvox", "horario": "14:40" },
//     { "canal": "Cris",  "horario": "15:00" }
//   ]
// }
//
// A chave de nível superior pode ter qualquer nome (ex.: "horarios_extras_video_3"),
// desde que o valor seja uma lista de objetos { canal, horario }.
//
// O módulo só mexe na interface (campos de data/hora e badges dos cards).
// Não grava nada direto no Supabase — o agendamento só é salvo quando o usuário
// clicar em "Agendar Este Canal" ou disparar a programação, como já acontece hoje.

(function () {
  "use strict";

  function normalizarNome(str) {
    return String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function obterListaCanais() {
    try {
      // Scripts clássicos (não-módulo) compartilham o mesmo escopo léxico global,
      // então "CANAIS_DINAMICOS" (declarado com let no app.js) é visível aqui como
      // identificador direto — mas NÃO existe como propriedade de window.
      // eslint-disable-next-line no-undef
      if (typeof CANAIS_DINAMICOS !== "undefined" && Array.isArray(CANAIS_DINAMICOS)) {
        // eslint-disable-next-line no-undef
        return CANAIS_DINAMICOS;
      }
    } catch (_) {
      /* ignora e tenta fallback abaixo */
    }
    if (Array.isArray(window.CANAIS_DINAMICOS)) return window.CANAIS_DINAMICOS;
    return null;
  }

  function localizarCanalPorNome(nomeCanal) {
    const alvo = normalizarNome(nomeCanal);
    const lista = obterListaCanais();
    if (!alvo || !lista) return null;
    return (
      lista.find((c) => normalizarNome(c.nome) === alvo) ||
      lista.find((c) => normalizarNome(c.id) === alvo) ||
      null
    );
  }

  function aplicarHorarioExtra(canal, horario) {
    if (!canal || !horario) return false;
    const horaEl = document.getElementById(`hora-${canal.id}`);
    if (!horaEl) return false;

    canal.horario = horario;
    canal._horarioValida = true;
    horaEl.value = horario;

    if (typeof window.atualizarAgendamento === "function") {
      window.atualizarAgendamento(canal.id);
    }

    const slotBadge = document.querySelector(`#card-${canal.id} .canal-slot`);
    if (slotBadge) slotBadge.textContent = horario;

    return true;
  }

  function finalizarAtualizacaoVisual() {
    if (typeof window.renderizarTrilho === "function") {
      window.renderizarTrilho("manha", "rail-manha");
      window.renderizarTrilho("noite", "rail-noite");
    }
    if (typeof window.atualizarFaixasRange === "function") {
      window.atualizarFaixasRange();
    }
  }

  function processarJsonHorariosExtras(objJson) {
    if (!objJson || typeof objJson !== "object") {
      if (typeof window.setMsg === "function") {
        window.setMsg("JSON de horários inválido.", true);
      }
      return;
    }

    const chaves = Object.keys(objJson).filter((k) => Array.isArray(objJson[k]));
    if (chaves.length === 0) {
      if (typeof window.setMsg === "function") {
        window.setMsg("Nenhuma lista de horários encontrada no JSON.", true);
      }
      return;
    }

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
    if (naoEncontrados.length > 0) {
      msg += ` Canal(is) não encontrado(s): ${naoEncontrados.join(", ")}.`;
    }

    if (typeof window.setMsg === "function") {
      window.setMsg(msg, naoEncontrados.length > 0);
    } else {
      console.log(msg);
    }
  }

  function lerArquivoHorariosExtras(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dados = JSON.parse(e.target.result);
        processarJsonHorariosExtras(dados);
      } catch (err) {
        if (typeof window.setMsg === "function") {
          window.setMsg("Erro ao ler JSON de horários: " + err.message, true);
        }
      }
    };
    reader.readAsText(file);
  }

  function criarDropzoneImportacao() {
    if (document.getElementById("dz-import-horarios-extras")) return;

    const input = document.createElement("input");
    input.type = "file";
    input.id = "input-horarios-extras";
    input.accept = ".json,application/json";
    input.style.display = "none";
    input.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        lerArquivoHorariosExtras(e.target.files[0]);
      }
      e.target.value = "";
    });

    const zona = document.createElement("div");
    zona.id = "dz-import-horarios-extras";
    zona.title = "Solte aqui um JSON com horários extras por canal (ex.: horarios_extras_video_2)";
    zona.textContent = "Arraste o JSON de horários extras aqui (ou clique)";
    zona.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:9999;width:220px;padding:14px 12px;" +
      "background:rgba(15,23,42,.92);color:#e2e8f0;border:2px dashed #22d3ee;border-radius:10px;" +
      "font-family:inherit;font-size:12.5px;font-weight:600;text-align:center;line-height:1.4;" +
      "cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.35);transition:background .15s,border-color .15s;";

    function marcarAtivo(ativo) {
      zona.style.background = ativo ? "rgba(34,211,238,.18)" : "rgba(15,23,42,.92)";
      zona.style.borderColor = ativo ? "#67e8f9" : "#22d3ee";
    }

    // Impede que o drop propague para o listener global de vídeo/JSON do script principal.
    zona.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      marcarAtivo(true);
    });
    zona.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      marcarAtivo(true);
    });
    zona.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      marcarAtivo(false);
    });
    zona.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      marcarAtivo(false);
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      const jsonFile = files.find((f) => f.name.toLowerCase().endsWith(".json"));
      if (jsonFile) {
        lerArquivoHorariosExtras(jsonFile);
      } else if (typeof window.setMsg === "function") {
        window.setMsg("Solte um arquivo .json de horários extras aqui.", true);
      }
    });
    zona.addEventListener("click", () => input.click());

    document.body.appendChild(input);
    document.body.appendChild(zona);
  }

  function iniciar() {
    criarDropzoneImportacao();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }

  // Exposto globalmente — útil se você já tem outra dropzone/botão e só
  // quer chamar a lógica de importação diretamente.
  window.processarJsonHorariosExtras = processarJsonHorariosExtras;
  window.lerArquivoHorariosExtras = lerArquivoHorariosExtras;
})();
