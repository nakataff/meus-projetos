import {$,setupShared,qs,esc,name,logo,tlogo,effectiveGame,path,teamLink,playerLink,loadGames,MONTHS,fetchBox,note,getData,setNote,setExtraGroup,platform,shortDate,currentDate,toast,modal,closeModal,eventBox,fetchRoster} from '../app.js?v=7';
import {fetchLiveBoxscore,projectStartingFive} from '../boxscore.js?v=1';
const id=qs('id')||'',hint=qs('data')||'',root=$('#pageContent');
setupShared('games','Centro da partida','Escalações, estatísticas e seu diário pessoal de basquete.');
let game=null,boxes={},box=null,probable={},rosters={},tab='resumo';
let statsSort='pts',statsAsc=false;
let statsTeam=typeof window.matchMedia==='function'&&window.matchMedia('(max-width:980px)').matches?'away':'both';
let statsDetail=false;
let remoteBox=null,remoteStatus=null,lastStatsCheck=0,checkingStats=false,statsMessage='',lastSuccess=null;
const REFRESH_MS=120000;
function gameStatus(){
 const event=effectiveGame(game);
 if(!remoteStatus)return event;
 const out={...event};
 if(remoteStatus.status==='live'||remoteStatus.status==='final'){
  out.status=remoteStatus.status;
  if(remoteStatus.scoreAway!==null && remoteStatus.scoreHome!==null){
   out.scoreAway=remoteStatus.scoreAway;out.scoreHome=remoteStatus.scoreHome;
  }
  if(remoteStatus.status==='live'){
   out.livePeriod=remoteStatus.quarter||event.livePeriod||0;
   out.liveClock=remoteStatus.clock||event.liveClock||'';
  }
 }
 return out;
}
function boxHasStats(record,requireBoth=false){
 if(!record?.players)return false;
 const hasStats=p=>p?.hasStats===true||p?.pts!==null&&p?.pts!==undefined;
 if(requireBoth)return [game.away,game.home].every(code=>(record.players[code]||[]).filter(hasStats).length>=5);
 return Object.values(record.players).some(list=>list.some(hasStats));
}
function updateBox(){
 const cached=eventBox(boxes,game);
 const fresh=remoteBox;
 if(fresh){
  // Um box score final já consolidado não deve ser substituído por dados incompletos.
  const count=x=>Object.values(x?.players||{}).reduce((a,players)=>a+players.filter(p=>p.hasStats||p.pts!==null&&p.pts!==undefined).length,0);
  const useFresh=!cached||gameStatus().status==='live'||count(fresh)>=count(cached);
  box=useFresh?fresh:cached;
 } else box=cached||null;
}
function needsBoxRefresh(){
 if(!game)return false;
 const status=gameStatus().status;
 if(status==='live')return true;
 if(game.date>currentDate())return false; // Antes da partida só consultar na abertura ou manualmente.
 if(status==='scheduled')return true; // Aguardando início/resultado.
 if(status==='final'){
  const complete=boxHasStats(box,true);
  // Parar de consultar quando já temos estatísticas finais consolidadas.
  if(complete && (!remoteStatus || remoteStatus.status==='final'))return false;
  // Se só temos números parciais, tentar buscar o box score definitivo.
  return game.date>=new Date(Date.parse(currentDate()+'T12:00:00Z')-2*86400000).toISOString().slice(0,10);
 }
 return false;
}
function sourceNotice(){
 const status=gameStatus().status;
 const ready=boxHasStats(box);
 const label=status==='live'?(ready?'Ao vivo • Parciais disponíveis':'Ao vivo • Aguardando estatísticas'):
  status==='final'?(ready?'Box score disponível':'Final • Aguardando box score'):
  'Pré-jogo • Escalações e informações';
 const last=lastSuccess?'Atualizado às '+lastSuccess.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Fonte: ESPN';
 const unavailable=/indisponível|não foi possível|falha|sem atualização/i.test(statsMessage);
 return '<div class="game-sync-inline" role="status" title="'+esc(statsMessage||'Dados da partida consultados de fonte pública não oficial')+'">'+
 '<span class="game-sync-dot '+(status==='live'?'is-live':unavailable?'is-warning':'')+'"></span>'+
 '<span class="game-sync-label">'+esc(label)+'</span>'+
 '<span class="game-sync-time">'+esc(unavailable?statsMessage:last)+'</span>'+
 '<button class="game-sync-refresh" type="button" id="refreshBox" aria-label="Atualizar escalações e estatísticas" title="Atualizar escalações e estatísticas" '+(checkingStats?'disabled':'')+'>'+
 (checkingStats?'Consultando…':'↻ Atualizar')+'</button></div>';
}
async function refreshBox(force=false){
 if(!game||checkingStats||document.hidden)return;
 const now=Date.now();
 if(!force&&now-lastStatsCheck<REFRESH_MS-20000)return;
 lastStatsCheck=now;
 checkingStats=true;statsMessage='Buscando escalações e box score na fonte pública…';
 if(tab!=='avaliar')draw();
 try{
  const result=await fetchLiveBoxscore(game);
  if(result){
   remoteStatus=result;remoteBox=result.box||remoteBox;
   lastSuccess=new Date();
   updateBox();
   const current=gameStatus().status;
   const confirmed=Object.values(result.starters||{}).some(n=>n>0);
   statsMessage=result.hasStats?
    (current==='live'?'Estatísticas parciais disponíveis.':'Estatísticas recebidas da partida.'):
    confirmed?'Titulares identificados; aguardando estatísticas individuais.':
    current==='scheduled'?'Quinteto oficial ainda não divulgado.':'Aguardando box score da fonte.';
  }else statsMessage=box?'Exibindo dados já importados; sem atualização nova.':'A fonte ainda não disponibilizou escalações ou box score.';
 }catch(err){
  console.warn('QUADRA: não foi possível obter box score da ESPN',err);
  statsMessage=box?'Consulta indisponível; exibindo os dados importados.':
   'Consulta indisponível no momento; projeções anteriores continuam disponíveis.';
 }finally{checkingStats=false;if(tab!=='avaliar')draw();}
}

const maybeMonth=hint.slice(0,7),months=MONTHS.includes(maybeMonth)?[maybeMonth]:MONTHS;
const statFields=[
 {key:'pts',label:'PTS',title:'Pontos'},
 {key:'reb',label:'REB',title:'Rebotes'},
 {key:'ast',label:'AST',title:'Assistências'},
 {key:'min',label:'MIN',title:'Minutos'},
 {key:'three',label:'3PT',title:'Bolas de 3 convertidas'},
 {key:'stl',label:'STL',title:'Roubos de bola'},
 {key:'blk',label:'BLK',title:'Tocos'},
 {key:'fg',label:'FG',title:'Arremessos convertidos'},
 {key:'to',label:'TOV',title:'Turnovers'},
 {key:'plusMinus',label:'+/-',title:'Saldo de pontos'}
];
function statValue(player,key){
 const value=player?.[key];
 if(value===undefined||value===null||value===''||value==='—')return null;
 if(key==='min'){
  const text=String(value).replace("'",'').trim();
  const mmss=text.match(/^(\d+):(\d{1,2})$/);
  if(mmss)return Number(mmss[1])+Number(mmss[2])/60;
  const minutes=parseFloat(text);
  return Number.isFinite(minutes)?minutes:null;
 }
 if(key==='three'||key==='fg'){
  const n=Number(String(value).split('-')[0]);
  return Number.isFinite(n)?n:null;
 }
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}
function scorePlayers(code){
 const rows=(box?.players?.[code]||[]).filter(p=>p.id&&p.name);
 return rows.slice().sort((a,b)=>{
  const av=statValue(a,statsSort),bv=statValue(b,statsSort);
  if(av===null && bv!==null)return 1;
  if(bv===null && av!==null)return -1;
  const delta=(av??0)-(bv??0);
  if(delta!==0)return statsAsc?delta:-delta;
  const tie=(statValue(b,'pts')??0)-(statValue(a,'pts')??0);
  return tie || String(a.name).localeCompare(String(b.name),'pt-BR');
 });
}
function statHeader(field){
 const active=statsSort===field.key;
 return '<th scope="col" class="'+(active?'stat-selected':'')+'"><button type="button" class="stat-heading" data-stats-sort="'+esc(field.key)+
 '" aria-label="Ordenar por '+esc(field.title)+(active?(statsAsc?', crescente':', decrescente'):'')+
 '" title="'+esc(field.title)+'">'+field.label+(active?'<span aria-hidden="true">'+(statsAsc?' ↑':' ↓')+'</span>':'')+'</button></th>';
}
function playerPortrait(p,code){
 const head=rosters[code]?.find(x=>String(x.id)===String(p.id))?.headshot;
 return head&&/^https:\/\//.test(head)?'<img src="'+esc(head)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" class="boxscore-headshot" onerror="this.style.display=\'none\'">':
 '<span class="boxscore-placeholder" aria-hidden="true">'+esc(String(p.name||'?').charAt(0))+'</span>';
}
function statText(player,key){
 const value=player?.[key];
 if(value===undefined||value===null||value===''||value==='—')return '—';
 return esc(value);
}
function playerStats(code){
 const rows=scorePlayers(code);
 if(!rows.length)return '<div class="filler"><b>Sem números para '+esc(name(code))+'</b>O box score desta equipe ainda não foi disponibilizado.</div>';
 const ratings=getData().extras,chosenMvp=String(ratings.gameMvp?.[game.id]||'');
 const basic=['min','pts','reb','ast','three'];
 // Mesmo na visão compacta, sempre exibir a coluna escolhida na ordenação.
 if(!basic.includes(statsSort))basic[basic.length-1]=statsSort;
 const cols=statsDetail?['min','pts','reb','ast','stl','blk','fg','three','to','plusMinus']:basic;
 const tr=rows.map((p,index)=>{
  const id=String(p.id),rating=ratings.gameRatings?.[game.id+':'+id];
  const mvp=chosenMvp===id;
  return '<tr class="'+(p.starter?'boxscore-starter':'')+'">'+
  '<th scope="row"><div class="boxscore-player">'+playerPortrait(p,code)+
  '<div class="boxscore-player-info"><a href="'+playerLink(id,code)+'" title="'+esc(p.name)+'">'+esc(p.name)+'</a>'+
  '<small>'+esc(p.number?'#'+p.number+' • ':'')+(p.starter?'TITULAR':'RESERVA')+'</small></div></div></th>'+
  cols.map(key=>'<td class="'+(statsSort===key?'stat-selected':'')+'">'+statText(p,key)+'</td>').join('')+
  '<td class="boxscore-actions"><button type="button" data-player-rating="'+esc(id)+'" data-player-team="'+esc(code)+
  '" class="boxscore-rating" title="Avaliar '+esc(p.name)+'" aria-label="Dar nota para '+esc(p.name)+'">'+
  (rating!==undefined?'★ '+esc(rating):'☆')+'</button>'+
  '<button type="button" class="boxscore-mvp'+(mvp?' chosen':'')+'" data-mvp="'+esc(id)+'" title="'+(mvp?'Meu MVP':'Escolher MVP')+
  '" aria-label="'+(mvp?'MVP selecionado':'Escolher '+esc(p.name)+' como MVP')+'">'+(mvp?'★':'MVP')+'</button></td></tr>';
 }).join('');
 return '<div class="boxscore-scroll"><table class="boxscore-table '+(statsDetail?'expanded':'')+'"><thead><tr><th scope="col">Jogador</th>'+
 cols.map(key=>statHeader(statFields.find(f=>f.key===key))).join('')+
 '<th scope="col" class="boxscore-actions-title">Minha nota / MVP</th></tr></thead><tbody>'+tr+'</tbody></table></div>';
}
function boxscorePanel(code){
 const stats=(box?.players?.[code]||[]).filter(p=>p.hasStats===true||p.pts!==null&&p.pts!==undefined);
 const players=(box?.players?.[code]||[]).length;
 const selected=statsTeam==='both'||(statsTeam==='away'?code===game.away:code===game.home);
 return '<section class="boxscore-team'+(selected?' is-selected':'')+'" data-score-team="'+esc(code)+'">'+
 '<div class="boxscore-team-head"><img src="'+esc(logo(code))+'" alt="" loading="lazy">'+
 '<div><strong>'+esc(name(code))+'</strong><span>'+stats.length+' atletas com dados'+(players>stats.length?' • '+players+' relacionados':'')+'</span></div>'+
 '</div>'+playerStats(code)+'</section>';
}
function boxscoreArea(){
 const teams=[['both','Ambos'],['away',game.away],['home',game.home]];
 const sortOptions=statFields.map(f=>'<option value="'+f.key+'"'+(statsSort===f.key?' selected':'')+'>'+f.title+'</option>').join('');
 return '<div class="boxscore-interface">'+
 '<div class="boxscore-toolbar"><div class="boxscore-filter" aria-label="Visualizar estatísticas da equipe">'+
 teams.map(([key,label])=>'<button type="button" class="boxscore-team-choice'+(statsTeam===key?' active':'')+
 '" data-stats-team="'+key+'" aria-pressed="'+(statsTeam===key)+'">'+esc(label)+'</button>').join('')+'</div>'+
 '<div class="boxscore-sort-controls"><label for="boxscoreSort">Ordenar por</label>'+
 '<select id="boxscoreSort" class="control" aria-label="Ordenar jogadores por estatística">'+sortOptions+'</select>'+
 '<button type="button" class="btn ghost boxscore-order" data-toggle-stats-direction title="Inverter ordem">'+(statsAsc?'↑ Crescente':'↓ Decrescente')+'</button>'+
 '<button type="button" class="btn ghost boxscore-detail" data-toggle-stats-detail aria-pressed="'+statsDetail+'">'+
 (statsDetail?'Menos dados':'Mais dados')+'</button></div></div>'+
 '<p class="boxscore-hint">Clique no nome da estatística para ordenar. As duas equipes seguem a mesma classificação. '+(statsDetail?'Arraste a tabela para ver todas as colunas no celular.':'')+'</p>'+
 '<div class="boxscore-panels '+(statsTeam==='both'?'view-both':'view-single')+'">'+
 boxscorePanel(game.away)+boxscorePanel(game.home)+'</div></div>';
}
function starterList(code){
 // A marcação explícita de starter vem do box score, nunca do elenco.
 const confirmed=(box?.players?.[code]||[]).filter(p=>p.starter);
 if(confirmed.length)return {
  list:confirmed,
  label:confirmed.length>=5?'Quinteto titular confirmado':'Titulares identificados até agora ('+confirmed.length+'/5)',
  date:game.date,confirmed:true
 };
 const previous=probable[code];
 if(previous?.players?.length)return {
  list:previous.players,label:'PROJEÇÃO • últimos '+previous.sample+' jogos com quinteto conhecido',
  date:previous.lastDate,confirmed:false
 };
 return {list:[],label:'Quinteto ainda não disponível',confirmed:false};
}
function lineupPanel(code){
 const info=starterList(code);
 const others=(box?.players?.[code]||[]).filter(p=>!p.starter);
 return '<section class="card"><div class="section-title"><h2>'+esc(name(code))+'</h2><a href="'+teamLink(code)+'" class="btn ghost">Ver elenco →</a></div>'+
 '<p class="lineup-caption '+(info.confirmed?'confirmed':'estimated')+'">'+
 (info.confirmed?'<span class="tag finished">✓ CONFIRMADO</span>':'<span class="tag dim">◇ NÃO OFICIAL</span>')+' '+esc(info.label)+
 (info.date?' • Base: '+shortDate(info.date):'')+'</p>'+
 (info.list.length?'<div>'+info.list.map(p=>'<div class="player-row"><div class="pname"><b><a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a></b>'+
 '<small>'+esc(p.number?'#'+p.number+' • ':'')+(info.confirmed?'Titular informado pela fonte':'Previsão estatística, não confirmada')+'</small></div>'+
 '<a class="btn" href="'+playerLink(p.id,code)+'">Perfil</a></div>').join('')+'</div>':
 '<div class="filler">Ainda não há cinco titulares anteriores suficientes para uma projeção confiável.</div>')+
 (others.length?'<p class="small subtle" style="margin-top:16px">Outros atletas registrados no box score: '+others.length+'</p>':'')+'</section>';
}
function scoreboard(){
 const event=gameStatus(),p=note(game.id),final=event.status==='final',live=event.status==='live';
 const hasManual=p.scoreAway!==''&&p.scoreHome!==''&&p.scoreAway!=null&&p.scoreHome!=null;
 const scoreAvailable=(final||live)&&event.scoreAway!=null&&event.scoreHome!=null;
 const scores=scoreAvailable?[event.scoreAway,event.scoreHome]:hasManual?[p.scoreAway,p.scoreHome]:null;
 const type=typeof game.stage==='string' && isNaN(Number(game.stage))?game.stage:
  Number(game.stage)===1?'Pré-temporada':Number(game.stage)===3?'Playoffs':'Temporada regular';
 const period=Number(event.livePeriod||0);
 const phase=period>4?'Prorrogação':period>0?period+'º quarto':'Ao vivo';
 return '<section class="card"><div class="eyebrow center">'+esc(type)+' • '+esc(shortDate(game.date))+' • '+esc(game.time||'Hora a definir')+' BRT</div>'+
 '<div class="scoreboard"><div class="side"><a href="'+teamLink(game.away)+'">'+tlogo(game.away,76)+'</a><span class="names">'+esc(name(game.away))+'</span></div>'+
 '<div class="center"><span class="bigscore">'+(scores?esc(scores[0])+' <span class="subtle">–</span> '+esc(scores[1]):'VS')+'</span>'+
 '<div class="small subtle">'+(final?'Partida encerrada':live?phase+(event.liveClock?' • '+esc(event.liveClock):''):'Jogo agendado')+'</div></div>'+
 '<div class="side"><a href="'+teamLink(game.home)+'">'+tlogo(game.home,76)+'</a><span class="names">'+esc(name(game.home))+'</span></div></div>'+
 '<div class="switches" style="justify-content:center"><span class="tag '+((game.platforms||[]).some(p=>['PRIME','ESPN'].includes(p))?'tv':'dim')+'">'+esc(platform(game))+'</span>'+
 (final?'<span class="tag finished">Resultado confirmado pela fonte</span>':live?'<span class="live-indicator"><i aria-hidden="true"></i>AO VIVO</span>':'')+'</div></section>';
}
function gameForm(){
 const p=note(game.id),rated=Number(p.rating)||0;
 return '<section class="card"><h3>Meu diário da partida</h3><p>Suas notas ficam salvas no navegador e sincronizadas no Firebase quando você estiver conectado.</p><form id="saveGame">'+
 '<div class="controls"><label class="small"><input type="checkbox" id="watched" '+(p.watched?'checked':'')+'> Já assisti</label><label class="small"><input type="checkbox" id="wish" '+(p.wish?'checked':'')+'> Quero assistir</label></div>'+
 '<div class="field"><label>Nota do jogo • <span id="gameRatingValue">'+(rated||'—')+'</span>/10</label><input class="rate-input" type="range" id="gameRating" min="0" max="10" step="0.5" value="'+rated+'"></div>'+
 '<div class="two-cols"><div class="field"><label>Placar visitante (manual)</label><input class="control" type="number" id="awayScore" min="0" max="250" value="'+esc(p.scoreAway??'')+'" placeholder="Opcional"></div><div class="field"><label>Placar mandante (manual)</label><input class="control" type="number" id="homeScore" min="0" max="250" value="'+esc(p.scoreHome??'')+'" placeholder="Opcional"></div></div>'+
 '<div class="field"><label>Comentários e observações</label><textarea class="control" id="comment" maxlength="1400" placeholder="Melhor jogador, lances importantes e o que achou da partida…">'+esc(p.comment||'')+'</textarea></div>'+
 '<div class="modal-footer"><button class="btn accent" type="submit">Salvar avaliação ✓</button></div></form></section>';
}
function teamPlayers(code){
 return (box?.players?.[code]||[]).filter(p=>p?.id && p?.name &&
  (p.hasStats===true||statValue(p,'pts')!==null||statValue(p,'min')!==null));
}
function teamSum(code,key){
 const players=teamPlayers(code),values=players.map(p=>statValue(p,key)).filter(v=>v!==null);
 if(!values.length)return null;
 return values.reduce((total,value)=>total+value,0);
}
function gameLeaders(){
 const all=[game.away,game.home].flatMap(code=>teamPlayers(code).map(p=>({code,player:p})));
 return [['pts','Pontos','PTS'],['reb','Rebotes','REB'],['ast','Assistências','AST']].map(([key,title,unit])=>{
  const candidates=all.filter(x=>statValue(x.player,key)!==null);
  candidates.sort((a,b)=>statValue(b.player,key)-statValue(a.player,key)||
   statValue(b.player,'pts')-statValue(a.player,'pts'));
  return {key,title,unit,leader:candidates.length&&statValue(candidates[0].player,key)>0?candidates[0]:null};
 });
}
function leaderCards(){
 const leaders=gameLeaders();
 return '<section class="section"><div class="section-title"><h2>Quem está se destacando</h2>'+
 '<button class="btn ghost" type="button" data-open-tab="stats">Box score completo →</button></div>'+
 '<div class="overview-leader-grid">'+leaders.map(item=>{
  if(!item.leader)return '<article class="overview-leader"><span class="caps">'+esc(item.title)+'</span>'+
   '<div class="overview-leader-empty">Aguardando dados</div></article>';
  const {code,player}=item.leader,num=statValue(player,item.key);
  return '<article class="overview-leader"><span class="caps">'+esc(item.title)+'</span>'+
   '<div class="overview-leader-body">'+playerPortrait(player,code)+
   '<div class="overview-leader-person"><a href="'+playerLink(player.id,code)+'">'+esc(player.name)+'</a>'+
   '<span><img src="'+esc(logo(code))+'" loading="lazy" alt="">'+esc(name(code))+'</span></div>'+
   '<div class="overview-leader-value"><strong>'+esc(num)+'</strong><small>'+item.unit+'</small></div></div></article>';
 }).join('')+'</div></section>';
}
function teamComparison(){
 const metrics=[
  {key:'reb',label:'Rebotes'},
  {key:'ast',label:'Assistências'},
  {key:'three',label:'Bolas de 3'},
  {key:'stl',label:'Roubos'},
  {key:'to',label:'Turnovers'}
 ].map(m=>({...m,left:teamSum(game.away,m.key),right:teamSum(game.home,m.key)}))
 .filter(m=>m.left!==null&&m.right!==null);
 if(!metrics.length)return '';
 return '<section class="section overview-comparison"><div class="section-title"><h2>Comparativo das equipes</h2>'+
 '<button class="btn ghost" type="button" data-open-tab="stats">Todos os números →</button></div>'+
 '<div class="overview-duel"><div class="overview-duel-head"><span><img src="'+esc(logo(game.away))+'" alt="">'+esc(game.away)+'</span>'+
 '<strong>Somatório do box score</strong><span>'+esc(game.home)+'<img src="'+esc(logo(game.home))+'" alt=""></span></div>'+
 metrics.map(m=>{
  const maximum=Math.max(m.left,m.right,1),leftWidth=Math.round(m.left/maximum*100),rightWidth=Math.round(m.right/maximum*100);
  return '<div class="overview-metric"><div class="overview-metric-label">'+esc(m.label)+'</div>'+
  '<div class="overview-metric-values"><b>'+esc(m.left)+'</b>'+
  '<div class="overview-metric-bars"><div class="overview-metric-half left"><i style="width:'+leftWidth+'%"></i></div>'+
  '<div class="overview-metric-half right"><i style="width:'+rightWidth+'%"></i></div></div>'+
  '<b>'+esc(m.right)+'</b></div></div>';
 }).join('')+'</div><p class="overview-data-note">'+
 (gameStatus().status==='live'?'Dados parciais da partida, sujeitos a correções.':
  'Soma das estatísticas individuais disponíveis para cada equipe; pode diferir dos totais oficiais.')+
 '</p></section>';
}
function recentTeamHighlight(code){
 const matches=Object.values(boxes||{})
  .filter(g=>g?.date<game.date&&(g.away===code||g.home===code)&&Array.isArray(g.players?.[code]))
  .sort((a,b)=>b.date.localeCompare(a.date));
 const match=matches.find(g=>g.players[code].filter(p=>p.pts!==undefined&&p.pts!==null).length>=5);
 if(!match)return '';
 const player=match.players[code].filter(p=>p.pts!==undefined&&p.pts!==null)
  .slice().sort((a,b)=>(Number(b.pts)||0)-(Number(a.pts)||0))[0];
 const opponent=match.away===code?match.home:match.away;
 return '<div class="overview-recent-team"><div class="overview-lineup-head"><img src="'+esc(logo(code))+'" alt="">'+
 '<div><strong>'+esc(name(code))+'</strong><span>'+esc(shortDate(match.date))+' • contra '+esc(name(opponent))+'</span></div></div>'+
 '<div class="overview-recent-highlight"><span class="caps">Destaque em pontos no último jogo registrado</span>'+
 '<div><a href="'+playerLink(player.id,code)+'">'+esc(player.name)+'</a><b>'+esc(player.pts)+' PTS</b></div></div>'+
 '<a class="btn ghost" href="'+path('jogo/?id='+encodeURIComponent(match.id)+'&data='+encodeURIComponent(match.date))+
 '">Ver partida anterior →</a></div>';
}
function recentForm(){
 const cards=[game.away,game.home].map(recentTeamHighlight).filter(Boolean);
 if(!cards.length)return '';
 return '<section class="section"><div class="section-title"><h2>Últimas atuações disponíveis</h2></div>'+
 '<div class="overview-lineups">'+cards.join('')+'</div>'+
 '<p class="overview-data-note">Dados das últimas partidas com box score importado. Podem incluir jogos de pré-temporada e não indicam titulares oficiais do próximo jogo.</p></section>';
}
function summaryLineups(){
 const teams=[game.away,game.home],content=teams.map(code=>{
  const info=starterList(code),confirmed=info.confirmed;
  return '<div class="overview-lineup-team"><div class="overview-lineup-head"><img src="'+esc(logo(code))+'" alt="">'+
  '<div><strong>'+esc(name(code))+'</strong><span>'+(confirmed?'✓ Titulares informados':'◇ Provável quinteto')+'</span></div></div>'+
  (info.list.length?'<div class="overview-lineup-players">'+info.list.slice(0,5).map(p=>
   '<a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a>').join('')+'</div>':
   '<p class="small subtle">Sem escalação disponível no momento.</p>')+'</div>';
 }).join('');
 return '<section class="section"><div class="section-title"><h2>Quintetos do confronto</h2>'+
 '<button class="btn ghost" type="button" data-open-tab="quintetos">Ver escalações →</button></div>'+
 '<div class="overview-lineups">'+content+'</div>'+
 '<p class="overview-data-note">As projeções são baseadas em jogos anteriores; somente os titulares identificados pela fonte são confirmados.</p></section>';
}
function overviewHtml(current,statsReady){
 const saved=note(game.id),mvp=getData().extras.gameMvp?.[game.id];
 const gameType=typeof game.stage==='string' && isNaN(Number(game.stage))?game.stage:
  Number(game.stage)===1?'Pré-temporada':Number(game.stage)===3?'Playoffs':'Temporada regular';
 const complete=statsReady && [game.away,game.home].every(code=>teamPlayers(code).length>0);
 return '<section class="overview-quickfacts"><div><span class="caps">Competição</span><strong>'+esc(gameType)+'</strong></div>'+
 '<div><span class="caps">Data e horário</span><strong>'+esc(shortDate(game.date))+' • '+esc(game.time||'A definir')+' BRT</strong></div>'+
 '<div><span class="caps">Onde assistir</span><strong>'+esc(platform(game))+'</strong></div>'+
 '<div><span class="caps">Meu registro</span><strong>'+(saved.watched?'✓ Assistido':saved.wish?'♡ Na minha lista':'Não avaliado')+
 (Number(saved.rating)>0?' • ★ '+esc(saved.rating)+'/10':'')+'</strong></div></section>'+
 (statsReady?leaderCards()+(complete?teamComparison():''):'' )+
 summaryLineups()+
 (!statsReady?recentForm():'')+
 '<div class="overview-footer"><div><strong>Seu diário da partida</strong><span>'+(
  mvp?'Você já escolheu seu MVP.':
  saved.watched?'Partida marcada como assistida.':
  'Dê sua nota, escolha o MVP e guarde suas observações.')+'</span></div>'+
 '<button type="button" class="btn accent" data-open-tab="avaliar">'+(saved.watched?'Ver minha avaliação':'Avaliar partida')+' →</button></div>';
}
function tabs(){return '<nav class="tabs">'+[['resumo','Resumo'],['quintetos','Escalações'],['stats','Estatísticas'],['avaliar','Minha avaliação']].map(([key,label])=>'<button class="tab '+(tab===key?'active':'')+'" data-tab="'+key+'">'+label+'</button>').join('')+'</nav>';}
function draw(){
 if(!game){root.innerHTML='<div class="filler">Partida não encontrada. <a href="'+path('jogos/')+'">Ver calendário</a></div>';return;}
 const statsReady=boxHasStats(box);
 const current=gameStatus();
 let content=scoreboard()+tabs()+sourceNotice();
 if(tab==='resumo'){
  content+=overviewHtml(current,statsReady);
 }else if(tab==='quintetos'){
  content+='<div class="grid two">'+lineupPanel(game.away)+lineupPanel(game.home)+'</div>';
 }else if(tab==='stats'){
  content+=statsReady?'<div class="section"><div class="section-title"><h2>'+(current.status==='live'?'Estatísticas parciais':'Estatísticas individuais')+'</h2>'+
  '<span class="subtle small">'+(current.status==='live'?'Parciais, sujeitas a correções':current.status==='final'?'Box score final':'Dados preliminares')+'</span></div>'+
  boxscoreArea()+'</div>':
  '<div class="filler"><b>Estatísticas individuais ainda indisponíveis</b>'+
  (current.status==='scheduled'?'Antes do início, confira a aba Escalações para ver o quinteto provável.':
  'A fonte ainda não publicou os dados desta partida. Você pode atualizar manualmente ou aguardar a próxima consulta.')+'</div>';
 }else if(tab==='avaliar'){
  content+=gameForm()+(statsReady?'<section class="section"><div class="section-title"><h2>Avaliar jogadores e escolher MVP</h2></div>'+boxscoreArea()+'</section>':'');
 }
 root.innerHTML=content;
}
function ratePlayer(pid,code){
 const info=(box?.players?.[code]||[]).find(p=>String(p.id)===String(pid));if(!info)return toast('Jogador indisponível.');
 const old=getData().extras.gameRatings?.[game.id+':'+pid]||0;
 modal('<h2>'+esc(info.name)+'</h2><p class="subtle">Nota para esta partida • '+esc(name(code))+'</p><form id="ratePlayer"><div class="field"><label>Nota <span id="scorePlayer">'+(old||'—')+'</span>/10</label><input class="rate-input" type="range" min="0" max="10" step="0.5" value="'+old+'" id="rateValue"></div><div class="modal-footer"><button type="submit" class="btn accent">Salvar nota</button></div></form>');
 $('#rateValue').oninput=()=>$('#scorePlayer').textContent=$('#rateValue').value;
 $('#ratePlayer').onsubmit=e=>{e.preventDefault();setExtraGroup('gameRatings',game.id+':'+pid,Number($('#rateValue').value));closeModal();draw();toast('Nota do jogador salva');};
}
root.addEventListener('click',e=>{
 if(e.target.closest('#refreshBox')){refreshBox(true);return;}
 const setTeam=e.target.closest('[data-stats-team]');
 if(setTeam){statsTeam=setTeam.dataset.statsTeam;draw();return;}
 const sorted=e.target.closest('[data-stats-sort]');
 if(sorted){
  const key=sorted.dataset.statsSort;
  if(!statFields.some(f=>f.key===key))return;
  if(statsSort===key)statsAsc=!statsAsc;
  else{statsSort=key;statsAsc=false;}
  draw();return;
 }
 if(e.target.closest('[data-toggle-stats-direction]')){statsAsc=!statsAsc;draw();return;}
 if(e.target.closest('[data-toggle-stats-detail]')){statsDetail=!statsDetail;draw();return;}
 const t=e.target.closest('[data-tab],[data-open-tab]');if(t){tab=t.dataset.tab||t.dataset.openTab;draw();return;}
 const r=e.target.closest('[data-player-rating]');if(r){ratePlayer(r.dataset.playerRating,r.dataset.playerTeam);return;}
 const m=e.target.closest('[data-mvp]');if(m){setExtraGroup('gameMvp',game.id,String(m.dataset.mvp));draw();toast('MVP da partida escolhido!');return;}
});
root.addEventListener('input',e=>{if(e.target.id==='gameRating')$('#gameRatingValue').textContent=e.target.value;});
root.addEventListener('change',e=>{
 if(e.target.id==='boxscoreSort'&&statFields.some(f=>f.key===e.target.value)){
  statsSort=e.target.value;statsAsc=false;draw();
 }
});
root.addEventListener('submit',e=>{
 if(e.target.id!=='saveGame')return;e.preventDefault();
 const away=$('#awayScore').value,home=$('#homeScore').value;
 if([away,home].some(x=>x!==''&&(!Number.isInteger(+x)||+x<0||+x>250))){toast('Placar inválido. Use valores de 0 a 250.');return;}
 setNote(game.id,{watched:$('#watched').checked,wish:$('#wish').checked,rating:Number($('#gameRating').value),scoreAway:away,scoreHome:home,comment:$('#comment').value.trim()});
 toast('Partida salva!');draw();
});
window.addEventListener('quadra:refresh',()=>{if(game&&tab!=='avaliar')draw()});
window.addEventListener('quadra:live-update',()=>{
 if(!game)return;
 if(tab!=='avaliar')draw();
 if(needsBoxRefresh())refreshBox(false);
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&needsBoxRefresh())refreshBox(false);
});
window.addEventListener('online',()=>{if(needsBoxRefresh())refreshBox(false)});
setInterval(()=>{
 if(document.hidden)return;
 if(needsBoxRefresh())refreshBox(false);
},REFRESH_MS);
async function load(){
 try{
  const games=await loadGames(months);
  game=games.find(g=>String(g.id)===id||String(g.externalId)===id);
  if(!game){draw();return;}
  document.title=name(game.away)+' x '+name(game.home)+' • QUADRA';
  const month=game.date.slice(0,7),index=MONTHS.indexOf(month);
  // Um jogo só carrega seus dados mensais e no máximo os dois meses anteriores.
  const history=index<0?[month]:MONTHS.slice(Math.max(0,index-2),index+1);
  const [statResults,rosterResults]=await Promise.all([
   Promise.all(history.map(fetchBox)),
   Promise.allSettled([fetchRoster(game.away),fetchRoster(game.home)])
  ]);
  boxes=Object.assign({},...statResults);
  rosters[game.away]=rosterResults[0].status==='fulfilled'?rosterResults[0].value:[];
  rosters[game.home]=rosterResults[1].status==='fulfilled'?rosterResults[1].value:[];
  for(const code of [game.away,game.home]){
   probable[code]=projectStartingFive(code,game,boxes,rosters[code]);
  }
  updateBox();
  draw();
  // Quando o jogo terminou e o box score já está completo no cache, não precisamos
  // disparar outra requisição. Jogos em andamento ou sem dados tentam busca direta.
  const cachedHasStats=boxHasStats(box,true);
  if(gameStatus().status!=='final'||!cachedHasStats)refreshBox(true);
  else {
   statsMessage='Estatísticas finais carregadas do cache atualizado pelo GitHub.';
   draw();
  }
 }catch(e){
  console.error('QUADRA: falha ao abrir jogo',e);
  root.innerHTML='<div class="filler"><b>Não foi possível carregar a partida</b>'+
   'Atualize a página para tentar novamente. Suas avaliações continuam salvas.</div>';
 }
}
root.innerHTML='<div class="filler">Carregando confronto e estatísticas…</div>';load();
