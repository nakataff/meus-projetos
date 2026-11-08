/* DE LA QUADRA — melhores marcas individuais em uma única partida. */
import {$,setupShared,asset,esc,logo,playerLink,gameLink,loadGames} from '../app.js?v=14';
import {GAME_RECORD_METRICS,gamePerformances,topSingleGames} from '../season-stats.mjs?v=20261103-records-v1';
import {fetchLiveBoxscore} from '../boxscore.js?v=2';
import {performanceRating} from '../performance-rating.js?v=3';
setupShared('records','Recordes da Temporada','Maiores atuações individuais em um único jogo da NBA 2026/27.');
const root=$('#pageContent'),params=new URLSearchParams(location.search);
let phase=params.get('fase')==='preseason'?'preseason':'regular';
let metric=GAME_RECORD_METRICS.some(([id])=>id===params.get('stat'))?params.get('stat'):'pts';
let dataset=null,players=null,games=new Map(),error='',initialAnchorHandled=false;
const recentFinals=new Map(),retryAt=new Map();
let snapshotPending=false,finalsPending=false,rescanFinals=false,checkedAt=0,signature='',retryTimer=null;
const headshot=id=>'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(id)+'.png';
const showDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Data não informada';
function format(v,key){return ['rating','min'].includes(key)?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}):Math.round(Number(v)||0).toLocaleString('pt-BR');}
function description(p){
 const g=games.get(p.gameId);
 if(!g)return '<span>Partida #'+esc(p.gameId)+'</span>';
 const opponent=g.away===p.team?g.home:g.away;
 const score=Number.isFinite(Number(g.scoreHome))&&Number.isFinite(Number(g.scoreAway))&&g.scoreHome!==null&&g.scoreAway!==null
  ?' · '+esc(g.away)+' '+esc(g.scoreAway)+' × '+esc(g.scoreHome)+' '+esc(g.home):'';
 return '<span>'+showDate(g.date)+' · contra '+esc(opponent||'adversário')+score+'</span>';
}
function player(p){
 return '<span class="records-player"><img src="'+headshot(p.id)+'" alt="" loading="lazy" onerror="this.style.opacity=.2">'+
 '<span><a href="'+esc(playerLink(p.id,p.team))+'"><strong>'+esc(p.name)+'</strong></a>'+
 '<small><img src="'+esc(logo(p.team))+'" alt="">'+esc(p.team)+(p.round?' · '+p.round+'º jogo do atleta':'')+'</small></span></span>';
}
function render(){
 if(!dataset||!players){root.innerHTML='<div class="filler">'+esc(error||'Carregando os recordes da temporada…')+'</div>';return;}
 const rows=recordPerformances();
 const leaderCards=GAME_RECORD_METRICS.map(([key,label,short])=>{
  const winner=topSingleGames(rows,key,1)[0];
  return '<button type="button" class="records-tile'+(key===metric?' is-active':'')+'" data-record-metric="'+key+'" aria-pressed="'+(metric===key)+'">'+
   '<span>'+esc(label)+'</span><b>'+(winner?format(winner[key],key):'—')+' <small>'+esc(short)+'</small></b>'+
   '<span class="records-tile-name">'+(winner?esc(winner.name):'Sem jogos')+'</span>'+
   '<span class="records-tile-jump" aria-hidden="true">Ver ranking ↓</span>'+
   (winner?'<img class="records-tile-photo" src="'+headshot(winner.id)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.opacity=.12">':'')+
   '</button>';
 }).join('');
 const selected=GAME_RECORD_METRICS.find(([id])=>id===metric),top=topSingleGames(rows,metric,20);
 let position=0;
 root.innerHTML='<div class="records-tools"><div class="leaders-phase" role="group" aria-label="Fase da temporada">'+
 '<button type="button" data-record-phase="regular" class="'+(phase==='regular'?'selected':'')+'">Temporada regular</button>'+
 '<button type="button" data-record-phase="preseason" class="'+(phase==='preseason'?'selected':'')+'">Pré-temporada</button></div>'+
 '<span class="subtle">'+rows.length.toLocaleString('pt-BR')+' atuações individuais • NBA 2026/27</span></div>'+
 '<div class="records-grid">'+leaderCards+'</div>'+
 '<div class="records-heading"><div><span class="caps">MARCAS EM UMA PARTIDA • '+esc(phase==='regular'?'TEMPORADA REGULAR':'PRÉ-TEMPORADA')+'</span>'+
 '<h2 id="ranking-recordes" tabindex="-1">Mais '+esc(selected[1].toLowerCase())+' em um jogo</h2></div><span class="subtle">Top 20 atuações</span></div>'+
 (top.length?'<div class="records-list">'+top.map((p,i)=>{
  const g=games.get(p.gameId);
  if(i===0||p[metric]!==top[i-1][metric])position=i+1;
  return '<article class="records-entry"><span class="records-place">'+position+'º</span>'+player(p)+
   '<div class="records-value"><strong>'+format(p[metric],metric)+'</strong><small>'+esc(selected[2])+'</small></div>'+
   '<div class="records-game">'+description(p)+(g?'<a href="'+esc(gameLink(g))+'">Ver jogo ↗</a>':'')+'</div></article>';
 }).join('')+'</div>':'<div class="filler">Ainda não há atuações registradas nesta fase.</div>')+
 '<p class="leaders-disclaimer">Os recordes consideram a estatística alcançada em uma única partida finalizada, sem exigência de mínimo de jogos. '+
 'Cada atuação aparece separadamente, mesmo que um atleta tenha vários jogos entre os melhores. NOTA DLQ é uma avaliação própria, não oficial da NBA. '+
 'Fonte: box scores de partidas finalizadas da ESPN.</p>';
}
function jumpToRecordRanking(smooth=true){
 const heading=$('#ranking-recordes');
 if(!heading)return;
 const reduceMotion=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(typeof heading.scrollIntoView==='function')heading.scrollIntoView({behavior:smooth&&!reduceMotion?'smooth':'auto',block:'start'});
 if(typeof heading.focus==='function')heading.focus({preventScroll:true});
}
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-record-metric]'),season=e.target.closest('[data-record-phase]');
 if(tab)metric=tab.dataset.recordMetric;
 else if(season)phase=season.dataset.recordPhase;
 else return;
 const url=new URL(location.href);
 url.searchParams.set('stat',metric);
 if(phase==='regular')url.searchParams.delete('fase');else url.searchParams.set('fase',phase);
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 render();
 if(tab)jumpToRecordRanking();
});
function phaseFor(event){
 return event.seasonType===1?'preseason':event.seasonType===2?'regular':null;
}
function recordPerformances(){
 const rows=gamePerformances(dataset[phase],players[phase]),seen=new Set(rows.map(p=>p.gameId+'|'+p.id));
 for(const {event,performances} of recentFinals.values()){
  if(phaseFor(event)!==phase)continue;
  for(const p of performances){
   const key=p.gameId+'|'+p.id;
   if(!seen.has(key)){rows.push(p);seen.add(key);}
  }
 }
 return rows;
}
function minutes(value){
 const [whole,seconds]=String(value??'').replace("'",'').split(':');
 return (Number(whole)||0)+(Number(seconds)||0)/60;
}
function madeAttempted(value){
 const match=String(value||'').match(/^(\d+)\s*-\s*(\d+)$/);
 return match?[Number(match[1]),Number(match[2])]:[0,0];
}
function fromFinal(event,result){
 if(result?.status!=='final')return null;
 const teams=[event.away,event.home].map(team=>[team,(result.box?.players?.[team]||[]).filter(p=>
  p.id&&p.name&&p.hasStats&&minutes(p.min)>0&&Number.isFinite(p.pts))]);
 if(teams.some(([,players])=>players.length<5))return null;
 return teams.flatMap(([team,players])=>players.map(p=>{
  const [fgm,fga]=madeAttempted(p.fg),[threeM,threeA]=madeAttempted(p.three);
  return {...p,id:String(p.id),gameId:String(event.id),team,round:0,min:minutes(p.min),
   fgm,fga,threeM,threeA,rating:performanceRating(p)};
 }));
}
function available(){return !document.hidden&&navigator.onLine;}
async function syncRecentRecords(){
 clearTimeout(retryTimer);retryTimer=null;
 if(!dataset||!available())return;
 if(finalsPending){rescanFinals=true;return;}
 const imported=new Set(['regular','preseason'].flatMap(p=>
  (dataset.countedGameIds?.[p]||dataset[p].map(row=>row[2])).map(String)));
 const missing=[...(window.QUADRA_LIVE_GAMES?.values()||[])].filter(event=>
  event.status==='final'&&phaseFor(event)&&!imported.has(String(event.id))&&!recentFinals.has(String(event.id)));
 const missingIds=new Set(missing.map(e=>String(e.id)));
 for(const id of retryAt.keys())if(!missingIds.has(id))retryAt.delete(id);
 const due=missing.filter(e=>Date.now()>=(retryAt.get(String(e.id))||0));
 finalsPending=true;
 let cursor=0;
 async function worker(){
  while(cursor<due.length&&available()){
   const event=due[cursor++],id=String(event.id);
   retryAt.set(id,Date.now()+30000);
   try{
    const result=await fetchLiveBoxscore(event),performances=fromFinal(event,result);
    if(!performances)continue;
    recentFinals.set(id,{event,performances});
    retryAt.delete(id);
    const previous=games.get(id);
    games.set(id,{...previous,...event,id:previous?.id||'espn_'+id,externalId:id,
     scoreAway:result.scoreAway??event.scoreAway,scoreHome:result.scoreHome??event.scoreHome});
    if(phaseFor(event)===phase&&!document.hidden)render();
   }catch(error){console.info('DLQ: box score recente ainda indisponível',id,error);}
  }
 }
 try{await Promise.all(Array.from({length:Math.min(3,due.length)},worker));}
 finally{
  finalsPending=false;
  const next=missing.filter(e=>!recentFinals.has(String(e.id))).map(e=>retryAt.get(String(e.id))||Date.now());
  if(rescanFinals){rescanFinals=false;queueMicrotask(syncRecentRecords);}
  else if(next.length&&available())retryTimer=setTimeout(syncRecentRecords,Math.max(1000,Math.min(...next)-Date.now()));
 }
}
async function fetchSnapshot(file){
 const response=await fetch(asset('data/'+file+'/2026-27.json'),{cache:'no-cache'});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response.json();
}
async function refreshSnapshot(){
 if(snapshotPending||(dataset&&Date.now()-checkedAt<120000))return;
 snapshotPending=true;checkedAt=Date.now();
 try{
  const [rounds,leaders,events]=await Promise.all([
   fetchSnapshot('player-rounds'),fetchSnapshot('player-leaders'),dataset?[]:loadGames()
  ]);
  if([rounds,leaders].some(data=>!Array.isArray(data.regular)||!Array.isArray(data.preseason)))throw Error('Estatísticas incompletas');
  for(const g of events)if(g.externalId||g.id)games.set(String(g.externalId||g.id),g);
  const next=JSON.stringify([rounds,leaders]),changed=next!==signature;
  dataset=rounds;players=leaders;signature=next;
  if(changed)render();
 }catch(e){
  console.warn('DLQ: falha ao carregar recordes',e);
  if(!dataset){error='Não foi possível carregar os recordes. Atualize a página para tentar novamente.';render();}
 }finally{snapshotPending=false;}
 if(dataset&&!initialAnchorHandled&&location.hash==='#ranking-recordes'){
  initialAnchorHandled=true;
  jumpToRecordRanking(false);
 }
 syncRecentRecords();
}
function resume(){
 if(!available())return;
 refreshSnapshot();
 syncRecentRecords();
}
window.addEventListener('quadra:live-update',resume);
window.addEventListener('online',resume);
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){clearTimeout(retryTimer);return;}
 resume();
});
window.addEventListener('pagehide',()=>clearTimeout(retryTimer));
refreshSnapshot();
