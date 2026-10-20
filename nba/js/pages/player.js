/* Perfil de atleta QUADRA — temporada, jogos, ficha compartilhável. */
import {$,setupShared,qs,TEAMS,name,logo,esc,fetchRoster,fetchBox,fetchMonth,MONTHS,
 currentDate,getData,modify,teamLink,gameLink,shortDate,toast,path} from '../app.js?v=7';
import {fetchLiveBoxscore} from '../boxscore.js?v=1';
import {exportPlayerImage,sharePlayerLink} from '../share-card.js?v=1';

const pid=qs('id')||'',rawTeam=(qs('team')||'').toUpperCase();
const highlightGame=qs('game')||'',hintDate=qs('data')||'';
const root=$('#pageContent');
setupShared('teams','Perfil do jogador','Médias da temporada, histórico por jogo e desempenho compartilhável.');
let team=TEAMS[rawTeam]?rawTeam:'',player=null,gameStats=[],selectedMonth='all',selectedGame=highlightGame,
 sort='recent',onlyStarters=false,loading=false;
const percentField=value=>value!==undefined&&value!==null&&value!==''?value:'—';
function getPlayer(){return getData().extras.players?.[pid]||{};}
function refGameID(event){return String(event.id||'').replace(/^espn_/,'');}
function shareURL(event){
 const source=String(event?.id||highlightGame).replace(/^espn_/,'');
 const date=event?.date||hintDate;
 const url=new URL(location.href);
 url.searchParams.set('id',pid);
 url.searchParams.set('team',team);
 url.searchParams.set('game',source);
 if(date)url.searchParams.set('data',date);
 return url.toString();
}
function statNumber(p,key){
 if(p?.[key]===undefined||p?.[key]===null||p[key]==='')return null;
 if(key==='min'){const raw=String(p[key]).replace("'",'');const m=raw.match(/(\d+):(\d+)/);return m?+m[1]+ +m[2]/60:(Number(raw)||null);}
 if(key==='three'||key==='fg'){
  const n=Number(String(p[key]).split('-')[0]);return Number.isFinite(n)?n:null;
 }
 const n=Number(p[key]);return Number.isFinite(n)?n:null;
}
function avg(rows,key){
 const vals=rows.map(x=>statNumber(x.row,key)).filter(x=>x!==null);
 if(!vals.length)return '—';
 return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1).replace('.',',');
}
function renderStat(label,value){return '<div class="player-season-metric"><span>'+label+'</span><strong>'+esc(value)+'</strong></div>';}
function metrics(rows){
 return '<div class="player-season-metrics">'+
 renderStat('JOGOS',rows.length)+renderStat('PTS / JOGO',avg(rows,'pts'))+
 renderStat('REB / JOGO',avg(rows,'reb'))+renderStat('AST / JOGO',avg(rows,'ast'))+
 renderStat('MIN / JOGO',avg(rows,'min'))+renderStat('STL / JOGO',avg(rows,'stl'))+
 renderStat('BLK / JOGO',avg(rows,'blk'))+renderStat('3PT / JOGO',avg(rows,'three'))+'</div>';
}
function matchingGames(){
 let rows=gameStats.filter(g=>
  (selectedMonth==='all'||g.date.startsWith(selectedMonth))&&
  (!onlyStarters||g.row.starter)&&(!selectedGame||refGameID(g.event)===selectedGame));
 rows=rows.slice();
 if(sort==='pts')rows.sort((a,b)=>(statNumber(b.row,'pts')??-1)-(statNumber(a.row,'pts')??-1));
 else if(sort==='old')rows.sort((a,b)=>a.date.localeCompare(b.date));
 else rows.sort((a,b)=>b.date.localeCompare(a.date));
 return rows;
}
function formatScore(event){
 if(event.scoreAway!=null&&event.scoreHome!=null)return event.scoreAway+' - '+event.scoreHome;
 return '';
}
function matchDetail(g){
 if(!g)return '';
 const s=g.row,e=g.event,opp=g.opponent;
 return '<section class="player-featured-game"><div class="player-featured-top"><div><span class="eyebrow">DESEMPENHO NESTA PARTIDA</span>'+
 '<h3>'+esc(name(team))+' x '+esc(name(opp))+'</h3><span>'+esc(shortDate(g.date))+
 ' • '+(s.starter?'Titular':'Reserva')+(formatScore(e)?' • '+esc(formatScore(e)):'')+'</span></div>'+
 '<div class="player-featured-logos"><img src="'+esc(logo(team))+'" alt="">'+
 '<span>VS</span><img src="'+esc(logo(opp))+'" alt=""></div></div>'+
 '<div class="player-featured-metrics">'+[
  ['pts','PTS'],['reb','REB'],['ast','AST'],['min','MIN'],['stl','STL'],['blk','BLK'],['fg','FG'],['three','3PT'],['to','TOV'],['plusMinus','+/-']
 ].map(([key,label])=>'<div><strong>'+esc(percentField(s[key]))+'</strong><span>'+label+'</span></div>').join('')+'</div>'+
 '<div class="player-featured-actions"><button class="btn accent" type="button" id="exportFeaturedCard">⇩ Gerar imagem PNG</button>'+
 '<button class="btn" type="button" id="shareFeatured">↗ Compartilhar</button>'+
 '<a class="btn ghost" href="'+gameLink({id:e.id,date:e.date})+'">Abrir partida →</a></div>'+
 '<p class="small subtle">Dados públicos desta partida. Durante jogos ao vivo, podem ser parciais.</p></section>';
}
function profileHTML(){
 if(!player){root.innerHTML='<div class="filler"><b>Jogador não encontrado</b>Acesse o elenco da equipe para abrir o perfil.</div>';return;}
 document.title=player.name+' • QUADRA NBA';
 const x=getData().extras,p=getPlayer(),franchise=x.franchise?.[team]===pid;
 const all=gameStats.slice().sort((a,b)=>b.date.localeCompare(a.date));
 const months=[...new Set(all.map(g=>g.date.slice(0,7)))];
 const selected=all.find(g=>refGameID(g.event)===selectedGame);
 const visible=matchingGames();
 const title=selectedGame?'Partida selecionada':'Temporada 2026/27';
 const options=all.map(g=>'<option value="'+esc(refGameID(g.event))+'"'+(selectedGame===refGameID(g.event)?' selected':'')+'>'+
 esc(shortDate(g.date)+' • '+name(g.opponent))+'</option>').join('');
 root.innerHTML=
 '<section class="team-hero player-profile-hero">'+
 '<img src="'+esc(player.headshot||logo(team))+'" alt="" referrerpolicy="no-referrer" onerror="this.src=\''+esc(logo(team))+'\'">'+
 '<div><div class="eyebrow">'+esc(name(team))+' • '+esc(player.position||'NBA')+'</div>'+
 '<h2>'+esc(player.name)+'</h2><p>#'+esc(player.number||'—')+' • Temporada 2026/27</p>'+
 '<div class="controls"><a href="'+teamLink(team)+'" class="btn ghost">← Elenco</a>'+
 (franchise?'<span class="tag accent">★ Meu franchise player</span>':'')+
 (p.favorite?'<span class="tag">♥ Favorito</span>':'')+'</div></div></section>'+
 (selected?matchDetail(selected):selectedGame?
  '<div class="info">Este jogo ainda não possui estatísticas individuais disponíveis. Os resultados aparecerão quando a fonte publicar o box score.</div>':'')+
 '<section class="section"><div class="section-title"><h2>Médias dos jogos importados</h2><span class="small subtle">'+all.length+' jogos disponíveis (inclusive pré-temporada, quando houver)</span></div>'+
 metrics(all)+'</section>'+
 '<section class="section"><div class="section-title"><h2>Histórico por partida</h2>'+
 '<span class="small subtle">'+visible.length+' partidas no filtro</span></div>'+
 '<div class="player-game-filters"><label>Mês<select class="control" id="playerMonth"><option value="all">Todos</option>'+
 months.map(m=>'<option value="'+m+'"'+(selectedMonth===m?' selected':'')+'>'+
 esc(new Date(m+'-15T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'}))+'</option>').join('')+'</select></label>'+
 '<label>Jogo<select class="control" id="playerGame"><option value="">Todas as partidas</option>'+options+'</select></label>'+
 '<label>Ordem<select class="control" id="playerSort"><option value="recent"'+(sort==='recent'?' selected':'')+'>Mais recentes</option>'+
 '<option value="old"'+(sort==='old'?' selected':'')+'>Mais antigos</option><option value="pts"'+(sort==='pts'?' selected':'')+'>Mais pontos</option></select></label>'+
 '<label class="player-starter-toggle"><input type="checkbox" id="playerOnlyStarters"'+(onlyStarters?' checked':'')+'> Somente titular</label></div>'+
 (visible.length?'<div class="player-games-list">'+visible.map(g=>'<a class="player-game-row" href="'+esc(shareURL(g.event))+'">'+
 '<span class="player-game-date">'+esc(shortDate(g.date))+'</span>'+
 '<img src="'+esc(logo(g.opponent))+'" alt="" loading="lazy">'+
 '<span class="player-game-opp"><b>'+esc(name(g.opponent))+'</b><small>'+(
 g.row.starter?'Titular':'Reserva')+'</small></span>'+
 [['pts','PTS'],['reb','REB'],['ast','AST']].map(([key,lab])=>'<span class="player-game-num"><b>'+
 esc(percentField(g.row[key]))+'</b><small>'+lab+'</small></span>').join('')+
 '<span aria-hidden="true">›</span></a>').join('')+'</div>':
 '<div class="filler">Nenhum jogo com esses filtros.</div>')+'</section>'+
 '<section class="card section"><h3>Minha avaliação do jogador</h3>'+
 '<p>Uma nota pessoal para a temporada, sincronizada com sua conta Google.</p>'+
 '<form id="playerProfile"><div class="field"><label>Minha nota: <span id="currentRating">'+esc(p.rating||0)+'</span>/10</label>'+
 '<input class="rate-input" type="range" id="rateProfile" min="0" max="10" step="0.5" value="'+esc(p.rating||0)+'"></div>'+
 '<div class="controls"><label><input type="checkbox" id="favoritePlayer"'+(p.favorite?' checked':'')+'> Jogador favorito</label>'+
 '<label><input type="checkbox" id="franchisePlayer"'+(franchise?' checked':'')+'> Meu franchise player</label></div>'+
 '<button type="submit" class="btn accent">Salvar avaliação ✓</button></form></section>';
}
function setSelectedGame(id){
 selectedGame=id;
 const url=new URL(location.href);
 if(id){
  url.searchParams.set('game',id);
  const row=gameStats.find(g=>refGameID(g.event)===id);
  if(row)url.searchParams.set('data',row.date);
 }else{url.searchParams.delete('game');url.searchParams.delete('data');}
 history.replaceState(null,'',url.pathname+url.search);
 profileHTML();
}
root.addEventListener('input',e=>{if(e.target.id==='rateProfile')$('#currentRating').textContent=e.target.value;});
root.addEventListener('change',e=>{
 if(e.target.id==='playerMonth'){
  selectedMonth=e.target.value;
  if(selectedGame&&!gameStats.some(g=>refGameID(g.event)===selectedGame &&
    (selectedMonth==='all'||g.date.startsWith(selectedMonth))))setSelectedGame('');
  else profileHTML();
 }
 if(e.target.id==='playerGame')setSelectedGame(e.target.value);
 if(e.target.id==='playerSort'){sort=e.target.value;profileHTML();}
 if(e.target.id==='playerOnlyStarters'){onlyStarters=e.target.checked;profileHTML();}
});
root.addEventListener('submit',e=>{
 if(e.target.id!=='playerProfile')return;e.preventDefault();
 const rated=+$('#rateProfile').value,fav=$('#favoritePlayer').checked,star=$('#franchisePlayer').checked;
 modify(b=>{
  const old=b.extras.players[pid]||{};
  b.extras.players[pid]={...old,name:player.name,team,rating:rated,favorite:fav};
  if(star)b.extras.franchise[team]=pid;
  else if(b.extras.franchise[team]===pid)delete b.extras.franchise[team];
  b.extras.updatedAt=new Date().toISOString();
 });
 toast('Avaliação salva');profileHTML();
});
root.addEventListener('click',async e=>{
 const exportButton=e.target.closest('#exportFeaturedCard'),shareButton=e.target.closest('#shareFeatured');
 if(!exportButton&&!shareButton)return;
 const chosen=gameStats.find(g=>refGameID(g.event)===selectedGame);
 if(!chosen)return toast('Dados desta partida indisponíveis.');
 const link=shareURL(chosen.event);
 if(shareButton){
  try{const result=await sharePlayerLink(link,'QUADRA • '+player.name+' — '+shortDate(chosen.date));
   if(result==='copied')toast('Link copiado!');}
  catch(e){toast('Não foi possível compartilhar: '+e.message);}
  return;
 }
 exportButton.disabled=true;exportButton.textContent='Preparando PNG…';
 try{
  await exportPlayerImage({
   player:chosen.row,teamCode:team,teamName:name(team),teamLogo:logo(team),
   headshot:player.headshot,
   opponent:name(chosen.opponent),opponentLogo:logo(chosen.opponent),
   gameLabel:name(team)+' x '+name(chosen.opponent),date:shortDate(chosen.date),
   score:formatScore(chosen.event),
   filename:'QUADRA-'+player.name.replace(/\s+/g,'-')+'-'+chosen.date
  });
  toast('Imagem PNG gerada!');
 }catch(err){toast('Erro ao gerar imagem: '+err.message);}
 finally{exportButton.disabled=false;exportButton.textContent='⇩ Gerar imagem PNG';}
});
window.addEventListener('quadra:refresh',profileHTML);
async function boot(){
 try{
  if(!/^[0-9]+$/.test(pid))throw Error('ID de jogador inválido.');
  if(team){
   const people=await fetchRoster(team);
   player=people.find(p=>String(p.id)===pid)||null;
  }else{
   for(const c of Object.keys(TEAMS)){
    const rows=await fetchRoster(c).catch(()=>[]);
    const found=rows.find(p=>String(p.id)===pid);
    if(found){player=found;team=c;break;}
   }
  }
  // Atletas recém-contratados podem ainda não constar do JSON de elenco.
  // Procurar pelo ID nos box scores antes de considerar o perfil indisponível.
  const present=currentDate().slice(0,7);
  const selectedMonthHint=/^\d{4}-\d{2}-\d{2}$/.test(hintDate)?hintDate.slice(0,7):'';
  const past=MONTHS.filter(m=>m<=present||m===selectedMonthHint);
  const boxes=await Promise.all(past.map(fetchBox));
  const found=new Set();
  for(const data of boxes)for(const item of Object.values(data)){
   const row=item.players?.[team]?.find(p=>String(p.id)===pid);
   if(!row)continue;
   const key=refGameID(item);if(found.has(key))continue;found.add(key);
   gameStats.push({row,date:item.date,opponent:item.away===team?item.home:item.away,event:item});
  }
  // Links de partidas ainda não incluídas nos JSONs: carregar apenas o confronto solicitado.
  if(highlightGame&&!gameStats.some(g=>refGameID(g.event)===highlightGame) && selectedMonthHint){
   const monthMatches=await fetchMonth(selectedMonthHint);
   const info=monthMatches.find(g=>String(g.id)===highlightGame);
   if(info){
    const match={...info,externalId:String(info.id),id:highlightGame};
    try{
     const fresh=await fetchLiveBoxscore(match);
     const row=fresh?.box?.players?.[team]?.find(p=>String(p.id)===pid);
     if(row)gameStats.push({row,date:match.date,opponent:match.away===team?match.home:match.away,
      event:{...match,scoreAway:fresh.scoreAway,scoreHome:fresh.scoreHome}});
    }catch(e){console.info('QUADRA: card compartilhado ainda não disponível',e);}
   }
  }
  if(!player){
   const known=gameStats.find(g=>g.row?.name)?.row;
   player=known?{
    id:pid,name:known.name,number:known.number||'',position:known.position||'',
    headshot:'https://a.espncdn.com/i/headshots/nba/players/full/'+pid+'.png'
   }:{id:pid,name:'Jogador #'+pid,number:'',position:'',headshot:''};
  }
  profileHTML();
 }catch(e){console.warn('QUADRA: falha no perfil do atleta',e);root.innerHTML='<div class="filler">'+esc(e.message)+'</div>';}
}
root.innerHTML='<div class="filler">Carregando estatísticas da temporada…</div>';
boot();
