import {$,setupShared,qs,TEAMS,name,logo,esc,fetchRoster,fetchBox,MONTHS,currentDate,getData,modify,playerLink,teamLink,gameLink,loadGames,shortDate,toast} from '../app.js?v=6';
const pid=qs('id')||'',rawTeam=(qs('team')||'').toUpperCase();
const root=$('#pageContent');setupShared('teams','Perfil do jogador','Estatísticas importadas, desempenho recente e suas avaliações pessoais.');
let team=TEAMS[rawTeam]?rawTeam:'',player=null,gameStats=[];
function section(){
 if(!player){root.innerHTML='<div class="filler"><b>Jogador não encontrado nos elencos carregados</b>Abra a página da equipe e clique no nome de um atleta.</div>';return;}
 document.title=player.name+' • QUADRA NBA';
 const b=getData(),x=b.extras,p=x.players?.[pid]||{},franchise=x.franchise?.[team]===pid;
 const games=gameStats.sort((a,b)=>b.date.localeCompare(a.date));
 const avg=games.length?(games.reduce((s,g)=>s+(+g.row.pts||0),0)/games.length).toFixed(1).replace('.',','):'—';
 root.innerHTML='<section class="team-hero"><img src="'+esc(player.headshot||logo(team))+'" alt="" style="border-radius:13px;background:#223046;object-fit:contain" onerror="this.src=\''+logo(team)+'\'"><div><div class="eyebrow">'+esc(name(team))+' • '+esc(player.position||'NBA')+'</div><h2>'+esc(player.name)+'</h2><p>#'+esc(player.number||'—')+' • Temporada 2026/27</p><div class="controls"><a href="'+teamLink(team)+'" class="btn">← Voltar ao elenco</a></div></div></section>'+
 '<div class="grid three"><div class="card"><div class="caps">Minha nota na temporada</div><h3>'+esc(p.rating||'—')+'/10</h3><p>Minha avaliação pessoal</p></div><div class="card"><div class="caps">Pontos por jogo importado</div><h3>'+avg+'</h3><p>Com base em '+games.length+' box scores disponíveis</p></div><div class="card"><div class="caps">Minha classificação</div><h3>'+(franchise?'★ Franchise player':p.favorite?'♥ Favorito':'—')+'</h3><p>Seleção feita por você</p></div></div>'+
 '<section class="card section"><h3>Avaliar jogador</h3><form id="playerProfile"><div class="field"><label>Nota da temporada: <span id="currentRating">'+esc(p.rating||0)+'</span>/10</label><input type="range" id="rateProfile" min="0" max="10" step="0.5" value="'+esc(p.rating||0)+'" class="rate-input"></div>'+
 '<div class="controls"><label><input type="checkbox" id="favoritePlayer" '+(p.favorite?'checked':'')+'> Jogador favorito</label><label><input type="checkbox" id="franchisePlayer" '+(franchise?'checked':'')+'> Meu franchise player de '+esc(name(team))+'</label></div><button type="submit" class="btn accent">Salvar avaliação ✓</button></form></section>'+
 '<section class="section"><div class="section-title"><h2>Últimas estatísticas disponíveis</h2><span class="subtle small">Somente partidas com box score importado</span></div>'+
 (games.length?'<div class="card scroll-x"><table class="stat-table"><thead><tr><th>Data / jogo</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>3PT</th></tr></thead><tbody>'+
 games.slice(0,30).map(g=>'<tr><td><a href="'+esc(gameLink({id:g.event.id,date:g.date}))+'">'+shortDate(g.date)+' • '+esc(name(g.opponent))+'</a></td><td>'+esc(g.row.min||'—')+'</td><td>'+esc(g.row.pts)+'</td><td>'+esc(g.row.reb)+'</td><td>'+esc(g.row.ast)+'</td><td>'+esc(g.row.stl)+'</td><td>'+esc(g.row.blk)+'</td><td>'+esc(g.row.three||'—')+'</td></tr>').join('')+'</tbody></table></div>':
 '<div class="filler"><b>Sem estatísticas importadas deste atleta</b>Os números aparecerão após as próximas partidas com box score disponível.</div>')+'</section>';
}
root.addEventListener('input',e=>{if(e.target.id==='rateProfile')$('#currentRating').textContent=e.target.value;});
root.addEventListener('submit',e=>{
 if(e.target.id!=='playerProfile')return;e.preventDefault();
 const rated=+$('#rateProfile').value,fav=$('#favoritePlayer').checked,star=$('#franchisePlayer').checked;
 modify(b=>{const old=b.extras.players[pid]||{};b.extras.players[pid]={...old,name:player.name,team,rating:rated,favorite:fav};if(star)b.extras.franchise[team]=pid;else if(b.extras.franchise[team]===pid)delete b.extras.franchise[team];b.extras.updatedAt=new Date().toISOString()});
 toast('Avaliação salva');section();
});
window.addEventListener('quadra:refresh',section);
async function boot(){
 try{
  if(!pid)throw Error('ID do atleta ausente');
  if(team){const people=await fetchRoster(team);player=people.find(p=>String(p.id)===pid);}
  else { // Links externos com apenas ID: procurar até encontrar o atleta.
   for(const c of Object.keys(TEAMS)){const arr=await fetchRoster(c).catch(()=>[]);const p=arr.find(x=>String(x.id)===pid);if(p){player=p;team=c;break;}}
  }
  if(!player){section();return;}
  const now=currentDate().slice(0,7),past=MONTHS.filter(m=>m<=now);
  const boxes=await Promise.all(past.map(fetchBox));
  for(const data of boxes)for(const event of Object.values(data)){
    const row=event.players?.[team]?.find(p=>String(p.id)===pid);
    if(row)gameStats.push({row,date:event.date,opponent:event.away===team?event.home:event.away,event});
  }
  section();
 }catch(e){console.error(e);root.innerHTML='<div class="filler">'+esc(e.message)+'</div>';}
}
root.innerHTML='<div class="filler">Carregando jogador…</div>';boot();
