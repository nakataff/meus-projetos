import {$,setupShared,loadGames,currentDate,dayShift,groupGames,path,getData,note,handleWishes,esc,broadcastInfo,name,logo,MONTHS,shortDate} from '../app.js?v=5';
setupShared('home','A NBA acontece aqui.','Jogos do dia, transmissões brasileiras e tudo que você quer acompanhar — sem estatísticas pessoais ocupando a tela.');
const root=$('#pageContent');
let games=[],loaded=false;
function section(title,actionLabel,href,body,empty){
 return '<section class="section"><div class="section-title"><h2>'+esc(title)+'</h2><a class="btn ghost" href="'+path(href)+'">'+esc(actionLabel)+' ↗</a></div>'+
 (body.length?groupGames(body):'<div class="filler">'+empty+'</div>')+'</section>';
}
function render(){
 if(!loaded)return;
 const today=currentDate(),tomorrow=dayShift(today,1),week=dayShift(today,7);
 const future=games.filter(g=>g.date>=today);
 const todayGames=future.filter(g=>g.date===today);
 const tv=future.filter(broadcastInfo).slice(0,5);
 const {settings}=getData(),fav=settings.fav;
 const teamGames=fav?future.filter(g=>g.away===fav||g.home===fav).slice(0,3):[];
 const watchlist=future.filter(g=>g.date<week&&note(g.id).wish&&!note(g.id).watched).slice(0,6);
 const nextTomorrow=future.filter(g=>g.date===tomorrow);
 const favHeader=fav?'<div class="favorite-hero"><img src="'+esc(logo(fav))+'" alt="" width="64" height="64"><div><span class="caps">Meu time favorito</span><strong>'+esc(name(fav))+'</strong><span class="small subtle">'+(teamGames.length?'Próximos confrontos na agenda':'Aguardando próximos jogos')+'</span></div><a class="btn" href="'+path('equipe/?id='+encodeURIComponent(fav))+'">Ver equipe ↗</a></div>':
 '<div class="favorite-hero empty"><div><span class="caps">Personalize sua NBA</span><strong>Qual é a sua franquia?</strong><span class="small subtle">Escolha um time para acompanhar seus próximos jogos aqui.</span></div><a class="btn accent" href="'+path('equipes/')+'">Escolher time →</a></div>';
 root.innerHTML=
 favHeader+
 section('Jogos de hoje','Agenda completa','jogos/',todayGames.slice(0,14),'Nenhuma partida prevista para hoje no calendário consultado.')+
 (todayGames.length===0&&nextTomorrow.length?'<div class="small subtle">Próximos jogos amanhã: <a href="'+path('jogos/')+'">'+nextTomorrow.length+' confrontos →</a></div>':'')+
 (fav?section('Próximos jogos do '+name(fav),'Página do time','equipe/?id='+encodeURIComponent(fav),teamGames,'Ainda não há jogos futuros desta equipe no período carregado.'):'')+
 section('Onde assistir no Brasil','Todas as transmissões','jogos/?tv=br',tv,'Ainda não há transmissões brasileiras confirmadas no período carregado.')+
 '<section class="section"><div class="section-title"><h2>Minha agenda da semana</h2><a class="btn ghost" href="'+path('perfil/?tab=atividade&filtro=desejos')+'">Minha lista ↗</a></div>'+
 (watchlist.length?groupGames(watchlist):'<div class="filler"><b>Você ainda não marcou jogos para esta semana</b>Toque no ♡ dos confrontos para montar sua agenda personalizada.</div>')+'</section>'+
 '<div class="grid two"><a class="card link" href="'+path('equipes/')+'"><div class="caps">Explore</div><h3>🏀 As 30 franquias</h3><p>Conferências, elencos, quintetos e próximos jogos.</p></a>'+
 '<a class="card link" href="'+path('perfil/')+'"><div class="caps">Sua jornada</div><h3>☆ Meu perfil</h3><p>Partidas assistidas, rankings, conquistas e dados pessoais.</p></a></div>';
}
root.innerHTML='<div class="filler">Carregando os jogos de hoje…</div>';
const idx=Math.max(MONTHS.indexOf(currentDate().slice(0,7)),0);
loadGames(MONTHS.slice(idx,Math.min(idx+2,MONTHS.length))).then(rows=>{games=rows;loaded=true;render()})
 .catch(e=>{console.error(e);root.innerHTML='<div class="filler">Agenda indisponível no momento. Atualize a página para tentar novamente.</div>'});
root.addEventListener('click',e=>{if(handleWishes(e.target,render))e.preventDefault()});
window.addEventListener('quadra:refresh',render);
