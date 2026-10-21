/* DE LA QUADRA — ranking de atletas gerado a partir dos box scores finalizados. */
import {$,setupShared,jsonFile,TEAMS,EAST,WEST,name,logo,esc,path,playerLink,getData,modify,toast} from '../app.js?v=13';
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
let minimum=1,search='',followingOnly=false,limit=30,board=null,loading=true;
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
function ranked(){
 return (board?.[phase]||[]).filter(qualifies).sort((a,b)=>
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
function athlete(row,index,featured=false){
 const href=playerLink(row.id,row.team),val=fmt(metricValue(row));
 const point=featured?'<span class="leaders-feature-rank">#'+(index+1)+'</span>':'<span class="leaders-rank">'+(index+1)+'º</span>';
 return '<article class="'+(featured?'leaders-feature':'leaders-athlete')+'">'+
 point+
 '<a class="leaders-athlete-info" href="'+esc(href)+'" aria-label="Ver perfil de '+esc(row.name)+'">'+
 '<img class="leaders-headshot" loading="lazy" decoding="async" src="'+athleteImage(row.id)+'" alt="" referrerpolicy="no-referrer" onerror="this.style.opacity=.15">'+
 '<span class="leaders-ident"><strong>'+esc(row.name)+'</strong><small><img loading="lazy" src="'+esc(logo(row.team))+'" alt="">'+esc(name(row.team))+'</small>'+
 '<small class="leaders-season-gp">'+row.gp+' '+(row.gp===1?'jogo':'jogos')+'</small></span></a>'+
 '<div class="leaders-scores"><strong>'+val+'</strong><span>'+esc(metrics.find(m=>m[0]===metric)?.[2]||metric)+'</span>'+
 (featured?'<small>'+fmt(avg(row,'pts'))+' PTS • '+fmt(avg(row,'reb'))+' REB • '+fmt(avg(row,'ast'))+' AST</small>':'')+'</div>'+
 '<button type="button" class="leaders-follow'+(followed(row.id)?' is-following':'')+'" data-leader-follow="'+esc(row.id)+'"'+
 ' aria-pressed="'+followed(row.id)+'" aria-label="'+(followed(row.id)?'Deixar de seguir ':'Seguir ')+esc(row.name)+'" title="'+(followed(row.id)?'Seguindo':'Seguir jogador')+'">'+(followed(row.id)?'♥':'♡')+'</button></article>';
}
function toolbar(){
 return '<div class="leaders-controls">'+
 '<div class="leaders-phase" role="group" aria-label="Fase da temporada">'+
 '<button type="button" data-leaders-phase="regular" class="'+(phase==='regular'?'selected':'')+'">Temporada regular</button>'+
 '<button type="button" data-leaders-phase="preseason" class="'+(phase==='preseason'?'selected':'')+'">Pré-temporada</button></div>'+
 '<div class="leaders-metrics" aria-label="Estatística do ranking">'+metrics.map(([id,label])=>
  '<button type="button" data-leaders-metric="'+id+'" class="'+(metric===id?'selected':'')+'" aria-pressed="'+(metric===id)+'">'+esc(label)+'</button>').join('')+'</div>'+
 '<div class="leaders-filters"><label>Buscar jogador<input id="leadersSearch" class="control" type="search" value="'+esc(search)+'" placeholder="Nome do atleta…"></label>'+
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
 const lead=rows.slice(0,3);
 const available=(board[phase]||[]).filter(p=>p.gp>=minimum).length;
 target.innerHTML='<div class="leaders-count"><div><span class="caps">RANKING • '+esc(heading.toUpperCase())+'</span>'+
 '<h2>'+esc(heading)+' <span>2026/27</span></h2></div><span>'+rows.length+' atletas no filtro</span></div>'+
 (rows.length?
  '<div class="leaders-podium">'+lead.map((p,i)=>athlete(p,i,true)).join('')+'</div>'+
  '<section class="leaders-list"><div class="leaders-list-head"><b>Classificação completa</b><span>Ordenado por '+esc(heading.toLocaleLowerCase('pt-BR'))+'</span></div>'+
  shown.map((p,i)=>athlete(p,i)).join('')+'</section>'+
  (rows.length>limit?'<div class="center leaders-load"><button class="btn" id="leadersLoadMore" type="button">Ver mais '+Math.min(30,rows.length-limit)+' jogadores ↓</button></div>':''):
  '<div class="filler"><b>Nenhum jogador com esses filtros</b>Reduza o mínimo de partidas ou escolha outra estatística.</div>')+
 '<p class="leaders-disclaimer">Fonte: '+esc(board.source)+'. Médias somente dos box scores de partidas encerradas e importadas.'+
 ' NOTA DLQ é a média das notas automáticas por partida (1 a 10), não uma nota oficial da NBA.'+
 ' Percentuais exigem uma quantidade mínima de tentativas. '+esc(board.description||'')+'</p>';
}
function render(){
 if(!board)return;
 root.innerHTML=toolbar()+'<div id="leadersResults"></div>';renderResults();
}
root.innerHTML='<div class="filler">Preparando ranking dos jogadores…</div>';
jsonFile('data/player-leaders/2026-27.json').then(data=>{
 if(!Array.isArray(data.regular)||!Array.isArray(data.preseason))throw Error('Ranking incompleto');
 board=data;loading=false;render();
}).catch(err=>{
 console.warn('Ranking DLQ:',err);
 root.innerHTML='<div class="filler"><b>Ranking temporariamente indisponível</b>Os dados serão exibidos quando os box scores forem importados. Tente novamente mais tarde.'+
 '<p><button class="btn" id="leadersRetry">Tentar novamente</button></p></div>';
});
root.addEventListener('click',e=>{
 const stat=e.target.closest('[data-leaders-metric]');
 if(stat){metric=stat.dataset.leadersMetric;limit=30;syncURL();render();return;}
 const phaseBtn=e.target.closest('[data-leaders-phase]');
 if(phaseBtn){phase=phaseBtn.dataset.leadersPhase;limit=30;syncURL();render();return;}
 if(e.target.closest('#leadersLoadMore')){limit+=30;renderResults();return;}
 if(e.target.closest('#leadersRetry')){location.reload();return;}
 const follow=e.target.closest('[data-leader-follow]');
 if(follow){
  const id=follow.dataset.leaderFollow;
  const player=(board?.[phase]||[]).find(p=>p.id===id);
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
    btn.title=now?'Seguindo':'Seguir jogador';
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
