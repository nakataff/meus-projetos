/* DE LA QUADRA — Início: agora, próximos confrontos, TV brasileira e equipes seguidas. */
import {$,setupShared,loadGames,currentDate,dayShift,groupGames,effectiveGame,path,getData,setSettings,note,handleWishes,esc,broadcastInfo,TEAMS,name,logo,MONTHS,playerLink,jsonFile,gameLink,gameRow,overnightGame,shortDate} from '../app.js?v=13';
import {trackedTeams,teamFollowChange} from '../team-follows.mjs?v=20261103-home-v1';
setupShared('home','A NBA acontece aqui.','Acompanhe os jogos ao vivo, os próximos confrontos e onde assistir no Brasil.');
const root=$('#pageContent');
let games=[],loaded=false,teamIndex=0,resultsExpanded=false;
const followedStats={};
const currentMonth=currentDate().slice(0,7);
const byDate=(a,b)=>String(a.date||'').localeCompare(String(b.date||''))||
 String(a.time||'').localeCompare(String(b.time||'');
const isTeamGame=(g,code)=>g.away===code||g.home===code;
const isLive=g=>effectiveGame(g).status==='live';
const isFinal=g=>effectiveGame(g).status==='final';
const isUpcoming=g=>!isFinal(g)&&!isLive(g)&&g.date>=currentDate();
function listSection(title,href,action,rows,empty,cssClass=''){
 return '<section class="section home-section '+cssClass+'"><div class="section-title"><h2>'+title+'</h2>'+
 '<a class="btn ghost" href="'+path(href)+'">'+esc(action)+' ↗</a></div>'+
 (rows.length?groupGames(rows):'<div class="filler">'+empty+'</div>')+'</section>';
}
function gameForTeam(team){
 const today=currentDate(),mine=games.filter(g=>isTeamGame(g,team));
 const current=mine.filter(isLive).sort(byDate)[0]||null;
 const next=mine.filter(g=>g.date>=today&&isUpcoming(g)).sort(byDate)[0]||null;
 const last=mine.filter(g=>g.date<=today&&isFinal(g)).sort((a,b)=>byDate(b,a))[0]||null;
 return {current,next,last};
}
function teamMatch(g,team,title){
 if(!g)return '<div class="fav-info"><span class="caps">'+title+'</span><b>Aguardando calendário</b>'+
 '<small>Nenhum confronto encontrado no período carregado.</small></div>';
 const other=g.away===team?g.home:g.away,state=effectiveGame(g);
 const hasScore=state.scoreAway!=null&&state.scoreHome!=null;
 const channels=(g.platforms||[]).filter(x=>x==='ESPN'||x==='PRIME').map(x=>x==='ESPN'?'ESPN / Disney+':'Prime Video');
 return '<a class="fav-info" href="'+gameLink(g)+'"><span class="caps">'+title+'</span>'+
 '<div class="fav-info-teams"><img src="'+esc(logo(other))+'" alt="" loading="lazy"><b>'+esc(g.home===team?'vs '+name(other):'@ '+name(other))+'</b></div>'+
 '<strong>'+esc(state.status==='live'?'● AO VIVO':hasScore?state.scoreAway+' – '+state.scoreHome:g.time?g.time+' BRT':'Horário a definir')+'</strong>'+
 '<small>'+esc(shortDate(g.date))+(channels.length?' • '+esc(channels.join(' + ')):'')+'</small></a>';
}
function teamDashboard(){
 const settings=getData().settings,teams=trackedTeams(settings,TEAMS);
 teamIndex=Math.max(0,Math.min(teamIndex,Math.max(0,teams.length-1)));
 const team=teams[teamIndex],untracked=Object.keys(TEAMS).filter(x=>!teams.includes(x))
  .sort((a,b)=>name(a).localeCompare(name(b),'pt-BR'));
 const picker='<label class="home-team-picker"><span class="sr-only">Adicionar equipe seguida</span>'+
 '<select class="control" id="homeAddTeam" aria-label="Adicionar equipe seguida"><option value="">+ Seguir equipe</option>'+
 untracked.map(code=>'<option value="'+esc(code)+'">'+esc(name(code))+'</option>').join('')+'</select></label>';
 if(!team)return '<section class="home-teams home-teams-empty"><div><span class="caps">SUA NBA</span>'+
 '<h2>Acompanhe suas equipes</h2><p>Escolha o primeiro time para ver seus próximos jogos e siga quantas franquias quiser.</p></div>'+
 '<div class="home-team-empty-actions">'+picker+'<a class="btn ghost" href="'+path('equipes/')+'">Ver as 30 equipes ↗</a></div></section>';
 const {current,next,last}=gameForTeam(team),primary=settings.fav===team;
 return '<section class="home-teams" aria-labelledby="home-teams-title">'+
 '<header class="home-teams-head"><div><span class="caps">MINHA NBA</span><h2 id="home-teams-title">Meus times</h2></div>'+
 '<div class="home-teams-tools">'+picker+
 '<div class="home-carousel-controls"><button type="button" data-home-team-step="-1" aria-label="Equipe anterior"'+(!teamIndex?' disabled':'')+'>‹</button>'+
 '<span aria-live="polite">'+(teamIndex+1)+' de '+teams.length+'</span>'+
 '<button type="button" data-home-team-step="1" aria-label="Próxima equipe"'+(teamIndex>=teams.length-1?' disabled':'')+'>›</button></div></div></header>'+
 '<div class="home-team-view" id="homeTeamViewport" role="region" aria-label="Equipe seguida: '+esc(name(team))+'">'+
 '<div class="home-team-identity"><img src="'+esc(logo(team))+'" alt="" loading="lazy">'+
 '<div><span class="caps">'+(primary?'★ MEU TIME PRINCIPAL':'♡ EQUIPE SEGUIDA')+'</span>'+
 '<h3>'+esc(name(team))+'</h3><span class="subtle small">Temporada NBA 2026/27</span></div></div>'+
 '<div class="home-team-overview">'+
 teamMatch(current||next,team,current?'Em quadra agora':'Próxima partida')+
 teamMatch(last,team,'Último resultado')+'</div>'+
 '<div class="home-team-actions"><button type="button" class="btn '+(primary?'accent':'ghost')+'" data-home-team-primary="'+esc(team)+'" aria-pressed="'+primary+'">'+
 (primary?'★ Time principal':'☆ Definir como principal')+'</button>'+
 '<button type="button" class="btn ghost" data-home-team-unfollow="'+esc(team)+'">✓ Seguindo · Deixar de seguir</button>'+
 '<a class="btn ghost" href="'+path('equipe/?id='+encodeURIComponent(team))+'">Ver equipe ↗</a></div></div></section>';
}
function loadFollowedPlayers(rows){
 const codes=[...new Set(rows.map(([,p])=>p.team).filter(Boolean))];
 for(const code of codes){
  if(Object.prototype.hasOwnProperty.call(followedStats,code))continue;
  followedStats[code]=null;
  jsonFile('data/team-stats/'+encodeURIComponent(code)+'.json').then(data=>{followedStats[code]=data;render();})
   .catch(()=>{followedStats[code]={};render();});
 }
}
function followedPlayers(){
 const people=Object.entries(getData().extras.players||{}).filter(([,p])=>p?.favorite&&p?.team).slice(0,5);
 if(!people.length)return '';
 loadFollowedPlayers(people);
 return '<section class="section home-followed-players"><div class="section-title"><h2>Jogadores que sigo</h2>'+
 '<a class="btn ghost" href="'+path('perfil/?tab=seguindo')+'">Ver todos ↗</a></div>'+
 '<div class="followed-home-grid">'+people.map(([id,p])=>{
  const regular=followedStats[p.team]?.regular,pre=followedStats[p.team]?.preseason;
  const stats=regular?.players?.find(x=>String(x.id)===id);
  const use=stats&&stats.gp?stats:pre?.players?.find(x=>String(x.id)===id);
  const average=k=>use?.gp?(Number(use[k]||0)/use.gp).toFixed(1).replace('.',','):'—';
  return '<a class="followed-home-player" href="'+playerLink(id,p.team)+'">'+
   '<img src="https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(id)+'.png" alt="" loading="lazy" referrerpolicy="no-referrer">'+
   '<div><strong>'+esc(p.name||'Jogador #'+id)+'</strong><span>'+esc(name(p.team))+'</span>'+
   '<small>'+(use?.gp?average('pts')+' PTS · '+average('reb')+' REB · '+average('ast')+' AST':'Médias ainda indisponíveis')+'</small></div></a>';
 }).join('')+'</div></section>';
}
function render(){
 if(!loaded)return;
 const today=currentDate(),week=dayShift(today,7);
 const inWindow=games.filter(g=>g.date>=today||overnightGame(g));
 const live=inWindow.filter(isLive).sort((a,b)=>Number(broadcastInfo(b))-Number(broadcastInfo(a))||byDate(a,b));
 const scheduled=inWindow.filter(isUpcoming).sort(byDate);
 // Partidas próximas têm preferência; dentro do recorte de dois dias, priorizar TV brasileira.
 const close=scheduled.filter(g=>g.date<=dayShift(today,2));
 const upcoming=(close.length?close:scheduled.slice(0,12))
  .sort((a,b)=>Number(broadcastInfo(b))-Number(broadcastInfo(a))||byDate(a,b)).slice(0,6);
 const tv=scheduled.filter(broadcastInfo).slice(0,4);
 const watchlist=scheduled.filter(g=>g.date<week&&note(g.id).wish&&!note(g.id).watched).slice(0,5);
 const finished=games.filter(g=>(g.date===today||overnightGame(g))&&isFinal(g)).sort(byDate);
 root.innerHTML=
 (live.length?'<section class="section home-live home-section"><div class="section-title"><h2><span class="home-live-dot"></span> Ao vivo agora <small>('+live.length+')</small></h2>'+
 '<a class="btn ghost" href="'+path('jogos/')+'">Ver todos ↗</a></div>'+groupGames(live.slice(0,5))+'</section>':'')+
 listSection('Próximos jogos','jogos/','Agenda completa',upcoming,'Ainda não há partidas agendadas no período consultado.','home-upcoming')+
 teamDashboard()+
 listSection('Onde assistir no Brasil','jogos/?tv=br','Transmissões',tv,'Nenhuma transmissão brasileira confirmada no calendário carregado.','home-brazil-tv')+
 followedPlayers()+
 '<section class="section home-watchlist"><div class="section-title"><h2>Minha agenda da semana</h2>'+
 '<a class="btn ghost" href="'+path('perfil/?tab=atividade&filtro=desejos')+'">Minha lista ↗</a></div>'+
 (watchlist.length?groupGames(watchlist):'<div class="filler"><b>Monte sua agenda</b>Toque em ♡ nos jogos para salvar os confrontos que deseja acompanhar.</div>')+'</section>'+
 (finished.length?'<section class="section home-results"><details id="homeResults"'+(resultsExpanded?' open':'')+'>'+
 '<summary><span><span class="caps">PLACARES E RESULTADOS</span><strong>Jogos encerrados hoje <small>('+finished.length+')</small></strong></span>'+
 '<span class="home-results-expand">Ver resultados <span aria-hidden="true">⌄</span></span></summary>'+
 '<div class="home-results-body">'+finished.map(gameRow).join('')+'</div></details></section>':'')+
 '<div class="grid leaders-home-shortcuts">'+
 '<a class="card link" href="'+path('equipes/')+'"><div class="caps">Explore</div><h3>🏀 As 30 franquias</h3><p>Conferências, elencos e próximos confrontos.</p></a>'+
 '<a class="card link" href="'+path('melhores/')+'"><div class="caps">Temporada</div><h3>🏅 Melhores jogadores</h3><p>Rankings, recordes e NOTA DLQ.</p></a>'+
 '<a class="card link" href="'+path('perfil/')+'"><div class="caps">Sua jornada</div><h3>☆ Meu perfil</h3><p>Jogos assistidos, conquistas e seus favoritos.</p></a></div>';
}
root.innerHTML='<div class="filler">Carregando próximos jogos…</div>';
const idx=Math.max(MONTHS.indexOf(currentMonth),0);
loadGames(MONTHS.slice(Math.max(0,idx-1),Math.min(idx+2,MONTHS.length))).then(rows=>{games=rows;loaded=true;render();})
 .catch(e=>{console.error(e);root.innerHTML='<div class="filler">Agenda indisponível agora. Atualize a página para tentar novamente.</div>';});
root.addEventListener('click',e=>{
 const arrow=e.target.closest('[data-home-team-step]');
 if(arrow){teamIndex+=Number(arrow.dataset.homeTeamStep);render();return;}
 const primary=e.target.closest('[data-home-team-primary]');
 if(primary){setSettings(teamFollowChange(getData().settings,TEAMS,primary.dataset.homeTeamPrimary,'primary'));render();return;}
 const unfollow=e.target.closest('[data-home-team-unfollow]');
 if(unfollow){
  const code=unfollow.dataset.homeTeamUnfollow;
  setSettings(teamFollowChange(getData().settings,TEAMS,code,'unfollow'));
  teamIndex=Math.max(0,teamIndex-1);render();return;
 }
 if(handleWishes(e.target,render))e.preventDefault();
});
root.addEventListener('change',e=>{
 if(e.target.id!=='homeAddTeam'||!TEAMS[e.target.value])return;
 const code=e.target.value;
 setSettings(teamFollowChange(getData().settings,TEAMS,code,'follow'));
 teamIndex=trackedTeams(getData().settings,TEAMS).indexOf(code);
 render();
});
let touchStart=null;
root.addEventListener('touchstart',e=>{
 if(!e.target.closest?.('#homeTeamViewport')||e.touches.length!==1)return;
 touchStart={x:e.touches[0].clientX,y:e.touches[0].clientY};
},{passive:true});
root.addEventListener('touchend',e=>{
 if(!touchStart||!e.target.closest?.('#homeTeamViewport')){touchStart=null;return;}
 const x=e.changedTouches[0].clientX-touchStart.x,y=e.changedTouches[0].clientY-touchStart.y;
 touchStart=null;
 if(Math.abs(x)<55||Math.abs(x)<=Math.abs(y)*1.3)return;
 teamIndex+=x<0?1:-1;render();
},{passive:true});
root.addEventListener('toggle',e=>{
 if(e.target.id==='homeResults')resultsExpanded=e.target.open;
},true);
window.addEventListener('quadra:refresh',render);
window.addEventListener('quadra:live-update',render);
