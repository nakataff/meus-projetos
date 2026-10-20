import {$,setupShared,qs,esc,name,logo,tlogo,effectiveGame,path,teamLink,playerLink,loadGames,MONTHS,fetchBox,note,getData,setNote,setExtraGroup,platform,shortDate,currentDate,toast,modal,closeModal,eventBox,fetchRoster} from '../app.js?v=7';
import {fetchLiveBoxscore,projectStartingFive} from '../boxscore.js?v=1';
const id=qs('id')||'',hint=qs('data')||'',root=$('#pageContent');
setupShared('games','Centro da partida','Escalações, estatísticas e seu diário pessoal de basquete.');
let game=null,boxes={},box=null,probable={},rosters={},tab='resumo';
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
function sourceNotice(){
 const status=gameStatus().status;
 const label=status==='live'?'DADOS EM TEMPO REAL':status==='final'?'RESULTADO FINAL':'ANTES DA PARTIDA';
 const message=statsMessage||(
  status==='live'?'Estatísticas parciais atualizadas periodicamente, conforme a fonte disponibiliza.':
  status==='final'?'Box score final, quando disponibilizado pela fonte.':
  'Projeção de titulares baseada nos jogos anteriores; não é escalação oficial.'
 );
 const last=lastSuccess?' • Consultado às '+lastSuccess.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';
 return '<div class="game-data-status"><div><strong class="'+(status==='live'?'data-live':'')+'">'+label+'</strong>'+
 '<span>'+esc(message+last)+'</span></div>'+
 '<button class="btn ghost" type="button" id="refreshBox" '+(checkingStats?'disabled':'')+'>'+(checkingStats?'Consultando…':'↻ Atualizar estatísticas')+'</button></div>';
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
function playerStats(code){
 const players=box?.players?.[code]||[];
 if(!players.length)return '<div class="filler">As estatísticas individuais ainda não foram importadas para esta partida.</div>';
 const b=getData(),mvp=b.extras.gameMvp?.[game.id];
 return '<div class="scroll-x"><table class="stat-table"><thead><tr><th>Jogador</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG</th><th>3PT</th><th>TO</th><th>+/-</th><th>Nota</th><th>MVP</th></tr></thead><tbody>'+
 players.map(p=>{
  const rate=b.extras.gameRatings?.[game.id+':'+p.id],isMvp=mvp===String(p.id);
  return '<tr><td><a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a>'+(p.starter?' <span class="tag finished">T</span>':'')+'</td>'+
  [p.min,p.pts,p.reb,p.ast,p.stl,p.blk,p.fg,p.three,p.to,p.plusMinus].map(v=>'<td>'+esc(v??'—')+'</td>').join('')+
  '<td><button class="btn" data-player-rating="'+esc(p.id)+'" data-player-team="'+code+'">'+(rate!==undefined?'★ '+esc(rate):'Avaliar')+'</button></td>'+
  '<td><button class="btn" data-mvp="'+esc(p.id)+'">'+(isMvp?'★ MVP':'☆ Votar')+'</button></td></tr>';
 }).join('')+'</tbody></table></div>';
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
 const period=Number(event.livePeriod||0);
 const phase=period>4?'Prorrogação':period>0?period+'º quarto':'Ao vivo';
 return '<section class="card"><div class="eyebrow center">'+esc(game.stage||'NBA')+' • '+esc(shortDate(game.date))+' • '+esc(game.time||'Hora a definir')+' BRT</div>'+
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
function tabs(){return '<nav class="tabs">'+[['resumo','Resumo'],['quintetos','Escalações'],['stats','Estatísticas'],['avaliar','Minha avaliação']].map(([key,label])=>'<button class="tab '+(tab===key?'active':'')+'" data-tab="'+key+'">'+label+'</button>').join('')+'</nav>';}
function draw(){
 if(!game){root.innerHTML='<div class="filler">Partida não encontrada. <a href="'+path('jogos/')+'">Ver calendário</a></div>';return;}
 const statsReady=!!box&&Object.values(box.players||{}).some(list=>list.some(p=>p.hasStats===true||p.pts!==null&&p.pts!==undefined));
 const current=gameStatus();
 let content=scoreboard()+tabs()+sourceNotice();
 if(tab==='resumo'){
  const b=getData().extras;
  content+='<div class="grid two"><section class="card"><h3>Onde assistir</h3><p>'+esc(platform(game))+'</p><p style="margin-top:8px">A confirmação de emissora refere-se às listas brasileiras cadastradas. Disponibilidade do League Pass depende dos direitos locais.</p></section><section class="card"><h3>Meu acompanhamento</h3><p>'+(note(game.id).watched?'✓ Já assisti':'Ainda não marcado como assistido')+'</p><p style="margin-top:10px">Nota: '+(note(game.id).rating||'—')+'/10'+(b.gameMvp?.[game.id]?' • MVP escolhido':'')+'</p><button class="btn" data-open-tab="avaliar">Avaliar partida →</button></section></div>'+
  '<section class="section"><div class="section-title"><h2>Quintetos e estatísticas</h2><button class="btn" data-open-tab="quintetos">Ver escalações</button></div>'+
  '<p class="info">'+(current.status==='live'?'Confira os titulares identificados e as estatísticas parciais, conforme a fonte disponibilizar.':
  current.status==='final'?'Confira o box score final e os titulares que começaram a partida.':
  'Antes do jogo, o QUADRA estima o quinteto considerando quem mais iniciou as últimas cinco partidas. A escalação real pode mudar.')+
  ' <button class="btn ghost" data-open-tab="stats">Ver estatísticas →</button></p></section>';
 }else if(tab==='quintetos'){
  content+='<div class="grid two">'+lineupPanel(game.away)+lineupPanel(game.home)+'</div>';
 }else if(tab==='stats'){
  content+=statsReady?'<div class="section"><div class="section-title"><h2>'+(current.status==='live'?'Estatísticas parciais':'Estatísticas individuais')+'</h2>'+
  '<span class="subtle small">'+(current.status==='live'?'Parciais, sujeitas a correções':current.status==='final'?'Box score final':'Dados preliminares')+'</span></div>'+
  '<div class="card"><h3>'+esc(name(game.away))+'</h3>'+playerStats(game.away)+'</div>'+
  '<div class="card section"><h3>'+esc(name(game.home))+'</h3>'+playerStats(game.home)+'</div></div>':
  '<div class="filler"><b>Estatísticas individuais ainda indisponíveis</b>'+
  (current.status==='scheduled'?'Antes do início, confira a aba Escalações para ver o quinteto provável.':
  'A fonte ainda não publicou os dados desta partida. Você pode atualizar manualmente ou aguardar a próxima consulta.')+'</div>';
 }else if(tab==='avaliar'){
  content+=gameForm()+(statsReady?'<section class="section"><div class="section-title"><h2>Avaliar jogadores e escolher MVP</h2></div><div class="card"><h3>'+esc(name(game.away))+'</h3>'+playerStats(game.away)+'</div><div class="card section"><h3>'+esc(name(game.home))+'</h3>'+playerStats(game.home)+'</div></section>':'');
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
 const t=e.target.closest('[data-tab],[data-open-tab]');if(t){tab=t.dataset.tab||t.dataset.openTab;draw();return;}
 const r=e.target.closest('[data-player-rating]');if(r){ratePlayer(r.dataset.playerRating,r.dataset.playerTeam);return;}
 const m=e.target.closest('[data-mvp]');if(m){setExtraGroup('gameMvp',game.id,String(m.dataset.mvp));draw();toast('MVP da partida escolhido!');return;}
});
root.addEventListener('input',e=>{if(e.target.id==='gameRating')$('#gameRatingValue').textContent=e.target.value;});
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
 const status=gameStatus().status;
 if(status==='live'||(status!=='final'&&game.date<=currentDate()))refreshBox(false);
});
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden && game && (gameStatus().status!=='final'||!box))refreshBox(false);
});
window.addEventListener('online',()=>{if(game&&gameStatus().status!=='final')refreshBox(false)});
setInterval(()=>{
 if(!game || document.hidden)return;
 const status=gameStatus().status;
 if(status==='live'||(status!=='final'&&game.date<=currentDate()))refreshBox(false);
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
  const cachedHasStats=box&&Object.values(box.players||{}).some(list=>list.some(p=>p.hasStats===true||p.pts!==null&&p.pts!==undefined));
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
