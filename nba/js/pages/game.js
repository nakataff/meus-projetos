import {$,setupShared,qs,esc,name,logo,tlogo,path,teamLink,playerLink,loadGames,MONTHS,fetchBox,groupGames,note,getData,setNote,setExtraGroup,modify,platform,shortDate,currentDate,toast,modal,closeModal,eventBox,newestStarting,fetchRoster} from '../app.js?v=4';
const id=qs('id')||'',hint=qs('data')||'',root=$('#pageContent');
setupShared('games','Centro da partida','Escalações, estatísticas e seu diário pessoal de basquete.');
let game=null,boxes={},box=null,probable={},rosters={},tab='resumo',loading=true;
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
 const confirmed=box?.players?.[code]?.filter(p=>p.starter)||[];
 if(confirmed.length)return {list:confirmed,label:'Titulares confirmados nesta partida',date:game.date,confirmed:true};
 const previous=probable[code];
 if(previous?.players.length)return {list:previous.players,label:'Provável quinteto: projeção baseada no último jogo disponível',date:previous.date,confirmed:false};
 return {list:[],label:'Titulares ainda não disponíveis',confirmed:false};
}
function lineupPanel(code){
 const info=starterList(code),others=box?.players?.[code]?.filter(p=>!p.starter)||[];
 return '<section class="card"><div class="section-title"><h2>'+esc(name(code))+'</h2><a href="'+teamLink(code)+'" class="btn ghost">Ver elenco →</a></div><p class="small subtle">'+esc(info.label)+(info.date?' • '+shortDate(info.date):'')+'</p>'+
 (info.list.length?'<div>'+info.list.map(p=>'<div class="player-row"><div class="pname"><b><a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a></b><small>'+esc(p.number?'#'+p.number+' • ':'')+(info.confirmed?'Titular oficial':'Projeção, não confirmada')+'</small></div><a class="btn" href="'+playerLink(p.id,code)+'">Perfil</a></div>').join('')+'</div>':
 '<div class="filler">Não há dados confiáveis suficientes para projetar este quinteto.</div>')+
 (others.length?'<p class="small subtle" style="margin-top:16px">Jogadores não titulares registrados no box score: '+others.length+'</p>':'')+'</section>';
}
function scoreboard(){
 const p=note(game.id),final=game.status==='final';
 const hasManual=p.scoreAway!==''&&p.scoreHome!==''&&p.scoreAway!=null&&p.scoreHome!=null;
 const scores=final?[game.scoreAway,game.scoreHome]:hasManual?[p.scoreAway,p.scoreHome]:null;
 return '<section class="card"><div class="eyebrow center">'+esc(game.stage||'NBA')+' • '+esc(shortDate(game.date))+' • '+esc(game.time||'Hora a definir')+' BRT</div>'+
 '<div class="scoreboard"><div class="side"><a href="'+teamLink(game.away)+'">'+tlogo(game.away,76)+'</a><span class="names">'+esc(name(game.away))+'</span></div>'+
 '<div class="center"><span class="bigscore">'+(scores?esc(scores[0])+' <span class="subtle">–</span> '+esc(scores[1]):'VS')+'</span><div class="small subtle">'+(final?'Partida encerrada':game.status==='live'?'Em andamento':'Jogo agendado')+'</div></div>'+
 '<div class="side"><a href="'+teamLink(game.home)+'">'+tlogo(game.home,76)+'</a><span class="names">'+esc(name(game.home))+'</span></div></div>'+
 '<div class="switches" style="justify-content:center"><span class="tag '+((game.platforms||[]).some(p=>['PRIME','ESPN'].includes(p))?'tv':'dim')+'">'+esc(platform(game))+'</span>'+
 (final?'<span class="tag finished">Resultado importado</span>':'')+'</div></section>';
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
 let content=scoreboard()+tabs();
 if(tab==='resumo'){
  const b=getData().extras;
  content+='<div class="grid two"><section class="card"><h3>Onde assistir</h3><p>'+esc(platform(game))+'</p><p style="margin-top:8px">A confirmação de emissora refere-se às listas brasileiras cadastradas. Disponibilidade do League Pass depende dos direitos locais.</p></section><section class="card"><h3>Meu acompanhamento</h3><p>'+(note(game.id).watched?'✓ Já assisti':'Ainda não marcado como assistido')+'</p><p style="margin-top:10px">Nota: '+(note(game.id).rating||'—')+'/10'+(b.gameMvp?.[game.id]?' • MVP escolhido':'')+'</p><button class="btn" data-open-tab="avaliar">Avaliar partida →</button></section></div>'+
  '<section class="section"><div class="section-title"><h2>Quintetos e estatísticas</h2><button class="btn" data-open-tab="quintetos">Ver escalações</button></div>'+
  '<p class="info">Quintetos prováveis são projeções obtidas a partir da última escalação confirmada disponível. Não representam anúncio oficial para este jogo.</p></section>';
 }else if(tab==='quintetos'){
  content+='<div class="grid two">'+lineupPanel(game.away)+lineupPanel(game.home)+'</div>';
 }else if(tab==='stats'){
  content+=box?'<div class="section"><div class="section-title"><h2>Estatísticas individuais</h2><span class="subtle small">Dados importados após a partida</span></div><div class="card"><h3>'+esc(name(game.away))+'</h3>'+playerStats(game.away)+'</div><div class="card section"><h3>'+esc(name(game.home))+'</h3>'+playerStats(game.home)+'</div></div>':
  '<div class="filler"><b>Box score ainda não disponível</b>As estatísticas serão exibidas após a importação dos resultados finais.</div>';
 }else if(tab==='avaliar'){
  content+=gameForm()+(box?'<section class="section"><div class="section-title"><h2>Avaliar jogadores e escolher MVP</h2></div><div class="card"><h3>'+esc(name(game.away))+'</h3>'+playerStats(game.away)+'</div><div class="card section"><h3>'+esc(name(game.home))+'</h3>'+playerStats(game.home)+'</div></section>':'');
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
async function load(){
 try{
  const games=await loadGames(months);game=games.find(g=>String(g.id)===id||String(g.externalId)===id);
  if(!game){draw();return;}
  const month=game.date.slice(0,7);
  boxes=await fetchBox(month);box=eventBox(boxes,game);
  const early=MONTHS.includes('2026-10')&&month!=='2026-10'?await fetchBox('2026-10'):{};
  const combined={...early,...boxes};
  for(const code of [game.away,game.home])probable[code]=newestStarting(code,Object.fromEntries(Object.entries(combined).filter(([,v])=>v.date<game.date)));
  document.title=name(game.away)+' x '+name(game.home)+' • QUADRA';
  draw();
 }catch(e){console.error(e);root.innerHTML='<div class="filler">Erro ao abrir partida. Tente atualizar esta página.</div>';}
}
root.innerHTML='<div class="filler">Carregando confronto e estatísticas…</div>';load();
