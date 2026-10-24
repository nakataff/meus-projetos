/* DE LA QUADRA • quadra 2D orientada pelos lances do play-by-play ESPN.
 * A visualização é ilustrativa; não rastreia as posições reais dos atletas.
 * Carregada apenas quando o usuário abre a aba Quadra 2D.
 */
const ESPN='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
const ACTIVE_MS=5000,PRE_GAME_MS=30000,MAX_LOG=24;
const ALIASES={GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',PHO:'PHX',UTAH:'UTA',WSH:'WAS'};
const code=s=>ALIASES[String(s||'').toUpperCase()]||String(s||'').toUpperCase();
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
export const eventId=game=>String(game?.externalId||String(game?.id||'').replace(/^espn_/,''));
export function normalizeCourtPlays(payload,game){
 const list=Array.isArray(payload?.plays)?payload.plays:
  Array.isArray(payload?.plays?.all)?payload.plays.all:
  Array.isArray(payload?.plays?.plays)?payload.plays.plays:
  Array.isArray(payload?.playByPlay)?payload.playByPlay:[];
 const participants=payload?.header?.competitions?.[0]?.competitors||[];
 const teamLookup=new Map(participants.map(c=>[String(c.team?.id),code(c.team?.abbreviation)]));
 const seen=new Set(),normalized=[];
 for(let i=0;i<list.length;i++){
  const p=list[i];if(!p||typeof p!=='object')continue;
  const pid=String(p.id??p.playId??p.sequenceNumber??p.order??'event-'+i);
  if(seen.has(pid))continue;seen.add(pid);
  const period=Number(p.period?.number??p.period??0);
  const clock=String(p.clock?.displayValue??p.clock?.display??p.clock??'').trim();
  const team=code(p.team?.abbreviation||p.team?.shortDisplayName||
    teamLookup.get(String(p.team?.id??p.teamId??''))||p.teamAbbreviation||'');
  const text=String(p.text||p.description||p.shortText||p.type?.text||'Lance registrado').trim();
  const rawType=String(p.type?.text||p.type?.name||'').toLowerCase();
  const phrase=(rawType+' '+text).toLowerCase();
  let kind='other';
  if(/(timeout|time.?out|tempo t[eé]cnico)/i.test(phrase))kind='timeout';
  else if(/(end of|end period|end quarter|end of quarter|fim do|period ends|end of game)/i.test(phrase))kind='period';
  else if(/(turnover|lost ball|violat(?:ion|ions))/i.test(phrase))kind='turnover';
  else if(/(block(?:ed)?|blocks)/i.test(phrase))kind='block';
  else if(/(steal|steals|roubo)/i.test(phrase))kind='steal';
  else if(/(foul|falta)/i.test(phrase))kind='foul';
  else if(/(rebound|rebote)/i.test(phrase))kind='rebound';
  else if(/(free throw|lance livre)/i.test(phrase))kind='freethrow';
  else if(/(3-pt|3-point|three.point|three pointer|3pt|3 pt)/i.test(phrase))kind='three';
  else if(p.shootingPlay||p.scoringPlay||/(2-pt|2-point|layup|jump shot|dunk|tip shot|hook shot|field goal|arremesso)/i.test(phrase))kind='shot';
  // Alguns registros ESPN informam scoringPlay sem uma descrição precisa.
  if(kind==='other'&&p.scoringPlay)kind='shot';
  const made=/(made|makes|hits|good|sinks|converts)/i.test(phrase)||
   (p.scoringPlay===true && !/(missed|misses|no good)/i.test(phrase));
  const missed=/(missed|misses|no good|blocked shot)/i.test(phrase);
  const x=numeric(p.coordinate?.x??p.coordinates?.x??p.coordinateX??p.coordinate_x);
  const y=numeric(p.coordinate?.y??p.coordinates?.y??p.coordinateY??p.coordinate_y);
  const rawPoints=numeric(p.scoreValue??p.pointsAttempted??p.points);
  normalized.push({id:pid,period,clock,text,team:team===game?.away||team===game?.home?team:'',
   kind,made:!!made,missed:!!missed,
   points:kind==='three'?3:kind==='freethrow'?1:(rawPoints===2||rawPoints===3?rawPoints:2),
   scoreAway:numeric(p.awayScore),scoreHome:numeric(p.homeScore),
   // Coordenadas não são sempre preenchidas nem seguem a mesma convenção.
   coordinates:x!==null&&y!==null?{x,y}:null});
 }
 return normalized;
}
function courtHTML(game){
 const away=escape(game.away||'VIS'),home=escape(game.home||'CAS');
 return '<section class="court-panel" aria-label="Visualização dos lances em uma quadra 2D">'+
 '<div class="court-panel-head"><div><span class="eyebrow">ACOMPANHAR PARTIDA</span>'+
 '<h2>Quadra 2D <span class="court-source-badge">ESPN • LANCES</span></h2>'+
 '<p>Representação visual dos lances registrados, não da movimentação real dos jogadores.</p></div>'+
 '<div class="court-panel-actions"><span id="courtFeedState" class="court-feed-state">Conectando…</span>'+
 '<button type="button" class="btn ghost" id="courtRefresh">↻ Atualizar</button></div></div>'+
 '<div class="court-viewport"><div class="court-board"><div class="court-board-teams"><span class="court-team-away"><span>'+away+'</span><strong id="courtAwayScore" aria-label="Pontos de '+away+'">—</strong>'+
 '</span><span id="courtPeriod">AGUARDANDO LANCES</span><span class="court-team-home"><strong id="courtHomeScore" aria-label="Pontos de '+home+'">—</strong><span>'+home+'</span></span></div>'+
 '<svg class="court-svg" viewBox="0 0 940 500" role="img" aria-label="Quadra estilizada vista de cima. Movimento ilustrativo conforme o tipo de lance." xmlns="http://www.w3.org/2000/svg">'+
 '<defs><linearGradient id="courtWood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bc8950"/><stop offset="1" stop-color="#a87541"/></linearGradient></defs>'+
 '<rect x="5" y="5" width="930" height="490" rx="12" fill="url(#courtWood)" stroke="#e9cea8" stroke-width="8"/>'+
 '<path d="M470 5 V495" stroke="#f6e4c5" stroke-width="4"/><circle cx="470" cy="250" r="76" fill="none" stroke="#f6e4c5" stroke-width="4"/>'+
 '<rect x="5" y="136" width="180" height="228" fill="#956334" fill-opacity=".65" stroke="#f6e4c5" stroke-width="4"/>'+
 '<rect x="755" y="136" width="180" height="228" fill="#956334" fill-opacity=".65" stroke="#f6e4c5" stroke-width="4"/>'+
 '<circle cx="185" cy="250" r="71" fill="none" stroke="#f6e4c5" stroke-width="4"/>'+
 '<circle cx="755" cy="250" r="71" fill="none" stroke="#f6e4c5" stroke-width="4"/>'+
 '<path d="M5 35 A275 275 0 0 1 5 465 M935 35 A275 275 0 0 0 935 465" stroke="#f6e4c5" stroke-width="4" fill="none"/>'+
 '<path d="M45 210 V290 M895 210 V290" stroke="#f6e4c5" stroke-width="6"/>'+
 '<circle cx="75" cy="250" r="12" fill="none" stroke="#fff3dd" stroke-width="5"/>'+
 '<circle cx="865" cy="250" r="12" fill="none" stroke="#fff3dd" stroke-width="5"/>'+
 '<line id="courtPassTrail" x1="470" y1="250" x2="470" y2="250" stroke="#ffeb96" stroke-width="5" stroke-dasharray="13 9" opacity="0"/>'+
 '<circle id="courtActionHalo" cx="470" cy="250" r="40" fill="#ffedac" opacity=".22"/>'+
 '<circle id="courtBall" cx="470" cy="250" r="17" fill="#ed892b" stroke="#683b1d" stroke-width="4"/>'+
 '<path id="courtBallSeam" d="M454 250h32 M470 234v32" stroke="#683b1d" stroke-width="2" fill="none"/>'+
 '</svg>'+
 '<div class="court-event-overlay" id="courtEventOverlay"><strong>Preparando quadra…</strong><span>Os lances aparecerão aqui</span></div></div>'+
 '<button type="button" class="court-fullscreen-toggle" id="courtFullscreen" aria-pressed="false" aria-label="Abrir quadra em tela cheia">⛶ Tela cheia</button></div>'+
 '<div class="court-latest"><div><span class="caps">ÚLTIMO LANCE</span><strong id="courtLatestTitle">Aguardando dados</strong>'+
 '<span id="courtLatestMeta">Quadra pronta para acompanhar</span></div>'+
 '<span id="courtLatestBadge" class="court-event-badge">—</span></div>'+
 '<div class="court-timeline-header"><h3>Lances da partida</h3><div><span id="courtLogCount" class="small subtle"></span>'+
 '<button id="courtLiveReturn" class="btn ghost" type="button">Ir ao mais recente ↗</button></div></div>'+
 '<div id="courtTimeline" class="court-timeline"><div class="filler">Consultando histórico de lances…</div></div>'+
 '<button id="courtLoadMore" type="button" class="btn ghost court-load-more" hidden>Ver mais lances ↓</button>'+
 '<p class="court-disclaimer">Atualização por consulta à ESPN. Pode haver atraso, correções e eventos sem coordenadas.'+
 ' A origem de arremessos usa as coordenadas da ESPN quando disponíveis; outras posições e trajetórias são ilustrativas.'+
 ' Não reproduz o movimento real dos atletas.'+
 ' As consultas detalhadas param ao sair desta aba.</p></section>';
}
function labelFor(p){
 switch(p.kind){
  case 'three':return p.made?'CESTA DE 3!':p.missed?'ARREMESSO DE 3 ERRADO':'ARREMESSO DE 3';
  case 'shot':return p.made?'CESTA DE 2!':p.missed?'ARREMESSO ERRADO':'ARREMESSO';
  case 'freethrow':return p.made?'LANCE LIVRE CONVERTIDO':p.missed?'LANCE LIVRE ERRADO':'LANCE LIVRE';
  case 'rebound':return 'REBOTE';
  case 'foul':return 'FALTA';
  case 'turnover':return 'PERDA DE POSSE';
  case 'steal':return 'ROUBO DE BOLA';
  case 'block':return 'TOCO';
  case 'timeout':return 'TEMPO TÉCNICO';
  case 'period':return 'FIM DO PERÍODO';
  default:return 'LANCE REGISTRADO';
 }
}
function positionFor(play,game){
 const left=play.team===game.home;
 const hoop=left?75:865;
 const direction=left?1:-1;
 // A ESPN normaliza arremessos no mesmo aro: X=largura da quadra (0..50 pés),
 // Y=distância do aro rumo ao meio (aprox. -1..31 pés). Ignorar sentinelas.
 // A quadra virtual escolhe lados ilustrativos; a origem de um arremesso, quando
 // informada, reflete o ponto do evento e não o tracking do atleta.
 const xy=play.coordinates;
 if(['shot','three'].includes(play.kind)&&xy&&
   xy.x>=0&&xy.x<=50&&xy.y>=-1&&xy.y<=34){
  return {x:Math.max(15,Math.min(925,hoop+direction*Math.max(0,xy.y)*10)),
   y:Math.max(12,Math.min(488,250+(xy.x-25)*9.5)),hoop};
 }
 const key=String(play.id).split('').reduce((n,c)=>n+c.charCodeAt(0),0);
 const delta=(key%90)-45;
 switch(play.kind){
  case 'three':return {x:hoop+direction*260,y:250+delta*2,hoop};
  case 'freethrow':return {x:hoop+direction*165,y:250,hoop};
  case 'shot':return {x:hoop+direction*(90+key%120),y:250+delta*2.3,hoop};
  case 'rebound':return {x:hoop+direction*65,y:250+delta,hoop};
  case 'steal':case 'turnover':return {x:470+delta*2,y:250+delta,hoop};
  case 'foul':case 'block':return {x:hoop+direction*150,y:250+delta,hoop};
  default:return {x:470+delta,y:250+delta,hoop};
 }
}
export function mountCourtTracker({element,game,getStatus,onSummary}){
 if(!element||!game)throw Error('Quadra 2D exige elemento e partida');
 const id=eventId(game);
 element.innerHTML=courtHTML(game);
 const $=selector=>element.querySelector(selector);
 const state={destroyed:false,pending:null,timer:null,playTimer:null,plays:[],known:new Set(),
   queue:[],processing:false,initial:true,limit:MAX_LOG,lastSeen:null,status:getStatus()?.status||'scheduled',failures:0,replay:null,fallback:false};
 const refs={feed:$('#courtFeedState'),period:$('#courtPeriod'),ball:$('#courtBall'),
   seam:$('#courtBallSeam'),halo:$('#courtActionHalo'),trail:$('#courtPassTrail'),
   latest:$('#courtLatestTitle'),meta:$('#courtLatestMeta'),badge:$('#courtLatestBadge'),
   overlay:$('#courtEventOverlay'),timeline:$('#courtTimeline'),count:$('#courtLogCount'),
   more:$('#courtLoadMore'),awayScore:$('#courtAwayScore'),homeScore:$('#courtHomeScore'),viewport:$('.court-viewport'),fullscreen:$('#courtFullscreen')};
 function statusText(message,kind=''){
  refs.feed.className='court-feed-state '+(kind?'is-'+kind:'');
  refs.feed.textContent=message;
 }
 function syncScore(){
  const current=getStatus()||game,play=state.replay;
  const away=numeric(play?.scoreAway)??numeric(current.scoreAway),home=numeric(play?.scoreHome)??numeric(current.scoreHome);
  refs.awayScore.textContent=away===null?'—':String(away);
  refs.homeScore.textContent=home===null?'—':String(home);
  if(!play&&current.status==='final')refs.period.textContent='FINAL';
 }
 function fullscreenState(){
  const active=document.fullscreenElement===refs.viewport||state.fallback;
  refs.fullscreen.textContent=active?'✕ Sair da tela cheia':'⛶ Tela cheia';
  refs.fullscreen.setAttribute('aria-pressed',String(active));
  refs.fullscreen.setAttribute('aria-label',active?'Sair da tela cheia':'Abrir quadra em tela cheia');
 }
 function fallbackFullscreen(active){state.fallback=active;refs.viewport.classList.toggle('court-is-fullscreen',active);document.body.classList.toggle('court-fullscreen-open',active);fullscreenState();}
 async function toggleFullscreen(){
  if(state.fallback){fallbackFullscreen(false);return;}
  if(document.fullscreenElement===refs.viewport){try{await document.exitFullscreen();}catch{}fullscreenState();return;}
  if(refs.viewport.requestFullscreen){try{await refs.viewport.requestFullscreen();if(state.destroyed){if(document.fullscreenElement===refs.viewport)await document.exitFullscreen?.();return;}fullscreenState();return;}catch{}}
  if(!state.destroyed)fallbackFullscreen(true);
 }
 function fullscreenKey(e){if(e.key==='Escape'&&state.fallback){e.preventDefault();fallbackFullscreen(false);}}
 function showPlay(play,animate=true,replay=false){
  if(state.destroyed||!element.isConnected)return;
  state.replay=replay?play:null;
  syncScore();
  const x=positionFor(play,game);
  const oldX=Number(refs.ball.getAttribute('cx'))||470;
  const oldY=Number(refs.ball.getAttribute('cy'))||250;
  const placeX=play.kind==='period'||play.kind==='timeout'?470:x.x;
  const placeY=play.kind==='period'||play.kind==='timeout'?250:x.y;
  refs.period.textContent=(replay?'REPLAY · ':'')+(play.period?(play.period>4?'PRORROGAÇÃO':play.period+'º QUARTO')+' • '+(play.clock||'—'):'LANCE RECENTE');
  if(!replay&&getStatus()?.status==='final')refs.period.textContent='FINAL';
  refs.latest.textContent=play.text;
  refs.meta.textContent=(play.team?play.team+' • ':'')+(play.period?play.period+'º período • ':'')+(play.clock||'');
  refs.badge.textContent=labelFor(play);
  refs.badge.className='court-event-badge court-kind-'+play.kind+(play.made?' court-scored':'');
  refs.overlay.innerHTML='<strong>'+escape(labelFor(play))+'</strong><span>'+escape(play.team||'NBA')+'</span>';
  refs.overlay.classList.remove('court-event-flash');void refs.overlay.offsetWidth;
  if(animate)refs.overlay.classList.add('court-event-flash');
  for(const circle of [refs.ball,refs.halo]){
   circle.style.transition=animate?'cx .75s ease-out, cy .75s ease-out, opacity .4s':'none';
   circle.setAttribute('cx',placeX);circle.setAttribute('cy',placeY);
  }
  refs.seam.setAttribute('d','M'+(placeX-16)+' '+placeY+' h32 M'+placeX+' '+(placeY-16)+' v32');
  const shooting=['shot','three','freethrow'].includes(play.kind);
  refs.trail.setAttribute('x1',oldX);refs.trail.setAttribute('y1',oldY);
  refs.trail.setAttribute('x2',shooting?x.hoop:placeX);refs.trail.setAttribute('y2',shooting?250:placeY);
  refs.trail.setAttribute('opacity',shooting?'0.85':'0');
  refs.ball.setAttribute('fill',play.team===game.home?'#3a9cc7':'#f39236');
  refs.halo.setAttribute('fill',play.made?'#91f4aa':'#ffedac');
 }
 function updateLog(){
  if(state.destroyed)return;
  const reversed=state.plays.slice().reverse();
  const visible=reversed.slice(0,state.limit);
  refs.count.textContent=state.plays.length+' registros';
  refs.timeline.innerHTML=visible.length?visible.map(p=>{
   const rank=state.plays.indexOf(p);
   return '<button type="button" class="court-log-item" data-court-index="'+rank+'">'+
    '<span class="court-log-time">'+(p.period?escape(p.period+'º Q'):'—')+'<small>'+escape(p.clock||'')+'</small></span>'+
    '<span class="court-log-body"><strong>'+escape(labelFor(p))+(p.team?' • '+escape(p.team):'')+'</strong>'+
    '<small>'+escape(p.text)+'</small></span><span aria-hidden="true" class="court-log-replay">↻</span></button>';
  }).join(''):'<div class="court-no-plays">Nenhum lance detalhado publicado para esta partida ainda.</div>';
  refs.more.hidden=state.plays.length<=state.limit;
 }
 function runQueue(){
  if(state.destroyed||state.processing||!state.queue.length)return;
  if(document.hidden){state.queue=[];return;}
  state.processing=true;
  function step(){
   if(state.destroyed){state.processing=false;return;}
   const play=state.queue.shift();
   if(!play){state.processing=false;return;}
   showPlay(play,true);
   state.playTimer=setTimeout(step,Math.max(850,Math.min(1450,1500-state.queue.length*120)));
  }
  step();
 }
 function ingest(plays){
  if(state.destroyed)return;
  if(!Array.isArray(plays))return;
  const fresh=plays.filter(p=>!state.known.has(p.id));
  for(const p of plays)state.known.add(p.id);
  // Não apagar lances já conhecidos se a API devolver uma resposta parcial.
  if(!plays.length&&state.plays.length)return;
  state.plays=plays;
  updateLog();
  if(state.initial){
   state.initial=false;
   if(plays.length)showPlay(plays.at(-1),false);
   return;
  }
  if(fresh.length){
   // Em caso de reconexão ou correção de muitos lances, priorizar os recentes.
   state.queue.push(...fresh.slice(-8));
   if(state.queue.length>12)state.queue=state.queue.slice(-12);
   runQueue();
  }
 }
 function schedule(ms){
  clearTimeout(state.timer);
  if(!ms||state.destroyed||document.hidden)return;
  state.timer=setTimeout(poll,ms);
 }
 async function poll(){
  if(state.destroyed||document.hidden||!navigator.onLine)return;
  if(state.pending)return;
  const current=getStatus()?.status||state.status;
  if(current==='final'&&state.initial===false){statusText('PARTIDA ENCERRADA','final');return;}
  const controller=new AbortController();
  state.pending=controller;
  const timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(ESPN+'?event='+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('HTTP '+response.status);
   const payload=await response.json();
   if(state.destroyed)return;
   state.failures=0;
   if(typeof onSummary==='function')onSummary(payload);
   syncScore();
   const plays=normalizeCourtPlays(payload,game);
   ingest(plays);
   state.status=getStatus()?.status||current;
   if(state.status==='final')statusText('PARTIDA ENCERRADA','final');
   else if(state.status==='live')statusText('AO VIVO • 5s','live');
   else statusText('AGUARDANDO INÍCIO','waiting');
   if(!plays.length){
    refs.latest.textContent=state.status==='scheduled'?'Aguardando início da partida':'Aguardando lances detalhados';
    refs.meta.textContent='A ESPN ainda não disponibilizou eventos';
   }
  }catch(error){
   if(state.destroyed)return;
   state.failures++;
   console.info('DLQ Quadra 2D: eventos ESPN indisponíveis',error);
   statusText('SEM ATUALIZAÇÃO','error');
   if(!state.plays.length){
    refs.latest.textContent='Não foi possível carregar os lances';
    refs.meta.textContent='Confira sua conexão ou tente atualizar';
   }
  }finally{
   clearTimeout(timeout);
   if(state.pending===controller)state.pending=null;
   if(state.destroyed)return;
   const currentStatus=getStatus()?.status||state.status;
   // Reduz a frequência após falhas: evita disparar requisições em cascata.
   const period=currentStatus==='live'?ACTIVE_MS:currentStatus==='scheduled'?PRE_GAME_MS:0;
   schedule(state.failures?Math.max(15000*Math.min(state.failures,4),period):period);
  }
 }
 function refresh(){clearTimeout(state.timer);if(!state.pending)poll();}
 function onClick(e){
  const item=e.target.closest('[data-court-index]');
  if(item){
   const p=state.plays[Number(item.dataset.courtIndex)];
   if(p)showPlay(p,true,true);return;
  }
  if(e.target.closest('#courtLoadMore')){state.limit+=24;updateLog();return;}
  if(e.target.closest('#courtFullscreen')){toggleFullscreen();return;}
  if(e.target.closest('#courtLiveReturn')){
   state.replay=null;syncScore();state.queue=[];if(state.plays.length)showPlay(state.plays.at(-1),true);return;
  }
  if(e.target.closest('#courtRefresh')){refresh();return;}
 }
 function visible(){if(document.hidden){clearTimeout(state.timer);state.pending?.abort();state.queue=[];}else refresh();}
 function online(){refresh();}
 element.addEventListener('click',onClick);
 document.addEventListener('visibilitychange',visible);
 document.addEventListener('fullscreenchange',fullscreenState);
 document.addEventListener('keydown',fullscreenKey);
 syncScore();
 window.addEventListener('online',online);
 if(!/^\d{7,15}$/.test(id)){
  statusText('IDENTIFICADOR INVÁLIDO','error');
  refs.timeline.innerHTML='<div class="court-no-plays">Partida sem identificador ESPN válido.</div>';
 }else poll();
 return {destroy(){
  state.destroyed=true;fallbackFullscreen(false);
  if(document.fullscreenElement===refs.viewport)document.exitFullscreen?.().catch(()=>{});
  clearTimeout(state.timer);clearTimeout(state.playTimer);
  state.pending?.abort();state.queue=[];
  element.removeEventListener('click',onClick);
  document.removeEventListener('visibilitychange',visible);
  document.removeEventListener('fullscreenchange',fullscreenState);
  document.removeEventListener('keydown',fullscreenKey);
  window.removeEventListener('online',online);
 },refresh,syncScore};
}
