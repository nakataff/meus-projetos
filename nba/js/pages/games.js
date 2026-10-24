import {$,setupShared,MONTHS,loadGames,TEAMS,groupGames,gameRow,handleWishes,currentDate,dayShift,niceDate,note,esc,qs,modal,closeModal,overnightGame} from '../app.js?v=13';

setupShared('games','Agenda NBA','Calendário, horários e transmissões dos jogos da temporada.');
const root=$('#pageContent');
let today=currentDate();
const calendarStart='2026-10-01',calendarEnd='2027-05-31';
const requested=qs('data');
let selectedDate=/^\d{4}-\d{2}-\d{2}$/.test(requested||'') && !Number.isNaN(Date.parse(requested+'T12:00:00Z')) ? requested : today;
let followToday=!requested;
let view=qs('view')==='upcoming'||(qs('tv')==='br'&&!qs('data'))?'upcoming':qs('view')==='season'?'season':'day';
let mode=qs('tv')==='br'?'br':'all',order='asc',limit=60;
const broadcastOptions=[['ESPN','ESPN / Disney+'],['PRIME','Prime Video'],['LEAGUE','NBA League Pass'],['OTHER','Sem transmissão informada']];
const selectedTeams=new Set();
const normalizeTeam=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let games=[],loadedMonths=new Set(),requestCounter=0,ready=false,busy=false;
const validMonth=date=>MONTHS.includes(date.slice(0,7));
const monthsFor=(date)=>{
 const target=date.slice(0,7);
 const months=validMonth(date)?[target]:[];
 // No primeiro dia do mês, o jogo iniciado ontem ainda está no arquivo anterior.
 if(date===today){
  const prior=dayShift(date,-1).slice(0,7);
  if(prior!==target&&MONTHS.includes(prior))months.unshift(prior);
 }
 return months;
};
function dayLabel(date){
 return new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{
  timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'
 });
}
function fullDay(date){return dayLabel(date).replace(/^./,x=>x.toUpperCase());}
function dateNav(){
 const label=dayLabel(selectedDate);
 const labelDate=new Date(selectedDate+'T12:00:00Z');
 const short=labelDate.toLocaleDateString('pt-BR',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
 const weekday=labelDate.toLocaleDateString('pt-BR',{timeZone:'UTC',weekday:'long'});
 return '<div class="agenda-date-nav" aria-label="Selecionar data da agenda">'+
 '<button type="button" class="agenda-day-arrow" data-step="-1" aria-label="Dia anterior">‹</button>'+
 '<button type="button" class="agenda-date-open" id="openGameCalendar" aria-label="Abrir calendário, data selecionada: '+esc(label)+'">'+
 '<span class="agenda-cal-icon" aria-hidden="true">▦</span><span><strong>'+esc(short)+'</strong>'+
 '<small>'+esc(weekday)+' · Abrir calendário</small></span><span class="agenda-cal-chevron" aria-hidden="true">⌄</span></button>'+
 '<button type="button" class="agenda-day-arrow" data-step="1" aria-label="Próximo dia">›</button>'+
 (selectedDate!==today?'<button type="button" class="agenda-today" id="goToday">Hoje</button>':'')+
 '</div>';
}
function toolbar(){
 const teams=Object.entries(TEAMS).sort((a,b)=>a[1][0].localeCompare(b[1][0]))
  .map(([code,t])=>'<label data-team-option="'+code+'"><input type="checkbox" data-agenda-team="'+code+'"> '+esc(t[0])+' <small>'+code+'</small></label>').join('');
 return '<div id="dayNavigation">'+(view==='day'?dateNav():'')+'</div>'+
 '<div class="agenda-compact-toolbar">'+
 '<label class="agenda-select"><span>Período</span><select class="control" id="agendaView">'+
 '<option value="day">Por dia</option><option value="upcoming">Próximos jogos</option><option value="season">Temporada inteira</option></select></label>'+
 '<label class="agenda-select"><span>Mostrar</span><select class="control" id="agendaMode">'+
 '<option value="all">Todos os jogos</option><option value="br">TV / streaming BR</option>'+
 '<option value="unknown">Sem TV BR</option><option value="wish">Quero assistir</option>'+
 '<option value="watched">Assistidos</option><option value="rated">Avaliados</option></select></label>'+
 '<details class="agenda-more-filters" id="advancedGameFilters"><summary>⚙ Filtros <span aria-hidden="true">⌄</span></summary>'+
 '<div class="agenda-filter-panel"><div class="agenda-team-field"><span>Equipe</span><details class="agenda-team-picker" id="teamGames"><summary><span id="teamFilterLabel">Todas as equipes</span><span aria-hidden="true">⌄</span></summary>'+
 '<div class="agenda-team-menu"><label class="agenda-team-search">Buscar equipe<input id="agendaTeamSearch" type="search" class="control" placeholder="Nome ou sigla…" autocomplete="off"></label>'+
 '<fieldset><legend>Selecionar equipes</legend><label><input type="checkbox" data-agenda-team="ALL" checked> Todas as equipes</label>'+teams+'</fieldset><p id="agendaTeamEmpty" hidden>Nenhuma equipe encontrada.</p></div></details></div>'+
 '<label>Onde assistir<select id="broadcastGames" class="control"><option value="">Todas as transmissões</option>'+broadcastOptions.map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select></label>'+
 '<label>Fase<select id="stageGames" class="control"><option value="">Todas as fases</option>'+
 '<option value="Temporada regular">Temporada regular</option><option value="Pré-temporada">Pré-temporada</option>'+
 '<option value="Copa NBA">Copa NBA</option><option value="Playoffs">Playoffs</option></select></label>'+
 '<label>Ordem<select id="sortGames" class="control"><option value="asc">Mais próximos primeiro</option>'+
 '<option value="desc">Mais distantes primeiro</option></select></label></div></details></div>'+
 '<div class="game-list-meta"><span class="small subtle" id="resultCount">Carregando jogos…</span></div>'+
 '<div id="gamesList" aria-live="polite"></div>';
}
function calendarHTML(month){
 const [year,mon]=month.split('-').map(Number);
 const first=new Date(Date.UTC(year,mon-1,1));
 const last=new Date(Date.UTC(year,mon,0)).getUTCDate();
 const weekday=(first.getUTCDay()+6)%7;
 const heading=first.toLocaleDateString('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'});
 const dates=Array.from({length:weekday+last},(_,i)=>{
  if(i<weekday)return '<span class="agenda-calendar-blank" aria-hidden="true"></span>';
  const day=i-weekday+1,iso=month+'-'+String(day).padStart(2,'0');
  const count=games.filter(g=>g.date===iso).length;
  const disabled=iso<calendarStart||iso>calendarEnd;
  return '<button type="button" class="agenda-calendar-day'+(iso===today?' is-today':'')+
   (iso===selectedDate?' is-selected':'')+'" data-cal-date="'+iso+'"'+(disabled?' disabled':'')+
   ' aria-label="'+esc(dayLabel(iso))+(count?' • '+count+' jogos':'')+'" aria-pressed="'+(iso===selectedDate)+'">'+
   '<b>'+day+'</b>'+(count?'<i aria-hidden="true"></i>':'')+'</button>';
 }).join('');
 return '<div class="agenda-calendar" role="group" aria-label="Calendário de jogos">'+
 '<div class="agenda-calendar-head"><button type="button" class="agenda-month-arrow" data-cal-month="-1" aria-label="Mês anterior" '+(month<='2026-10'?'disabled':'')+'>‹</button>'+
 '<strong>'+esc(heading.charAt(0).toUpperCase()+heading.slice(1))+'</strong>'+
 '<button type="button" class="agenda-month-arrow" data-cal-month="1" aria-label="Próximo mês" '+(month>='2027-05'?'disabled':'')+'>›</button></div>'+
 '<div class="agenda-calendar-grid">'+['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=>
  '<span class="agenda-week-label">'+x+'</span>').join('')+dates+'</div>'+
 '<div class="agenda-calendar-foot"><span>• Dias com partidas já carregadas</span>'+
 '<button type="button" class="btn ghost" data-cal-date="'+today+'">Hoje</button></div></div>';
}
function openCalendar(month=selectedDate.slice(0,7)){
 modal('<div class="agenda-calendar-modal"><h2>Escolher data</h2>'+calendarHTML(month)+'</div>');
 const panel=document.querySelector('#modalRoot .agenda-calendar-modal');
 if(!panel)return;
 panel.addEventListener('click',e=>{
  const day=e.target.closest('[data-cal-date]');
  if(day&&!day.disabled){closeModal();setDay(day.dataset.calDate,day.dataset.calDate===today);return;}
  const nav=e.target.closest('[data-cal-month]');
  if(nav){
   const [y,m]=month.split('-').map(Number);
   const next=new Date(Date.UTC(y,m-1+Number(nav.dataset.calMonth),1));
   const candidate=next.toISOString().slice(0,7);
   if(candidate<'2026-10'||candidate>'2027-05')return;
   openCalendar(candidate);
  }
 });
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
 const period=$('#agendaView'),category=$('#agendaMode'),sort=$('#sortGames');
 if(period)period.value=view;
 if(category)category.value=mode;
 if(sort)sort.value=order;
}
function matchFilter(g){
 const broadcast=$('#broadcastGames')?.value||'';
 const stage=$('#stageGames')?.value||'';
 const n=note(g.id);
 if(view==='day'&&g.date!==selectedDate&&!(selectedDate===today&&overnightGame(g)))return false;
 if(view==='upcoming'&&g.date<today&&!overnightGame(g))return false;
 if(selectedTeams.size&&!selectedTeams.has(g.away)&&!selectedTeams.has(g.home))return false;
 if(stage&&g.stage!==stage)return false;
 const platforms=g.platforms||[];
 if(broadcast&&(broadcast==='OTHER'?platforms.some(x=>['ESPN','PRIME','LEAGUE'].includes(x)):!platforms.includes(broadcast)))return false;
 if(mode==='br'&&!(g.platforms||[]).some(p=>p==='PRIME'||p==='ESPN'))return false;
 if(mode==='unknown'&&(g.platforms||[]).some(p=>p==='PRIME'||p==='ESPN'))return false;
 if(mode==='wish'&&(!n.wish||n.watched))return false;
 if(mode==='watched'&&!n.watched)return false;
 if(mode==='rated'&&!(Number(n.rating)>0))return false;
 return true;
}
function emptyMessage(){
 const later=games.find(g=>g.date>selectedDate&&(!selectedTeams.size||selectedTeams.has(g.away)||selectedTeams.has(g.home)));
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
 $('#resultCount').textContent=filtered.length+' '+(filtered.length===1?'partida':'partidas')+(view==='upcoming'?' • próximos jogos':view==='season'?' • temporada':filtered.some(g=>g.date<selectedDate)?' • inclui jogo iniciado ontem':'');
 $('#gamesList').innerHTML=filtered.length?(view==='day'?filtered.slice(0,limit).map(gameRow).join(''):groupGames(filtered.slice(0,limit)))+
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
function setDay(date,autoFollow=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||date<calendarStart||date>calendarEnd)return;
 selectedDate=date;
 followToday=autoFollow;
 view='day';
 order='asc';limit=60;
 renderNav();syncURL();reload();
}
root.innerHTML=toolbar();ready=true;
renderNav();updateActive();reload();
root.addEventListener('click',e=>{
 if(handleWishes(e.target,render)){e.preventDefault();return;}
 if(e.target.closest('#openGameCalendar')){openCalendar();return;}
 const step=e.target.closest('[data-step]');if(step){setDay(dayShift(selectedDate,Number(step.dataset.step)));return;}
 const go=e.target.closest('[data-go-date]');if(go){setDay(go.dataset.goDate);return;}
 if(e.target.closest('#goToday')){setDay(today,true);return;}
 if(e.target.closest('#loadMore')){limit+=60;render();return;}
});
root.addEventListener('change',e=>{
 if(e.target.matches('[data-agenda-team]')){
  const key=e.target.dataset.agendaTeam;
  if(key==='ALL')selectedTeams.clear();
  else if(e.target.checked)selectedTeams.add(key);else selectedTeams.delete(key);
  root.querySelectorAll('[data-agenda-team]').forEach(box=>{box.checked=box.dataset.agendaTeam==='ALL'?!selectedTeams.size:selectedTeams.has(box.dataset.agendaTeam);});
  $('#teamFilterLabel').textContent=!selectedTeams.size?'Todas as equipes':selectedTeams.size===1?TEAMS[[...selectedTeams][0]][0]:selectedTeams.size+' equipes selecionadas';
  limit=60;render();return;
 }
 if(e.target.id==='agendaView'){
  view=e.target.value;order='asc';limit=60;
  renderNav();syncURL();reload();return;
 }
 if(e.target.id==='agendaMode'){
  mode=e.target.value;
  if(['watched','rated'].includes(mode)&&view==='day')view='season';
  else if(mode==='wish'&&view==='day')view='upcoming';
  renderNav();syncURL();reload();return;
 }
 if(e.target.id==='sortGames'){order=e.target.value;render();return;}
 if(['broadcastGames','stageGames'].includes(e.target.id)){limit=60;render();}
});

function refreshForClock(){
 const actual=currentDate();
 if(today!==actual){
  today=actual;
  if(followToday&&view==='day'){
   selectedDate=today;
   renderNav();syncURL();reload();return;
  }
 }
 render();
}
window.addEventListener('quadra:refresh',refreshForClock);
window.addEventListener('quadra:live-update',refreshForClock);

// Search only the 30 local team labels; it never changes the match filter itself.
root.addEventListener('input',e=>{
 if(e.target.id!=='agendaTeamSearch')return;
 const query=normalizeTeam(e.target.value);let visible=0;
 root.querySelectorAll('[data-team-option]').forEach(row=>{
  const code=row.dataset.teamOption;
  row.hidden=!normalizeTeam(TEAMS[code][0]+' '+code).includes(query);
  if(!row.hidden)visible++;
 });
 $('#agendaTeamEmpty').hidden=visible>0;
});
document.addEventListener('click',e=>{const picker=$('#teamGames');if(picker&&!picker.contains(e.target))picker.open=false;});
root.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#teamGames')?.open){$('#teamGames').open=false;$('#teamGames summary').focus();e.stopPropagation();}});
