/* DE LA QUADRA — melhores marcas individuais em uma única partida. */
import {$,setupShared,asset,esc,logo,name,playerLink,gameLink,loadGames,jsonFile} from '../app.js?v=13';
import {GAME_RECORD_METRICS,gamePerformances,topSingleGames} from '../season-stats.mjs?v=20261103-records-v1';
setupShared('records','Recordes da Temporada','Maiores atuações individuais em um único jogo da NBA 2026/27.');
const root=$('#pageContent'),params=new URLSearchParams(location.search);
let phase=params.get('fase')==='preseason'?'preseason':'regular';
let metric=GAME_RECORD_METRICS.some(([id])=>id===params.get('stat'))?params.get('stat'):'pts';
let dataset=null,players=null,games=new Map(),error='';
const headshot=id=>'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(id)+'.png';
const showDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Data não informada';
const stat=v=>metric==='rating'||metric==='min'?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}):Number(v).toLocaleString('pt-BR');
function format(v,key){return ['rating','min'].includes(key)?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}):Math.round(Number(v)||0).toLocaleString('pt-BR');}
function description(p){
 const g=games.get(p.gameId);
 if(!g)return '<span>Partida #'+esc(p.gameId)+'</span>';
 const opponent=g.away===p.team?g.home:g.away,at=g.away===p.team?'contra':'contra';
 const score=Number.isFinite(Number(g.scoreHome))&&Number.isFinite(Number(g.scoreAway))&&g.scoreHome!==null&&g.scoreAway!==null
  ?' · '+esc(g.away)+' '+esc(g.scoreAway)+' × '+esc(g.scoreHome)+' '+esc(g.home):'';
 return '<span>'+showDate(g.date)+' · '+at+' '+esc(opponent||'adversário')+score+'</span>';
}
function player(p){
 return '<span class="records-player"><img src="'+headshot(p.id)+'" alt="" loading="lazy" onerror="this.style.opacity=.2">'+
 '<span><a href="'+esc(playerLink(p.id,p.team))+'"><strong>'+esc(p.name)+'</strong></a>'+
 '<small><img src="'+esc(logo(p.team))+'" alt="">'+esc(p.team)+' · '+(p.round||1)+'º jogo do atleta</small></span></span>';
}
function render(){
 if(!dataset||!players){root.innerHTML='<div class="filler">'+esc(error||'Carregando os recordes da temporada…')+'</div>';return;}
 const rows=gamePerformances(dataset[phase],players[phase]);
 const leaderCards=GAME_RECORD_METRICS.map(([key,label,short])=>{
  const winner=topSingleGames(rows,key,1)[0];
  return '<button type="button" class="records-tile'+(key===metric?' is-active':'')+'" data-record-metric="'+key+'" aria-pressed="'+(metric===key)+'">'+
   '<span>'+esc(label)+'</span><b>'+(winner?format(winner[key],key):'—')+' <small>'+esc(short)+'</small></b>'+
   '<span class="records-tile-name">'+(winner?esc(winner.name):'Sem jogos')+'</span>'+
   (winner?'<img class="records-tile-photo" src="'+headshot(winner.id)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.opacity=.12">':'')+
   '</button>';
 }).join('');
 const selected=GAME_RECORD_METRICS.find(([id])=>id===metric),top=topSingleGames(rows,metric,20);
 root.innerHTML='<div class="records-tools"><div class="leaders-phase" role="group" aria-label="Fase da temporada">'+
 '<button type="button" data-record-phase="regular" class="'+(phase==='regular'?'selected':'')+'">Temporada regular</button>'+
 '<button type="button" data-record-phase="preseason" class="'+(phase==='preseason'?'selected':'')+'">Pré-temporada</button></div>'+
 '<span class="subtle">'+rows.length.toLocaleString('pt-BR')+' atuações individuais • NBA 2026/27</span></div>'+
 '<div class="records-grid">'+leaderCards+'</div>'+
 '<div class="records-heading"><div><span class="caps">MARCAS EM UMA PARTIDA • '+esc(phase==='regular'?'TEMPORADA REGULAR':'PRÉ-TEMPORADA')+'</span>'+
 '<h2>Mais '+esc(selected[1].toLowerCase())+' em um jogo</h2></div><span class="subtle">Top 20 atuações</span></div>'+
 (top.length?'<div class="records-list">'+top.map((p,i)=>{
  const g=games.get(p.gameId);
  return '<article class="records-entry"><span class="records-place">'+(i+1)+'º</span>'+player(p)+
   '<div class="records-value"><strong>'+format(p[metric],metric)+'</strong><small>'+esc(selected[2])+'</small></div>'+
   '<div class="records-game">'+description(p)+(g?'<a href="'+esc(gameLink(g))+'">Ver jogo ↗</a>':'')+'</div></article>';
 }).join('')+'</div>':'<div class="filler">Ainda não há atuações registradas nesta fase.</div>')+
 '<p class="leaders-disclaimer">Os recordes consideram a estatística alcançada em uma única partida finalizada, sem exigência de mínimo de jogos. '+
 'Cada atuação aparece separadamente, mesmo que um atleta tenha vários jogos entre os melhores. NOTA DLQ é uma avaliação própria, não oficial da NBA. '+
 'Fonte: box scores ESPN já importados no DE LA QUADRA.</p>';
}
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-record-metric]'),season=e.target.closest('[data-record-phase]');
 if(tab)metric=tab.dataset.recordMetric;
 else if(season)phase=season.dataset.recordPhase;
 else return;
 const url=new URL(location.href);
 url.searchParams.set('stat',metric);
 if(phase==='regular')url.searchParams.delete('fase');else url.searchParams.set('fase',phase);
 history.replaceState(null,'',url.pathname+url.search);
 render();
});
(async()=>{
 try{
  const [rounds,leaders,events]=await Promise.all([
   jsonFile('data/player-rounds/2026-27.json'),jsonFile('data/player-leaders/2026-27.json'),loadGames()
  ]);
  if(!Array.isArray(rounds.regular)||!Array.isArray(rounds.preseason))throw Error('Estatísticas incompletas');
  dataset=rounds;players=leaders;
  games=new Map(events.filter(g=>g.externalId||g.id).map(g=>[String(g.externalId||g.id),g]));
 }catch(e){console.warn('DLQ: falha ao carregar recordes',e);error='Não foi possível carregar os recordes. Atualize a página para tentar novamente.';}
 render();
})();
