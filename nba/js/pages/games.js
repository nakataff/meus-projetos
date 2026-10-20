import {$,setupShared,MONTHS,loadGames,TEAMS,groupGames,handleWishes,currentDate,dayShift,niceDate,note,esc,qs} from '../app.js';

setupShared('games','Agenda NBA','Veja os jogos de hoje, avance ou volte pelo calendário e filtre os confrontos da temporada.');
const root=$('#pageContent'),today=currentDate();
const calendarStart='2026-10-01',calendarEnd='2027-05-31';
const requested=qs('data');
let selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(requested||'') && !Number.isNaN(Date.parse(requested+'T12:00:00Z')) ? requested : today;
let view=qs('view')==='upcoming'||(qs('tv')==='br'&&!qs('data'))?'upcoming':qs('view')==='season'?'season':'day';
let mode=qs('tv')==='br'?'br':'all',order='asc',limit=60;
let games=[],loadedMonths=new Set(),requestCounter=0,ready=false,busy=false;
const validMonth=date=>MONTHS.includes(date.slice(0,7));
const monthsFor=(date)=>{
 const target=date.slice(0,7);
 return validMonth(date)?[target]:[];
};
function dayLabel(date){
 return new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',weekday:'short',day:'numeric'});
}
function fullDay(date){
 return niceDate(date).replace(/^./,x=>x.toUpperCase());
}
function dateNav(){
 const strip=Array.from({length:7},(_,i)=>dayShift(selectedDate,i-3)).map(date=>
 '<button type="button" class="game-day '+(date===selectedDate?'active':'')+(date===today?' today':'')+'" data-day="'+date+'" aria-pressed="'+(date===selectedDate)+'"><span>'+
 esc(dayLabel(date).split(',')[0])+'</span><b>'+date.slice(8,10)+'</b></button>').join('');
 return '<section class="date-navigator" aria-label="Navegação pelo calendário">'+
 '<div class="date-navigator-head"><div><span class="caps">DATA SELECIONADA</span><h2 id="selectedDayTitle">'+esc(fullDay(selectedDate))+'</h2></div>'+
 '<div class="date-actions"><button class="btn ghost" type="button" id="goToday">Hoje</button>'+
 '<button class="btn day-arrow" type="button" data-step="-1" aria-label="Dia anterior">‹</button>'+
 '<input class="control date-input" type="date" id="gameDate" aria-label="Escolher dia no calendário" value="'+selectedDate+'" min="'+calendarStart+'" max="'+calendarEnd+'">'+
 '<button class="btn day-arrow" type="button" data-step="1" aria-label="Próximo dia">›</button></div></div>'+
 '<div class="date-week">'+strip+'</div></section>';
}
function toolbar(){
 const teams=Object.entries(TEAMS).sort((a,b)=>a[1][0].localeCompare(b[1][0]))
 .map(([code,t])=>'<option value="'+code+'">'+esc(t[0])+'</option>').join('');
 return '<nav class="switches game-views" aria-label="Período dos jogos">'+
 [['day','Por dia'],['upcoming','Próximos jogos'],['season','Temporada inteira']].map(([key,label])=>
 '<button type="button" class="pill" data-view="'+key+'">'+label+'</button>').join('')+'</nav>'+
 '<div id="dayNavigation">'+dateNav()+'</div>'+
 '<div class="controls game-filters"><input id="searchGames" class="control" type="search" placeholder="Buscar equipe…">'+
 '<select id="teamGames" class="control"><option value="">Todas as equipes</option>'+teams+'</select>'+
 '<select id="stageGames" class="control"><option value="">Todas as fases</option><option value="Temporada regular">Temporada regular</option><option value="Pré-temporada">Pré-temporada</option><option value="Copa NBA">Copa NBA</option><option value="Playoffs">Playoffs</option></select></div>'+
 '<div class="switches game-categories" aria-label="Filtro de partidas">'+[
 ['all','Todos'],['br','TV / Streaming BR'],['unknown','Sem TV BR informada'],
 ['wish','Quero assistir'],['watched','Assistidos'],['rated','Avaliados']
 ].map(([key,label])=>'<button type="button" class="pill" data-mode="'+key+'">'+label+'</button>').join('')+'</div>'+
 '<div class="game-list-meta"><span class="small subtle" id="resultCount">Carregando jogos…</span>'+
 '<button type="button" class="btn ghost" id="sortGames">↑ Mais próximos</button></div>'+
 '<div id="gamesList" aria-live="polite"></div>';
}
function syncURL(){
 const url=new URL(location.href);
 url.searchParams.delete('view');url.searchParams.delete('data');
 if(view!=='day')url.searchParams.set('view',view);
 if(view==='day'&&selectedDate!==today)url.searchParams.set('data',selectedDate);
 if(mode==='br')url.searchParams.set('tv','br');
 else url.searchParams.delete('tv');
 history.replaceState(null,'',url.pathname+url.search);
}
function renderNav(){
 $('#dayNavigation').innerHTML=view==='day'?dateNav():'';
}
function updateActive(){
 root.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===view));
 root.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));
 $('#sortGames').textContent=order==='asc'?'↑ Mais próximos':'↓ Mais distantes';
}
function matchFilter(g){
 const search=($('#searchGames')?.value||'').toLowerCase().trim();
 const team=$('#teamGames')?.value||'';
 const stage=$('#stageGames')?.value||'';
 const n=note(g.id);
 if(view==='day'&&g.date!==selectedDate)return false;
 if(view==='upcoming'&&g.date<today)return false;
 if(team&&g.away!==team&&g.home!==team)return false;
 if(stage&&g.stage!==stage)return false;
 if(search&&![g.away,g.home,TEAMS[g.away]?.[0],TEAMS[g.home]?.[0]].join(' ').toLowerCase().includes(search))return false;
 if(mode==='br'&&!(g.platforms||[]).some(p=>p==='PRIME'||p==='ESPN'))return false;
 if(mode==='unknown'&&(g.platforms||[]).some(p=>p==='PRIME'||p==='ESPN'))return false;
 if(mode==='wish'&&(!n.wish||n.watched))return false;
 if(mode==='watched'&&!n.watched)return false;
 if(mode==='rated'&&!(Number(n.rating)>0))return false;
 return true;
}
function emptyMessage(){
 const later=games.find(g=>g.date>selectedDate&&(!$('#teamGames')?.value||g.away===$('#teamGames').value||g.home===$('#teamGames').value));
 const earlier=[...games].reverse().find(g=>g.date<selectedDate);
 let html='<div class="filler"><b>Nenhum jogo encontrado '+(view==='day'?'para '+esc(fullDay(selectedDate)):'com esses filtros')+'.</b>'+
 (view==='day'?'Você pode avançar ou voltar um dia, ou escolher uma data no calendário.':'Ajuste os filtros ou escolha outro período.')+'</div>';
 if(view==='day'&&later)html+='<p class="center"><button class="btn" data-go-date="'+later.date+'">Próximo dia com jogos: '+esc(fullDay(later.date))+' →</button></p>';
 else if(view==='day'&&earlier)html+='<p class="center"><button class="btn ghost" data-go-date="'+earlier.date+'">Último dia com jogos: '+esc(fullDay(earlier.date))+' →</button></p>';
 return html;
}
function render(){
 if(!ready)return;
 updateActive();
 let filtered=games.filter(matchFilter);
 if(order==='desc')filtered=filtered.reverse();
 $('#resultCount').textContent=filtered.length+' '+(filtered.length===1?'partida':'partidas')+(view==='day'?' • '+fullDay(selectedDate):view==='upcoming'?' a partir de hoje':' na temporada');
 $('#gamesList').innerHTML=filtered.length?groupGames(filtered.slice(0,limit))+
 (filtered.length>limit?'<p class="center"><button class="btn" id="loadMore">Carregar mais '+Math.min(60,filtered.length-limit)+' partidas ↓</button></p>':''):emptyMessage();
}
async function reload(){
 const token=++requestCounter;
 busy=true;
 $('#gamesList').innerHTML='<div class="filler">Buscando partidas do período…</div>';
 $('#resultCount').textContent='Carregando…';
 try{
  // Consultar apenas o mês aberto; listas amplas carregam o calendário inteiro.
  const requested=view==='day'?monthsFor(selectedDate):MONTHS;
  const loaded=await loadGames(requested);
  if(token!==requestCounter)return;
  games=loaded;loadedMonths=new Set(requested);
  busy=false;render();
 }catch(err){
  if(token!==requestCounter)return;
  busy=false;console.error('Falha ao carregar agenda',err);
  $('#gamesList').innerHTML='<div class="filler"><b>Calendário indisponível agora</b>Tente atualizar a página.</div>';
 }
}
function setDay(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))return;
 selectedDate=date;
 view='day';
 order='asc';limit=60;
 renderNav();syncURL();reload();
}
root.innerHTML=toolbar();ready=true;
renderNav();updateActive();reload();
root.addEventListener('click',e=>{
 if(handleWishes(e.target,render)){e.preventDefault();return;}
 const v=e.target.closest('[data-view]');
 if(v){view=v.dataset.view;order='asc';limit=60;renderNav();syncURL();reload();return;}
 const modeBtn=e.target.closest('[data-mode]');
 if(modeBtn){
  mode=modeBtn.dataset.mode;
  // Histórico e lista pessoal devem mostrar registros do período completo.
  if(['watched','rated'].includes(mode)&&view==='day'){view='season';renderNav();reload();}
  else if(mode==='wish'&&view==='day'){view='upcoming';renderNav();reload();}
  syncURL();render();return;
 }
 const step=e.target.closest('[data-step]');if(step){setDay(dayShift(selectedDate,Number(step.dataset.step)));return;}
 const day=e.target.closest('[data-day]');if(day){setDay(day.dataset.day);return;}
 const go=e.target.closest('[data-go-date]');if(go){setDay(go.dataset.goDate);return;}
 if(e.target.closest('#goToday')){setDay(today);return;}
 if(e.target.closest('#sortGames')){order=order==='asc'?'desc':'asc';render();return;}
 if(e.target.closest('#loadMore')){limit+=60;render();return;}
});
root.addEventListener('input',e=>{
 if(['searchGames','teamGames','stageGames'].includes(e.target.id)){limit=60;render();}
});
root.addEventListener('change',e=>{
 if(e.target.id==='gameDate'){setDay(e.target.value);return;}
 if(['teamGames','stageGames'].includes(e.target.id)){limit=60;render();}
});
window.addEventListener('quadra:refresh',render);
