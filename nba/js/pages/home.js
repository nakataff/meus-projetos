import {$,setupShared,loadGames,currentDate,dayShift,groupGames,effectiveGame,path,getData,note,handleWishes,esc,broadcastInfo,name,logo,MONTHS,shortDate,fetchBox,eventBox,playerLink,jsonFile,gameLink,gameRow} from '../app.js?v=11';
import {topPerformance,ratingLabel} from '../performance-rating.js?v=2';
setupShared('home','A NBA acontece aqui.','Jogos, transmissões, estatísticas e tudo sobre a temporada da NBA.');
const root=$('#pageContent');
let games=[],loaded=false;
let lastStar={key:'',ready:false,player:null,rating:null};
let followedStats={};
const currentMonth=currentDate().slice(0,7);
function section(title,actionLabel,href,body,empty){
 return '<section class="section"><div class="section-title"><h2>'+esc(title)+'</h2><a class="btn ghost" href="'+path(href)+'">'+esc(actionLabel)+' ↗</a></div>'+
 (body.length?(title==='Jogos de hoje'?body.map(gameRow).join(''):groupGames(body)):'<div class="filler">'+empty+'</div>')+'</section>';
}

function isTeamGame(g,code){return g.away===code||g.home===code;}
function lastAndNext(fav){
 const today=currentDate(),mine=games.filter(g=>isTeamGame(g,fav));
 const past=mine.filter(g=>g.date<=today&&effectiveGame(g).status==='final')
  .sort((a,b)=>(b.date+' '+b.time).localeCompare(a.date+' '+a.time))[0]||null;
 const next=mine.filter(g=>effectiveGame(g).status!=='final'&&
  effectiveGame(g).status!=='live'&&g.date>=today)
  .sort((a,b)=>(a.date+' '+a.time).localeCompare(b.date+' '+b.time))[0]||null;
 return {past,next};
}
function loadBestPlayer(fav,past){
 const key=fav+':'+String(past?.id||'');
 if(!past||lastStar.key===key)return;
 lastStar={key,ready:false,player:null,rating:null};
 fetchBox(past.date.slice(0,7)).then(boxes=>{
  if(lastStar.key!==key)return;
  const record=eventBox(boxes,past);
  const players=record?.players?.[fav]||[];
  const best=topPerformance({[fav]:players});
  lastStar={key,ready:true,player:best?.player||null,rating:best?.rating??null};
  render();
 }).catch(()=>{if(lastStar.key===key){lastStar.ready=true;render();}});
}
function matchLabel(g,fav){
 if(!g)return '';
 const other=g.away===fav?g.home:g.away;
 return (g.home===fav?'vs ':'@ ')+name(other);
}
function gamePanel(g,fav,title){
 if(!g)return '<div class="fav-info"><span class="caps">'+title+'</span><b>Aguardando calendário</b><small>Nenhum confronto disponível neste período</small></div>';
 const state=effectiveGame(g),hasScore=state.scoreAway!=null&&state.scoreHome!=null;
 return '<a class="fav-info" href="'+gameLink(g)+'"><span class="caps">'+title+'</span>'+
  '<div class="fav-info-teams"><img src="'+esc(logo(g.away===fav?g.home:g.away))+'" alt="" loading="lazy">'+
  '<b>'+esc(matchLabel(g,fav))+'</b></div>'+
  '<strong>'+esc(hasScore?state.scoreAway+' – '+state.scoreHome:
    (state.status==='live'?'AO VIVO':g.time?g.time+' BRT':'Horário a definir'))+'</strong>'+
  '<small>'+esc(shortDate(g.date))+(hasScore?' • Resultado final':'')+'</small></a>';
}
function favoritePanel(fav){
 const {past,next}=lastAndNext(fav);
 loadBestPlayer(fav,past);
 const star=lastStar.ready&&past&&lastStar.key===fav+':'+String(past.id)?lastStar.player:null;
 const standout=star?'<a class="fav-info" href="'+playerLink(star.id,fav)+'"><span class="caps">Destaque do último jogo</span>'+
  '<div class="fav-star"><img src="https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(String(star.id))+'.png" alt="" loading="lazy" referrerpolicy="no-referrer">'+
  '<b>'+esc(star.name)+'</b></div>'+
  '<strong>'+esc(star.pts??'—')+' PTS · '+esc(star.reb??'—')+' REB · '+esc(star.ast??'—')+' AST</strong>'+
  '<small>NOTA DLQ '+ratingLabel(lastStar.rating)+' • Ver perfil →</small></a>':
  '<div class="fav-info"><span class="caps">Destaque do último jogo</span><b>'+(!past?'Sem partida anterior':lastStar.ready?'Estatísticas indisponíveis':'Carregando destaque…')+'</b>'+
  '<small>'+(!past?'Aparece após o primeiro jogo':'Baseado no box score da partida')+'</small></div>';
 return '<section class="favorite-dashboard"><div class="favorite-hero"><img src="'+esc(logo(fav))+'" alt="" width="64" height="64">'+
 '<div><span class="caps">Meu time favorito</span><strong>'+esc(name(fav))+'</strong><span class="small subtle">Temporada 2026/27</span></div>'+
 '<a class="btn" href="'+path('equipe/?id='+encodeURIComponent(fav))+'">Ver equipe ↗</a></div>'+
 '<div class="fav-overview-grid">'+gamePanel(past,fav,'Última partida')+
 gamePanel(next,fav,'Próxima partida')+standout+'</div></section>';
}
function loadFollowedPlayers(rows){
 const keys=[...new Set(rows.map(([,p])=>p.team).filter(Boolean))];
 for(const code of keys){
  if(Object.prototype.hasOwnProperty.call(followedStats,code))continue;
  followedStats[code]=null;
  jsonFile('data/team-stats/'+encodeURIComponent(code)+'.json').then(data=>{
   followedStats[code]=data;render();
  }).catch(()=>{followedStats[code]={};render();});
 }
}
function followedPanel(){
 const people=Object.entries(getData().extras.players||{}).filter(([,p])=>p?.favorite&&p?.team).slice(0,5);
 if(!people.length)return '';
 loadFollowedPlayers(people);
 return '<section class="section"><div class="section-title"><h2>Jogadores que sigo</h2>'+
 '<a class="btn ghost" href="'+path('perfil/?tab=seguindo')+'">Ver todos →</a></div>'+
 '<div class="followed-home-grid">'+people.map(([id,p])=>{
   const regular=followedStats[p.team]?.regular;
   const pre=followedStats[p.team]?.preseason;
   const stats=regular?.players?.find(x=>String(x.id)===id);
   const use=stats&&stats.gp?stats:pre?.players?.find(x=>String(x.id)===id);
   const average=k=>use?.gp?(Number(use[k]||0)/use.gp).toFixed(1).replace('.',','):'—';
   return '<a class="followed-home-player" href="'+playerLink(id,p.team)+'"><img src="https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(id)+'.png" alt="" loading="lazy" referrerpolicy="no-referrer">'+
   '<div><strong>'+esc(p.name||'Jogador #'+id)+'</strong><span>'+esc(name(p.team))+'</span>'+
   '<small>'+ (use?.gp?average('pts')+' PTS · '+average('reb')+' REB · '+average('ast')+' AST':'Médias ainda indisponíveis')+'</small></div></a>';
 }).join('')+'</div><p class="small subtle">Médias por jogo nos dados disponíveis. Toque no atleta para comparar com a liga.</p></section>';
}

function render(){
 if(!loaded)return;
 const today=currentDate(),tomorrow=dayShift(today,1),week=dayShift(today,7);
 const future=games.filter(g=>g.date>=today);
 const todayGames=future.filter(g=>g.date===today);
 const tv=future.filter(broadcastInfo).slice(0,5);
 const {settings}=getData(),fav=settings.fav;
 const watchlist=future.filter(g=>g.date<week&&note(g.id).wish&&!note(g.id).watched).slice(0,6);
 const nextTomorrow=future.filter(g=>g.date===tomorrow);
 const liveNow=future.filter(g=>effectiveGame(g).status==='live');
 const liveNotice=liveNow.length?
  '<div class="live-banner"><span class="live-banner-label"><i aria-hidden="true"></i> AO VIVO AGORA</span>'+
  '<strong>'+liveNow.length+' '+(liveNow.length===1?'partida em andamento':'partidas em andamento')+'</strong>'+
  '<a class="btn" href="'+path('jogos/?data='+today)+'">Ver jogos →</a></div>'+
  groupGames(liveNow.slice(0,4)) : '';
 const favHeader=fav?favoritePanel(fav):
 '<div class="favorite-hero empty"><div><span class="caps">Seu time, sua NBA</span><strong>Escolha seu time favorito</strong><span class="small subtle">Veja o próximo jogo e os destaques da equipe.</span></div><a class="btn accent" href="'+path('equipes/')+'">Escolher time →</a></div>';
 root.innerHTML=
 liveNotice+favHeader+followedPanel()+
 section('Jogos de hoje','Agenda completa','jogos/',todayGames.slice(0,14),'Nenhuma partida prevista para hoje no calendário consultado.')+
 (todayGames.length===0&&nextTomorrow.length?'<div class="small subtle">Próximos jogos amanhã: <a href="'+path('jogos/')+'">'+nextTomorrow.length+' confrontos →</a></div>':'')+

 section('Onde assistir no Brasil','Todas as transmissões','jogos/?tv=br',tv,'Ainda não há transmissões brasileiras confirmadas no período carregado.')+
 '<section class="section"><div class="section-title"><h2>Minha agenda da semana</h2><a class="btn ghost" href="'+path('perfil/?tab=atividade&filtro=desejos')+'">Minha lista ↗</a></div>'+
 (watchlist.length?groupGames(watchlist):'<div class="filler"><b>Você ainda não marcou jogos para esta semana</b>Toque no ♡ dos confrontos para montar sua agenda personalizada.</div>')+'</section>'+
 '<div class="grid two"><a class="card link" href="'+path('equipes/')+'"><div class="caps">Explore</div><h3>🏀 As 30 franquias</h3><p>Conferências, elencos, quintetos e próximos jogos.</p></a>'+
 '<a class="card link" href="'+path('perfil/')+'"><div class="caps">Sua jornada</div><h3>☆ Meu perfil</h3><p>Partidas assistidas, rankings, conquistas e dados pessoais.</p></a></div>';
}
root.innerHTML='<div class="filler">Carregando os jogos de hoje…</div>';
const idx=Math.max(MONTHS.indexOf(currentMonth),0);
loadGames(MONTHS.slice(Math.max(0,idx-1),Math.min(idx+2,MONTHS.length))).then(rows=>{games=rows;loaded=true;render()})
 .catch(e=>{console.error(e);root.innerHTML='<div class="filler">Agenda indisponível no momento. Atualize a página para tentar novamente.</div>'});
root.addEventListener('click',e=>{if(handleWishes(e.target,render))e.preventDefault()});
window.addEventListener('quadra:refresh',render);
window.addEventListener('quadra:live-update',render);
