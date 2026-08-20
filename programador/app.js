if(window.opener&&new URLSearchParams(window.location.search).has("auth")){try{const params=new URLSearchParams(window.location.search);const authType=params.get("auth");if(authType==="instagram_pending_map"){window.opener.postMessage({type:"instagram_pending_map",search:window.location.search},"*");}else if(typeof window.opener.testarConexaoSupabase==="function"){window.opener.testarConexaoSupabase();}else{window.opener.location.reload();}}catch(_){}window.close();}
const CANAIS=[{id:"alvox",nome:"Alvox",faixa:"manha",horario:"11:00"},{id:"flux",nome:"Flux",faixa:"manha",horario:"11:20"},{id:"loopx",nome:"Loopx",faixa:"manha",horario:"11:40"},{id:"cris",nome:"Cris",faixa:"manha",horario:"12:00"},{id:"lunax",nome:"Lunax",faixa:"manha",horario:"12:20"},{id:"maxx",nome:"Maxx",faixa:"manha",horario:"12:40"},{id:"most",nome:"Most",faixa:"noite",horario:"18:00"},{id:"post",nome:"Post",faixa:"noite",horario:"18:20"},{id:"primordial",nome:"Primordial",faixa:"noite",horario:"18:40"},{id:"topx",nome:"Topx",faixa:"noite",horario:"19:00"},{id:"vibex",nome:"Vibex",faixa:"noite",horario:"19:20"}];
const PLATAFORMAS=["youtube","instagram","tiktok"];
const estadoCanais={};
const CORES={info:"#22d3ee",ok:"#34d399",erro:"#fb7185",aviso:"#fbbf24"};
const ICONS={rocket:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 2.5c2.6 2 4.2 5.1 4.2 8.6 0 2-.6 3.9-1.7 5.5l-2.5 3-2.5-3a9.4 9.4 0 0 1-1.7-5.5c0-3.5 1.6-6.6 4.2-8.6z"/><circle cx="12" cy="10.5" r="1.7"/><path d="M8.7 16.3L6 18l.6-3"/><path d="M15.3 16.3L18 18l-.6-3"/></svg>',camera:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 8h3.2l1.8-2h6l1.8 2H20v11H4z"/><circle cx="12" cy="13.5" r="3.3"/></svg>',save:'<svg class="icon" viewBox="0 0 24 24"><path d="M4 4h12l4 4v12H4z"/><path d="M8 4v5h7V4"/><path d="M7 20v-7h10v7"/></svg>',film:'<svg class="icon icon-sm" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="4" x2="7" y2="20"/><line x1="17" y1="4" x2="17" y2="20"/><line x1="3" y1="9" x2="7" y2="9"/><line x1="3" y1="15" x2="7" y2="15"/><line x1="17" y1="9" x2="21" y2="9"/><line x1="17" y1="15" x2="21" y2="15"/></svg>',link:'<svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M9.5 14.5l5-5"/><path d="M8 11.5l-2 2a3 3 0 0 0 4.2 4.2l2-2"/><path d="M16 12.5l2-2a3 3 0 0 0-4.2-4.2l-2 2"/></svg>',paperclip:'<svg class="icon icon-lg icon-default" viewBox="0 0 24 24"><path d="M17.5 9L10 16.5a2.8 2.8 0 0 1-4-4L13.5 5a4.2 4.2 0 1 1 6 6L11 19.5a5.6 5.6 0 1 1-8-8"/></svg>',check:'<svg class="icon icon-lg icon-success" viewBox="0 0 24 24"><polyline points="4 12.5 9 17.5 20 6"/></svg>',checkCircle:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="8 12.5 11 15.5 16 9.5"/></svg>',xCircle:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>',alert:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 3.5l9.5 16.5H2.5z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="16.8" r=".6" fill="currentColor" stroke="none"/></svg>',loader:'<svg class="icon icon-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-dasharray="40 16"/></svg>'};
const ICONE_TIPO={info:ICONS.loader,ok:ICONS.checkCircle,erro:ICONS.xCircle,aviso:ICONS.alert};

function setMsg(text,isError=false){const el=document.getElementById("msg");if(!el)return;el.innerHTML=`${isError?ICONE_TIPO.erro:ICONE_TIPO.info}<span>${text}</span>`;el.style.color=isError?CORES.erro:CORES.info;}
function setCardStatus(canalId,text,tipo="info"){const el=document.getElementById(`card-status-${canalId}`);if(!el)return;if(!text){el.innerHTML="";return;}el.innerHTML=`${ICONE_TIPO[tipo]||ICONE_TIPO.info}<span>${text}</span>`;el.style.color=CORES[tipo]||CORES.info;}
function getCreds(){return{url:localStorage.getItem("supa_url")||"",key:localStorage.getItem("supa_key")||"",admin:localStorage.getItem("admin_secret")||""};}
function obterDataPadrao(){const d=new Date();d.setDate(d.getDate()+1);const ano=d.getFullYear();const mes=String(d.getMonth()+1).padStart(2,"0");const dia=String(d.getDate()).padStart(2,"0");return `${ano}-${mes}-${dia}`;}
function iniciarRelogio(){const el=document.getElementById("liveClock");if(!el)return;const tick=()=>{el.textContent=new Date().toLocaleTimeString("pt-BR",{hour12:false});};tick();setInterval(tick,1000);}
function renderizarTrilho(faixa,containerId){const el=document.getElementById(containerId);if(!el)return;const canaisDaFaixa=CANAIS.filter((c)=>c.faixa===faixa);el.innerHTML=canaisDaFaixa.map((c)=>`<div class="launch-beacon" title="${c.nome} agenda-se às ${c.horario}"><span class="beacon-time">${c.horario}</span><span class="beacon-dot"></span><span class="beacon-name">${c.nome}</span></div>`).join("");}

function montarInterface(){
  const containerManha=document.getElementById("grid-manha");
  const containerNoite=document.getElementById("grid-noite");
  const{url,key,admin}=getCreds();
  if(document.getElementById("supaUrl"))document.getElementById("supaUrl").value=url;
  if(document.getElementById("supaKey"))document.getElementById("supaKey").value=key;
  if(document.getElementById("adminSecret"))document.getElementById("adminSecret").value=admin;
  const dataPadrao=obterDataPadrao();
  const dataGlobalEl=document.getElementById("dataGlobal");
  if(dataGlobalEl&&!dataGlobalEl.value)dataGlobalEl.value=dataPadrao;
  
  CANAIS.forEach((c)=>{
    estadoCanais[c.id]={arquivo:null,videoUrl:null,titulo:{youtube:"",instagram:"",tiktok:""},plataformas:{youtube:true,instagram:true,tiktok:true},agendamento:""};
    const cardHTML=`<div class="card" id="card-${c.id}"><div><div class="card-header"><span>${c.nome}</span><span class="canal-slot">${c.horario}</span></div><div class="auth-buttons"><button class="btn-auth btn-yt" onclick="conectarPlataforma('${c.id}','youtube')">YT</button><button class="btn-auth btn-ig" onclick="conectarPlataforma('${c.id}','instagram')">IG</button><button class="btn-auth btn-tk" onclick="conectarPlataforma('${c.id}','tiktok')">TK</button></div><div class="status"><span id="st-yt-${c.id}" class="err">YT</span><span id="st-ig-${c.id}" class="err">IG</span><span id="st-tk-${c.id}" class="err">TK</span></div><div class="plataformas-select"><label class="chk-plataforma"><input type="checkbox" id="chk-youtube-${c.id}" disabled onchange="atualizarPlataforma('${c.id}','youtube',this.checked)"> YT</label><label class="chk-plataforma"><input type="checkbox" id="chk-instagram-${c.id}" disabled onchange="atualizarPlataforma('${c.id}','instagram',this.checked)"> IG</label><label class="chk-plataforma"><input type="checkbox" id="chk-tiktok-${c.id}" disabled onchange="atualizarPlataforma('${c.id}','tiktok',this.checked)"> TK</label></div><div class="agendamento-select"><input type="date" class="input-data" id="data-${c.id}" value="${dataPadrao}" onchange="atualizarAgendamento('${c.id}')"><input type="time" class="input-hora" id="hora-${c.id}" value="${c.horario}" onchange="atualizarAgendamento('${c.id}')"></div></div><div class="dropzone" id="dz-${c.id}" ondragover="event.preventDefault();event.stopPropagation();this.classList.add('over')" ondragleave="event.stopPropagation();this.classList.remove('over')" ondrop="tratarDropCard(event,'${c.id}')" onclick="document.getElementById('single-${c.id}').click()"><span class="dz-icon-wrap">${ICONS.paperclip}${ICONS.check}</span><span class="dz-text" id="dz-text-${c.id}">Vídeo ou JSON</span><div class="detalhes-meta" id="meta-${c.id}"></div><input id="single-${c.id}" type="file" accept="video/*,.json" style="display:none" onchange="tratarSelecaoCard(this,'${c.id}')"></div><div class="campos-texto"><input type="text" class="input-titulo" id="titulo-youtube-${c.id}" placeholder="Título YouTube" oninput="atualizarTitulo('${c.id}','youtube',this.value)"><input type="text" class="input-titulo" id="titulo-instagram-${c.id}" placeholder="Título Instagram" oninput="atualizarTitulo('${c.id}','instagram',this.value)"><input type="text" class="input-titulo" id="titulo-tiktok-${c.id}" placeholder="Título TikTok" oninput="atualizarTitulo('${c.id}','tiktok',this.value)"></div><button class="btn-disparar-card" onclick="agendarCanalIndividual('${c.id}')">${ICONS.rocket} Agendar Este Canal</button><div class="card-status" id="card-status-${c.id}"></div></div>`;
    if(c.faixa==="manha"&&containerManha)containerManha.innerHTML+=cardHTML;
    else if(containerNoite)containerNoite.innerHTML+=cardHTML;
  });
  CANAIS.forEach((c)=>atualizarAgendamento(c.id));
  renderizarTrilho("manha","rail-manha");
  renderizarTrilho("noite","rail-noite");
  iniciarRelogio();
  inicializarGlobalDropzone();
}

function salvarSupa(){const url=document.getElementById("supaUrl").value.trim();const key=document.getElementById("supaKey").value.trim();const admin=document.getElementById("adminSecret").value.trim();localStorage.setItem("supa_url",url);localStorage.setItem("supa_key",key);localStorage.setItem("admin_secret",admin);setMsg("Credenciais salvas!");}
function atualizarPlataforma(canalId,platform,checked){if(!estadoCanais[canalId])return;estadoCanais[canalId].plataformas[platform]=checked;}
function atualizarTexto(canalId,campo,valor){if(!estadoCanais[canalId])return;estadoCanais[canalId][campo]=valor;}
function atualizarTitulo(canalId,plataforma,valor){if(!estadoCanais[canalId])return;if(!estadoCanais[canalId].titulo)estadoCanais[canalId].titulo={};estadoCanais[canalId].titulo[plataforma]=String(valor||"");}
function temTitulo(st){if(!st||!st.titulo)return false;return PLATAFORMAS.some((p)=>typeof st.titulo[p]==="string"&&(st.titulo[p]||"").trim()!=="");}
function atualizarAgendamento(canalId){const dataEl=document.getElementById(`data-${canalId}`);const horaEl=document.getElementById(`hora-${canalId}`);if(!dataEl||!horaEl||!estadoCanais[canalId])return;const data=dataEl.value;const hora=horaEl.value;estadoCanais[canalId].agendamento=data&&hora?`${data}T${hora}:00`:"";}
function aplicarDataATodos(){const dataGlobalEl=document.getElementById("dataGlobal");if(!dataGlobalEl||!dataGlobalEl.value){setMsg("Selecione uma data global antes de aplicar.",true);return;}CANAIS.forEach((c)=>{const dataEl=document.getElementById(`data-${c.id}`);if(dataEl){dataEl.value=dataGlobalEl.value;atualizarAgendamento(c.id);}});setMsg("Data aplicada a todos os canais!");}
function aplicarStatusConexao(canalId,platform,conectado){const cb=document.getElementById(`chk-${platform}-${canalId}`);if(!cb)return;const eraConectado=cb.dataset.conectado==="1";cb.disabled=!conectado;cb.dataset.conectado=conectado?"1":"0";if(conectado&&!eraConectado){cb.checked=true;estadoCanais[canalId].plataformas[platform]=true;}else if(!conectado){cb.checked=false;estadoCanais[canalId].plataformas[platform]=false;}}
function selecionarTudoGlobal(){let marcados=0;CANAIS.forEach((c)=>{PLATAFORMAS.forEach((p)=>{const cb=document.getElementById(`chk-${p}-${c.id}`);if(cb&&!cb.disabled){cb.checked=true;estadoCanais[c.id].plataformas[p]=true;marcados++;}});});setMsg(marcados>0?"Todas as plataformas conectadas foram selecionadas!":"Nenhuma plataforma conectada para selecionar.");}

async function testarConexaoSupabase(){const{url,key}=getCreds();if(!url||!key){setMsg("Configure URL e Key do Supabase primeiro!",true);return;}try{const resposta=await fetch(`${url.replace(/\/$/,"")}/rest/v1/conexoes_canais_status?select=*`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!resposta.ok)throw new Error(`HTTP ${resposta.status}`);const dados=await resposta.json();const conectadoPorCanal={};CANAIS.forEach((c)=>{conectadoPorCanal[c.id]={youtube:false,instagram:false,tiktok:false};});dados.forEach((row)=>{const cid=(row.canal_id||"").toLowerCase();if(!conectadoPorCanal[cid])return;if(row.provider in conectadoPorCanal[cid]){conectadoPorCanal[cid][row.provider]=!!row.conectado;}});CANAIS.forEach((c)=>{const conn=conectadoPorCanal[c.id];const yt=document.getElementById(`st-yt-${c.id}`);const ig=document.getElementById(`st-ig-${c.id}`);const tk=document.getElementById(`st-tk-${c.id}`);if(yt)yt.className=conn.youtube?"ok":"err";if(ig)ig.className=conn.instagram?"ok":"err";if(tk)tk.className=conn.tiktok?"ok":"err";aplicarStatusConexao(c.id,"youtube",conn.youtube);aplicarStatusConexao(c.id,"instagram",conn.instagram);aplicarStatusConexao(c.id,"tiktok",conn.tiktok);});setMsg("Conectado e status atualizado!");}catch(e){setMsg("Erro ao testar conexão: "+e.message,true);}}
async function conectarPlataforma(canalId,plataforma){const{url,key,admin}=getCreds();if(!url||!key||!admin){setMsg("Configure URL, Key e Admin Secret antes de conectar.",true);return;}setMsg(`Iniciando conexão com ${plataforma}...`);try{const res=await fetch(`${url.replace(/\/$/,"")}/functions/v1/auth-${plataforma}`,{method:"POST",headers:{"apikey":key,"Authorization":`Bearer ${key}`,"x-admin-secret":admin,"Content-Type":"application/json"},body:JSON.stringify({channel_id:canalId,redirect_to:window.location.href.split("?")[0]})});if(!res.ok){const errJson=await res.json().catch(()=>({}));throw new Error(errJson.error||`HTTP ${res.status}`);}const data=await res.json();if(data.url){const popup=window.open(data.url,`auth_${plataforma}`,"width=600,height=700");const timer=setInterval(()=>{try{if(!popup||popup.closed){clearInterval(timer);testarConexaoSupabase();}}catch(_){}},1500);}else{throw new Error("URL de autenticação não retornada pela API.");}}catch(e){setMsg(`Erro ao conectar com ${plataforma}: `+e.message,true);}}
function criarModalMapeamento(batchId,contas){const antigo=document.getElementById("modal-mapeamento-ig");if(antigo)antigo.remove();const overlay=document.createElement("div");overlay.id="modal-mapeamento-ig";overlay.className="modal-overlay";const contasHtml=contas.map((acc)=>{const idVal=acc.igUserId||acc.ig_user_id||"";return `<div class="ig-account-chip" draggable="true" ondragstart="event.dataTransfer.setData('text/plain','${idVal}')" data-ig-id="${idVal}">${ICONS.camera}<span>@${acc.username||idVal}</span></div>`;}).join("");const containersHtml=CANAIS.map((c)=>`<div class="drop-target-canal" id="target-ig-${c.id}" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="receberDropContaIG(event,'${c.id}')"><span class="target-name">${c.nome}</span><span class="slot-status">Arraste a conta do IG aqui</span></div>`).join("");overlay.innerHTML=`<div class="modal-box"><div class="modal-head"><h2>Vincular Contas do Instagram aos Canais</h2><p>Arraste cada conta do Instagram da esquerda para o seu respectivo container de canal à direita.</p></div><div class="modal-body"><div class="modal-col-source"><h3>Contas do Instagram (Meta)</h3><div id="lista-chips-ig">${contasHtml}</div></div><div class="modal-col-targets">${containersHtml}</div></div><div class="modal-foot"><button onclick="concluirMapeamentoIG('${batchId}')" class="btn btn-success">${ICONS.save} Salvar Vínculos</button></div></div>`;document.body.appendChild(overlay);window._mapeamentoTempContas=contas;window._mapeamentoVinculos={};}
async function receberDropContaIG(event,canalId){event.preventDefault();const targetEl=document.getElementById(`target-ig-${canalId}`);if(targetEl)targetEl.classList.remove("drag-over");const igUserId=event.dataTransfer.getData("text/plain");if(!igUserId||igUserId==="undefined")return;window._mapeamentoVinculos[canalId]=igUserId;if(targetEl){targetEl.classList.add("linked");targetEl.querySelector(".slot-status").textContent=`Conectado: ID ${igUserId}`;}}
async function concluirMapeamentoIG(batchId){const{url,key,admin}=getCreds();const vinculos=window._mapeamentoVinculos||{};if(Object.keys(vinculos).length===0){alert("Vincule pelo menos uma conta antes de salvar.");return;}setMsg("Salvando vínculos do Instagram...");try{const res=await fetch(`${url.replace(/\/$/,"")}/functions/v1/auth-instagram/save-mappings`,{method:"POST",headers:{"apikey":key,"Authorization":`Bearer ${key}`,"x-admin-secret":admin,"Content-Type":"application/json"},body:JSON.stringify({batch_id:batchId,mappings:vinculos})});if(!res.ok)throw new Error("Erro ao salvar vínculos no servidor.");document.getElementById("modal-mapeamento-ig")?.remove();setMsg("Contas do Instagram vinculadas com sucesso!");testarConexaoSupabase();}catch(e){setMsg("Erro ao salvar mapeamento: "+e.message,true);}}
async function uploadVideo(canalId,file){const{url,key,admin}=getCreds();if(!url||!key||!admin)throw new Error("Credenciais do Supabase ausentes");const fd=new FormData();fd.append("file",file);fd.append("canal_id",canalId);const res=await fetch(`${url.replace(/\/$/,"")}/functions/v1/upload-video`,{method:"POST",headers:{"apikey":key,"Authorization":`Bearer ${key}`,"x-admin-secret":admin},body:fd});if(!res.ok){const errJson=await res.json().catch(()=>({}));throw new Error(errJson.error||`Upload HTTP ${res.status}`);}const out=await res.json();if(!out.ok)throw new Error(out.error||"Falha no upload");return out.url;}

async function distribuirVideosCanais(videos){
  let distribuidos=0;
  const canaisOcupados=new Set();
  const videosNaoAlocados=[];

  for(const video of videos){
    const nomeLow=video.name.toLowerCase();
    const canal=CANAIS.find(c=>nomeLow.includes(c.id.toLowerCase())||nomeLow.includes(c.nome.toLowerCase()));
    if(canal){
      await processarArquivo(canal.id,video);
      canaisOcupados.add(canal.id);
      distribuidos++;
    }else{
      videosNaoAlocados.push(video);
    }
  }

  if(videosNaoAlocados.length>0){
    const canaisLivres=CANAIS.filter(c=>!canaisOcupados.has(c.id));
    for(let i=0;i<Math.min(videosNaoAlocados.length,canaisLivres.length);i++){
      await processarArquivo(canaisLivres[i].id,videosNaoAlocados[i]);
      distribuidos++;
    }
  }

  setMsg(`${distribuidos} vídeo(s) distribuído(s) para os canais!`);
}

function inicializarGlobalDropzone(){
  const overlay=document.getElementById("globalDrop");
  let dragCounter=0;
  window.addEventListener("dragover",(e)=>{e.preventDefault();});
  window.addEventListener("dragenter",(e)=>{if(!e.dataTransfer||!Array.from(e.dataTransfer.types||[]).includes("Files"))return;dragCounter++;if(overlay)overlay.classList.add("active");});
  window.addEventListener("dragleave",()=>{dragCounter=Math.max(0,dragCounter-1);if(dragCounter===0&&overlay)overlay.classList.remove("active");});
  window.addEventListener("drop",async(e)=>{
    e.preventDefault();
    dragCounter=0;
    if(overlay)overlay.classList.remove("active");
    if(e.target.closest&&e.target.closest('.dropzone'))return;
    const files=Array.from(e.dataTransfer.files||[]);
    if(files.length===0)return;
    const videos=files.filter((f)=>f.type.startsWith("video/")||f.name.match(/\.(mp4|mov|mkv|avi|webm)$/i));
    const jsonFiles=files.filter((f)=>f.name.toLowerCase().endsWith(".json"));
    if(jsonFiles.length>0){jsonFiles.forEach((jf)=>processarArquivoJson(jf));}
    if(videos.length>0){
      videos.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
      await distribuirVideosCanais(videos);
    }
  });
}

async function tratarDropCard(e,id){e.preventDefault();e.stopPropagation();e.currentTarget.classList.remove("over");const files=e.dataTransfer.files;if(!files||files.length===0)return;await processarArquivo(id,files[0]);}
async function tratarSelecaoCard(input,id){if(!input.files||input.files.length===0)return;await processarArquivo(id,input.files[0]);input.value="";}

async function processarArquivosVideo(fileList){
  const files=Array.from(fileList||[]);
  if(files.length===0)return;
  const videos=files.filter((f)=>f.type.startsWith("video/")||f.name.match(/\.(mp4|mov|mkv|avi|webm)$/i)).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
  if(videos.length===0){setMsg("Nenhum arquivo de vídeo válido selecionado.",true);return;}
  await distribuirVideosCanais(videos);
}

async function processarArquivo(id,file){if(file.name.toLowerCase().endsWith(".json")){processarArquivoJson(file);return;}estadoCanais[id].arquivo=file.name;estadoCanais[id].videoUrl=null;atualizarVisualContainer(id);setMsg(`Enviando vídeo para ${id}...`);setCardStatus(id,"Enviando vídeo...","info");try{const videoUrl=await uploadVideo(id,file);estadoCanais[id].videoUrl=videoUrl;setMsg(`Vídeo de ${id} enviado com sucesso!`);setCardStatus(id,"Vídeo enviado com sucesso!","ok");}catch(e){setMsg(`Erro ao enviar vídeo de ${id}: ${e.message}`,true);setCardStatus(id,`Erro no upload: ${e.message}`,"erro");}finally{atualizarVisualContainer(id);}}

function processarArquivoJson(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=(e)=>{
    try{
      const data=JSON.parse(e.target.result);
      const lista=Array.isArray(data)?data:[data];
      lista.forEach((item)=>{
        const c=CANAIS.find((c)=>c.id.toLowerCase()===String(item.canal||"").toLowerCase()||c.nome.toLowerCase()===String(item.canal||"").toLowerCase());
        if(!c)return;

        let titulosObj={};
        if(item.titulos&&typeof item.titulos==="object") titulosObj=item.titulos;
        else if(item.titles&&typeof item.titles==="object") titulosObj=item.titles;
        else if(item.titulo&&typeof item.titulo==="object") titulosObj=item.titulo;
        else if(item.title&&typeof item.title==="object") titulosObj=item.title;

        const tituloGeral=(typeof item.titulo==="string"?item.titulo:"")||
                           (typeof item.title==="string"?item.title:"")||
                           (typeof item.legenda==="string"?item.legenda:"")||
                           (typeof item.caption==="string"?item.caption:"");

        PLATAFORMAS.forEach((p)=>{
          const val=(titulosObj[p]&&typeof titulosObj[p]==="string")?titulosObj[p]:tituloGeral;
          if(!estadoCanais[c.id].titulo) estadoCanais[c.id].titulo={};
          estadoCanais[c.id].titulo[p]=val;
          const inp=document.getElementById(`titulo-${p}-${c.id}`);
          if(inp)inp.value=val;
        });
        atualizarVisualContainer(c.id);
      });
      setMsg("JSON de títulos importado!");
    }catch(err){
      setMsg("JSON inválido: "+err.message,true);
    }
  };
  reader.readAsText(file);
}

function atualizarVisualContainer(id){const dz=document.getElementById(`dz-${id}`);const st=estadoCanais[id];if(dz){if(st.arquivo)dz.classList.add("cheio");else dz.classList.remove("cheio");}let html="";if(st.arquivo)html+=`<span class="arquivo" style="font-size:12px;">${ICONS.film}${st.arquivo}</span>`;if(st.videoUrl)html+=`<span class="url-meta">${ICONS.link}Enviado ao Storage</span>`;if(!html)html=`<span class="dz-text">Vídeo ou JSON</span>`;const meta=document.getElementById(`meta-${id}`);if(meta)meta.innerHTML=html;}

async function salvarAgendamentoNoBanco(canalId){
  const{url,key}=getCreds();
  const st=estadoCanais[canalId];
  const plataformasAtivas=PLATAFORMAS.filter((p)=>st.plataformas[p]);

  const titulosLimpos={};
  PLATAFORMAS.forEach((p)=>{
    let txt=(st.titulo&&typeof st.titulo[p]==="string")?st.titulo[p].trim():"";
    // Trava para respeitar o limite máximo de 100 caracteres do YouTube
    if(p==="youtube"&&txt.length>100){
      txt=txt.substring(0,97)+"...";
    }
    titulosLimpos[p]=txt;
  });

  const payload={
    canal_id:canalId,
    video_url:st.videoUrl||"",
    titulo:titulosLimpos,
    plataformas:plataformasAtivas,
    agendado_para:st.agendamento||"",
    status:"pendente"
  };

  const res=await fetch(`${url.replace(/\/$/,"")}/rest/v1/posts_agendados`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "apikey":key,
      "Authorization":`Bearer ${key}`,
      "Prefer":"return=minimal"
    },
    body:JSON.stringify(payload)
  });

  if(!res.ok){
    const errText=await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }
  return true;
}

async function agendarCanalIndividual(canalId){const{url,key}=getCreds();if(!url||!key){setMsg("Configure URL e Key do Supabase antes de agendar.",true);return;}const st=estadoCanais[canalId];if(!st)return;if(!st.videoUrl){setCardStatus(canalId,"Envie um vídeo antes de agendar.","erro");return;}if(!temTitulo(st)){setCardStatus(canalId,"Preencha ao menos um título antes de agendar.","erro");return;}if(!st.agendamento){setCardStatus(canalId,"Selecione data e hora.","erro");return;}setCardStatus(canalId,"Agendando...","info");try{await salvarAgendamentoNoBanco(canalId);setCardStatus(canalId,"Agendado com sucesso!","ok");}catch(e){setCardStatus(canalId,`Erro: ${e.message}`,"erro");}}
async function dispararProgramacao(){const{url,key}=getCreds();if(!url||!key){setMsg("Configure URL e Key do Supabase antes de disparar.",true);return;}const prontos=CANAIS.filter((c)=>{const st=estadoCanais[c.id];return st&&st.videoUrl&&temTitulo(st)&&st.agendamento;});if(prontos.length===0){setMsg("Nenhum canal está pronto (vídeo + título + data/hora) para disparo.",true);return;}setMsg(`Disparando programação para ${prontos.length} canal(is)...`);let sucesso=0;let falhas=0;for(const c of prontos){setCardStatus(c.id,"Agendando...","info");try{await salvarAgendamentoNoBanco(c.id);setCardStatus(c.id,"Agendado com sucesso!","ok");sucesso++;}catch(e){setCardStatus(c.id,`Erro: ${e.message}`,"erro");falhas++;}}setMsg(falhas===0?`Programação disparada! ${sucesso} canal(is) agendado(s) com sucesso.`:`Programação concluída: ${sucesso} agendado(s), ${falhas} com erro.`,falhas>0);}

window.addEventListener("message",async(e)=>{if(e.data&&e.data.type==="instagram_pending_map"){const params=new URLSearchParams(e.data.search);const batchId=params.get("batch_id");if(batchId){const{url,key}=getCreds();try{const res=await fetch(`${url.replace(/\/$/,"")}/rest/v1/contas_pendentes_meta?batch_id=eq.${batchId}&select=*`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});const dados=await res.json();if(dados&&dados.length>0){criarModalMapeamento(batchId,dados[0].contas);}}catch(err){setMsg("Erro ao carregar contas para mapeamento.",true);}}}});
if(new URLSearchParams(location.search).get("auth")==="instagram_pending_map"){const batchId=new URLSearchParams(location.search).get("batch_id");if(batchId){getCreds().url&&fetch(`${getCreds().url.replace(/\/$/,"")}/rest/v1/contas_pendentes_meta?batch_id=eq.${batchId}&select=*`,{headers:{apikey:getCreds().key,Authorization:`Bearer ${getCreds().key}`}}).then((r)=>r.json()).then((dados)=>{if(dados&&dados.length>0)criarModalMapeamento(batchId,dados[0].contas);});}}else if(new URLSearchParams(location.search).get("auth")){setMsg("Conexão realizada! Atualizando status...");testarConexaoSupabase();}

montarInterface();
