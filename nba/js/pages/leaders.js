/* DE LA QUADRA — ranking de atletas gerado a partir dos box scores finalizados. */
import {$,setupShared,asset,currentDate,dayShift,TEAMS,name,logo,esc,playerLink,getData,modify,toast} from '../app.js?v=13';
import {openPlayerCardComposer} from '../share-card.js?v=7';
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
const query=new URLSearchParams(location.search);
const valid=new Set(metrics.map(x=>x[0]));
let metric=valid.has(query.get('stat'))?query.get('stat'):'pts';
let phase=query.get('fase')==='preseason'?'preseason':'regular';
let team=TEAMS[query.get('time')]?query.get('time'):'all';
let minimum=1,search='',followingOnly=false,limit=30,board=null;
let refreshPending=false,lastDataSignature='',recentSyncPending=false,lastRecentScan=0;
const recentFinals=new Map();
const n=v=>Number(v)||0,round=v=>Math.round(v*10)/10;
const avg=(p,key)=>n(p.gp)?n(p[key])/n(p.gp):0;
function metricValue(p,key=metric){
 if(key==='rating')return p.ratingGames?n(p.ratingSum)/p.ratingGames:null;
 if(key==='fgpct')return p.fga?100*n(p.fgm)/p.fga:null;
 if(key==='threepct')return p.threeA?100*n(p.threeM)/p.threeA:null;
 return avg(p,key);
}
function qualifies(p){
 if(!p.gp||p.gp<minimum)return false;
 if(team!=='all'&&p.team!==team)return false;
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
  const signature=JSON.stringify([data.lastGameDate,data.countedGameIds,
   data.regular.length,data.preseason.length,
   data.regular.reduce((n,r)=>n+r.gp,0),data.preseason.reduce((n,r)=>n+r.gp,0)]);
  const changed=signature!==lastDataSignature;
  lastDataSignature=signature;
  board=data;
  if(changed||force){
   if(!$('#leadersResults'))render();
   else renderResults();
  }
  if(changed)syncRecentFinals(true);
 }catch(error){
  console.warn('DLQ: falha ao atualizar ranking',error);
  if(!board){
   root.innerHTML='<div class="filler"><b>Ranking temporariamente indisponível</b>'+
   'Não foi possível buscar o arquivo de estatísticas. Tente novamente mais tarde.'+
   '<p><button class="btn" id="leadersRetry">Tentar novamente</button></p></div>';
  }
 }finally{refreshPending=false;}
}
async function syncRecentFinals(force=false){
 if(!board||recentSyncPending||document.hidden||!navigator.onLine)return;
 if(!force&&Date.now()-lastRecentScan<30000)return;
 lastRecentScan=Date.now();
 const today=currentDate(),yesterday=dayShift(today,-1);
 const available=[...(window.QUADRA_LIVE_GAMES?.values()||[])];
 const missing=available.filter(event=>{
  const p=phaseFor(event);
  return p&&event.status==='final'&&
   (event.date===today||event.date===yesterday)&&
   !alreadyCounted(event,p)&&!recentFinals.has(String(event.id));
 });
 if(!missing.length)return;
 recentSyncPending=true;
 let index=0,changed=false;
 async function worker(){
  while(index<missing.length&&!document.hidden){
   const event=missing[index++],p=phaseFor(event);
   try{
    const result=await fetchLiveBoxscore({
     id:String(event.id),externalId:String(event.id),
     date:event.date,away:event.away,home:event.home
    });
    const players=result?.box?.players;
    // Não contar um box score incompleto como partida final consolidada.
    if(!players||[event.away,event.home].some(code=>
     (players[code]||[]).filter(p=>p.hasStats&&minutes(p.min)>0).length<5))continue;
    const athletes=[];
    for(const teamCode of [event.away,event.home]){
     for(const athlete of players[teamCode]||[]){
      if(!athlete.id||!athlete.name||minutes(athlete.min)<=0||!athlete.hasStats)continue;
      athletes.push({athlete,team:teamCode});
     }
    }
    if(!athletes.length)continue;
    recentFinals.set(String(event.id),{phase:p,event,athletes});
    changed=true;
   }catch(e){console.info('DLQ: box score recente ainda não disponível',event.id,e);}
  }
 }
 try{await Promise.all(Array.from({length:Math.min(3,missing.length)},worker));}
 finally{
  recentSyncPending=false;
  if(changed&&board&&$('#leadersResults'))renderResults();
 }
}
function ranked(){
 return mergedRows().filter(qualifies).sort((a,b)=>
  metricValue(b)-metricValue(a)||b.gp-a.gp||a.name.localeCompare(b.name,'pt-BR'));
}
function fmt(value){
 if(value===null||value===undefined)return '—';
 return round(value).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
}
function syncURL(){
 const url=new URL(location.href);
 url.searchParams.set('stat',metric);
 url.searchParams.set('fase',phase);
 if(team!=='all')url.searchParams.set('time',team);else url.searchParams.delete('time');
 history.replaceState(null,'',url.pathname+url.search);
}
function athleteImage(id){
 return 'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(String(id))+'.png';
}
function followed(id){return !!getData().extras.players?.[id]?.favorite;}

function cellMetric(row,key){
 const val=metricValue(row,key);
 if(val===null||val===undefined)return '—';
 return fmt(val);
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
   '<button type="button" class="leaders-row-action" data-leader-card="'+esc(p.id)+'" title="Gerar card das médias" aria-label="Gerar card das médias de '+esc(p.name)+'">▣</button></div>'+
  '</div></div>';
 const fields=['pts','reb','ast','stl','blk','rating'].map(key=>{
  const val=metricValue(p,key);
  const label=key==='rating'?'Nota DLQ':(metricName[key]||key)+' por jogo';
  return '<span role="cell" class="leaders-table-stat '+(metric===key?' is-active':'')+'">'+
    (key==='rating'?'<span class="leaders-rating-badge '+ratingClass(val)+'">'+cellMetric(p,key)+'</span>':
    '<span>'+cellMetric(p,key)+'</span>')+'</span>';
 }).join('');
 return '<div class="leaders-table-row" role="row">'+
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
 '<div class="leaders-filters">'+
 '<label>Equipe<select class="control" id="leadersTeam"><option value="all">Toda a liga</option>'+Object.keys(TEAMS).sort((a,b)=>name(a).localeCompare(name(b))).map(c=>
  '<option value="'+esc(c)+'"'+(team===c?' selected':'')+'>'+esc(name(c))+'</option>').join('')+'</select></label>'+
 '<label>Mínimo de jogos<select class="control" id="leadersMinimum">'+[1,3,5,10,20].map(v=>
  '<option value="'+v+'"'+(minimum===v?' selected':'')+'>'+v+' '+(v===1?'jogo':'jogos')+'</option>').join('')+'</select></label>'+
 '<label class="leaders-following-toggle"><input id="leadersFollowing" type="checkbox"'+(followingOnly?' checked':'')+'> Só jogadores que sigo</label></div></div>';
}

function renderResults(){
 const target=$('#leadersResults');if(!target||!board)return;
 const rows=ranked(),shown=rows.slice(0,limit);
 const heading=metricName[metric]||'Melhores jogadores';
 target.innerHTML='<div class="leaders-count"><div><span class="caps">RANKING GERAL • '+esc(phase==='regular'?'TEMPORADA REGULAR':'PRÉ-TEMPORADA')+'</span>'+
 '<h2>Melhores jogadores <span>2026/27</span></h2></div><div class="leaders-update-info">'+
 '<span>'+rows.length+' atletas • Ordem: '+esc(heading)+'</span>'+
 '<span>Consolidado até '+esc(board.lastGameDate?
  board.lastGameDate.split('-').reverse().join('/'):'sem partidas finalizadas')+
 (overlayCount()?' • +'+overlayCount()+' jogos finais recentes':'')+'</span>'+
 '<button type="button" class="btn ghost" id="leadersRefresh">↻ Atualizar</button></div></div>'+
 (rows.length?
  tableHTML(shown)+
  (rows.length>limit?'<div class="center leaders-load"><button class="btn" id="leadersLoadMore" type="button">Ver mais '+Math.min(30,rows.length-limit)+' jogadores ↓</button></div>':''):
  '<div class="filler"><b>Nenhum jogador com esses filtros</b>Reduza o mínimo de partidas ou escolha outra estatística.</div>')+
 '<p class="leaders-disclaimer">Toque em PTS, REB, AST, STL, BLK ou RTG para ordenar. Os números são médias por jogo; RTG é a NOTA DLQ.'+
 ' Fonte: '+esc(board.source)+'. São considerados somente jogos finalizados já importados. A NOTA DLQ não é oficial da NBA.'+
 ' Os rankings de porcentagem exigem um mínimo de arremessos.</p>';
}

function render(){
 if(!board)return;
 root.innerHTML=toolbar()+'<div id="leadersResults"></div>';renderResults();
}
root.innerHTML='<div class="filler">Preparando ranking dos jogadores…</div>';
refreshLeaders(true);
window.addEventListener('quadra:live-update',()=>syncRecentFinals());
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden){refreshLeaders();syncRecentFinals(true);}
});
window.addEventListener('online',()=>{refreshLeaders();syncRecentFinals(true);});
// O ranking revalida o cache leve sem recarregar a página nem mudar os filtros.
setInterval(()=>{if(!document.hidden)refreshLeaders();},60000);
root.addEventListener('click',e=>{
 const stat=e.target.closest('[data-leaders-metric]');
 if(stat){metric=stat.dataset.leadersMetric;limit=30;syncURL();render();return;}
 const phaseBtn=e.target.closest('[data-leaders-phase]');
 if(phaseBtn){phase=phaseBtn.dataset.leadersPhase;limit=30;syncURL();render();return;}
 if(e.target.closest('#leadersLoadMore')){limit+=30;renderResults();return;}
 if(e.target.closest('#leadersRefresh')){refreshLeaders(true);syncRecentFinals(true);return;}
 const card=e.target.closest('[data-leader-card]');
 if(card){
  const row=mergedRows().find(p=>p.id===card.dataset.leaderCard);
  if(!row)return;
  openPlayerCardComposer({kind:'season',phase,season:row,player:{id:row.id,name:row.name},
   teamCode:row.team,teamName:name(row.team),teamLogo:logo(row.team),headshot:athleteImage(row.id)});
  return;
 }
 if(e.target.closest('#leadersRetry')){location.reload();return;}
 const follow=e.target.closest('[data-leader-follow]');
 if(follow){
  const id=follow.dataset.leaderFollow;
  const player=mergedRows().find(p=>p.id===id);
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
 if(e.target.id==='leadersTeam'){team=e.target.value;limit=30;syncURL();renderResults();}
 if(e.target.id==='leadersMinimum'){minimum=Number(e.target.value)||1;limit=30;renderResults();}
 if(e.target.id==='leadersFollowing'){followingOnly=e.target.checked;limit=30;renderResults();}
});
window.addEventListener('quadra:refresh',()=>{if(board)renderResults();});
