/* QUADRA — perfil leve de franquia com médias coletivas e por atleta. */
import {$,setupShared,TEAMS,EAST,WEST,name,logo,esc,qs,fetchRoster,loadGames,MONTHS,
 currentDate,shortDate,teamLink,playerLink,path,jsonFile,getData,setSettings,
 modify,modal,closeModal,toast,groupGames,handleWishes} from '../app.js?v=12';

const code=(qs('id')||'BOS').toUpperCase(),root=$('#pageContent'),valid=!!TEAMS[code];
setupShared('teams',valid?name(code):'Equipe não encontrada',
 'Campanha, estatísticas coletivas e individuais, elenco e próximos jogos.');
const groups={...EAST,...WEST};
const division=Object.keys(groups).find(d=>groups[d].includes(code))||'';
const conf=Object.values(EAST).some(list=>list.includes(code))?'Leste':'Oeste';
let roster=[],teamStats=null,standings=null,games=[],active='resumo',
 phase='regular',sortBy='pts',sortAsc=false,statError='',rosterReady=false,gamesLoaded=false;

const n=x=>Number.isFinite(Number(x))?Number(x):0;
const fmt=x=>Number.isFinite(x)?x.toFixed(1).replace('.',','):'—';
const rate=(made,tried)=>n(tried)>0?fmt(n(made)*100/n(tried))+'%':'—';
const average=(sum,games)=>games>0?fmt(n(sum)/games):'—';
const percent=(win,loss)=>win+loss?fmt(100*win/(win+loss))+'%':'—';
const section=()=>teamStats?.[phase]||null;
const pAverage=(p,key)=>key==='gp'?p.gp:key==='starts'?p.starts:
 key==='fgPct'?p.fga?100*n(p.fgm)/p.fga:null:
 key==='threePct'?p.threeA?100*n(p.threeM)/p.threeA:null:
 p.gp?n(p[key])/p.gp:null;
const cell=x=>x===null||x===undefined?'—':typeof x==='number'?fmt(x):esc(x);
const rosterById=id=>roster.find(p=>String(p.id)===String(id));
const playerPhoto=p=>esc(rosterById(p.id)?.headshot||
 'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(String(p.id))+'.png');
const logoImage=esc(logo(code));
function playerImage(p){
 return '<img src="'+playerPhoto(p)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt=""'+
  ' onerror="this.onerror=null;this.src=\''+logoImage+'\'">';
}
function ownStanding(){return standings?.teams?.find(row=>row.team===code)||null;}
function teamPosition(){
 const own=ownStanding();if(!own||own.w+own.l===0)return null;
 const inGroup=conf==='Leste'?Object.values(EAST).flat():Object.values(WEST).flat();
 const sort=rows=>rows.slice().sort((a,b)=>{
  const pa=x=>x.w+x.l?x.w/(x.w+x.l):-1;
  return pa(b)-pa(a)||((b.pf-b.pa)-(a.pf-a.pa))||a.team.localeCompare(b.team);
 });
 const selected=sort((standings?.teams||[]).filter(row=>inGroup.includes(row.team)));
 return selected.findIndex(row=>row.team===code)+1;
}
function phaseControl(){
 return '<div class="team-stats-switch" aria-label="Selecionar fase">'+
 [['regular','Temporada regular'],['preseason','Pré-temporada']].map(([id,label])=>
 '<button class="pill '+(phase===id?'active':'')+'" type="button" data-phase="'+id+'" aria-pressed="'+(phase===id)+'">'+label+'</button>').join('')+'</div>';
}
function teamWarning(){
 const stats=section();
 if(statError)return '<p class="info">As estatísticas estão temporariamente indisponíveis. O elenco e as avaliações continuam funcionando.</p>';
 if(!stats||!stats.games)return '<div class="team-no-games"><b>Nenhum jogo finalizado nesta fase ainda</b>'+
 'As médias aparecem automaticamente quando os resultados e box scores são importados. Você pode consultar a outra fase pelo filtro acima.</div>';
 return '';
}
function metric(label,value,detail=''){
 return '<article class="team-metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong>'+
 (detail?'<small>'+esc(detail)+'</small>':'')+'</article>';
}
function teamOverviewMetrics(){
 const st=section();if(!st||!st.games)return '';
 const standing=phase==='regular'?ownStanding():null;
 const win=standing?standing.w:st.wins,loss=standing?standing.l:st.losses;
 const confRank=phase==='regular'?teamPosition():null;
 return '<div class="team-metrics-grid">'+
 metric('CAMPANHA',win+'V • '+loss+'D',percent(win,loss)+' de aproveitamento')+
 metric('PONTOS / JOGO',average(st.pointsFor,st.games),'Sofridos: '+average(st.pointsAgainst,st.games))+
 metric('REBOTES / JOGO',average(st.reb,st.boxGames),'Box scores: '+st.boxGames)+
 metric('ASSISTÊNCIAS / JOGO',average(st.ast,st.boxGames),'Box scores: '+st.boxGames)+
 metric('FG%',rate(st.fgm,st.fga),'Arremessos de quadra')+
 metric('3PT%',rate(st.threeM,st.threeA),'Bolas de três')+
 metric('SALDO / JOGO',average(st.pointsFor-st.pointsAgainst,st.games),'Pontos feitos − sofridos')+
 metric(phase==='regular'?'POSIÇÃO NO '+(conf==='Leste'?'LESTE':'OESTE'):'PARTIDAS COM ESTATÍSTICAS',
  confRank?confRank+'º':String(st.boxGames),confRank?'Classificação provisória':'Jogos importados')+
 '</div>';
}
const athleteSort=(rows,key,asc=false)=>rows.slice().sort((a,b)=>{
 const av=pAverage(a,key),bv=pAverage(b,key);
 if(av===null&&bv!==null)return 1;
 if(bv===null&&av!==null)return -1;
 const delta=(av??0)-(bv??0);
 return delta?(asc?delta:-delta):b.gp-a.gp||a.name.localeCompare(b.name,'pt-BR');
});
function leaderSummary(){
 const s=section();if(!s?.players?.length)return '';
 const categories=[['pts','Pontos','PTS / jogo'],['reb','Rebotes','REB / jogo'],
  ['ast','Assistências','AST / jogo']];
 return '<section class="section"><div class="section-title"><h2>Líderes da equipe</h2>'+
 '<button type="button" class="btn ghost" data-tab="estatisticas">Ver ranking completo →</button></div>'+
 '<div class="team-leaders">'+categories.map(([key,label,unit])=>{
  const p=athleteSort(s.players,key)[0];
  if(!p)return '';
  return '<article class="team-leader-card"><span class="caps">MAIS '+esc(label.toUpperCase())+'</span>'+
   '<div class="team-leader-inner">'+playerImage(p)+
   '<div><a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a>'+
   '<span>'+p.gp+' '+(p.gp===1?'jogo':'jogos')+' • '+p.starts+' titularidades</span></div>'+
   '<div class="team-leader-number"><strong>'+cell(pAverage(p,key))+'</strong><small>'+unit+'</small></div></div></article>';
 }).join('')+'</div></section>';
}
function recentLineup(){
 const s=section(),available=s?.lastLineup||(phase==='regular'?teamStats?.preseason?.lastLineup:null);
 if(!available?.players?.length)return '<div class="filler">Ainda não há quinteto confirmado nos dados importados.</div>';
 const wasOther=phase==='regular'&&!s?.lastLineup;
 return '<div class="team-last-lineup"><div class="team-last-lineup-head"><div>'+
 '<strong>Último quinteto confirmado</strong><span>'+shortDate(available.date)+
 (wasOther?' • pré-temporada':' • '+(phase==='regular'?'temporada regular':'pré-temporada'))+
 '</span></div><span class="tag finished">✓ CONFIRMADO NA PARTIDA ANTERIOR</span></div>'+
 '<div class="team-last-lineup-players">'+available.players.map(p=>
 '<a href="'+playerLink(p.id,code)+'">'+playerImage(p)+
 '<span><strong>'+esc(p.name)+'</strong><small>#'+esc(p.number||'—')+
 ' • '+(p.pts??'—')+' PTS • '+(p.reb??'—')+' REB • '+(p.ast??'—')+' AST</small></span></a>').join('')+'</div>'+
 '<p class="small subtle">Escalação da última partida com quinteto identificado — não representa previsão oficial do próximo jogo.</p></div>';
}
function overview(){
 return phaseControl()+teamWarning()+(section()?.games?
  '<section class="section"><div class="section-title"><h2>Números da equipe</h2>'+
  '<a class="btn ghost" href="'+path('classificacao/?time='+code)+'">Classificação completa →</a></div>'+
  teamOverviewMetrics()+
  '<p class="team-stats-footnote">Pontos, campanha e saldo: jogos finalizados nesta fase. Rebotes, assistências e aproveitamento de arremessos: apenas '+section().boxGames+
  ' jogos com box score importado. Dados sujeitos à disponibilidade da fonte.</p></section>'+
  leaderSummary():'')+
 '<section class="section"><div class="section-title"><h2>Quinteto mais recente</h2>'+
 '<button type="button" class="btn ghost" data-tab="titulares">Ver escalações →</button></div>'+recentLineup()+'</section>'+
 '<section class="team-quick-links"><button type="button" class="btn" data-tab="estatisticas">Ranking dos jogadores →</button>'+
 '<button type="button" class="btn ghost" data-tab="jogos">Próximos jogos →</button></section>';
}
const columns=[
 {id:'pts',name:'PTS',label:'Pontos/jogo'},
 {id:'reb',name:'REB',label:'Rebotes/jogo'},
 {id:'ast',name:'AST',label:'Assistências/jogo'},
 {id:'minutes',name:'MIN',label:'Minutos/jogo'},
 {id:'stl',name:'STL',label:'Roubos/jogo'},
 {id:'blk',name:'BLK',label:'Tocos/jogo'},
 {id:'threePct',name:'3PT%',label:'Aproveitamento de 3'},
 {id:'fgPct',name:'FG%',label:'Aproveitamento de quadra'},
 {id:'gp',name:'J',label:'Jogos disputados'}
];
function playerRanking(){
 const stats=section();
 const options=columns.map(col=>'<option value="'+col.id+'"'+(sortBy===col.id?' selected':'')+'>'+col.label+'</option>').join('');
 return phaseControl()+teamWarning()+'<section class="section"><div class="section-title"><h2>Estatísticas dos jogadores</h2>'+
 '<span class="small subtle">'+(stats?.players?.length||0)+' atletas com box score</span></div>'+
 '<div class="team-ranking-toolbar"><label>Ordenar por <select id="teamSort" class="control">'+options+'</select></label>'+
 '<button type="button" class="btn ghost" id="teamSortDirection">'+(sortAsc?'↑ Crescente':'↓ Decrescente')+'</button></div>'+
 (stats?.players?.length?'<div class="team-rank-scroll"><table class="team-rank-table"><thead><tr>'+
 '<th class="team-rank-player">Jogador</th><th>J</th><th>TIT</th>'+
 columns.filter(c=>c.id!=='gp').map(c=>'<th><button type="button" data-team-stat="'+c.id+'" class="'+(sortBy===c.id?'selected':'')+
 '" title="'+c.label+'">'+c.name+(sortBy===c.id?(sortAsc?' ↑':' ↓'):'')+'</button></th>').join('')+
 '</tr></thead><tbody>'+
 athleteSort(stats.players,sortBy,sortAsc).map(p=>
 '<tr><th class="team-rank-player"><a href="'+playerLink(p.id,code)+'">'+playerImage(p)+
 '<span><b>'+esc(p.name)+'</b><small>#'+esc(p.number||'—')+
 ' • '+esc(rosterById(p.id)?.position||'Jogador')+'</small></span></a></th>'+
 '<td>'+p.gp+'</td><td>'+p.starts+'</td>'+
 columns.filter(c=>c.id!=='gp').map(c=>'<td class="'+(sortBy===c.id?'selected':'')+'">'+
 cell(pAverage(p,c.id))+(c.id.endsWith('Pct')&&pAverage(p,c.id)!==null?'%':'')+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div>':'<div class="filler">O ranking aparecerá assim que houver estatísticas nesta fase.</div>')+
 '<p class="team-stats-footnote">Médias por jogo disputado pelo atleta nesta franquia e fase, não por minuto. Inclui jogadores que participaram de jogos mesmo que não estejam mais no elenco atual. Percentuais calculados por arremessos convertidos/tentados.</p></section>';
}
function playerRow(p){
 const saved=getData().extras,star=saved.franchise?.[code]===String(p.id),
 own=(saved.lineups?.[code]||[]).includes(String(p.id));
 const recent=Boolean(section()?.lastLineup?.players?.some(x=>String(x.id)===String(p.id)));
 const badges=(star?'<span class="tag accent">★ Franchise</span>':'')+
  (own?'<span class="tag">Meu quinteto</span>':'')+
  (recent?'<span class="tag finished">Último titular</span>':'');
 return '<article class="player-row"><a href="'+playerLink(p.id,code)+'">'+playerImage(p)+'</a>'+
  '<div class="pname"><b><a href="'+playerLink(p.id,code)+'">'+esc(p.name)+'</a></b>'+
  '<small>#'+esc(p.number||'—')+' • '+esc(p.position||'—')+' '+badges+'</small></div>'+
  '<span class="muted-star">'+(saved.players?.[p.id]?.rating?'★ '+esc(saved.players[p.id].rating):'')+'</span>'+
  '<button class="btn" type="button" data-rate="'+esc(p.id)+'">Avaliar</button></article>';
}
function ratingForm(player){
 const b=getData(),x=b.extras,own=(x.lineups?.[code]||[]).includes(String(player.id)),
  star=x.franchise?.[code]===String(player.id),info=x.players?.[player.id]||{};
 modal('<h2>'+esc(player.name)+'</h2><p class="subtle">'+esc(name(code))+' • '+esc(player.position||'Jogador')+'</p>'+
 '<form id="playerForm"><div class="field"><label>Minha nota na temporada <span id="playerScore">'+esc(info.rating||'—')+
 '</span>/10</label><input type="range" id="playerRating" min="0" max="10" step="0.5" value="'+(Number(info.rating)||0)+'" class="rate-input"></div>'+
 '<div class="field"><label><input id="isFranchise" type="checkbox" '+(star?'checked':'')+'> Meu franchise player</label></div>'+
 '<div class="field"><label><input id="isStarter" type="checkbox" '+(own?'checked':'')+'> Meu quinteto titular (5 jogadores)</label></div>'+
 '<div class="field"><label><input id="isFavorite" type="checkbox" '+(info.favorite?'checked':'')+' > Seguir jogador</label></div>'+
 '<div class="modal-footer"><button type="submit" class="btn accent">Salvar avaliação</button></div></form>');
 $('#playerRating').oninput=()=>$('#playerScore').textContent=$('#playerRating').value;
 $('#playerForm').onsubmit=e=>{
  e.preventDefault();
  let line=(getData().extras.lineups?.[code]||[]).filter(id=>id!==String(player.id));
  if($('#isStarter').checked&&line.length>=5){toast('Seu quinteto já tem 5 jogadores. Retire um antes.');return;}
  if($('#isStarter').checked)line.push(String(player.id));
  modify(bundle=>{
   bundle.extras.players[player.id]={...info,name:player.name,team:code,rating:Number($('#playerRating').value),favorite:$('#isFavorite').checked};
   bundle.extras.lineups[code]=line;
   if($('#isFranchise').checked)bundle.extras.franchise[code]=String(player.id);
   else if(bundle.extras.franchise[code]===String(player.id))delete bundle.extras.franchise[code];
   bundle.extras.updatedAt=new Date().toISOString();
  });
  closeModal();draw();toast('Jogador avaliado!');
 };
}
function tabs(){
 return '<nav class="tabs team-tabs">'+[
  ['resumo','Resumo'],['estatisticas','Estatísticas'],['elenco','Elenco'],
  ['titulares','Titulares'],['jogos','Jogos'],['notas','Minhas notas']
 ].map(([key,label])=>'<button class="tab '+(active===key?'active':'')+
 '" data-tab="'+key+'">'+label+'</button>').join('')+'</nav>';
}
function hero(){
 const b=getData(),fav=b.settings.fav===code,st=ownStanding(),pos=teamPosition();
 return '<section class="team-hero"><img src="'+logoImage+'" alt=""><div>'+
 '<div class="eyebrow">CONFERÊNCIA '+conf.toUpperCase()+' • DIVISÃO '+esc(division).toUpperCase()+'</div>'+
 '<h2>'+esc(name(code))+'</h2><p>'+roster.length+' jogadores no elenco'+
 (st?' • Temporada regular: '+st.w+'V / '+st.l+'D'+(pos?' • '+pos+'º no '+conf:''):'')+'</p>'+
 '<div class="controls"><button class="btn '+(fav?'accent':'')+'" id="favoriteTeam">'+
 (fav?'★ Meu time favorito':'☆ Marcar como favorito')+'</button>'+
 '<a class="btn" href="'+path('classificacao/?time='+code)+'">Ver classificação ↗</a>'+
 '<a class="btn" href="'+path('equipes/')+'">Outras equipes</a></div></div></section>';
}
function draw(){
 if(!valid){root.innerHTML='<div class="filler">Equipe não encontrada. <a href="'+path('equipes/')+'">Ver equipes</a></div>';return;}
 let content=hero()+tabs();
 if(active==='resumo')content+=overview();
 else if(active==='estatisticas')content+=playerRanking();
 else if(active==='elenco'){
  content+='<section class="section"><div class="section-title"><h2>Elenco 2026/27</h2>'+
  '<span class="small subtle">Clique em um jogador para abrir seu perfil</span></div>'+
  (roster.length?'<div class="card team-roster-list">'+roster.map(playerRow).join('')+'</div>':
  '<div class="filler">'+(rosterReady?'Elenco indisponível nesta fonte.':'Carregando elenco…')+'</div>')+'</section>';
 }else if(active==='titulares'){
  const line=getData().extras.lineups?.[code]||[];
  content+=phaseControl()+'<section class="section"><h2>Último quinteto identificado</h2>'+recentLineup()+'</section>'+
  '<section class="card section"><h3>Meu quinteto pessoal <span class="subtle">'+line.length+'/5</span></h3>'+
  '<p>São suas escolhas, não necessariamente os titulares oficiais.</p>'+
  (line.length?line.map(id=>roster.find(p=>String(p.id)===String(id))).filter(Boolean).map(playerRow).join(''):
   '<div class="filler">Use Avaliar na aba Elenco para escolher seus cinco jogadores.</div>')+'</section>';
 }else if(active==='jogos'){
  const upcoming=games.filter(g=>(g.away===code||g.home===code)&&g.date>=currentDate()).slice(0,8);
  content+='<section class="section"><div class="section-title"><h2>Próximos jogos</h2>'+
  '<a class="btn" href="'+path('jogos/')+'">Agenda completa →</a></div>'+
  (gamesLoaded?groupGames(upcoming):'<div class="filler">Carregando próximos confrontos…</div>')+'</section>';
 }else if(active==='notas'){
  const saved=getData().extras;
  const rated=roster.filter(p=>Number(saved.players?.[p.id]?.rating)>0)
   .sort((a,b)=>Number(saved.players[b.id].rating)-Number(saved.players[a.id].rating));
  content+='<section class="card section"><h3>Meu ranking pessoal</h3>'+
   '<p>Notas de 0 a 10 que você atribuiu. Não são as notas automáticas do site DE LA QUADRA.</p>'+
   (rated.length?rated.map(playerRow).join(''):'<div class="filler">Nenhum jogador avaliado.</div>')+'</section>';
 }
 root.innerHTML=content;
}
async function loadExtras(){
 if(!valid)return;
 const today=currentDate(),index=Math.max(0,MONTHS.indexOf(today.slice(0,7)));
 const required=MONTHS.slice(index,index+2);
 gamesLoaded=false;
 try{games=await loadGames(required);}catch(e){console.info('QUADRA: jogos do time indisponíveis',e);games=[]}
 gamesLoaded=true;if(active==='jogos')draw();
}
root.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]');
 if(tab){active=tab.dataset.tab;draw();if(active==='jogos'&&!gamesLoaded)loadExtras();return;}
 const changePhase=e.target.closest('[data-phase]');
 if(changePhase){phase=changePhase.dataset.phase;draw();return;}
 if(e.target.closest('#teamSortDirection')){sortAsc=!sortAsc;draw();return;}
 const sort=e.target.closest('[data-team-stat]');
 if(sort){if(sortBy===sort.dataset.teamStat)sortAsc=!sortAsc;else{sortBy=sort.dataset.teamStat;sortAsc=false;}draw();return;}
 if(e.target.closest('#favoriteTeam')){setSettings({fav:getData().settings.fav===code?'':code});draw();return;}
 const player=e.target.closest('[data-rate]');
 if(player){const p=roster.find(x=>String(x.id)===player.dataset.rate);if(p)ratingForm(p);return;}
 if(handleWishes(e.target,draw))e.preventDefault();
});
root.addEventListener('change',e=>{if(e.target.id==='teamSort'){sortBy=e.target.value;sortAsc=false;draw();}});
window.addEventListener('quadra:refresh',draw);
if(valid){
 root.innerHTML='<div class="filler">Carregando números e elenco do time…</div>';
 Promise.allSettled([
  jsonFile('data/team-stats/'+code+'.json'),
  jsonFile('data/standings/2026-27.json'),
  fetchRoster(code)
 ]).then(results=>{
  if(results[0].status==='fulfilled')teamStats=results[0].value;else statError=String(results[0].reason);
  standings=results[1].status==='fulfilled'?results[1].value:null;
  roster=results[2].status==='fulfilled'?results[2].value:[];
  rosterReady=true;draw();
 });
}else draw();
