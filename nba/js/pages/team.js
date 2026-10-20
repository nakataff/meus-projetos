import {$,setupShared,TEAMS,EAST,WEST,name,logo,esc,qs,fetchRoster,fetchBox,loadGames,MONTHS,currentDate,shortDate,teamLink,playerLink,path,getData,setSettings,setExtraGroup,modify,modal,closeModal,toast,newestStarting,groupGames,handleWishes,showError} from '../app.js?v=4';
const code=(qs('id')||'BOS').toUpperCase(),root=$('#pageContent'),valid=!!TEAMS[code];
setupShared('teams',valid?name(code):'Equipe não encontrada','Elenco, quintetos confirmados, suas avaliações e próximas partidas.');
let roster=[],box={},games=[],active='elenco',loadError='',best=null;
const groups={...EAST,...WEST};
const division=Object.keys(groups).find(d=>groups[d].includes(code))||'';
const conf=Object.values(EAST).some(a=>a.includes(code))?'Leste':'Oeste';
function playerHTML(p){
 const b=getData(),x=b.extras,star=x.franchise?.[code]===String(p.id),own=(x.lineups?.[code]||[]).includes(String(p.id)),recent=best?.players.some(q=>String(q.id)===String(p.id));
 const badges=(star?'<span class="tag accent">★ Franchise</span>':'')+(own?'<span class="tag">Meu quinteto</span>':'')+(recent?'<span class="tag finished">Último titular</span>':'');
 return '<article class="player-row"><a href="'+playerLink(p.id,code)+'"><img src="'+esc(p.headshot||logo(code))+'" loading="lazy" alt="" onerror="this.src=\''+esc(logo(code))+'\'"></a><div class="pname"><b><a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a></b><small>#'+esc(p.number||'—')+' • '+esc(p.position||'—')+' '+badges+'</small></div><span class="muted-star">'+(x.players?.[p.id]?.rating?('★ '+esc(x.players[p.id].rating)):'')+'</span><button class="btn" data-rate="'+esc(p.id)+'">Avaliar</button></article>';
}
function ratingForm(player){
 const b=getData(),x=b.extras,own=(x.lineups?.[code]||[]).includes(String(player.id)),star=x.franchise?.[code]===String(player.id),info=x.players?.[player.id]||{};
 modal('<h2>'+esc(player.name)+'</h2><p class="subtle">'+esc(name(code))+' • '+esc(player.position)+'</p><form id="playerForm"><div class="field"><label>Minha nota na temporada <span id="playerScore">'+esc(info.rating||'—')+'</span>/10</label><input type="range" id="playerRating" min="0" max="10" step="0.5" value="'+(Number(info.rating)||0)+'" class="rate-input"></div><div class="field"><label><input id="isFranchise" type="checkbox" '+(star?'checked':'')+'> Meu franchise player</label></div><div class="field"><label><input id="isStarter" type="checkbox" '+(own?'checked':'')+'> Meu quinteto titular (5 jogadores)</label></div><div class="field"><label><input id="isFavorite" type="checkbox" '+(info.favorite?'checked':'')+'> Jogador favorito</label></div><div class="modal-footer"><button type="submit" class="btn accent">Salvar avaliação</button></div></form>');
 $('#playerRating').oninput=()=>$('#playerScore').textContent=$('#playerRating').value;
 $('#playerForm').onsubmit=e=>{
  e.preventDefault();let line=(getData().extras.lineups?.[code]||[]).filter(id=>id!==String(player.id));
  if($('#isStarter').checked&&line.length>=5){toast('Seu quinteto já tem 5 jogadores. Retire um antes.');return;}
  if($('#isStarter').checked)line.push(String(player.id));
  modify(bundle=>{
   bundle.extras.players[player.id]={...info,name:player.name,team:code,rating:Number($('#playerRating').value),favorite:$('#isFavorite').checked};
   bundle.extras.lineups[code]=line;
   if($('#isFranchise').checked)bundle.extras.franchise[code]=String(player.id);
   else if(bundle.extras.franchise[code]===String(player.id))delete bundle.extras.franchise[code];
   bundle.extras.updatedAt=new Date().toISOString();
  });closeModal();draw();toast('Jogador avaliado!');
 };
}
function tabs(){return '<nav class="tabs">'+[['elenco','Elenco'],['titulares','Titulares'],['jogos','Próximos jogos'],['notas','Minhas notas']].map(([key,text])=>'<button class="tab '+(active===key?'active':'')+'" data-tab="'+key+'">'+text+'</button>').join('')+'</nav>';}
function draw(){
 if(!valid){root.innerHTML='<div class="filler">Equipe não encontrada. <a href="'+path('equipes/')+'">Ver equipes</a></div>';return;}
 const b=getData(),fav=b.settings.fav===code,x=b.extras,line=x.lineups?.[code]||[];
 let content='<section class="team-hero"><img src="'+logo(code)+'" alt=""><div><div class="eyebrow">CONFERÊNCIA '+conf.toUpperCase()+' • DIVISÃO '+esc(division).toUpperCase()+'</div><h2>'+esc(name(code))+'</h2><p>'+roster.length+' jogadores no elenco</p><div class="controls"><button class="btn '+(fav?'accent':'')+'" id="favoriteTeam">'+(fav?'★ Meu time favorito':'☆ Marcar como favorito')+'</button><a class="btn" href="'+path('equipes/')+'">Outras equipes</a></div></div></section>'+tabs();
 if(active==='elenco'){
  content+='<div class="section-title"><h2>Elenco 2026/27</h2><span class="small subtle">Selecione o jogador para avaliar</span></div>';
  content+=roster.length?'<div class="card" style="padding:8px 13px">'+roster.map(playerHTML).join('')+'</div>':'<div class="filler">Elenco indisponível na fonte no momento.</div>';
 }else if(active==='titulares'){
  content+='<section class="card section"><h3>Último quinteto confirmado</h3><p>'+(best?'Identificado no box score de '+shortDate(best.date)+' — não é confirmação do próximo jogo.':'Ainda não há um quinteto inicial confirmado nos resultados importados.')+'</p>'+
  (best?best.players.map(p=>{const full=roster.find(x=>String(x.id)===String(p.id))||p;return playerHTML(full)}).join(''):'')+'</section>'+
  '<section class="card section"><h3>Meu quinteto pessoal <span class="subtle">'+line.length+'/5</span></h3><p>Você escolhe estes cinco; não são necessariamente os titulares oficiais.</p>'+
  (line.length?line.map(id=>roster.find(p=>String(p.id)===String(id))).filter(Boolean).map(playerHTML).join(''):'<div class="filler">Use o botão Avaliar na aba Elenco para escolher seu quinteto.</div>')+'</section>';
 }else if(active==='jogos'){
  const upcoming=games.filter(g=>(g.away===code||g.home===code)&&g.date>=currentDate()).slice(0,8);
  content+='<div class="section-title"><h2>Próximos jogos</h2><a class="btn" href="'+path('jogos/')+'">Agenda completa →</a></div>'+groupGames(upcoming);
 }else {
  const rated=roster.filter(p=>Number(x.players?.[p.id]?.rating)>0).sort((a,b)=>Number(x.players[b.id].rating)-Number(x.players[a.id].rating));
  content+='<section class="card"><h3>Meu ranking do elenco</h3><p>Notas pessoais de 0 a 10 para os jogadores da franquia.</p>'+(rated.length?rated.map(playerHTML).join(''):'<div class="filler">Nenhuma avaliação registrada.</div>')+'</section>';
 }
 root.innerHTML=content;
}
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]');if(tab){active=tab.dataset.tab;draw();return;}
 if(e.target.closest('#favoriteTeam')){setSettings({fav:getData().settings.fav===code?'':code});draw();return;}
 const player=e.target.closest('[data-rate]');if(player){const p=roster.find(x=>String(x.id)===player.dataset.rate);if(p)ratingForm(p);return;}
 if(handleWishes(e.target,draw))e.preventDefault();
});
window.addEventListener('quadra:refresh',draw);
if(valid){
 root.innerHTML='<div class="filler">Carregando elenco e últimos quintetos…</div>';
 const today=currentDate(),months=[...new Set([today.slice(0,7),'2026-10'])].filter(m=>MONTHS.includes(m));
 Promise.allSettled([fetchRoster(code),...months.map(fetchBox),loadGames(MONTHS.slice(Math.max(0,MONTHS.indexOf(today.slice(0,7))),Math.max(0,MONTHS.indexOf(today.slice(0,7)))+2))]).then(r=>{
  roster=r[0].status==='fulfilled'?r[0].value:[];
  const merged={};for(let i=1;i<=months.length;i++)if(r[i].status==='fulfilled')Object.assign(merged,r[i].value);
  best=newestStarting(code,merged);
  games=r[months.length+1].status==='fulfilled'?r[months.length+1].value:[];
  draw();
 });
}else draw();
