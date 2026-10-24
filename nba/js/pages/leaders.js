/* DE LA QUADRA — ranking de atletas gerado a partir dos box scores finalizados. */
import {$,setupShared,asset,currentDate,dayShift,TEAMS,name,logo,esc,playerLink,getData,modify,toast} from '../app.js?v=13';
import {openPlayerCardComposer} from '../share-card.js?v=20261024-compare-v1';
import {mountPlayerActions,openPlayerComparison} from '../player-actions.js?v=20261024-compare-v1';
import {fetchLiveBoxscore} from '../boxscore.js?v=2';
import {performanceRating} from '../performance-rating.js?v=2';
setupShared('leaders','Melhores jogadores','Ranking de jogadores da NBA por médias e NOTA DLQ, com filtros de temporada e equipe.');
const root=$('#pageContent');
const metrics=[
 ['pts','Pontos','PTS / JOGO'],
 ['reb','Rebotes','REB / JOGO'],
 ['ast','Assistências','AST / JOGO'],
 ['rating','NOTA DLQ','NOTA DLQ'],
 ['stl','Roubos','ROUBOS / JOGO'],
 ['blk','Tocos','TOCOS / JOGO'],
 ['threeM','Bolas de 3','3PT / JOGO'],
 ['fgpct','Aproveit. FG','FG %'],
 ['threepct','Aproveit. 3PT','3PT %'],
 ['min','Minutos','MIN / JOGO']
];
const metricName=Object.fromEntries(metrics.map(([id,label])=>[id,label]));
const isAverageOnly=key=>['rating','fgpct','threepct'].includes(key);
const query=new URLSearchParams(location.search);
const valid=new Set(metrics.map(x=>x[0]));
let metric=valid.has(query.get('stat'))?query.get('stat'):'pts';
let phase=query.get('fase')==='preseason'?'preseason':'regular';
const requestedTeams=(query.get('times')||query.get('time')||'').split(',');
let selectedTeams=new Set(requestedTeams.filter(code=>Object.hasOwn(TEAMS,code)));
let valueMode=query.get('modo')==='total'?'total':'average';
let selectedRounds=new Set(
 (query.get('rodadas')||'').split(',').filter(x=>/^\d+$/.test(x)&&Number(x)>0&&Number(x)<=82).map(Number)
),roundData=null,roundPromise=null,roundError='',openFilter='';
let lastRoundRefresh=0;
let minimum=1,search='',followingOnly=false,limit=30,board=null;
let refreshPending=false,lastDataSignature='',recentSyncPending=false,lastRecentScan=0;
const recentFinals=new Map(),finalAttempts=new Map();
const FINAL_RETRY_MS=10000,FINAL_FAST_ATTEMPTS=6;
let recentRetryTimer=null;
const n=v=>Number(v)||0,round=v=>Math.round(v*10)/10;
const avg=(p,key)=>n(p.gp)?n(p[key])/n(p.gp):0;
function metricValue(p,key=metric){
 if(key==='rating')return p.ratingGames?n(p.ratingSum)/p.ratingGames:null;
 if(key==='fgpct')return p.fga?100*n(p.fgm)/p.fga:null;
 if(key==='threepct')return p.threeA?100*n(p.threeM)/p.threeA:null;
 return valueMode==='total'?n(p[key]):avg(p,key);
}
function qualifies(p){
 if(!p.gp||p.gp<minimum)return false;
 if(selectedTeams.size&&!selectedTeams.has(p.team))return false;
 if(search&&!String(p.name).toLocaleLowerCase('pt-BR').includes(search))return false;
 if(followingOnly&&!getData().extras.players?.[p.id]?.favorite)return false;
 if(metric==='rating'&&!p.ratingGames)return false;
 // Porcentagens de um único arremesso não devem dominar o ranking.
 if(metric==='fgpct'&&p.fga<Math.max(3,p.gp*3))return false;
 if(metric==='threepct'&&p.threeA<Math.max(2,p.gp*2))return false;
 return metricValue(p)!==null;
}
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const minutes=v=>{
 const val=String(v??'').replace(/'/g,'').trim();
 if(!val||val==='—')return 0;
 if(/^\d+:\d+$/.test(val)){
  const [m,seconds]=val.split(':').map(Number);
  return m+seconds/60;
 }
 return num(val);
};
function shot(value){
 const match=String(value||'').match(/^(\d+)\s*-\s*(\d+)$/);
 return match?[Number(match[1]),Number(match[2])]:[0,0];
}
function phaseFor(event){
 if(event.seasonType===1)return 'preseason';
 if(event.seasonType===2)return 'regular';
 return null;
}
function alreadyCounted(event,phaseName){
 const ids=board?.countedGameIds?.[phaseName];
 // Compatibilidade com versões anteriores ao campo countedGameIds.
 if(!Array.isArray(ids))return event.date<=String(board?.lastGameDate||'');
 return ids.includes(String(event.id));
}
function mergedRows(phaseName=phase){
 const map=new Map((board?.[phaseName]||[]).map(p=>[String(p.id),{...p}]));
 for(const record of recentFinals.values()){
  if(record.phase!==phaseName||alreadyCounted(record.event,phaseName))continue;
  for(const {athlete,team:code} of record.athletes){
   const id=String(athlete.id||'');
   if(!id)continue;
   const row=map.get(id)||{id,name:athlete.name,team:code,lastDate:'',gp:0,pts:0,reb:0,ast:0,
    stl:0,blk:0,to:0,min:0,fgm:0,fga:0,threeM:0,threeA:0,ratingSum:0,ratingGames:0};
   if(record.event.date>=row.lastDate){
    row.lastDate=record.event.date;row.team=code;row.name=athlete.name;
   }
   row.gp+=1;row.min+=minutes(athlete.min);
   for(const key of ['pts','reb','ast','stl','blk','to'])row[key]+=num(athlete[key]);
   const [fgm,fga]=shot(athlete.fg),[tm,ta]=shot(athlete.three);
   row.fgm+=fgm;row.fga+=fga;row.threeM+=tm;row.threeA+=ta;
   const rating=performanceRating(athlete);
   if(rating!==null){row.ratingSum+=rating;row.ratingGames++;}
   map.set(id,row);
  }
 }
 return [...map.values()];
}
/* Rodada N é a N-ésima partida de CADA atleta na fase. Carregar o
 * arquivo compacto somente quando um filtro de rodadas for selecionado.
 * Tupla: id, rodada, jogo, time, pts, reb, ast, stl, blk, to,
 *        minutos, fgm, fga, 3pm, 3pa, nota. */
function roundMax(){
 return mergedRows().reduce((max,p)=>Math.max(max,p.gp||0),0);
}
const teamCodes=Object.keys(TEAMS).sort((a,b)=>name(a).localeCompare(name(b),'pt-BR'));
function filterOptions(type){
 const rounds=type==='rounds',selected=rounds?selectedRounds:selectedTeams;
 const max=rounds?roundMax():teamCodes.length;
 const all=!selected.size;
 const title=rounds?'Rodadas':'Equipe';
 const label=all?(rounds?'Todas ('+max+')':'Toda a liga'):
  rounds?([...selected].sort((a,b)=>a-b).join(', ')):
  selected.size===1?name([...selected][0]):selected.size+' equipes selecionadas';
 const options=rounds?Array.from({length:max},(_,i)=>({
  value:i+1,text:'Rodada '+(i+1),desc:(i+1)+'º jogo de cada atleta'
 })):teamCodes.map(code=>({value:code,text:name(code),desc:code}));
 return '<div class="leaders-select-field"><span class="leaders-select-label">'+title+'</span>'+
 '<details class="leaders-select-dropdown" data-leaders-filter="'+type+'"'+
 (openFilter===type?' open':'')+'>'+
 '<summary aria-label="Escolher '+title.toLowerCase()+'"><span class="leaders-select-value">'+esc(label)+'</span>'+
 '<span class="leaders-select-chevron" aria-hidden="true">⌄</span></summary>'+
 '<div class="leaders-select-menu">'+
 '<label class="leaders-select-option leaders-select-all"><input type="checkbox" data-leaders-'+
 (rounds?'round':'team')+'-all'+(all?' checked':'')+(max?'':' disabled')+'>'+
 '<strong>'+(rounds?'Todas':'Toda a liga')+'</strong><small>'+max+
 (rounds?' disponíveis':' equipes')+'</small></label>'+
 (options.length?options.map(opt=>
 '<div class="leaders-select-option"><label class="leaders-select-choice">'+
 '<input type="checkbox" data-leaders-'+(rounds?'round':'team')+'="'+opt.value+'"'+
 (selected.has(opt.value)?' checked':'')+'>'+
 '<span><strong>'+esc(opt.text)+'</strong>'+
 '<small>'+esc(opt.desc)+'</small></span></label>'+
 '<button type="button" class="leaders-select-only" data-leaders-'+
 (rounds?'only':'only-team')+'="'+opt.value+'" aria-label="Selecionar somente '+esc(opt.text)+'">Somente</button></div>'
 ).join(''):'<p class="small subtle leaders-select-empty">Nenhuma opção disponível.</p>')+
 '</div></details></div>';
}
function emptyRow(id,teamCode,nameStr){
 return {id,name:nameStr||'Jogador',team:teamCode,lastDate:'',gp:0,
  pts:0,reb:0,ast:0,stl:0,blk:0,to:0,min:0,fgm:0,fga:0,
  threeM:0,threeA:0,ratingSum:0,ratingGames:0};
}
function addRoundRow(map,base,row){
 // Preserva nome e último time do ranking consolidado, mesmo que o atleta
 // tenha mudado de franquia entre as rodadas selecionadas.
 const [id,,gameId,teamCode,pts,reb,ast,stl,blk,tov,mins,fgm,fga,threeM,threeA,rating]=row;
 let current=map.get(String(id));
 if(!current){
  const reference=base.get(String(id));
  current=emptyRow(String(id),reference?.team||teamCode,reference?.name);
  map.set(String(id),current);
 }
 for(const [field,value] of Object.entries({pts,reb,ast,stl,blk,to:tov,min:mins,fgm,fga,threeM,threeA}))
  current[field]+=Number(value)||0;
 current.gp++;
 if(rating!==null&&rating!==undefined){
  current.ratingSum+=Number(rating)||0;current.ratingGames++;
 }
}
function roundRows(){
 if(!selectedRounds.size)return mergedRows();
 if(!roundData)return [];
 const base=new Map(mergedRows().map(p=>[String(p.id),p]));
 const output=new Map(),all=roundData[phase]||[];
 const counts=new Map();
 for(const tuple of all){
  const pid=String(tuple[0]);
  counts.set(pid,Math.max(counts.get(pid)||0,Number(tuple[1])||0));
  if(selectedRounds.has(Number(tuple[1])))addRoundRow(output,base,tuple);
 }
 // Complementar os jogos recém-encerrados que ainda não foram para o JSON.
 const counted=new Set(roundData.countedGameIds?.[phase]||[]);
 const latest=[...recentFinals.values()].filter(r=>r.phase===phase&&!counted.has(String(r.event.id)))
  .sort((a,b)=>String(a.event.date||'').localeCompare(String(b.event.date||''))||
   String(a.event.id).localeCompare(String(b.event.id)));
 for(const record of latest){
  for(const {athlete,team:teamCode} of record.athletes){
   const id=String(athlete.id);
   const gameNo=(counts.get(id)||0)+1;counts.set(id,gameNo);
   if(!selectedRounds.has(gameNo))continue;
   const [fgm,fga]=shot(athlete.fg),[thm,tha]=shot(athlete.three);
   const rating=performanceRating(athlete);
   addRoundRow(output,base,[id,gameNo,record.event.id,teamCode,
    num(athlete.pts),num(athlete.reb),num(athlete.ast),num(athlete.stl),num(athlete.blk),
    num(athlete.to),minutes(athlete.min),fgm,fga,thm,tha,rating]);
  }
 }
 return [...output.values()];
}
async function loadRoundData(force=false){
 if(!selectedRounds.size)return;
 if(roundPromise)return roundPromise;
 if(roundData&&!force&&Date.now()-lastRoundRefresh<60000)return;
 roundError='';
 roundPromise=(async()=>{
  try{
   const response=await fetch(asset('data/player-rounds/2026-27.json'),{cache:'no-store'});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!Array.isArray(data.regular)||!Array.isArray(data.preseason))
    throw Error('Arquivo de rodadas incompleto');
   roundData=data;lastRoundRefresh=Date.now();roundError='';
  }catch(err){
   console.warn('DLQ: não foi possível buscar as rodadas',err);
   roundError='Não foi possível carregar as rodadas. Toque em Atualizar para tentar novamente.';
  }finally{
   roundPromise=null;
   if($('#leadersResults'))renderResults();
  }
 })();
 return roundPromise;
}
function applyFilter(type,value,only=false,all=false){
 const rounds=type==='rounds',selected=rounds?selectedRounds:selectedTeams;
 if(all)selected.clear();
 else if(only){
  selected.clear();selected.add(value);
 }else if(selected.has(value))selected.delete(value);
 else selected.add(value);
 // Conjunto vazio = Todas / Toda a liga.
 openFilter=type;limit=30;syncURL();render();
 if(rounds&&selectedRounds.size)loadRoundData();
}

function overlayCount(phaseName=phase){
 return [...recentFinals.values()].filter(record=>
  record.phase===phaseName&&!alreadyCounted(record.event,phaseName)).length;
}
async function refreshLeaders(force=false){
 if(refreshPending||document.hidden||!navigator.onLine)return;
 refreshPending=true;
 try{
  // Não usar jsonFile: ele memoriza permanentemente o primeiro JSON da sessão.
  const response=await fetch(asset('data/player-leaders/2026-27.json'),{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.regular)||!Array.isArray(data.preseason))throw Error('Ranking incompleto');
  // Correções de pontos/rebotes/notas também mudam a tabela, mesmo
  // quando IDs e quantidade de jogos continuam iguais.
  const signature=JSON.stringify(data);
  const changed=signature!==lastDataSignature;
  lastDataSignature=signature;
  board=data;
  if(changed||force)render();
  if(changed&&selectedRounds.size)loadRoundData(true);
  if(changed)syncRecentFinals(true);
 }catch(error){
  console.warn('DLQ: falha ao atualizar ranking',error);
  if(!board){
   root.innerHTML='<div class="filler"><b>Ranking temporariamente indisponível</b>'+
   'Não foi possível buscar o arquivo de estatísticas. Tente novamente mais tarde.'+
   '<p><button class="btn" id="leadersRetry">Tentar novamente</button></p></div>';
  }
 }finally{
  refreshPending=false;
  // Mesmo com JSON igual, repetir a busca de jogos finais ausentes: a ESPN
  // pode ter publicado o box score alguns minutos depois do placar final.
  if(board)syncRecentFinals();
  if(selectedRounds.size&&roundData)loadRoundData();
 }
}
function pendingFinals(){
 const today=currentDate(),yesterday=dayShift(today,-1);
 return [...(window.QUADRA_LIVE_GAMES?.values()||[])].filter(event=>{
  const p=phaseFor(event);
  return p&&event.status==='final'&&(event.date===today||event.date===yesterday)&&
   !alreadyCounted(event,p)&&!recentFinals.has(String(event.id));
 });
}
function scheduleFinalRetry(){
 clearTimeout(recentRetryTimer);recentRetryTimer=null;
 if(!board||document.hidden||!navigator.onLine)return;
 const pending=pendingFinals(),ids=new Set(pending.map(e=>String(e.id)));
 for(const id of finalAttempts.keys())if(!ids.has(id))finalAttempts.delete(id);
 // Tentativas rápidas só dos finais ainda ausentes. Depois de seis falhas,
 // a verificação normal de um minuto continua recuperando a fonte.
 const due=pending.map(e=>finalAttempts.get(String(e.id)))
  .filter(attempt=>!attempt||attempt.count<FINAL_FAST_ATTEMPTS)
  .map(attempt=>attempt?.next||Date.now());
 if(due.length)recentRetryTimer=setTimeout(()=>{
  recentRetryTimer=null;return syncRecentFinals(true);
 },Math.max(0,Math.min(...due)-Date.now()));
}
async function syncRecentFinals(force=false){
 if(!board||recentSyncPending||document.hidden||!navigator.onLine)return;
 if(!force&&Date.now()-lastRecentScan<30000)return;
 lastRecentScan=Date.now();
 const missing=pendingFinals().filter(event=>
  Date.now()>=(finalAttempts.get(String(event.id))?.next||0));
 if(!missing.length){scheduleFinalRetry();return;}
 recentSyncPending=true;
 let index=0;
 async function worker(){
  while(index<missing.length&&!document.hidden&&navigator.onLine){
   const event=missing[index++],p=phaseFor(event),id=String(event.id);
   const attempt={count:(finalAttempts.get(id)?.count||0)+1,next:Infinity};
   finalAttempts.set(id,attempt);
   try{
    const result=await fetchLiveBoxscore({
     id,externalId:id,date:event.date,away:event.away,home:event.home
    });
    const players=result?.box?.players;
    if(result?.status!=='final'||!players||[event.away,event.home].some(code=>
     (players[code]||[]).filter(p=>p.hasStats&&minutes(p.min)>0).length<5))continue;
    const athletes=[];
    for(const teamCode of [event.away,event.home]){
     for(const athlete of players[teamCode]||[]){
      if(!athlete.id||!athlete.name||minutes(athlete.min)<=0||!athlete.hasStats)continue;
      athletes.push({athlete,team:teamCode});
     }
    }
    if(!athletes.length)continue;
    recentFinals.set(id,{phase:p,event,athletes});finalAttempts.delete(id);
    // Atualiza este resultado assim que chega, sem esperar outros jogos.
    if(!document.hidden&&$('#leadersResults'))render();
   }catch(e){console.info('DLQ: box score recente ainda não disponível',event.id,e);}
   finally{
    if(finalAttempts.has(id))attempt.next=Date.now()+
     (attempt.count<FINAL_FAST_ATTEMPTS?FINAL_RETRY_MS:60000);
   }
  }
 }
 try{await Promise.all(Array.from({length:Math.min(3,missing.length)},worker));}
 finally{recentSyncPending=false;scheduleFinalRetry();}
}
function ranked(){
 return roundRows().filter(qualifies).sort((a,b)=>
  metricValue(b)-metricValue(a)||b.gp-a.gp||a.name.localeCompare(b.name,'pt-BR'));
}
function fmt(value,key=''){
 if(value===null||value===undefined)return '—';
 const integer=valueMode==='total'&&!isAverageOnly(key)&&key!=='min';
 return (integer?Math.round(value):round(value)).toLocaleString('pt-BR',{
  minimumFractionDigits:integer?0:1,maximumFractionDigits:integer?0:1});
}
function syncURL(){
 const url=new URL(location.href);
 url.searchParams.set('stat',metric);
 url.searchParams.set('fase',phase);
 url.searchParams.set('modo',valueMode);
 if(selectedRounds.size)url.searchParams.set('rodadas',[...selectedRounds].sort((a,b)=>a-b).join(','));
 else url.searchParams.delete('rodadas');
 url.searchParams.delete('time');url.searchParams.delete('times');
 if(selectedTeams.size===1)url.searchParams.set('time',[...selectedTeams][0]);
 else if(selectedTeams.size>1)url.searchParams.set('times',[...selectedTeams].sort().join(','));
 history.replaceState(null,'',url.pathname+url.search);
}
function athleteImage(id){
 return 'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(String(id))+'.png';
}
function followed(id){return !!getData().extras.players?.[id]?.favorite;}

function cellMetric(row,key){
 const val=metricValue(row,key);
 if(val===null||val===undefined)return '—';
 return fmt(val,key);
}
function ratingClass(value){
 if(value===null)return 'unrated';
 if(value>=8.5)return 'great';
 if(value>=7)return 'good';
 if(value>=6)return 'average';
 return 'low';
}
function rowHTML(p,i){
 const info='<div class="leaders-table-player">'+
  '<span class="leaders-table-rank">'+(i+1)+'</span>'+
  '<img class="leaders-table-photo" src="'+athleteImage(p.id)+'" loading="lazy" decoding="async" alt="" referrerpolicy="no-referrer" onerror="this.style.opacity=.18">'+
  '<div class="leaders-table-player-info">'+
   '<a href="'+esc(playerLink(p.id,p.team))+'" title="Ver perfil de '+esc(p.name)+'"><b>'+esc(p.name)+'</b></a>'+
   '<span class="leaders-table-club"><img src="'+esc(logo(p.team))+'" alt="" loading="lazy">'+esc(p.team)+' • '+p.gp+' '+(p.gp===1?'jogo':'jogos')+'</span>'+
   '<div class="leaders-row-actions"><button type="button" data-leader-follow="'+esc(p.id)+'" class="leaders-row-action'+(followed(p.id)?' is-following':'')+'" title="'+(followed(p.id)?'Deixar de seguir':'Seguir jogador')+'" aria-label="'+(followed(p.id)?'Deixar de seguir ':'Seguir ')+esc(p.name)+'" aria-pressed="'+followed(p.id)+'">'+(followed(p.id)?'♥':'♡')+'</button>'+
   '<button type="button" class="leaders-row-action" data-leader-card="'+esc(p.id)+'" title="Gerar card das médias" aria-label="Gerar card das médias de '+esc(p.name)+'">▣</button><button type="button" class="leaders-row-action" data-player-options aria-label="Opções de '+esc(p.name)+'" title="Opções do jogador">⋯</button></div>'+
  '</div></div>';
 const fields=['pts','reb','ast','stl','blk','rating'].map(key=>{
  const val=metricValue(p,key);
  const label=key==='rating'?'Nota DLQ':(metricName[key]||key)+(valueMode==='total'?' total':' por jogo');
  return '<span role="cell" class="leaders-table-stat '+(metric===key?' is-active':'')+'">'+
    (key==='rating'?'<span class="leaders-rating-badge '+ratingClass(val)+'">'+cellMetric(p,key)+'</span>':
    '<span>'+cellMetric(p,key)+'</span>')+'</span>';
 }).join('');
 return '<div class="leaders-table-row" role="row" tabindex="0" data-leader-id="'+esc(p.id)+'">'+
  '<div role="cell" class="leaders-table-player-cell">'+info+'</div>'+fields+'</div>';
}
function tableHTML(rows){
 const headers=[['pts','PTS'],['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['rating','RTG']];
 return '<div class="leaders-rank-table" role="table" aria-label="Ranking geral dos jogadores">'+
 '<div role="rowgroup"><div role="row" class="leaders-table-header">'+
 '<div role="columnheader" class="leaders-table-player-head">Jogador</div>'+
 headers.map(([id,label])=>'<button type="button" role="columnheader" data-leaders-metric="'+id+
 '" class="leaders-table-sort'+(metric===id?' is-active':'')+'" aria-label="Ordenar por '+esc(id==='rating'?'Nota DLQ':metricName[id])+'" aria-sort="'+(metric===id?'descending':'none')+'">'+label+
 (metric===id?'<span aria-hidden="true">▼</span>':'')+'</button>').join('')+'</div></div>'+
 '<div role="rowgroup">'+rows.map(rowHTML).join('')+'</div></div>';
}

function toolbar(){
 return '<div class="leaders-controls">'+
 '<label class="leaders-search-bar"><span class="leaders-search-icon" aria-hidden="true">⌕</span>'+
 '<input id="leadersSearch" class="control" type="search" value="'+esc(search)+'" placeholder="Pesquisar jogador pelo nome…" autocomplete="off" aria-label="Pesquisar jogador"></label>'+
 '<div class="leaders-phase" role="group" aria-label="Fase da temporada">'+
 '<button type="button" data-leaders-phase="regular" class="'+(phase==='regular'?'selected':'')+'">Temporada regular</button>'+
 '<button type="button" data-leaders-phase="preseason" class="'+(phase==='preseason'?'selected':'')+'">Pré-temporada</button></div>'+
 '<div class="leaders-metrics" aria-label="Ordenar por estatística">'+metrics.map(([id,label])=>
  '<button type="button" data-leaders-metric="'+id+'" class="'+(metric===id?'selected':'')+'" aria-pressed="'+(metric===id)+'">'+esc(label)+'</button>').join('')+'</div>'+
 '<div class="leaders-filters leaders-extra-filters">'+
 '<div class="leaders-mode-group"><span>Exibir estatísticas</span>'+
 '<div class="leaders-mode-buttons" role="group" aria-label="Modo de cálculo">'+
 '<button type="button" data-leaders-mode="average" class="'+(valueMode==='average'?'selected':'')+
 '" aria-pressed="'+(valueMode==='average')+'">Média por jogo</button>'+
 '<button type="button" data-leaders-mode="total" class="'+(valueMode==='total'?'selected':'')+
 '" aria-pressed="'+(valueMode==='total')+'">Soma total</button></div></div>'+
 filterOptions('rounds')+
 filterOptions('teams')+
 '<label>Mínimo de jogos<select class="control" id="leadersMinimum">'+[1,3,5,10,20].map(v=>
  '<option value="'+v+'"'+(minimum===v?' selected':'')+'>'+v+' '+(v===1?'jogo':'jogos')+'</option>').join('')+'</select></label>'+
 '<label class="leaders-following-toggle"><input id="leadersFollowing" type="checkbox"'+(followingOnly?' checked':'')+'> Só jogadores que sigo</label><button type="button" class="btn ghost" data-open-comparison>⇄ Comparar jogadores</button></div></div>';
}

function latestGameDate(){
 return mergedRows().reduce((date,row)=>String(row.lastDate||'')>date?String(row.lastDate):date,'');
}
function renderResults(){
 const target=$('#leadersResults');if(!target||!board)return;
 const rows=ranked(),shown=rows.slice(0,limit);
 const heading=metricName[metric]||'Melhores jogadores';
 target.innerHTML='<div class="leaders-count"><div><span class="caps">RANKING GERAL • '+esc(phase==='regular'?'TEMPORADA REGULAR':'PRÉ-TEMPORADA')+'</span>'+
 '<h2>Melhores jogadores <span>2026/27</span></h2></div><div class="leaders-update-info">'+
 '<span>'+rows.length+' atletas • Ordem: '+esc(heading)+
 ' • '+(valueMode==='total'?'Soma total':'Média por jogo')+
 (selectedRounds.size?' • Rodadas '+[...selectedRounds].sort((a,b)=>a-b).join(', '):' • Todas as rodadas')+'</span>'+
 '<span>Dados até '+esc(latestGameDate()?
  latestGameDate().split('-').reverse().join('/'):'sem partidas finalizadas')+
 (overlayCount()?' • +'+overlayCount()+' jogos finais recentes':'')+'</span>'+
 '<button type="button" class="btn ghost" id="leadersRefresh">↻ Atualizar</button></div></div>'+
 (selectedRounds.size&&!roundData?
  '<div class="filler"><b>'+(roundError?'Rodadas indisponíveis':'Carregando estatísticas das rodadas…')+
  '</b>'+(roundError?esc(roundError):'A tabela será atualizada ao terminar o carregamento.')+'</div>':
  rows.length?
  tableHTML(shown)+
  (rows.length>limit?'<div class="center leaders-load"><button class="btn" id="leadersLoadMore" type="button">Ver mais '+Math.min(30,rows.length-limit)+' jogadores ↓</button></div>':''):
  '<div class="filler"><b>Nenhum jogador com esses filtros</b>Reduza o mínimo de partidas ou escolha outra estatística.</div>')+
 '<p class="leaders-disclaimer">Toque em PTS, REB, AST, STL, BLK ou RTG para ordenar. '+
 (valueMode==='total'?'PTS, REB, AST, STL e BLK mostram a soma das partidas selecionadas.':
 'PTS, REB, AST, STL e BLK mostram médias por partida.')+
 ' A nota RTG (NOTA DLQ) e os percentuais continuam como médias.'+
 ' Fonte: '+esc(board.source)+'. São considerados somente jogos finalizados já importados. A NOTA DLQ não é oficial da NBA.'+
 ' Os rankings de porcentagem exigem um mínimo de arremessos.</p>';
}

function render(){
 if(!board)return;
 // Preservar a posição do menu, evitando voltar ao topo ao selecionar
 // equipes ou rodadas no fim da lista.
 const previous=root.querySelector('.leaders-select-dropdown[open]');
 const previousScroll=previous?.querySelector('.leaders-select-menu')?.scrollTop||0;
 root.innerHTML=toolbar()+'<div id="leadersResults"></div>';
 const current=root.querySelector('.leaders-select-dropdown[open] .leaders-select-menu');
 if(current)current.scrollTop=previousScroll;
 renderResults();
 if(selectedRounds.size&&!roundData&&!roundPromise)loadRoundData();
}
root.innerHTML='<div class="filler">Preparando ranking dos jogadores…</div>';
refreshLeaders(true);
// Um novo FINAL não espera o intervalo de revalidação do consolidado.
window.addEventListener('quadra:live-update',()=>syncRecentFinals(true));
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){clearTimeout(recentRetryTimer);recentRetryTimer=null;return;}
 refreshLeaders();syncRecentFinals(true);
});
window.addEventListener('pagehide',()=>{clearTimeout(recentRetryTimer);recentRetryTimer=null;});
window.addEventListener('offline',()=>{clearTimeout(recentRetryTimer);recentRetryTimer=null;});
window.addEventListener('online',()=>{refreshLeaders();syncRecentFinals(true);});
// O ranking revalida o cache leve sem recarregar a página nem mudar os filtros.
// A consulta compartilhada do placar inclui ontem durante todo o dia nesta página.
setInterval(()=>{if(!document.hidden)refreshLeaders();},60000);
function leaderComparisonPlayers(){
 return roundRows().filter(p=>p.gp>0).map(p=>({key:p.team+':'+p.id,id:String(p.id),name:p.name,teamCode:p.team,teamName:name(p.team),teamLogo:logo(p.team),headshot:athleteImage(p.id),profileUrl:playerLink(p.id,p.team),gp:p.gp,raw:p,followed:followed(p.id),stats:Object.fromEntries(['pts','reb','ast','stl','blk','threeM','to','rating','min','fgpct','threepct'].map(k=>[k,metricValue(p,k)]))}));
}
function compareLeaders(firstKey=''){
 if(selectedRounds.size&&!roundData)return toast('Aguarde o carregamento das rodadas.');
 openPlayerComparison({getPlayers:leaderComparisonPlayers,firstKey,context:{mode:valueMode,title:(phase==='regular'?'Temporada regular':'Pré-temporada')+' 2026/27',subtitle:(selectedRounds.size?'Rodadas '+[...selectedRounds].sort((a,b)=>a-b).join(', '):'Todas as rodadas')+' · '+(valueMode==='total'?'Soma total':'Médias por jogo')}});
}
function leaderIndividualCard(candidate){
 const row=roundRows().find(p=>String(p.id)===candidate.id);if(!row)return;
 openPlayerCardComposer({kind:'season',phase,season:row,roundsLabel:selectedRounds.size?'RODADAS '+[...selectedRounds].sort((a,b)=>a-b).join(', '):'',player:{id:row.id,name:row.name},teamCode:row.team,teamName:name(row.team),teamLogo:logo(row.team),headshot:athleteImage(row.id)});
}
const playerActions=mountPlayerActions({root,selector:'[data-leader-id]',resolve:row=>leaderComparisonPlayers().find(p=>p.id===row.dataset.leaderId),onCompare:p=>compareLeaders(p.key),onCard:leaderIndividualCard,onFollow:p=>{
 const now=!followed(p.id);modify(b=>{b.extras.players[p.id]={...(b.extras.players[p.id]||{}),favorite:now,name:p.name,team:p.teamCode};b.extras.updatedAt=new Date().toISOString();});renderResults();toast(now?'Agora você segue '+p.name:'Você deixou de seguir '+p.name);
}});
window.addEventListener('pagehide',()=>playerActions.destroy());
root.addEventListener('click',e=>{
 if(e.target.closest('[data-open-comparison]')){compareLeaders();return;}
 const stat=e.target.closest('[data-leaders-metric]');
 if(stat){metric=stat.dataset.leadersMetric;limit=30;syncURL();render();return;}
 const phaseBtn=e.target.closest('[data-leaders-phase]');
 if(phaseBtn){
  phase=phaseBtn.dataset.leadersPhase;selectedRounds.clear();roundError='';
  limit=30;syncURL();render();return;
 }
 const modeButton=e.target.closest('[data-leaders-mode]');
 if(modeButton){valueMode=modeButton.dataset.leadersMode;limit=30;syncURL();render();return;}
 const only=e.target.closest('[data-leaders-only]');
 if(only){applyFilter('rounds',Number(only.dataset.leadersOnly),true);return;}
 const teamOnly=e.target.closest('[data-leaders-only-team]');
 if(teamOnly){applyFilter('teams',teamOnly.dataset.leadersOnlyTeam,true);return;}
 if(e.target.closest('#leadersLoadMore')){limit+=30;renderResults();return;}
 if(e.target.closest('#leadersRefresh')){
  refreshLeaders(true);syncRecentFinals(true);
  if(selectedRounds.size)loadRoundData(true);
  return;
 }
 const card=e.target.closest('[data-leader-card]');
 if(card){
  const row=roundRows().find(p=>p.id===card.dataset.leaderCard);
  if(!row)return;
  openPlayerCardComposer({kind:'season',phase,season:row,
   roundsLabel:selectedRounds.size?'RODADAS '+[...selectedRounds].sort((a,b)=>a-b).join(', '):'',
   player:{id:row.id,name:row.name},
   teamCode:row.team,teamName:name(row.team),teamLogo:logo(row.team),headshot:athleteImage(row.id)});
  return;
 }
 if(e.target.closest('#leadersRetry')){location.reload();return;}
 const follow=e.target.closest('[data-leader-follow]');
 if(follow){
  const id=follow.dataset.leaderFollow;
  const player=roundRows().find(p=>p.id===id);
  if(!player)return;
  const now=!followed(id);
  modify(b=>{
   b.extras.players[id]={...(b.extras.players[id]||{}),favorite:now,name:player.name,team:player.team};
   b.extras.updatedAt=new Date().toISOString();
  });
  toast(now?'Agora você segue '+player.name+'!':'Você deixou de seguir '+player.name);
  if(followingOnly)renderResults();
  else{
   for(const btn of root.querySelectorAll('[data-leader-follow="'+id+'"]')){
    btn.classList.toggle('is-following',now);btn.textContent=now?'♥':'♡';
    btn.setAttribute('aria-pressed',String(now));
    btn.title=now?'Deixar de seguir':'Seguir jogador';
    btn.setAttribute('aria-label',(now?'Deixar de seguir ':'Seguir ')+player.name);
   }
  }
 }
});
root.addEventListener('input',e=>{
 if(e.target.id==='leadersSearch'){
  search=e.target.value.toLocaleLowerCase('pt-BR').trim();limit=30;renderResults();
 }
});
root.addEventListener('change',e=>{
 if(e.target.matches('[data-leaders-round-all]')){
  applyFilter('rounds',null,false,true);return;
 }
 if(e.target.matches('[data-leaders-team-all]')){
  applyFilter('teams',null,false,true);return;
 }
 const roundTick=e.target.closest('[data-leaders-round]');
 if(roundTick){applyFilter('rounds',Number(roundTick.dataset.leadersRound));return;}
 const teamTick=e.target.closest('[data-leaders-team]');
 if(teamTick){applyFilter('teams',teamTick.dataset.leadersTeam);return;}
 if(e.target.id==='leadersMinimum'){minimum=Number(e.target.value)||1;limit=30;renderResults();}
 if(e.target.id==='leadersFollowing'){followingOnly=e.target.checked;limit=30;renderResults();}
});
window.addEventListener('quadra:refresh',()=>{if(board)renderResults();});

root.addEventListener('toggle',e=>{
 const details=e.target.closest?.('.leaders-select-dropdown');
 if(!details||!details.isConnected)return;
 const type=details.dataset.leadersFilter;
 if(details.open){
  openFilter=type;
  for(const other of root.querySelectorAll('.leaders-select-dropdown[open]')){
   if(other!==details)other.open=false;
  }
 }else if(openFilter===type)openFilter='';
},true);
document.addEventListener('pointerdown',e=>{
 if(!openFilter||e.target.closest?.('.leaders-select-dropdown'))return;
 const active=root.querySelector('.leaders-select-dropdown[open]');
 if(active)active.open=false;openFilter='';
});
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape'||!openFilter)return;
 const active=root.querySelector('.leaders-select-dropdown[open]');
 if(active){
  active.open=false;active.querySelector('summary')?.focus();
  openFilter='';e.preventDefault();
 }
});
