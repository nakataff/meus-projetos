import {$,setupShared,MONTHS,loadGames,TEAMS,groupGames,handleWishes,currentDate,getData,note,getSpoilers,setSpoilers,esc,qs,toast,shortDate} from '../app.js';
setupShared('games','Calendário de jogos','Toda a agenda da temporada, com transmissões brasileiras em destaque e seu histórico.');
const root=$('#pageContent');
let data=[],limit=55,mode=qs('tv')==='br'?'br':'all',order='asc';
root.innerHTML='<div class="filler"><b>Carregando jogos…</b>Consultando arquivos mensais da temporada.</div>';
function filters(){
 const months=MONTHS.map(m=>'<option value="'+m+'">'+new Date(m+'-15T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'})+'</option>').join('');
 const teams=Object.entries(TEAMS).sort((a,b)=>a[1][0].localeCompare(b[1][0])).map(([c,t])=>'<option value="'+c+'">'+esc(t[0])+'</option>').join('');
 return '<div class="controls"><input id="searchGames" class="control" type="search" placeholder="Buscar equipe…"><select id="monthGames" class="control"><option value="">Todos os meses</option>'+months+'</select><select id="teamGames" class="control"><option value="">Todas as equipes</option>'+teams+'</select><select id="stageGames" class="control"><option value="">Todas as fases</option><option>Temporada regular</option><option>Pré-temporada</option><option>Copa NBA</option><option>Playoffs</option></select></div>'+
 '<div class="switches"><button class="pill" data-mode="all">Todos</button><button class="pill" data-mode="br">TV / Streaming BR</button><button class="pill" data-mode="unknown">Sem TV BR informada</button><button class="pill" data-mode="wish">Quero assistir</button><button class="pill" data-mode="watched">Assistidos</button><button class="pill" data-mode="rated">Avaliados</button></div>'+
 '<div class="controls"><button class="btn ghost" id="toggleSpoilers">'+(getSpoilers()?'◉ Ocultar resultados':'◎ Mostrar resultados')+'</button><button class="btn ghost" id="sortGames">↑ Ordem crescente</button><span class="subtle small" id="resultCount"></span></div>';
}
let result=[],controlsReady=false;
function applyFilters(){
 const search=($('#searchGames')?.value||'').toLowerCase().trim(),month=$('#monthGames')?.value||'',team=$('#teamGames')?.value||'',stage=$('#stageGames')?.value||'';
 result=data.filter(g=>{
 const n=note(g.id);
 if(month&&!g.date.startsWith(month))return false;
 if(team&&g.away!==team&&g.home!==team)return false;
 if(stage&&g.stage!==stage)return false;
 if(search&&!([g.away,g.home,TEAMS[g.away]?.[0],TEAMS[g.home]?.[0]].join(' ').toLowerCase().includes(search)))return false;
 if(mode==='br'&&!((g.platforms||[]).some(p=>['PRIME','ESPN'].includes(p))))return false;
 if(mode==='unknown'&&((g.platforms||[]).some(p=>['PRIME','ESPN'].includes(p))))return false;
 if(mode==='wish'&&(!n.wish||n.watched))return false;
 if(mode==='watched'&&!n.watched)return false;
 if(mode==='rated'&&!(Number(n.rating)>0))return false;
 return true;});
 if(order==='desc')result.reverse();
 $('#resultCount').textContent=result.length+' partidas';
 root.querySelectorAll('[data-mode]').forEach(el=>el.classList.toggle('active',el.dataset.mode===mode));
 $('#sortGames').textContent=order==='asc'?'↑ Ordem crescente':'↓ Ordem decrescente';
 $('#toggleSpoilers').textContent=getSpoilers()?'◉ Sem spoilers':'◎ Exibir resultados';
 $('#gamesList').innerHTML=groupGames(result.slice(0,limit))+(result.length>limit?'<p class="center"><button class="btn" id="loadMore">Carregar mais '+Math.min(55,result.length-limit)+' partidas ↓</button></p>':'');
}
function draw(){
 if(!controlsReady){root.innerHTML=filters()+'<div id="gamesList"></div>';controlsReady=true;}
 applyFilters();
}
loadGames(MONTHS).then(g=>{data=g;draw();}).catch(e=>root.innerHTML='<div class="filler">Não foi possível carregar o calendário. '+esc(e.message)+'</div>');
root.addEventListener('click',e=>{
 if(handleWishes(e.target,applyFilters)){e.preventDefault();return;}
 const b=e.target.closest('[data-mode]');if(b){mode=b.dataset.mode;limit=55;applyFilters();return;}
 if(e.target.closest('#loadMore')){limit+=55;applyFilters();return;}
 if(e.target.closest('#sortGames')){order=order==='asc'?'desc':'asc';applyFilters();return;}
 if(e.target.closest('#toggleSpoilers')){setSpoilers(!getSpoilers());applyFilters();return;}
});
root.addEventListener('input',e=>{if(['searchGames','monthGames','teamGames','stageGames'].includes(e.target.id)){limit=55;applyFilters();}});
root.addEventListener('change',e=>{if(['monthGames','teamGames','stageGames'].includes(e.target.id)){limit=55;applyFilters();}});
window.addEventListener('quadra:refresh',()=>{if(controlsReady)applyFilters()});
