/* ============================================================
   PATCH: Suporte a JSON de "horários extras" no drop global
   Cole este bloco em algum lugar do seu app.js, ANTES da
   função processarArquivoJson (ou logo depois dela, tanto faz,
   já que são function declarations e ficam hoisted).
   ============================================================ */

function normalizarNomeCanal(str) {
  return String(str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function localizarCanalPorNomeOuId(nomeCanal) {
  const alvo = normalizarNomeCanal(nomeCanal);
  if (!alvo) return null;
  return (
    CANAIS_DINAMICOS.find((c) => normalizarNomeCanal(c.nome) === alvo) ||
    CANAIS_DINAMICOS.find((c) => normalizarNomeCanal(c.id) === alvo) ||
    null
  );
}

function aplicarHorarioExtraAoCanal(canal, horario) {
  if (!canal || !horario) return false;
  const horaEl = document.getElementById(`hora-${canal.id}`);
  if (!horaEl) return false;
  canal.horario = horario;
  canal._horarioValida = true;
  horaEl.value = horario;
  atualizarAgendamento(canal.id);
  const slotBadge = document.querySelector(`#card-${canal.id} .canal-slot`);
  if (slotBadge) slotBadge.textContent = horario;
  return true;
}

// Detecta o formato: { "qualquerChave": [ { canal: "...", horario: "..." }, ... ], ... }
function ehJsonDeHorariosExtras(objJson) {
  if (!objJson || typeof objJson !== "object" || Array.isArray(objJson)) return false;
  const chaves = Object.keys(objJson).filter((k) => Array.isArray(objJson[k]) && objJson[k].length > 0);
  if (chaves.length === 0) return false;
  return chaves.some((k) =>
    objJson[k].every((item) => item && typeof item === "object" && "canal" in item && "horario" in item)
  );
}

function processarJsonDeHorariosExtras(objJson) {
  const chaves = Object.keys(objJson).filter((k) => Array.isArray(objJson[k]));
  let aplicados = 0;
  const naoEncontrados = [];

  chaves.forEach((chave) => {
    objJson[chave].forEach((item) => {
      const nomeCanal = item && item.canal;
      const horario = item && String(item.horario || "").trim();
      const canal = localizarCanalPorNomeOuId(nomeCanal);
      if (canal && horario) {
        if (aplicarHorarioExtraAoCanal(canal, horario)) aplicados++;
      } else if (nomeCanal) {
        naoEncontrados.push(nomeCanal);
      }
    });
  });

  renderizarTrilho("manha", "rail-manha");
  renderizarTrilho("noite", "rail-noite");
  atualizarFaixasRange();

  let msg = `${aplicados} horário(s) aplicado(s) a partir do JSON.`;
  if (naoEncontrados.length > 0) msg += ` Canal(is) não encontrado(s): ${naoEncontrados.join(", ")}.`;
  setMsg(msg, naoEncontrados.length > 0);
}

/* ============================================================
   Agora SUBSTITUA sua função processarArquivoJson por esta versão
   (é a mesma, só com a checagem do novo formato adicionada logo
   após o JSON.parse):
   ============================================================ */

function processarArquivoJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      // NOVO: se for o formato de "horários extras", trata separado e sai
      if (ehJsonDeHorariosExtras(data)) {
        processarJsonDeHorariosExtras(data);
        return;
      }

      // --- a partir daqui é o seu código original, sem mudanças ---
      const lista = Array.isArray(data) ? data : [data];
      lista.forEach((item) => {
        const c = CANAIS_DINAMICOS.find(
          (c) =>
            c.id.toLowerCase() === String(item.canal || "").toLowerCase() ||
            c.nome.toLowerCase() === String(item.canal || "").toLowerCase()
        );
        if (!c) return;

        let titulosObj = {};
        if (item.titulos && typeof item.titulos === "object") titulosObj = item.titulos;
        else if (item.titles && typeof item.titles === "object") titulosObj = item.titles;
        else if (item.titulo && typeof item.titulo === "object") titulosObj = item.titulo;
        else if (item.title && typeof item.title === "object") titulosObj = item.title;

        const tituloGeral =
          (typeof item.titulo === "string" ? item.titulo : "") ||
          (typeof item.title === "string" ? item.title : "") ||
          (typeof item.legenda === "string" ? item.legenda : "") ||
          (typeof item.caption === "string" ? item.caption : "");

        PLATAFORMAS.forEach((p) => {
          const val = titulosObj[p] && typeof titulosObj[p] === "string" ? titulosObj[p] : tituloGeral;
          if (!estadoCanais[c.id].titulo) estadoCanais[c.id].titulo = {};
          estadoCanais[c.id].titulo[p] = val;
          const inp = document.getElementById(`titulo-${p}-${c.id}`);
          if (inp) inp.value = val;
        });
        atualizarVisualContainer(c.id);
      });
      setMsg("JSON de títulos importado!");
    } catch (err) {
      setMsg("JSON inválido: " + err.message, true);
    }
  };
  reader.readAsText(file);
}
