
(async()=>{
'use strict';
const SEED=[['KAELL','RO'],['FOGUINHO','SE'],['SANTOZ','TO'],['HOGUE','PE'],['VITÚ','PE'],['BOBBY MÍDYA','PA'],['MCHARLES','CE'],['WL BXD','RJ'],['BLINK','AM'],['NETO','RR'],['VITU','SC'],['KAMUI','MS'],['STASH','PB'],['SUBENÊ','PR'],['NOVENTA','ES'],['MABRU','AL'],['HW','MA'],['APAXI','AC'],['MANEL','BA'],['NICK','RN'],['JEFFÊ','DF'],['IKE','MG'],['MIKA','GO'],['XAMUEL','RS'],['JOTAPÊ','SP'],['GAJO','PI'],['MANO GÊ','AP'],['JAYA','BA'],['RICO MESQUITA','RJ'],['MARTIN','CE'],['GR','MT'],['HAVEL','MT']];
const UFS=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const MODE=document.body.dataset.mode;const PUBLIC=MODE==='public';const ADMIN=MODE==='admin';const DATA_URL=new URL(document.body.dataset.base+'dados.json',location.href);const KEY='duelo-nacional-web-v1-'+MODE;
const initial=()=>({people:SEED.map((p,i)=>({id:'mc'+i,name:p[0],uf:p[1]})),slots:Array(32).fill(null),manualRounds:{},results:{}});
function sanitize(raw){
 if(!raw||!Array.isArray(raw.people)||raw.people.length!==32)throw Error('O arquivo precisa conter exatamente 32 participantes.');
 const ids=new Set();const people=raw.people.map((p,i)=>{const id=String(p.id||'mc'+i);if(ids.has(id))throw Error('IDs duplicados.');ids.add(id);return {id,name:String(p.name||'MC sem nome').slice(0,48),uf:UFS.includes(p.uf)?p.uf:''}});
 const hasSlots=Array.isArray(raw.slots)&&raw.slots.length===32;
 // Backups antigos com resultados mantêm os confrontos; os sem resultados não sugerem confrontos inventados.
 const slots=hasSlots?raw.slots.map(id=>ids.has(id)?id:null):(raw.results&&Object.keys(raw.results).length?people.map(p=>p.id):Array(32).fill(null));
 const seen=new Set();for(let i=0;i<32;i++){if(slots[i]&&seen.has(slots[i]))slots[i]=null;else if(slots[i])seen.add(slots[i])}
 const results={};if(raw.results&&typeof raw.results==='object'){for(const [k,v]of Object.entries(raw.results)){if(/^([0-4])-(\d{1,2})$/.test(k)&&v&&ids.has(v.winnerId))results[k]={winnerId:v.winnerId,loserScore:v.loserScore===1?1:0}}}
 const manualRounds={};
 if(raw.manualRounds&&typeof raw.manualRounds==='object')for(let r=1;r<=4;r++){
  const given=raw.manualRounds[r];if(!Array.isArray(given))continue;
  const seenRound=new Set();manualRounds[r]=Array.from({length:[0,16,8,4,2][r]},(_,i)=>{
   const id=given[i];if(!ids.has(id)||seenRound.has(id))return null;
   seenRound.add(id);return id;
  });
 }
 return {people,slots,manualRounds,results};
}
let official=null,officialStamp=null;
const status=document.getElementById('portalStatus');
const setStatus=message=>{status.textContent=message};
async function loadOfficial(){
 const urls=location.hostname==='nakataff.github.io'?[new URL('https://raw.githubusercontent.com/nakataff/meus-projetos/main/duelo-nacional/dados.json'),new URL(DATA_URL)]:[new URL(DATA_URL)];
 let lastError;for(const url of urls){try{url.searchParams.set('v',Date.now());const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw Error('Não foi possível carregar os resultados ('+res.status+').');const raw=await res.json(),clean=sanitize(raw);if(official&&officialStamp&&(!raw.updatedAt||raw.updatedAt<officialStamp))return official;officialStamp=raw.updatedAt||null;official=clean;return clean}catch(e){lastError=e}}throw lastError;
}
let state;try{official=await loadOfficial();state=official;setStatus(officialStamp?'Resultados publicados em '+new Date(officialStamp).toLocaleString('pt-BR'):'Resultados do backup enviado em 22/11. Atualizações publicadas pelo organizador aparecem aqui.')}catch(e){setStatus(e.message+' Recarregue para tentar novamente.');document.querySelector('.layout').hidden=true;return;}
if(!PUBLIC){try{const draft=JSON.parse(localStorage.getItem(KEY));if(draft)state=sanitize(draft)}catch{}}

const undoStack=[];
function saveUndo(){undoStack.push(JSON.stringify(state));if(undoStack.length>25)undoStack.shift()}
function clearUpstream(matchIndex){
 delete state.results[`0-${matchIndex}`];
 for(let r=1;r<5;r++){
  if(Array.isArray(state.manualRounds?.[r]))break;
  delete state.results[`${r}-${Math.floor(matchIndex/(2**r))}`];
 }
}
function commitSlots(changedMatches){for(const m of new Set(changedMatches))clearUpstream(m);dropInvalid();renderRoster();renderBuilder();render()}
function assign(slot,newId){
 const oldId=state.slots[slot],id=newId||null;
 if(oldId===id)return;
 const other=id?state.slots.indexOf(id):-1;
 saveUndo();state.slots[slot]=id;
 if(other!==-1)state.slots[other]=oldId;
 const affected=[Math.floor(slot/2)];if(other!==-1)affected.push(Math.floor(other/2));
 commitSlots(affected);
 if(other!==-1)toast('MCs trocaram de posição. A chave foi atualizada.');
}
function repositionMatch(from,to){
 if(from===to||from<0||to<0||from>15||to>15)return;
 saveUndo();for(let j=0;j<2;j++){const a=2*from+j,b=2*to+j;[state.slots[a],state.slots[b]]=[state.slots[b],state.slots[a]]}
 // Resultados da própria batalha seguem com ela; confrontos das próximas fases mudam.
 const k1=`0-${from}`,k2=`0-${to}`;[state.results[k1],state.results[k2]]=[state.results[k2],state.results[k1]];
 if(!state.results[k1])delete state.results[k1];if(!state.results[k2])delete state.results[k2];
 for(const mi of [from,to])for(let r=1;r<5;r++){
  if(Array.isArray(state.manualRounds?.[r]))break;
  delete state.results[`${r}-${Math.floor(mi/(2**r))}`];
 }
 dropInvalid();
 renderRoster();renderBuilder();render();toast('Confronto movido! Próximas fases recalculadas.');
}
function invertMatch(m){const a=m*2,b=a+1;if(!state.slots[a]&&!state.slots[b])return;saveUndo();[state.slots[a],state.slots[b]]=[state.slots[b],state.slots[a]];renderRoster();renderBuilder();render()}
let view='all',toastTimer=null;
const $=x=>document.getElementById(x);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let onStateChange=()=>{};
const persist=()=>{if(PUBLIC)return;onStateChange(state);try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){setStatus('Não foi possível salvar neste navegador. Baixe um Backup JSON antes de sair.')}};
function toast(msg){const el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3300)}
function rounds(){
 let arr=state.slots.slice();const out=[];
 for(let r=0;r<5;r++){
  if(r>0&&Array.isArray(state.manualRounds?.[r])){
   const eligible=new Set(out[r-1].filter(m=>m.winner).map(m=>m.winner));
   const seen=new Set();
   arr=state.manualRounds[r].map(id=>{
    if(!id||!eligible.has(id)||seen.has(id))return null;
    seen.add(id);return id;
   });
  }
  const matches=[],next=[];
  for(let m=0;m<arr.length/2;m++){
   const a=arr[m*2],b=arr[m*2+1],result=state.results[`${r}-${m}`];
   const valid=!!(a&&b&&result&&(result.winnerId===a||result.winnerId===b));
   matches.push({r,m,a,b,result:valid?result:null,winner:valid?result.winnerId:null});
   next.push(valid?result.winnerId:null);
  }
  out.push(matches);arr=next;
 }
 return out;
}
function dropInvalid(){for(let r=0;r<5;r++){const all=rounds();for(const m of all[r]){const k=`${r}-${m.m}`;if(state.results[k]&&!m.winner)delete state.results[k]}}}
function setBulkStatus(msg,type=''){const el=$('bulkStatus');if(!el)return;el.textContent=msg;el.className='import-status'+(type?' '+type:'')}
function normalizeName(str){return String(str||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/['`´~^]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function aliasEntries(){
 const extra={'bobby mydia':'BOBBY MÍDYA','subene':'SUBENÊ','subenee':'SUBENÊ','mcharles':'MCHARLES','jeffe':'JEFFÊ','jotape':'JOTAPÊ','mano ge':'MANO GÊ','jaya luuck':'JAYA','jaya luck':'JAYA','jaya luq':'JAYA','rico':'RICO MESQUITA','wlbxd':'WL BXD','wl bxd':'WL BXD','hw':'HW','gr':'GR','vitu':'VITU','vitu sc':'VITU','vitu pe':'VITÚ','vitu pernambuco':'VITÚ'};
 const map=new Map();
 const add=(key,id)=>{if(!key||!id)return;const arr=map.get(key)||[];if(!arr.includes(id))arr.push(id);map.set(key,arr)};
 state.people.forEach(p=>{const n=normalizeName(p.name);add(n,p.id);add(n.replace(/\s+/g,''),p.id)});
 Object.entries(extra).forEach(([alias,target])=>{const p=state.people.find(x=>normalizeName(x.name)===normalizeName(target));if(p){add(normalizeName(alias),p.id);add(normalizeName(alias).replace(/\s+/g,''),p.id)}});
 return map;
}
function resolvePerson(query,usedIds=new Set()){
 const raw=String(query||'').trim();if(!raw)return null;
 const matchUF=raw.match(/\(\s*([A-Za-z]{2})\s*\)\s*$/);
 const uf=matchUF?matchUF[1].toUpperCase():null;
 const name=matchUF?raw.slice(0,matchUF.index).trim():raw;
 const norm=normalizeName(name);if(!norm)return null;
 const compact=norm.replace(/\s+/g,'');
 const aliasMap=aliasEntries();
 let candidates=(aliasMap.get(norm)||aliasMap.get(compact)||[]).map(id=>byId(id)).filter(Boolean);
 if(!candidates.length){
  const scored=state.people.map(p=>{
   const pn=normalizeName(p.name),pc=pn.replace(/\s+/g,'');let score=0;
   if(pn===norm)score+=100;if(pc===compact)score+=96;if(pn.includes(norm)||norm.includes(pn))score+=54;
   const qTokens=norm.split(' '),pTokens=pn.split(' ');let overlap=0;
   for(const qt of qTokens){if(pTokens.some(pt=>pt===qt||pt.startsWith(qt)||qt.startsWith(pt)))overlap++}
   score+=overlap*12;if(overlap===qTokens.length&&qTokens.length)score+=14;
   return {p,score};
  }).filter(x=>x.score>=24).sort((a,b)=>b.score-a.score);
  if(scored.length)candidates=scored.filter(x=>x.score===scored[0].score).map(x=>x.p);
 }
 // VITU (sem acento) refere-se a SC; VITÚ e VITU PE referem-se a PE.
 if(norm==='vitu'){
  const targetUF=uf||(/ú/i.test(name)?'PE':'SC');
  candidates=candidates.filter(p=>p.uf===targetUF);
 }else if(uf)candidates=candidates.filter(p=>p.uf===uf);
 return candidates.find(p=>!usedIds.has(p.id))||null;
}
function parseBulkLines(text){
 const rows=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const used=new Set(),duels=[],notes=[];
 const cleanSide=name=>String(name||'').trim().replace(/^[-•–—\s]+/,'').trim();
 if(!rows.length)throw Error('Cole pelo menos uma linha.');
 if(rows.length>16)throw Error('A 1ª fase tem no máximo 16 duelos por importação.');
 rows.forEach((row,i)=>{
  const cleaned=row.replace(/^[-•–—\s]+/,'').trim();
  let leftName='',rightName='',leftScore=null,rightScore=null;
  const withScore=cleaned.match(/^(.*?)\s*(?:\(\s*)?([0-2])\s*[xX]\s*([0-2])(?:\s*\))?\s*(.*?)$/);
  if(withScore){
   leftName=cleanSide(withScore[1]);rightName=cleanSide(withScore[4]);leftScore=+withScore[2];rightScore=+withScore[3];
  }else{
   const noScore=cleaned.match(/^(.*?)\s+(?:x|vs)\s+(.*?)$/i);
   if(!noScore)throw Error(`Linha ${i+1} fora do padrão: "${row}"`);
   leftName=cleanSide(noScore[1]);rightName=cleanSide(noScore[2]);
  }
  if(!leftName||!rightName)throw Error(`Linha ${i+1} precisa ter dois MCs.`);
  if(leftScore!==null&& (leftScore===rightScore||Math.max(leftScore,rightScore)!==2))throw Error(`Linha ${i+1} precisa estar em MD3, como 2x0 ou 2x1.`);
  const left=resolvePerson(leftName,used);if(!left)throw Error(`Não encontrei "${leftName}" na linha ${i+1}.`);
  used.add(left.id);
  const right=resolvePerson(rightName,used);if(!right)throw Error(`Não encontrei "${rightName}" na linha ${i+1}.`);
  if(left.id===right.id)throw Error(`Linha ${i+1} repetiu o mesmo MC nos dois lados.`);
  used.add(right.id);
  if(normalizeName(left.name)!==normalizeName(leftName))notes.push(`Linha ${i+1}: "${leftName}" → ${left.name}`);
  if(normalizeName(right.name)!==normalizeName(rightName))notes.push(`Linha ${i+1}: "${rightName}" → ${right.name}`);
  duels.push({left,right,winnerId:leftScore!==null?(leftScore>rightScore?left.id:right.id):null,loserScore:leftScore!==null?Math.min(leftScore,rightScore):null});
 });
 return {duels,notes};
}
function applyBulkImport(){
 try{
  const parsed=parseBulkLines($('bulkInput').value),replaceFirst=$('bulkReplace').checked;
  const slots=replaceFirst?Array(32).fill(null):state.slots.slice();
  const results=replaceFirst?{}:{...state.results};
  const clearPath=m=>{for(let r=0;r<5;r++)delete results[`${r}-${Math.floor(m/(2**r))}`]};
  const touched=[];
  parsed.duels.forEach((duel,i)=>{
   const a=duel.left.id,b=duel.right.id;
   let target=replaceFirst?i:-1;
   if(!replaceFirst){
    for(let m=0;m<16;m++)if((slots[m*2]===a&&slots[m*2+1]===b)||(slots[m*2]===b&&slots[m*2+1]===a)){target=m;break}
    if(target===-1){for(let m=0;m<16;m++)if(!slots[m*2]&&!slots[m*2+1]){target=m;break}}
   }
   if(target===-1)throw Error('Não há duelos vazios. Marque “substituir toda a 1ª fase” ou reorganize a chave manualmente.');
   for(const id of [a,b]){
    const where=slots.indexOf(id);
    if(where>=0&&Math.floor(where/2)!==target)throw Error(`${byId(id)?.name||'MC'} já está no duelo ${String(Math.floor(where/2)+1).padStart(2,'0')}. Use o editor manual para movê-lo.`);
   }
   const changing=slots[target*2]!==a||slots[target*2+1]!==b;
   if(changing||duel.winnerId!==results[`0-${target}`]?.winnerId||duel.loserScore!==results[`0-${target}`]?.loserScore)clearPath(target);
   slots[target*2]=a;slots[target*2+1]=b;
   if(duel.winnerId)results[`0-${target}`]={winnerId:duel.winnerId,loserScore:duel.loserScore===1?1:0};
   touched.push(target);
  });
  saveUndo();state.slots=slots;state.results=results;dropInvalid();renderRoster();renderBuilder();render();
  const msg=`${parsed.duels.length} confronto(s) aplicado(s): ${touched.map(m=>String(m+1).padStart(2,'0')).join(', ')}.`;
  setBulkStatus(msg+(parsed.notes.length?' Reconhecidos: '+parsed.notes.slice(0,3).join(' · '):''),'ok');
  toast(msg);
 }catch(err){setBulkStatus(err.message,'err');toast('Não consegui aplicar o texto.')}
}
const SAMPLE_IMPORT=`-Havel (2x1) Subene
-HW (MA) X FOGUINHO (SE)
-MCharles 2x0 Mabru
-Santoz (TO) X VITU (SC)
-Xamuel (2x0) Jaya Luuck
-Bobby Mydia (PA) X GR (MT)`;
const ROUND_LABELS=['1ª FASE','OITAVAS','QUARTAS','SEMIFINAIS','GRANDE FINAL'];
function stageIds(r){return r===0?state.people.map(p=>p.id):rounds()[r-1].filter(m=>m.winner).map(m=>m.winner)}
function roundIds(r){return r===0?state.slots:state.manualRounds?.[r]||null}
function roundIsManual(r){return r===0||Array.isArray(state.manualRounds?.[r])}
function quickStage(){return +$('quickRound').value}
function nextEmptyMatch(r){
 const ids=roundIds(r);
 if(r>0&&!ids)return 0;
 for(let m=0;m<matchNum(r);m++)if(!ids[m*2]&&!ids[m*2+1])return m;
 return -1;
}
function setQuickSelect(id,values,keep){
 const el=$(id),previous=keep?el.value:'';
 el.innerHTML=values;
 if(previous&&[...el.options].some(o=>o.value===previous))el.value=previous;
}
function quickOptions(r,selected=''){
 const assigned=roundIds(r)||[];
 return '<option value="">Selecione um MC...</option>'+stageIds(r).map(id=>{
  const p=byId(id),existing=assigned.indexOf(id),used=existing>=0?` · duelo ${String(Math.floor(existing/2)+1).padStart(2,'0')}`:'';
  return `<option value="${esc(id)}" ${selected===id?'selected':''}>${esc(p.name)} (${esc(p.uf||'UF')})${used}</option>`;
 }).join('');
}
function quickPositionIndex(){
 const r=quickStage(),slot=$('quickPosition').value;
 return slot==='next'?nextEmptyMatch(r):+slot;
}
function quickPopulate(){
 const r=quickStage(),m=quickPositionIndex(),info=(r>0&&!roundIsManual(r))?null:rounds()[r][m];
 setQuickSelect('quickA',quickOptions(r,info?.a||''));
 setQuickSelect('quickB',quickOptions(r,info?.b||''));
 $('quickA').value=info?.a||'';$('quickB').value=info?.b||'';
 const res=info?.result;
 $('quickScore').value=res?(res.winnerId===info.a?`2-${res.loserScore}`:`${res.loserScore}-2`):'pending';
 $('quickAdd').disabled=m<0;
}
function renderQuickStage(resetForm=false){
 const r=quickStage(),manual=roundIsManual(r),data=roundIds(r)||[],matches=rounds()[r];
 const selected=$('quickPosition').value||'next';
 const options=['<option value="next">Próxima posição livre</option>'];
 for(let m=0;m<matchNum(r);m++){
  const a=byId(data[m*2]),b=byId(data[m*2+1]);
  const named=a||b?` · ${(a?.name||'?')} × ${(b?.name||'?')}`:'';
  options.push(`<option value="${m}">Duelo ${String(m+1).padStart(2,'0')}${esc(named)}</option>`);
 }
 $('quickPosition').innerHTML=options.join('');
 $('quickPosition').value=!resetForm&&selected!=='next'&&+selected<matchNum(r)?selected:'next';
 $('quickMode').textContent=r===0?'1ª FASE • ORGANIZAÇÃO LIVRE':manual?'CHAVEAMENTO MANUAL':'CRUZAMENTOS AUTOMÁTICOS NÃO CONFIRMADOS';
 $('quickManual').hidden=r===0||manual;
 $('quickAuto').hidden=r===0||!manual;
 $('quickListLabel').textContent=ROUND_LABELS[r]+' / CONFRONTOS CADASTRADOS';
 const entries=manual?matches.filter(m=>m.a||m.b):[];
 const finished=entries.filter(m=>m.winner).length;
 $('quickCount').textContent=`${entries.filter(m=>m.a&&m.b).length} de ${matchNum(r)} duelos · ${finished} encerrado${finished===1?'':'s'}`;
 $('quickHint').textContent=r===0?'Cadastre os duelos individualmente. Só os vencedores serão oferecidos nas oitavas.':manual?`Você escolhe os duelos das ${ROUND_LABELS[r].toLowerCase()} livremente. Após cadastrar um confronto, use “Encaixar sorteio na chave” para ajustar as conexões na visualização completa.`:`Os cruzamentos exibidos na chave são apenas um padrão automático do editor, não confirmados como oficiais. Ao adicionar um duelo nesta fase, você passa para o modo manual.`;
 $('quickMatches').innerHTML=entries.length?entries.map(m=>{
  const a=byId(m.a),b=byId(m.b),winner=byId(m.winner);
  const score=m.winner?(m.winner===m.a?`2×${m.result.loserScore}`:`${m.result.loserScore}×2`):'A realizar';
  return `<div class="qr-item"><span class="qr-number">${String(m.m+1).padStart(2,'0')}</span><div class="qr-pair"><b>${esc(a?.name||'A definir')} (${esc(a?.uf||'—')}) × ${esc(b?.name||'A definir')} (${esc(b?.uf||'—')})</b><small>${esc(score)}${winner?' · Vencedor: '+esc(winner.name):''}</small></div><div class="qr-item-actions"><button data-q-copy="${m.m}" title="Copiar duelo">⧉</button><button data-q-edit="${m.m}" title="Editar duelo">✎</button><button data-q-move="${m.m}" data-q-delta="-1" title="Subir">↑</button><button data-q-move="${m.m}" data-q-delta="1" title="Descer">↓</button><button data-q-delete="${m.m}" title="Apagar duelo">×</button></div></div>`;
 }).join(''):`<div class="qr-empty">${r>0&&!manual?'Nenhum confronto oficial cadastrado. Selecione dois MCs e clique em adicionar: só essa batalha será inserida.':'Nenhum duelo cadastrado nesta fase. Você pode adicionar apenas o próximo, sem preencher os demais.'}</div>`;
 quickPopulate();refreshAlignUi();
}
function quickReadText(){
 try{
  const data=parseBulkLines($('quickPaste').value);
  if(data.duels.length!==1)throw Error('Cole somente um confronto aqui.');
  const m=data.duels[0],r=quickStage(),eligible=new Set(stageIds(r));
  if(!eligible.has(m.left.id)||!eligible.has(m.right.id))throw Error('Um dos MCs não está classificado para esta fase. Confira os vencedores da fase anterior.');
  $('quickA').value=m.left.id;$('quickB').value=m.right.id;
  $('quickScore').value=m.winnerId?(m.winnerId===m.left.id?`2-${m.loserScore}`:`${m.loserScore}-2`):'pending';
  toast('MCs reconhecidos. Clique em Adicionar / salvar duelo.');
 }catch(e){toast(e.message)}
}
function ensureManualFrom(r){
 for(let rr=r;rr<=4;rr++)if(!Array.isArray(state.manualRounds?.[rr]))state.manualRounds[rr]=Array(matchNum(rr)*2).fill(null);
}
function saveQuickDuel(){
 const r=quickStage(),m=quickPositionIndex(),a=$('quickA').value,b=$('quickB').value,score=$('quickScore').value;
 if(m<0){toast('Essa fase já está preenchida. Selecione um duelo para editar.');return}
 if(!a||!b||a===b){toast('Selecione dois MCs diferentes.');return}
 const eligible=new Set(stageIds(r));if(!eligible.has(a)||!eligible.has(b)){toast('Os dois MCs precisam ter vencido a fase anterior.');return}
 const source=roundIds(r)||Array(matchNum(r)*2).fill(null),oldA=source[m*2],oldB=source[m*2+1];
 for(const id of [a,b]){const pos=source.indexOf(id);if(pos>=0&&Math.floor(pos/2)!==m){toast(`${byId(id).name} já está no duelo ${String(Math.floor(pos/2)+1).padStart(2,'0')}. Edite ou mova esse duelo.`);return}}
 const [sa,sb]=score==='pending'?[null,null]:score.split('-').map(Number),winner=sa===null?null:sa>sb?a:b,loser=sa===null?null:Math.min(sa,sb),key=`${r}-${m}`;
 const same=oldA===a&&oldB===b;
 if(same&&state.results[key]?.winnerId===winner&&state.results[key]?.loserScore===loser)return toast('Esse resultado já está cadastrado.');
 saveUndo();
 if(r===0){state.slots[m*2]=a;state.slots[m*2+1]=b}
 else{
  if(!roundIsManual(r))ensureManualFrom(r);
  state.manualRounds[r][m*2]=a;state.manualRounds[r][m*2+1]=b;
 }
 if(!same||state.results[key]?.winnerId!==winner)delete state.results[key];
 if(winner)state.results[key]={winnerId:winner,loserScore:loser};else delete state.results[key];
 dropInvalid();renderRoster();renderBuilder();
 $('quickPosition').value='next';render();toast(`${ROUND_LABELS[r]} · Duelo ${String(m+1).padStart(2,'0')} salvo!`);
}
function removeQuickDuel(m){
 const r=quickStage(),manual=roundIsManual(r),ids=roundIds(r);
 if(!manual){toast('Ative a escolha manual para alterar os confrontos desta fase.');return}
 if(!ids[m*2]&&!ids[m*2+1])return;
 saveUndo();ids[m*2]=null;ids[m*2+1]=null;delete state.results[`${r}-${m}`];dropInvalid();renderRoster();renderBuilder();$('quickPosition').value='next';render();toast('Duelo removido sem apagar os demais.');
}
function moveQuickDuel(m,to){
 const r=quickStage(),ids=roundIds(r);
 if(!ids||to<0||to>=matchNum(r))return;
 saveUndo();for(let j=0;j<2;j++)[ids[m*2+j],ids[to*2+j]]=[ids[to*2+j],ids[m*2+j]];
 const k1=`${r}-${m}`,k2=`${r}-${to}`;
 [state.results[k1],state.results[k2]]=[state.results[k2],state.results[k1]];
 if(!state.results[k1])delete state.results[k1];if(!state.results[k2])delete state.results[k2];
 dropInvalid();renderRoster();renderBuilder();render();toast('Posição do duelo atualizada.');
}
function activateQuickManual(){
 const r=quickStage();if(!r||roundIsManual(r))return;
 const completedHere=rounds()[r].filter(m=>m.winner).length;
 if(completedHere&&!confirm(`Ativar sorteio manual nas ${ROUND_LABELS[r]}? ${completedHere} resultado(s) automáticos dessa fase serão apagados; a primeira fase será preservada.`))return;
 saveUndo();ensureManualFrom(r);
 for(let rr=r;rr<=4;rr++)for(let m=0;m<matchNum(rr);m++)delete state.results[`${rr}-${m}`];
 render();toast(`Chaveamento manual ativado nas ${ROUND_LABELS[r]}.`);
}
function disableQuickManual(){
 const r=quickStage();if(!r||!roundIsManual(r))return;
 if(!confirm(`Voltar ao cruzamento automático em ${ROUND_LABELS[r]}? Os duelos e resultados manuais desta fase serão descartados.`))return;
 saveUndo();delete state.manualRounds[r];for(let rr=r;rr<=4;rr++)for(let m=0;m<matchNum(rr);m++)delete state.results[`${rr}-${m}`];
 render();toast('Modo automático restaurado para esta fase.');
}
function quickPhaseText(){
 const r=quickStage(),arr=rounds()[r],manual=roundIsManual(r);
 return `DUELO NACIONAL · ${ROUND_LABELS[r]}\n`+(manual?arr.filter(m=>m.a&&m.b).map(m=>{
  const a=byId(m.a),b=byId(m.b),score=m.winner?(m.winner===m.a?`(2x${m.result.loserScore})`:`(${m.result.loserScore}x2)`):'X';
  return `${String(m.m+1).padStart(2,'0')}. ${a.name} (${a.uf}) ${score} ${b.name} (${b.uf})`;
 }).join('\n'):'Aguardando definição manual dos confrontos');
}
// Ajustar o desenho da chave às disputas sorteadas, sem alterar os resultados das batalhas.
function countMisalignedLinks(){
 const all=DueloCore.layoutRounds(rounds(),state.manualRounds);let incorrect=0,confirmed=0;
 for(let r=1;r<=4;r++){
  if(!Array.isArray(state.manualRounds?.[r]))continue;
  for(const [position,target] of all[r].entries()){
   if(!target.a||!target.b)continue;
   const left=all[r-1][2*position],right=all[r-1][2*position+1];
   if(left?.winner===target.a&&right?.winner===target.b)confirmed++;
   else incorrect++;
  }
 }
 return {incorrect,confirmed};
}
function refreshAlignUi(){
 const summary=countMisalignedLinks(),label=$('alignInfo');
 if(!label)return;
 const known=Object.entries(state.manualRounds||{}).filter(([r,slots])=>+r>0&&Array.isArray(slots)&&slots.some(Boolean));
 const hasPairs=known.some(([r,slots])=>slots.some((id,i)=>i%2===0&&id&&slots[i+1]));
 $('alignBracketBtn').disabled=!hasPairs;
 $('alignUndoBtn').disabled=!undoStack.length;
 if(!known.length){label.className='qr-align-info';label.innerHTML='Defina um duelo sorteado nas oitavas ou nas fases seguintes e depois clique em <strong>Encaixar sorteio na chave</strong>.';return}
 if(summary.incorrect===0){label.className='qr-align-info success';label.textContent=summary.confirmed?`✓ ${summary.confirmed} confronto(s) sorteado(s) já estão conectados corretamente no mapa. A chave respeita o sorteio.`:'Os confrontos cadastrados ainda não têm ligações para ajustar.';return}
 label.className='qr-align-info warn';label.textContent=`${summary.incorrect} confronto(s) sorteado(s) ainda não estão alinhados no diagrama. Clique em “Encaixar sorteio na chave” para organizar as batalhas anteriores.`;
}
function alignBracketToDraw(){
 const original=JSON.stringify(state),report={pairs:0,moved:0,unresolved:[],blocked:[]};
 for(let targetRound=4;targetRound>=1;targetRound--){
  const manualTarget=state.manualRounds?.[targetRound];
  if(!Array.isArray(manualTarget))continue;
  const sourceRound=targetRound-1;
  if(sourceRound>0&&!Array.isArray(state.manualRounds?.[sourceRound])){
   if(manualTarget.some(Boolean))report.blocked.push(ROUND_LABELS[targetRound]);
   continue;
  }
  const current=rounds()[sourceRound];
  const len=matchNum(sourceRound),assigned=Array(len).fill(null),pinned=new Set();
  // Freeze the already announced pairings into source positions. Unannounced duels keep their relative order.
  for(let m=0;m<matchNum(targetRound);m++){
   const a=manualTarget[2*m],b=manualTarget[2*m+1];
   if(!a||!b)continue;
   const left=current.findIndex(src=>src.winner===a),right=current.findIndex(src=>src.winner===b);
   if(left<0||right<0||left===right||pinned.has(left)||pinned.has(right)){
    report.unresolved.push(`${ROUND_LABELS[targetRound]} #${m+1}`);continue;
   }
   assigned[2*m]=left;assigned[2*m+1]=right;
   pinned.add(left);pinned.add(right);report.pairs++;
  }
  let next=0;
  for(let i=0;i<len;i++)if(assigned[i]===null){while(pinned.has(next))next++;assigned[i]=next++;}
  if(assigned.every((src,i)=>src===i))continue;
  // Save both full MC slots and their respective result objects as an inseparable block.
  const slots=sourceRound===0?state.slots:state.manualRounds[sourceRound];
  const oldSlots=slots.slice();
  const oldResults=Array.from({length:len},(_,i)=>state.results[`${sourceRound}-${i}`]);
  const reordered=assigned.flatMap(i=>oldSlots.slice(2*i,2*i+2));
  if(sourceRound===0)state.slots=reordered;else state.manualRounds[sourceRound]=reordered;
  for(let i=0;i<len;i++){
   const key=`${sourceRound}-${i}`,r=oldResults[assigned[i]];
   if(r)state.results[key]={winnerId:r.winnerId,loserScore:r.loserScore};else delete state.results[key];
   if(assigned[i]!==i)report.moved++;
  }
 }
 if(JSON.stringify(state)!==original){undoStack.push(original);if(undoStack.length>25)undoStack.shift();dropInvalid();renderRoster();renderBuilder();render();}
 const remain=countMisalignedLinks().incorrect;
 if(report.moved){toast(`${report.pairs} confronto(s) encaixado(s); resultados preservados.`);}
 else if(report.pairs&&!remain){toast('Os confrontos já estão encaixados na chave!');}
 else if(report.unresolved.length||report.blocked.length){toast('Ainda há duelos sem encaixe. Confira os classificados das fases anteriores.');}
 else toast('Cadastre os duelos sorteados com os dois classificados para encaixar.');
 if(report.unresolved.length||report.blocked.length){
  const label=$('alignInfo');label.className='qr-align-info warn';
  label.textContent=`${report.pairs} pares avaliados. Sem encaixe: ${[...report.unresolved,...report.blocked].join(', ')}. Confira os resultados e se as rodadas anteriores estão em modo manual.`;
 }
}
$('alignBracketBtn').addEventListener('click',()=>{alignBracketToDraw();view='all';render();$('arenaScroll').scrollTop=0;});
$('alignUndoBtn').addEventListener('click',()=>{if(!undoStack.length)return;state=sanitize(JSON.parse(undoStack.pop()));renderRoster();renderBuilder();render();toast('Organização anterior restaurada.');});

$('quickRound').addEventListener('change',()=>{renderQuickStage(true)});
$('quickPosition').addEventListener('change',quickPopulate);
$('quickAdd').addEventListener('click',saveQuickDuel);
$('quickParse').addEventListener('click',quickReadText);
$('quickPaste').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();quickReadText()}});
$('quickManual').addEventListener('click',activateQuickManual);
$('quickAuto').addEventListener('click',disableQuickManual);
$('quickCopyAll').addEventListener('click',async()=>toast(await copyText(quickPhaseText())?'Confrontos da fase copiados!':'Não foi possível copiar.'));
function loadKnownResults(){
 const first=[
  ['HAVEL','MT','SUBENÊ','PR',1],['MCHARLES','CE','MABRU','AL',0],
  ['NETO','RR','BLINK','AM',0],['SANTOZ','TO','VITU','SC',0],
  ['XAMUEL','RS','JAYA','BA',0],['MIKA','GO','NICK','RN',1],
  ['BOBBY MÍDYA','PA','GR','MT',0],['MARTIN','CE','APAXI','AC',0],
  ['HOGUE','PE','KAMUI','MS',1],['IKE','MG','STASH','PB',0],
  ['NOVENTA','ES','JEFFÊ','DF',1],['KAELL','RO','RICO MESQUITA','RJ',0],
  ['JOTAPÊ','SP','WL BXD','RJ',1],['HW','MA','FOGUINHO','SE',1],
  ['VITÚ','PE','MANEL','BA',0],['MANO GÊ','AP','GAJO','PI',0]
 ];
 const known=[
  ['MIKA','GO','JOTAPÊ','SP',1,0],
  ['NOVENTA','ES','HAVEL','MT',0,1],
  ['VITÚ','PE','HOGUE','PE',null,null]
 ];
 if(!confirm('Carregar os 16 resultados da primeira fase apresentados no PDF e os 3 confrontos das oitavas que você informou? Isso substitui o chaveamento e os placares atuais.'))return;
 try{
  const get=(name,uf)=>{
   const p=state.people.find(x=>x.uf===uf&&normalizeName(x.name)===normalizeName(name));
   if(!p)throw Error(`MC não encontrado: ${name} (${uf}). Confira o cadastro.`);
   return p.id;
  };
  const slots=[],results={},manualRounds={};
  first.forEach(([a,au,b,bu,score],m)=>{
   const aid=get(a,au),bid=get(b,bu);slots.push(aid,bid);
   results[`0-${m}`]={winnerId:aid,loserScore:score};
  });
  for(let rr=1;rr<=4;rr++)manualRounds[rr]=Array(matchNum(rr)*2).fill(null);
  known.forEach(([a,au,b,bu,loser,selector],m)=>{
   const aid=get(a,au),bid=get(b,bu);
   manualRounds[1][m*2]=aid;manualRounds[1][m*2+1]=bid;
   if(loser!==null)results[`1-${m}`]={winnerId:selector===0?bid:aid,loserScore:loser};
  });
  saveUndo();state.slots=slots;state.results=results;state.manualRounds=manualRounds;
  $('quickRound').value='1';$('quickPosition').value='next';renderRoster();renderBuilder();render();
  toast('Dados carregados: 16 duelos da primeira fase + 3 das oitavas.');
 }catch(e){toast('Não foi possível carregar: '+e.message)}
}
$('quickLoadKnown').addEventListener('click',loadKnownResults);

$('quickMatches').addEventListener('click',async e=>{
 const get=attr=>e.target.closest(`[${attr}]`);
 const edit=get('data-q-edit'),copy=get('data-q-copy'),del=get('data-q-delete'),move=get('data-q-move');
 if(edit){$('quickPosition').value=edit.dataset.qEdit;quickPopulate();$('quickA').focus();return}
 if(copy){const r=quickStage(),m=rounds()[r][+copy.dataset.qCopy],a=byId(m.a),b=byId(m.b),score=m.winner?(m.winner===m.a?`(2x${m.result.loserScore})`:`(${m.result.loserScore}x2)`):'X';toast(await copyText(`${a?.name} (${a?.uf}) ${score} ${b?.name} (${b?.uf})`)?'Duelo copiado!':'Não foi possível copiar.');return}
 if(del){removeQuickDuel(+del.dataset.qDelete);return}
 if(move){moveQuickDuel(+move.dataset.qMove,+move.dataset.qMove+(+move.dataset.qDelta));return}
});
const byId=id=>state.people.find(p=>p.id===id);
const matchNum=r=>[16,8,4,2,1][r];
function completed(){return rounds().flat().filter(x=>x.winner).length}
function renderRoster(){
 const html=state.people.map((p,i)=>{const where=state.slots.indexOf(p.id),used=where!==-1;return `<div class="roster-item ${used?'selected-in-bracket':''}" data-id="${esc(p.id)}"><span class="slot">${String(i+1).padStart(2,'0')}</span><input type="text" maxlength="48" spellcheck="false" aria-label="Nome do MC ${i+1}" data-id="${esc(p.id)}" data-kind="name" value="${esc(p.name)}"/><select aria-label="Estado do MC ${i+1}" data-id="${esc(p.id)}" data-kind="uf"><option value="" ${p.uf?'':'selected'}>UF</option>${UFS.map(u=>`<option value="${u}" ${u===p.uf?'selected':''}>${u}</option>`).join('')}</select><span class="roster-used ${used?'':'free'}">${used?'#'+String(Math.floor(where/2)+1).padStart(2,'0'):'LIVRE'}</span></div>`}).join('');
 $('roster').innerHTML=html
}
function optionHtml(current){
 return `<option value="">Selecionar MC...</option>`+state.people.map(p=>{const assigned=state.slots.indexOf(p.id),isCurrent=current===p.id;return `<option value="${esc(p.id)}" ${isCurrent?'selected':''}>${esc(p.name)} · ${esc(p.uf||'UF')}${!isCurrent&&assigned!==-1?'  ↔ #'+String(Math.floor(assigned/2)+1).padStart(2,'0'):''}</option>`}).join('')
}
function renderBuilder(){
 const used=state.slots.filter(Boolean).length,complete=Array.from({length:16},(_,i)=>!!state.slots[2*i]&&!!state.slots[2*i+1]).filter(Boolean).length;
 $('filledMatches').textContent=complete+' / 16';$('usedCount').textContent=used+' / 32';$('remainingCount').textContent=String(32-used);$('undoBtn').disabled=!undoStack.length;
 $('duelsGrid').innerHTML=Array.from({length:16},(_,m)=>{
 const a=state.slots[m*2],b=state.slots[m*2+1],ready=!!(a&&b),group=m<8?'METADE 1':'METADE 2';
 const moves=Array.from({length:16},(_,j)=>{if(j===m)return '';const x=byId(state.slots[j*2]),y=byId(state.slots[j*2+1]);const title=x||y?' · '+(x?.name||'?')+' x '+(y?.name||'?'):'';return `<option value="${j}">#${String(j+1).padStart(2,'0')}${esc(title)}</option>`}).join('');
 return `<article class="duel-card" data-match="${m}" draggable="true"><div class="duel-top"><span class="duel-index"><b>${String(m+1).padStart(2,'0')}</b> DUELO <span class="duel-group">/ ${group}</span></span><div class="duel-controls"><button data-copy-duel="${m}" title="Copiar só este confronto" aria-label="Copiar duelo ${m+1}">⧉</button><button data-invert="${m}" title="Inverter os dois MCs" aria-label="Inverter MCs do duelo ${m+1}">⇆</button><button data-move-duel="${m}" data-offset="-1" ${m===0?'disabled':''} title="Subir duelo" aria-label="Subir duelo ${m+1}">↑</button><button data-move-duel="${m}" data-offset="1" ${m===15?'disabled':''} title="Descer duelo" aria-label="Descer duelo ${m+1}">↓</button></div></div><div class="duel-body"><select class="${a?'':'unset'}" data-slot="${m*2}" aria-label="Primeiro MC do duelo ${m+1}">${optionHtml(a)}</select><div class="duel-vs">VS</div><select class="${b?'':'unset'}" data-slot="${m*2+1}" aria-label="Segundo MC do duelo ${m+1}">${optionHtml(b)}</select></div><div class="duel-foot"><span class="${ready?'complete':''}">${ready?'✓ PRONTO PARA MD3':a||b?'FALTA 1 MC':'AGUARDANDO MCS'}</span><div class="duel-swap"><label for="swap-${m}">Trocar com</label><select id="swap-${m}" data-swap-duel="${m}" aria-label="Trocar posição do duelo ${m+1}"><option value="">Escolher...</option>${moves}</select></div></div></article>`
 }).join('');
}
const sideRange=(v,r)=>v==='a'?[0,[8,4,2,1][r]]:[ [8,4,2,1][r], [16,8,4,2][r] ];
function matchesForView(v, all){if(v==='all')return all;if(v==='first')return [all[0]];if(v==='oitavas')return [all[1]];if(v==='quartas')return [all[2]];if(v==='semis')return [all[3]];if(v==='final')return [all[4]];return all.slice(0,4).map((round,r)=>{const [start,end]=sideRange(v,r);return round.slice(start,end)})}
function uiMatch(m,x,y){const a=byId(m.a),b=byId(m.b),has=!!m.winner;
const fighter=(p,idx)=>{let score='–';if(has)score=m.winner===p?.id?'2':String(m.result.loserScore);const winner=has&&p&&m.winner===p.id,loser=has&&p&&!winner;return `<button class="fighter ${winner?'winner':loser?'loser':''}" data-win="${p?esc(p.id):''}" data-r="${m.r}" data-m="${m.m}" ${p&&a&&b?'':'disabled'} title="${p?'Clique para dar a vitória por 2–0':'Aguardando definição'}"><span class="fighter-name">${p?esc(p.name):'A definir'}</span><span class="uf">${p?esc(p.uf||'UF'):'—'}</span><span class="score">${score}</span></button>`};
return `<div class="match ${has?'has-result':''} ${m.r===4?'highlight':''}" style="left:${x}px;top:${y}px"><div class="match-hd"><span>#${String(m.m+1).padStart(2,'0')} · ${['1ª FASE','OITAVAS','QUARTAS','SEMIFINAL','FINAL'][m.r]}</span><span class="${has?'done':''}">${has?'● ENCERRADA':'MD3'}</span></div><div class="fighters">${fighter(a,0)}<div class="fight-divider"></div>${fighter(b,1)}</div><div class="match-bottom"><span>${has?'VENCEDOR DEFINIDO':a&&b?'TOQUE NO VENCEDOR':'AGUARDANDO DUELO'}</span>${has?`<button class="score-toggle" data-close="1" data-r="${m.r}" data-m="${m.m}" title="Alternar entre 2–0 e 2–1">${m.result.loserScore===1?'2–1 ↔':'2–0 ↔'}</button>`:'<span class="pick-tip">● ● ○</span>'}</div></div>`}
function renderFinal(){const m=rounds()[4][0],a=byId(m.a),b=byId(m.b),winner=byId(m.winner);$('arena').style.width='min(100%,760px)';$('arena').style.height='auto';$('arena').style.minHeight='0';$('arena').innerHTML=`<div class="champion-panel"><div class="eyebrow">A ÚLTIMA BATALHA · MELHOR DE TRÊS</div><h3>GRANDE FINAL</h3><div class="final-duel"><div class="finalist"><strong>${esc(a?.name||'A definir')}</strong><small>${esc(a?.uf||'—')}${m.result?' · '+(winner?.id===a?.id?'2':m.result.loserScore):''}</small></div><div class="versus">VS</div><div class="finalist"><strong>${esc(b?.name||'A definir')}</strong><small>${esc(b?.uf||'—')}${m.result?' · '+(winner?.id===b?.id?'2':m.result.loserScore):''}</small></div></div><div class="champion-banner"><small>${winner?'CAMPEÃO NACIONAL':'O TRONO ESTÁ VAGO'}</small><b>${esc(winner?.name||'QUEM LEVA ESSA?')}</b></div><p class="final-hint">${a&&b?`Escolha o vencedor clicando em um dos finalistas acima pelo mapa completo, ou use o duelo abaixo.`:'Complete as semifinais de cada lado para definir os finalistas.'}</p>${a&&b?`<div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:20px"><button class="btn softgold" data-final-win="${esc(a.id)}">${esc(a.name)} vence 2–0</button><button class="btn softgold" data-final-win="${esc(b.id)}">${esc(b.name)} vence 2–0</button>${winner?`<button class="btn" data-close="1" data-r="4" data-m="0">Alterar placar para 2–${m.result.loserScore===1?'0':'1'}</button>`:''}</div>`:''}</div>`}
function renderArena(){const v=view;const el=$('arena');if(v==='final'){renderFinal();return}const blocks=matchesForView(v,DueloCore.layoutRounds(rounds(),state.manualRounds));const n=blocks.length,round0=blocks[0].length;const slot=v==='all'||v==='first'?144:155,top=66,w=233,gap=75,sidePad=30,height=round0*slot+top+42,width=n*w+(n-1)*gap+2*sidePad;const x=r=>sidePad+r*(w+gap);const y=(r,i)=>top+slot*(2**r*(i+.5)) - 58;const center=(r,i)=>top+slot*(2**r*(i+.5));let lines='';for(let r=0;r<n-1;r++)for(const edge of DueloCore.roundEdges(blocks[r],blocks[r+1],Array.isArray(state.manualRounds?.[blocks[r+1][0].r]))){
 const from=blocks[r][edge.from],c=from.winner?'#ffc85b9b':'#45556c83';const x1=x(r)+w,x2=x(r+1),mid=(x1+x2)/2;
 lines+=`<path data-source-round="${from.r}" data-source-match="${from.m}" data-target-match="${blocks[r+1][edge.to].m}" d="M${x1} ${center(r,edge.from)} H${mid} V${center(r+1,edge.to)} H${x2}" fill="none" stroke="${c}" stroke-width="1.7"/>`}
;let html=`<svg class="bracket-lines" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${lines}</svg>`;let labels=['PRIMEIRA FASE','OITAVAS','QUARTAS','SEMIFINAIS','GRANDE FINAL'];for(let r=0;r<n;r++){html+=`<div class="round-label" style="left:${x(r)}px">${String(blocks[r][0].r+1).padStart(2,'0')} / ${labels[blocks[r][0].r]}</div>`;for(let i=0;i<blocks[r].length;i++)html+=uiMatch(blocks[r][i],x(r),y(r,i))}el.style.width=width+'px';el.style.height=height+'px';el.style.minHeight='0';el.innerHTML=html}
function renderProgress(){
 const num=completed();$('progressText').innerHTML=`<strong>${num}</strong> / 31 duelos definidos`;$('progressFill').style.width=(num/31*100)+'%';$('mcCount').textContent=state.people.length;
 document.querySelectorAll('[data-view]').forEach(t=>t.classList.toggle('selected',t.dataset.view===view));
 $('viewNote').textContent=view==='oitavas'?'Oitavas: escolha os confrontos no editor de fases, mesmo que só o próximo duelo esteja confirmado.':view==='quartas'?'Quartas: combine os vencedores das oitavas.':view==='semis'?'Semifinais: escolha os cruzamentos dos classificados.':view==='final'?'A final reúne quem avançou pelas duas metades do mapa. Todos os duelos são MD3.':view==='first'?'Primeira fase: 16 confrontos. Use o editor acima para escolher os MCs e mudar a posição das batalhas.':view==='all'?'A chave completa acompanha os confrontos sorteados que você cadastrou. O mapa encaixa automaticamente os vencedores nos confrontos sorteados, preservando os números das batalhas.':`Metade ${view==='a'?'1':'2'}: visualização de 8 confrontos. Você pode mover qualquer batalha para a outra metade no editor.`;
}
function render(){dropInvalid();renderProgress();renderArena();renderQuickStage();persist()}
function win(r,m,id){if(PUBLIC)return;const all=rounds();const match=all[r]?.[m];if(!match||!match.a||!match.b||!id||!(match.a===id||match.b===id))return;const key=`${r}-${m}`;if(match.winner===id){state.results[key].loserScore=state.results[key].loserScore?0:1}else{state.results[key]={winnerId:id,loserScore:0}}dropInvalid();render();}
$('roster').addEventListener('input',e=>{if(e.target.dataset.kind!=='name')return;const p=byId(e.target.dataset.id);if(p){p.name=e.target.value;renderBuilder();render();}});
$('roster').addEventListener('change',e=>{if(e.target.dataset.kind!=='uf')return;const p=byId(e.target.dataset.id);if(p){p.uf=e.target.value;renderBuilder();render()}});
$('duelsGrid').addEventListener('change',e=>{
 const select=e.target.closest('select');if(!select)return;
 if(select.dataset.slot!==undefined){assign(+select.dataset.slot,select.value);return}
 if(select.dataset.swapDuel!==undefined&&select.value!==''){repositionMatch(+select.dataset.swapDuel,+select.value);return}
});
$('duelsGrid').addEventListener('click',e=>{
 const copy=e.target.closest('[data-copy-duel]');if(copy){copySingleDuel(+copy.dataset.copyDuel);return}
 const invert=e.target.closest('[data-invert]');if(invert){invertMatch(+invert.dataset.invert);return}
 const move=e.target.closest('[data-move-duel]');if(move){const from=+move.dataset.moveDuel;repositionMatch(from,from+(+move.dataset.offset));return}
});
let draggingMatch=null;
$('duelsGrid').addEventListener('dragstart',e=>{if(e.target.closest('select,button')){e.preventDefault();return}const card=e.target.closest('.duel-card');if(!card)return;draggingMatch=+card.dataset.match;card.classList.add('dragging');if(e.dataTransfer)e.dataTransfer.effectAllowed='move'});
$('duelsGrid').addEventListener('dragover',e=>{if(draggingMatch===null)return;e.preventDefault();document.querySelectorAll('.duel-card.over').forEach(n=>n.classList.remove('over'));e.target.closest('.duel-card')?.classList.add('over')});
$('duelsGrid').addEventListener('drop',e=>{e.preventDefault();const card=e.target.closest('.duel-card');if(card&&draggingMatch!==null)repositionMatch(draggingMatch,+card.dataset.match);draggingMatch=null;document.querySelectorAll('.duel-card.over,.duel-card.dragging').forEach(n=>n.classList.remove('over'))});
$('duelsGrid').addEventListener('dragend',()=>{draggingMatch=null;document.querySelectorAll('.duel-card.over,.duel-card.dragging').forEach(n=>n.classList.remove('over'))});
$('toggleBuilder').addEventListener('click',()=>{const collapsed=$('builderSection').classList.toggle('collapsed');$('toggleBuilder').textContent=collapsed?'Abrir editor ↓':'Recolher editor ↑'});
$('goBuilderBtn').addEventListener('click',()=>{$('builderSection').classList.remove('collapsed');$('toggleBuilder').textContent='Recolher editor ↑';$('builderSection').scrollIntoView({behavior:'smooth',block:'start'})});
$('fillEmptyBtn').addEventListener('click',()=>{
 const available=state.people.map(p=>p.id).filter(id=>!state.slots.includes(id)),empty=state.slots.map((id,i)=>id===null?i:-1).filter(i=>i!==-1);
 if(!empty.length){toast('Todas as vagas já estão preenchidas.');return}
 if(!confirm(`Sortear ${available.length} MCs somente nas ${empty.length} vagas disponíveis? Os confrontos já escolhidos serão mantidos.`))return;
 saveUndo();for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]]}
 const changed=[];empty.forEach((slot,i)=>{state.slots[slot]=available[i];changed.push(Math.floor(slot/2))});commitSlots(changed);toast('Vagas vazias preenchidas. Duelos manuais preservados!')
});
$('clearMatchesBtn').addEventListener('click',()=>{if(!state.slots.some(Boolean)){toast('Ainda não há confrontos definidos.');return}if(!confirm('Limpar os 16 confrontos e todos os resultados? Os 32 nomes e estados serão mantidos.'))return;saveUndo();state.slots.fill(null);state.results={};state.manualRounds={};renderRoster();renderBuilder();render();toast('Confrontos limpos. Escolha os MCs manualmente.')});
$('undoBtn').addEventListener('click',()=>{if(!undoStack.length)return;state=sanitize(JSON.parse(undoStack.pop()));renderRoster();renderBuilder();render();toast('Última alteração desfeita!')});
function duelLine(m,{includeIndex=true}={}){const a=byId(state.slots[m*2]),b=byId(state.slots[m*2+1]);const prefix=includeIndex?`${String(m+1).padStart(2,'0')} · `:'';if(!a||!b)return prefix+[a?`${a.name} (${a.uf||'UF'})`:'A DEFINIR',b?`${b.name} (${b.uf||'UF'})`:'A DEFINIR'].join(' X ');const result=state.results[`0-${m}`];const score=result&&result.winnerId?(result.winnerId===a.id?`(2x${result.loserScore})`:`(${result.loserScore}x2)`):'X';return `${prefix}${a.name} (${a.uf||'UF'}) ${score} ${b.name} (${b.uf||'UF'})`;}
function matchesText(){let lines=['DUELO NACIONAL • CHAVEAMENTO MD3',''];for(let i=0;i<16;i++)lines.push(duelLine(i));return lines.join('\n')}
async function copyMatches(){const ok=await copyText(matchesText());toast(ok?'Confrontos copiados em texto!':'Não foi possível copiar. Use Backup JSON.')}
async function copySingleDuel(m){const ok=await copyText(duelLine(m,{includeIndex:false}));toast(ok?`Duelo ${String(m+1).padStart(2,'0')} copiado!`:'Não foi possível copiar o confronto.')}
$('copyMatchesBtn').addEventListener('click',copyMatches);$('copyMatchesBtn2').addEventListener('click',copyMatches);
$('applyBulkBtn').addEventListener('click',applyBulkImport);
$('clearBulkBtn').addEventListener('click',()=>{$('bulkInput').value='';setBulkStatus('Campo limpo. Cole as linhas e clique em Aplicar texto.')});
$('sampleImportBtn').addEventListener('click',()=>{$('bulkInput').value=SAMPLE_IMPORT;setBulkStatus('Exemplo preenchido. Pode aplicar ou editar antes.','ok')});
$('bulkInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();applyBulkImport()}});
$('arena').addEventListener('click',e=>{const w=e.target.closest('[data-win]');if(w){win(+w.dataset.r,+w.dataset.m,w.dataset.win);return}const fw=e.target.closest('[data-final-win]');if(fw){win(4,0,fw.dataset.finalWin);return}const close=e.target.closest('[data-close]');if(close){const k=`${close.dataset.r}-${close.dataset.m}`,result=state.results[k];if(result){result.loserScore=result.loserScore?0:1;render()}}});
$('viewTabs').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(!b)return;view=b.dataset.view;render();$('arenaScroll').scrollTop=0;$('arenaScroll').scrollLeft=0});
$('toggleRoster').addEventListener('click',()=>{const open=$('rosterPanel').classList.toggle('collapsed')===false;$('toggleRoster').textContent=open?'Fechar ↑':'Editar ↓'});
$('resetScoresBtn').addEventListener('click',()=>{if(!confirm('Apagar todos os resultados mantendo os confrontos montados?'))return;saveUndo();state.results={};renderBuilder();render();toast('Placares apagados; confrontos mantidos.')});
$('resetAllBtn').addEventListener('click',()=>{if(!confirm('Restaurar os 32 participantes e limpar os confrontos?'))return;saveUndo();state=initial();renderRoster();renderBuilder();render();toast('Tudo restaurado, sem confrontos pré-definidos.')});
function encodeState(){return btoa(unescape(encodeURIComponent(JSON.stringify(state))))}
function decodeState(s){return sanitize(JSON.parse(decodeURIComponent(escape(atob(s))))) }
function importHash(){if(!location.hash.startsWith('#chave='))return;try{state=decodeState(location.hash.slice(7));renderRoster();renderBuilder();toast('Chave compartilhada carregada!')}catch(e){toast('Não foi possível ler o link compartilhado.') }}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch(e){const input=document.createElement('textarea');input.value=text;input.style.position='fixed';input.style.opacity=0;document.body.appendChild(input);input.select();let ok=false;try{ok=document.execCommand('copy')}catch(e){}input.remove();return ok}}
$('shareBtn').addEventListener('click',async()=>{if(location.protocol==='file:'){toast('Para compartilhar por link, publique este HTML. Offline, envie uma arte ou o Backup JSON.');return}const url=location.href.split('#')[0]+'#chave='+encodeState();const ok=await copyText(url);toast(ok?'Link copiado! É só enviar.':'Não foi possível copiar. Use o Backup JSON ou baixe uma imagem.');});
$('saveJsonBtn').addEventListener('click',()=>downloadBlob(new Blob([JSON.stringify({...state,app:'Duelo Nacional MD3',version:2},null,2)],{type:'application/json'}),'duelo-nacional-backup.json'));
$('loadJsonBtn').addEventListener('click',()=>$('jsonInput').click());
$('jsonInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=sanitize(JSON.parse(await file.text()));if(!confirm('Importar o backup e substituir a chave atual?'))return;state=parsed;renderRoster();renderBuilder();render();toast('Backup importado com sucesso!')}catch(err){toast('Backup inválido: '+err.message)}e.target.value=''});
$('printBtn').addEventListener('click',()=>{view='all';render();window.print()});
function downloadBlob(blob,filename){const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
// --- ARTE OFFLINE: Canvas nativo, sem dependências externas ---
const C={bg:'#0b101a',card:'#202b3d',gold:'#ffcb5b',gold2:'#db9e36',white:'#f9f6ed',muted:'#abb9c9',teal:'#6be8d1'};
const dims={feed:[1080,1350],story:[1080,1920],square:[1080,1080],wide:[1920,1080],wide4k:[3840,2160]};
function rr(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(1,ctx.canvas.width/1080);ctx.stroke()}}
function textFit(ctx,t,x,y,maxW,size,color,bold=true,align='left'){ctx.save();ctx.textAlign=align;ctx.textBaseline='middle';let n=size;ctx.font=`${bold?'900':'700'} ${n}px Impact, 'Arial Black', Arial, sans-serif`;while(n>Math.max(9,size*.6)&&ctx.measureText(t).width>maxW){n--;ctx.font=`${bold?'900':'700'} ${n}px Impact, 'Arial Black', Arial, sans-serif`}ctx.fillStyle=color;ctx.fillText(t,x,y);ctx.restore()}
function font(ctx,str,x,y,size,color,weight='700',align='left',family='Arial,sans-serif'){ctx.save();ctx.textAlign=align;ctx.textBaseline='middle';ctx.font=`${weight} ${size}px ${family}`;ctx.fillStyle=color;ctx.fillText(str,x,y);ctx.restore()}
function artBackground(ctx,W,H){const grd=ctx.createLinearGradient(0,0,W,H);grd.addColorStop(0,'#101b2a');grd.addColorStop(.49,'#090e18');grd.addColorStop(1,'#231b19');ctx.fillStyle=grd;ctx.fillRect(0,0,W,H);
const glow=ctx.createRadialGradient(W*.87,H*.06,0,W*.87,H*.06,W*.7);glow.addColorStop(0,'#c9902c45');glow.addColorStop(1,'#c9902c00');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
ctx.save();ctx.strokeStyle='#ffffff07';ctx.lineWidth=Math.max(1,W/800);for(let i=-H;i<W+H;i+=W/22){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i+H,H);ctx.stroke()}ctx.restore();
// Linhas do vinil, como textura original da arte.
ctx.save();ctx.translate(W*.92,H*.34);ctx.strokeStyle='#f7bc4b0b';ctx.lineWidth=Math.max(1,W*.006);for(let i=0;i<8;i++){ctx.beginPath();ctx.arc(0,0,W*(.20+i*.028),0,Math.PI*2);ctx.stroke()}ctx.restore();
let seed=197;for(let i=0;i<Math.min(4000,Math.floor(W*H/400));i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%W;seed=(seed*1664525+1013904223)>>>0;const y=seed%H;ctx.fillStyle=i%7?'#ffffff08':'#ffda7722';ctx.fillRect(x,y,i%3===0?2:1,i%5===0?2:1)}
ctx.fillStyle=C.gold;ctx.fillRect(0,0,W,Math.max(8,W*.008));}
function artHeader(ctx,W,H,v){
 const pad=Math.max(32,W*.049),base=Math.max(37,Math.min(87,W*.056));
 const landscape=W/H>1.42;
 const display={
  'all-first':['CHAVE COMPLETA',landscape?'PARTE 1 DE 2 • PRIMEIRA FASE':'PARTE 1 DE 3 • PRIMEIRA FASE'],
  'all-round16':['CHAVE COMPLETA','PARTE 2 DE 3 • OITAVAS DE FINAL'],
  'all-last':['CHAVE COMPLETA','PARTE 3 DE 3 • QUARTAS À FINAL'],
  'a-first':['METADE 1','PARTE 1 DE 2 • PRIMEIRA FASE'],
  'a-next':['METADE 1','PARTE 2 DE 2 • OITAVAS À SEMIFINAL'],
  'b-first':['METADE 2','PARTE 1 DE 2 • PRIMEIRA FASE'],
  'b-next':['METADE 2','PARTE 2 DE 2 • OITAVAS À SEMIFINAL'],
  'all-later':['CHAVE COMPLETA','PARTE 2 DE 2 • OITAVAS À FINAL'],
  first:['PRIMEIRA FASE','16 DUELOS • 32 MCs'],
  oitavas:['OITAVAS DE FINAL','8 DUELOS • 16 MCS'],
  quartas:['QUARTAS DE FINAL','4 DUELOS • 8 MCS'],
  semis:['SEMIFINAIS','2 DUELOS • 4 MCS'],
  later:['FASES DECISIVAS','OITAVAS • QUARTAS • SEMIFINAL • FINAL'],
  a:['METADE 1','CAMINHO PARA A GRANDE FINAL'],
  b:['METADE 2','CAMINHO PARA A GRANDE FINAL'],
  final:['GRANDE FINAL','A ÚLTIMA BATALHA • MELHOR DE 3']
 };
 const [headline,desc]=display[v]||display.first;
 const size=landscape?Math.min(95,W*.065):Math.min(83,W*.077);
 font(ctx,'DN / DUELO NACIONAL',pad,base,Math.max(16,W*.019),C.gold,'900','left',"Impact, 'Arial Black', sans-serif");
 font(ctx,'CULTURA / RIMA / RESPEITO',W-pad,base,Math.max(11,W*.010),C.muted,'900','right');
 textFit(ctx,headline,pad,base+size*.95,W-pad*2,size,C.white,true);
 font(ctx,desc,pad,base+size*1.57,Math.max(14,Math.min(25,W*.019)),C.gold,'900');
 const lineY=base+size*1.95;
 ctx.strokeStyle='#ffcb5b7a';ctx.lineWidth=Math.max(2,W*.0018);ctx.beginPath();ctx.moveTo(pad,lineY);ctx.lineTo(W-pad,lineY);ctx.stroke();
 return lineY+Math.max(25,H*.036);
}
function artFooter(ctx,W,H,v){
 const p=Math.max(32,W*.049),y=H-Math.max(27,H*.036);
 ctx.fillStyle=C.gold;ctx.fillRect(p,y-10,Math.max(25,W*.025),3);
 font(ctx,'DUELO NACIONAL / MD3',p+Math.max(34,W*.034),y-7,Math.max(11,Math.min(19,W*.014)),C.muted,'900');
 font(ctx,'32 MCs   •   31 DUELOS   •   1 CAMPEÃO',W-p,y-7,Math.max(10,Math.min(17,W*.012)),C.gold,'900','right');
}
function artMatch(ctx,m,x,top,cw,ch){
 const decided=!!m.winner;
 const stroke=decided?'#d4a7479c':'#63768d91';
 rr(ctx,x,top,cw,ch,Math.max(8,Math.min(15,cw*.028)), '#182536f2', stroke);
 ctx.save();ctx.fillStyle=decided?C.gold:'#526b85';ctx.fillRect(x,top,Math.max(5,cw*.012),ch);ctx.restore();
 const pad=Math.max(12,cw*.038);
 const titleH=Math.min(Math.max(16,ch*.21),29);
 const titleSize=Math.min(19,Math.max(11,Math.min(ch*.12,cw*.036)));
 const rn=['1ª FASE','OITAVAS','QUARTAS','SEMIFINAL','FINAL'][m.r]||'MD3';
 font(ctx,`${rn}  /  DUELO ${String(m.m+1).padStart(2,'0')}`,x+pad,top+titleH*.55,titleSize,C.muted,'900');
 font(ctx,decided?'ENCERRADO':'MD3',x+cw-pad,top+titleH*.55,titleSize*.88,decided?C.gold:C.muted,'900','right');
 ctx.strokeStyle='#ffffff19';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+pad,top+titleH);ctx.lineTo(x+cw-pad,top+titleH);ctx.stroke();
 const bodyTop=top+titleH;
 const rowH=(ch-titleH)/2;
 const fsize=Math.max(15,Math.min(40,cw*.081,rowH*.62));
 const stateSize=Math.max(11,Math.min(19,fsize*.62));
 const scoreSize=Math.max(13,Math.min(23,fsize*.70));
 [byId(m.a),byId(m.b)].forEach((person,t)=>{
  const winner=decided&&m.winner===person?.id,loser=decided&&!winner;
  const yy=bodyTop+rowH*(t+.5);
  const stateX=x+cw-pad-(decided?Math.max(28,cw*.065):0);
  const nameW=stateX-(x+pad+2)-Math.max(27,cw*.115);
  textFit(ctx,(person?.name||'A DEFINIR').toUpperCase(),x+pad+3,yy,Math.max(20,nameW),fsize,loser?'#8895a5':winner?C.gold:C.white,true);
  font(ctx,person?.uf||'--',stateX,yy,stateSize,winner?C.gold:C.muted,'900','right');
  if(decided){font(ctx,winner?'2':String(m.result.loserScore),x+cw-pad,yy,scoreSize,winner?C.gold:'#9cabb9','900','right')}
  if(t===0){ctx.strokeStyle='#ffffff15';ctx.beginPath();ctx.moveTo(x+pad,bodyTop+rowH);ctx.lineTo(x+cw-pad,bodyTop+rowH);ctx.stroke()}
 });
}
function getArtSections(v){
 const all=DueloCore.layoutRounds(rounds(),state.manualRounds);
 if(v==='first'||v==='all-first')return [{title:'PRIMEIRA FASE',matches:all[0]}];
 if(v==='oitavas')return [{title:'OITAVAS DE FINAL',matches:all[1]}];
 if(v==='quartas')return [{title:'QUARTAS DE FINAL',matches:all[2]}];
 if(v==='semis')return [{title:'SEMIFINAIS',matches:all[3]}];
 if(v==='later'||v==='all-later')return all.slice(1).map((matches,i)=>({title:['OITAVAS DE FINAL','QUARTAS DE FINAL','SEMIFINAIS','GRANDE FINAL'][i],matches}));
 if(v==='all-round16')return [{title:'OITAVAS DE FINAL',matches:all[1]}];
 if(v==='all-last')return all.slice(2).map((matches,i)=>({title:['QUARTAS DE FINAL','SEMIFINAIS','GRANDE FINAL'][i],matches}));
 if(['a','b','a-first','a-next','b-first','b-next'].includes(v))return all.slice(0,4).map((matches,i)=>{
  const side=v.startsWith('a')?'a':'b';
  const start=side==='a'?0:Math.floor(matches.length/2),end=side==='a'?Math.floor(matches.length/2):matches.length;
  return {title:['PRIMEIRA FASE','OITAVAS','QUARTAS','SEMIFINAL'][i],matches:matches.slice(start,end)};
 }).filter((section,i)=>v.endsWith('-first')?i===0:v.endsWith('-next')?i>0:true);
 return [{title:'PRIMEIRA FASE',matches:all[0]}];
}
function drawBracketArt(ctx,W,H,v,top){
 const sections=getArtSections(v),landscape=W/H>1.42;
 const p=Math.max(32,W*.049),gap=Math.max(13,W*.019),footer=Math.max(88,H*.095);
 const topY=top,avail=H-topY-footer;
 const colsFor=len=>len===1?1:Math.min(landscape?4:2,len);
 const calc=sections.map(s=>({ ...s,cols:colsFor(s.matches.length),rows:Math.ceil(s.matches.length/colsFor(s.matches.length))}));
 const totalRows=calc.reduce((n,s)=>n+s.rows,0);
 const headerH=Math.max(25,Math.min(38,H*.025));
 const sectionGap=Math.max(10,Math.min(18,H*.011));
 const rowGap=Math.max(8,Math.min(15,H*.009));
 const totalHead=calc.length*(headerH+2*sectionGap),totalGap=(totalRows-calc.length)*rowGap;
 const matchH=Math.max(36,(avail-totalHead-totalGap)/totalRows);
 let y=topY;
 calc.forEach(sec=>{
  const capFont=Math.max(13,Math.min(22,W*.018));
  font(ctx,sec.title,y===topY?p:p,y+headerH*.5,capFont,C.gold,'900');
  ctx.strokeStyle='#ffcb5b42';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p+Math.min(W*.26,265),y+headerH*.58);ctx.lineTo(W-p,y+headerH*.58);ctx.stroke();
  y+=headerH+sectionGap;
  const cw=(W-p*2-gap*(sec.cols-1))/sec.cols;
  // Ordem por colunas: duelos 01–08 na coluna 1, 09–16 na coluna 2.
  for(let c=0;c<sec.cols;c++)for(let r=0;r<sec.rows;r++){
   const index=c*sec.rows+r;if(index>=sec.matches.length)continue;
   artMatch(ctx,sec.matches[index],p+c*(cw+gap),y+r*(matchH+rowGap),cw,matchH);
  }
  y+=sec.rows*matchH+(sec.rows-1)*rowGap+sectionGap;
 });
}
function drawFinalArt(ctx,W,H,top){
 const m=rounds()[4][0],a=byId(m.a),b=byId(m.b),winner=byId(m.winner);
 const pad=W*.07,landscape=W/H>1.42;
 const cardW=W*.37,cardH=Math.min(H*.25,landscape?H*.30:W*.30);
 const cy=top+(H-top)*(landscape?.31:.30);
 const mkCard=(person,x,active)=>{
  rr(ctx,x,cy-cardH/2,cardW,cardH,Math.max(12,W*.014),active?'#584120':'#202c3d',active?'#ffcb5b':'#6b7f97');
  font(ctx,person?.uf||'—',x+cardW/2,cy-cardH*.27,Math.max(16,W*.026),C.gold,'900','center');
  textFit(ctx,(person?.name||'A DEFINIR').toUpperCase(),x+cardW/2,cy+cardH*.02,cardW*.88,Math.min(76,W*.070),active?C.gold:C.white,true,'center');
  font(ctx,'FINALISTA',x+cardW/2,cy+cardH*.30,Math.max(12,W*.018),C.muted,'900','center');
 };
 mkCard(a,pad,winner?.id===a?.id);mkCard(b,W-pad-cardW,winner?.id===b?.id);
 font(ctx,'VS',W/2,cy,Math.min(W*.12,160),C.gold,'900','center',"Impact, 'Arial Black', sans-serif");
 const by=cy+cardH/2+H*.10,bw=W-pad*2,bh=Math.min(H*.17,270);
 rr(ctx,pad,by,bw,bh,Math.max(13,W*.018),'#e9b14b',C.gold);
 font(ctx,winner?'CAMPEÃO NACIONAL':'O TRONO ESTÁ VAGO',W/2,by+bh*.24,Math.max(14,W*.025),'#32210a','900','center');
 textFit(ctx,(winner?.name||'QUEM LEVA ESSA?').toUpperCase(),W/2,by+bh*.64,bw*.87,Math.min(92,W*.099),'#191b1d',true,'center');
 font(ctx,'GRANDE FINAL  •  MELHOR DE TRÊS',W/2,by+bh+H*.055,Math.max(14,W*.024),C.muted,'900','center');
}
async function renderArtBlob(chosen,sizeKey,type){
 const [W,H]=dims[sizeKey],canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas indisponível no navegador.');
 artBackground(ctx,W,H);const top=artHeader(ctx,W,H,chosen);
 if(chosen==='final')drawFinalArt(ctx,W,H,top);else drawBracketArt(ctx,W,H,chosen,top);
 artFooter(ctx,W,H,chosen);
 const mime={png:'image/png',jpeg:'image/jpeg',webp:'image/webp'}[type];
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,mime,.95));
 if(!blob)throw Error('Falha ao gerar a imagem.');
 return {blob,W,H,ext:type==='jpeg'?'jpg':type};
}
function pagesForView(chosen,sizeKey){
 if(chosen==='all')return ['wide','wide4k'].includes(sizeKey)?['all-first','all-later']:['all-first','all-round16','all-last'];
 if(['a','b'].includes(chosen)&&['feed','square'].includes(sizeKey))return [chosen+'-first',chosen+'-next'];
 return [chosen];
}
function selectedBatchViews(){return [...document.querySelectorAll('[data-batch-view]:checked')].map(x=>x.dataset.batchView)}
function zipCRC(bytes){let crc=0xffffffff;for(let i=0;i<bytes.length;i++){crc^=bytes[i];for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
async function makeZip(files){
 const chunks=[],central=[];let pos=0;
 const enc=new TextEncoder();
 const header=(len,entries)=>{const buf=new Uint8Array(len),dv=new DataView(buf.buffer);entries.forEach(([offset,value,bits=4])=>{if(bits===2)dv.setUint16(offset,value,true);else dv.setUint32(offset,value,true)});return buf};
 for(const f of files){
  const name=enc.encode(f.name),bytes=new Uint8Array(await f.blob.arrayBuffer()),crc=zipCRC(bytes),size=bytes.length;
  const lh=header(30,[[0,0x04034b50],[4,20,2],[6,0x0800,2],[8,0,2],[10,0,2],[12,0,2],[14,crc],[18,size],[22,size],[26,name.length,2],[28,0,2]]);
  chunks.push(lh,name,bytes);
  const ch=header(46,[[0,0x02014b50],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,0,2],[14,0,2],[16,crc],[20,size],[24,size],[28,name.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0],[42,pos]]);
  central.push(ch,name);pos+=lh.length+name.length+size;
 }
 const centralSize=central.reduce((sum,c)=>sum+c.length,0);
 const end=header(22,[[0,0x06054b50],[4,0,2],[6,0,2],[8,files.length,2],[10,files.length,2],[12,centralSize],[16,pos],[20,0,2]]);
 return new Blob([...chunks,...central,end],{type:'application/zip'});
}
async function createExportPages(views,sizeKey,type){
 const result=[];
 for(const page of views.flatMap(v=>pagesForView(v,sizeKey))){
  const {blob,ext}=await renderArtBlob(page,sizeKey,type);
  const name=`duelo-nacional-${page}-${sizeKey}.${ext}`;
  // Se a chave completa foi selecionada junto da primeira fase, não repetir uma arte idêntica.
  if(result.some(x=>x.name===name))continue;
  result.push({name,blob});
 }
 return result;
}
async function downloadExport(views,sizeKey,type,forceZip){
 const files=await createExportPages(views,sizeKey,type);
 if(files.length===1&&!forceZip){downloadBlob(files[0].blob,files[0].name);return 1}
 downloadBlob(await makeZip(files),`duelo-nacional-${sizeKey}-${files.length}-artes.zip`);
 return files.length;
}
async function exportArt(){
 const button=$('downloadBtn');button.disabled=true;button.textContent='Preparando arte…';
 try{
  const requested=$('exportView').value,chosen=requested==='current'?view:requested;
  const count=await downloadExport([chosen],$('exportSize').value,$('exportType').value,false);
  toast(count===1?'Arte gerada em alta qualidade!':`${count} imagens da chave completa reunidas em um ZIP!`);
 }catch(err){console.error(err);toast('Erro ao exportar: '+err.message)}
 finally{button.disabled=false;button.textContent='↓ Baixar arte(s)'}
}
async function exportBatch(){
 const button=$('downloadBatchBtn'),views=selectedBatchViews();
 if(!views.length){toast('Marque pelo menos uma visão para exportar.');return}
 button.disabled=true;button.textContent='Gerando pacote…';
 try{const count=await downloadExport(views,$('exportSize').value,$('exportType').value,true);toast(`Pacote ZIP com ${count} imagem(ns) gerado!`)}
 catch(err){console.error(err);toast('Erro ao exportar lote: '+err.message)}
 finally{button.disabled=false;button.textContent='⇣ Baixar várias artes (ZIP)'}
}
$('downloadBtn').addEventListener('click',exportArt);
$('downloadBatchBtn').addEventListener('click',exportBatch);
if(!PUBLIC&&!ADMIN)importHash();renderRoster();renderBuilder();render();

if(PUBLIC){
 document.querySelector('.hero p').textContent='Acompanhe os confrontos e os resultados do Duelo Nacional. Escolha uma fase abaixo ou crie sua própria chave.';
 $('arena').addEventListener('click',e=>{e.stopImmediatePropagation();e.preventDefault()},true);
 const publicRender=()=>{document.querySelectorAll('#arena .fighter').forEach(b=>{b.removeAttribute('title');b.setAttribute('aria-disabled','true')});$('viewNote').textContent='Resultados cadastrados pelo organizador. Arraste para os lados para acompanhar a chave completa.';};
 publicRender();new MutationObserver(publicRender).observe($('arena'),{childList:true});
 let refreshing=false;async function refresh(){if(refreshing||document.hidden)return;refreshing=true;try{const next=await loadOfficial();if(JSON.stringify(next)!==JSON.stringify(state)){state=next;render();}setStatus('Chave oficial · conferida às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+' · atualização automática a cada 30 s.');}catch{setStatus('Sem conexão para atualizar. Exibindo a última chave carregada.')}finally{refreshing=false}}
 document.getElementById('refreshOfficial').onclick=refresh;setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
}else if(!ADMIN){
 document.querySelector('.hero p').textContent='Sua chave, seus palpites. Edite os confrontos, escolha vencedores e compartilhe por link ou imagem.';
 setStatus('Sua chave fica salva neste navegador. Suas alterações não mudam os resultados oficiais.');
 document.getElementById('useOfficial').onclick=()=>{if(!confirm('Substituir sua chave pelos resultados oficiais atuais?'))return;state=structuredClone(official);undoStack.length=0;renderRoster();renderBuilder();render();toast('Chave oficial copiada. Continue seus palpites!')};
 document.getElementById('startBlank').onclick=()=>{if(!confirm('Começar uma chave vazia? A chave atual será substituída.'))return;state=initial();undoStack.length=0;renderRoster();renderBuilder();render()};
}else{
 let token='',publisher=null;
 onStateChange=current=>publisher?.changed(sanitize(current));
 const publish=document.getElementById('publishOfficial');
 const api='https://api.github.com/repos/nakataff/meus-projetos';
 const file='/contents/duelo-nacional/dados.json';
 async function request(path,options={}){const res=await fetch(api+path,{cache:'no-store',signal:AbortSignal.timeout(20000),...options,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});const body=await res.json();if(!res.ok)throw Error(res.status===401?'Token inválido ou expirado.':res.status===403?'Sem permissão. Use um token com Contents: Read and write apenas no repositório meus-projetos.':res.status===409?'Os resultados mudaram em outra sessão. Recarregue antes de publicar.':body.message||'Falha no GitHub.');return body}
 function decodeFile(data){return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\s/g,'')),c=>c.charCodeAt(0))))}
 function syncStatus(kind,error){
  publish.disabled=kind==='publishing';
  if(kind==='publishing')setStatus('Publicando resultado automaticamente…');
  else if(kind==='pending')setStatus('Alteração salva neste navegador · publicação automática em andamento…');
  else if(kind==='saved')setStatus('Resultado publicado automaticamente. A página pública consulta os resultados a cada 30 segundos.');
  else setStatus('Não publicado: '+error.message+' O rascunho está salvo neste navegador. Clique em Publicar agora para tentar novamente.');
 }
 document.getElementById('connectGithub').onclick=async()=>{
  const input=document.getElementById('githubToken');token=input.value.trim();input.value='';if(!token){setStatus('Informe um token do GitHub para entrar.');return}
  document.getElementById('connectGithub').disabled=true;
  try{
   setStatus('Validando acesso ao repositório…');const repo=await request('');if(!repo.permissions?.push)throw Error('Esta conta não tem permissão para publicar no repositório.');
   const data=await request(file+'?ref=main'),raw=decodeFile(data);official=sanitize(raw);state=structuredClone(official);renderRoster();renderBuilder();render();
   publisher=DueloCore.createPublisher({read:()=>request(file+'?ref=main'),write:async({state:snapshot,sha})=>{
    const payload={...snapshot,app:'Duelo Nacional MD3',version:4,updatedAt:new Date().toISOString()},bytes=new TextEncoder().encode(JSON.stringify(payload,null,2)+'\n');
    let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
    const saved=await request(file,{method:'PUT',body:JSON.stringify({message:'duelo: publicar resultado automaticamente',content:btoa(binary),sha,branch:'main'})});
    return {sha:saved.content.sha,updatedAt:payload.updatedAt};
   },onStatus:syncStatus,onCommitted:snapshot=>{official=structuredClone(snapshot)}});
   publisher.initialize({sha:data.sha,state:sanitize(state)});
   document.body.classList.remove('admin-locked');publish.disabled=false;document.getElementById('connectGithub').hidden=true;input.hidden=true;document.getElementById('disconnectGithub').hidden=false;
   setStatus('Conectado · publicação automática ativada. Clique no vencedor ou salve um duelo para publicar. O token fica apenas na memória desta aba.');
  }catch(e){token='';setStatus(e.message)}finally{document.getElementById('connectGithub').disabled=false}
 };
 publish.onclick=()=>publisher?.flush();
 document.getElementById('disconnectGithub').onclick=()=>{if(publisher?.hasPending()&&!confirm('Ainda há uma publicação pendente. Sair e manter apenas o rascunho neste navegador?'))return;publisher?.dispose();publisher=null;token='';document.body.classList.add('admin-locked');publish.disabled=true;document.getElementById('connectGithub').hidden=false;document.getElementById('githubToken').hidden=false;document.getElementById('disconnectGithub').hidden=true;setStatus('Sessão encerrada. O rascunho permanece neste navegador.')};
 window.addEventListener('beforeunload',e=>{if(publisher?.hasPending()){e.preventDefault();e.returnValue=''}});
 window.addEventListener('online',()=>publisher?.flush());
 setStatus('Entre com acesso de escrita ao repositório para editar e publicar os resultados.');
}

if(window.matchMedia('(min-width:801px)').matches){$('rosterPanel').classList.remove('collapsed')}
})();
