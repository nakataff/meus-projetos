import {$,setupShared,loadGames,MONTHS,getData,groupGames,esc,path,backup,restore,handleWishes,note,TEAMS,teamLink,playerLink,gameLink,logo,modal,closeModal,setSettings,toast} from '../app.js?v=7';
setupShared('personal','Meu perfil','Sua jornada na NBA: avaliações, jogos assistidos, jogadores favoritos e conquistas.');
const root=$('#pageContent');
let games=[],loaded=false,tab=new URLSearchParams(location.search).get('tab')||'resumo';
let filter=new URLSearchParams(location.search).get('filtro')||'assistidos';
let limit=30,account=window.QUADRA_ACCOUNT||null;
if(['assistidos','desejos','notas'].includes(tab)){filter=tab;tab='atividade';}
const tabs={resumo:'Resumo',atividade:'Atividade',rankings:'Rankings',conquistas:'Conquistas'};
if(!tabs[tab])tab='resumo';
const filters={assistidos:'Assistidos',desejos:'Quero assistir',notas:'Avaliados'};
if(!filters[filter])filter='assistidos';
const profileName=(settings)=>settings.nickname||account?.name||account?.email?.split('@')[0]||'Meu perfil';
const accImg=()=>account?.photoURL&&/^https:\/\//i.test(account.photoURL)?'<img class="profile-avatar" src="'+esc(account.photoURL)+'" referrerpolicy="no-referrer" alt="Foto do Google" onerror="this.style.display=\'none\'">':'<span class="profile-avatar profile-fallback">🏀</span>';
const count=(notes,pred)=>Object.values(notes).filter(pred).length;
const formatGrade=n=>Number(n)>0?Number(n).toLocaleString('pt-BR'):'—';
const topNames={};
function snapshot(){
 const bundle=getData(),notes=bundle.saved.notes,all=Object.entries(notes),rated=all.filter(([,n])=>+n.rating>0);
 const players=Object.entries(bundle.extras.players||{}).filter(([,p])=>+p.rating>0).sort((a,b)=>+b[1].rating-+a[1].rating);
 const watched=all.filter(([,n])=>n.watched),wishlist=all.filter(([,n])=>n.wish&&!n.watched);
 const viewedTeams=new Map(),teamCount=new Map();
 const lookup=new Map(games.map(g=>[g.id,g]));
 for(const [id,n] of watched){
  const g=lookup.get(id);if(!g)continue;
  for(const c of [g.away,g.home]){viewedTeams.set(c,true);teamCount.set(c,(teamCount.get(c)||0)+1);}
 }
 const favTeam=[...teamCount.entries()].sort((a,b)=>b[1]-a[1])[0]||null;
 const average=rated.length?(rated.reduce((sum,[,n])=>sum+(+n.rating||0),0)/rated.length).toFixed(1).replace('.',','):'—';
 return {bundle,notes,rated,players,watched,wishlist,viewedTeams,teamCount,favTeam,average,lookup};
}
function header(s){
 const settings=s.bundle.settings,fav=settings.fav;
 return '<section class="profile-head"><div class="profile-avatar-wrap">'+accImg()+'</div>'+
 '<div class="profile-identity"><span class="caps">TORCEDOR • NBA 2026/27</span><h2>'+esc(profileName(settings))+'</h2><div class="profile-meta">'+
 (account?'<span class="profile-connected">● Conta Google conectada</span>':'<span class="subtle small">Dados locais • Faça login com Google para sincronizar</span>')+
 (fav?'<a class="profile-team" href="'+teamLink(fav)+'"><img src="'+esc(logo(fav))+'" alt="" width="23" height="23">'+esc(TEAMS[fav]?.[0]||fav)+'</a>':'<a class="profile-team" href="'+path('equipes/')+'">☆ Escolher time favorito</a>')+
 '</div></div><button class="btn ghost" id="editNickname">✎ Editar perfil</button></section>';
}
function metrics(s){
 const watched=s.watched.length,wishes=s.wishlist.length;
 return '<div class="grid four profile-metrics">'+
 [['✓ Jogos assistidos',watched,'Seu histórico'],['♡ Quero assistir',wishes,'Na sua lista'],['★ Minha nota média',s.average,'Em '+s.rated.length+' avaliações'],['☆ Jogadores avaliados',s.players.length,'Na temporada']].map(([title,value,label])=>
 '<div class="card profile-metric"><div class="caps">'+title+'</div><strong>'+esc(value)+'</strong><span>'+esc(label)+'</span></div>').join('')+'</div>';
}
function gameLinkOf(id,g){return g?gameLink(g):path('jogos/');}
function playerItem(row,index){
 const [id,p]=row,person=p.name||topNames[id]||'Jogador #'+id,team=p.team;
 return '<div class="profile-rank-item"><span class="rank-position">'+(index+1)+'</span><div class="rank-body">'+
 (team?'<a href="'+playerLink(id,team)+'">'+esc(person)+'</a>':'<b>'+esc(person)+'</b>')+
 '<span class="small subtle">'+(team&&TEAMS[team]?esc(TEAMS[team][0]):'Nota pessoal na temporada')+'</span></div>'+
 '<span class="profile-rank-score">★ '+formatGrade(p.rating)+'</span></div>';
}
function topPlayers(s,n=5){
 return s.players.length?s.players.slice(0,n).map(playerItem).join(''):'<div class="filler">Avalie jogadores para montar seu ranking pessoal.</div>';
}
function topGames(s,n=5){
 const list=s.rated.slice().sort((a,b)=>+b[1].rating-+a[1].rating).slice(0,n);
 return list.length?list.map(([id,r],i)=>{
  const g=s.lookup.get(id),title=g?(TEAMS[g.away]?.[0]||g.away)+' x '+(TEAMS[g.home]?.[0]||g.home):'Jogo registrado';
  return '<div class="profile-rank-item"><span class="rank-position">'+(i+1)+'</span><div class="rank-body"><a href="'+gameLinkOf(id,g)+'">'+esc(title)+'</a><span class="small subtle">'+(g?g.date:'Partida do seu histórico')+'</span></div><span class="profile-rank-score">★ '+formatGrade(r.rating)+'</span></div>';
 }).join(''):'<div class="filler">Avalie suas partidas para ver os jogos favoritos aqui.</div>';
}
function prefs(s){
 return '<section class="card profile-settings"><div class="section-title"><h2>Conta e preferências</h2></div>'+
 
 '<div class="profile-setting-row"><div><b>Conta Google</b><span class="small subtle">Suas avaliações continuam sendo salvas automaticamente entre dispositivos quando você está conectado.</span></div><div id="firebaseAccountControl" class="profile-cloud-slot"></div></div>'+
 '<div class="profile-setting-row"><div><b>Seus dados</b><span class="small subtle">Exportar um backup antes de trocar ou limpar o navegador.</span></div>'+
 '<div class="profile-backup-actions"><button class="btn accent" id="backup">↓ Baixar JSON</button><button class="btn" id="importBackup">↑ Restaurar</button><input type="file" id="backupFile" accept=".json,application/json" hidden></div></div>'+
 '</section>';
}
function favoriteSections(s){
 const extra=s.bundle.extras;
 const loved=Object.entries(extra.players||{}).filter(([,p])=>p?.favorite).slice(0,6);
 const franchises=Object.entries(extra.franchise||{}).filter(([code,id])=>TEAMS[code]&&id).slice(0,8);
 const full=Object.entries(extra.lineups||{}).filter(([code,ids])=>TEAMS[code]&&Array.isArray(ids)&&ids.length===5);
 function person(id,p,team){
  const info=p||extra.players?.[id]||{},label=info.name||'Jogador #'+id;
  return '<div class="profile-rank-item"><div class="rank-body">'+(team?'<a href="'+playerLink(id,team)+'">'+esc(label)+'</a>':'<b>'+esc(label)+'</b>')+
  '<span class="small subtle">'+(team&&TEAMS[team]?esc(TEAMS[team][0]):'Favorito pessoal')+'</span></div></div>';
 }
 return '<div class="grid two section"><section class="card"><h2>Jogadores favoritos ♡</h2><p class="small subtle">Seus atletas marcados como favoritos</p>'+
 (loved.length?loved.map(([id,p])=>person(id,p,p.team)).join(''):'<div class="filler">Marque seus jogadores favoritos nos perfis dos atletas.</div>')+'</section>'+
 '<section class="card"><h2>Franchise players ★</h2><p class="small subtle">Quem você escolheu para liderar cada franquia</p>'+
 (franchises.length?franchises.map(([code,id])=>person(id,extra.players?.[id],code)).join(''):'<div class="filler">Escolha um franchise player nas páginas das equipes.</div>')+'</section></div>'+
 (full.length?'<section class="card section"><h2>Meus quintetos completos</h2><p class="small subtle">Escalações pessoais que você montou</p>'+
 full.map(([code,ids])=>'<div class="profile-rank-item"><div class="rank-body"><a href="'+teamLink(code)+'">'+esc(TEAMS[code][0])+'</a><span class="small subtle">'+ids.map(id=>esc(extra.players?.[id]?.name||'#'+id)).join(', ')+'</span></div><span class="tag finished">5/5</span></div>').join('')+'</section>':'');
}
function summary(s){
 const last=s.watched.map(([id,n])=>({id,n,g:s.lookup.get(id)})).filter(x=>x.g).sort((a,b)=>String(b.n.updated||b.g.date).localeCompare(String(a.n.updated||a.g.date))).slice(0,3);
 return '<div class="grid two"><section class="card"><div class="section-title"><h2>Meus melhores jogadores</h2><button data-tab="rankings" class="btn ghost">Ver ranking →</button></div>'+topPlayers(s,5)+'</section>'+
 '<section class="card"><div class="section-title"><h2>Partidas favoritas</h2><button data-tab="rankings" class="btn ghost">Ver notas →</button></div>'+topGames(s,5)+'</section></div>'+
 favoriteSections(s)+
 '<section class="section"><div class="section-title"><h2>Últimas partidas assistidas</h2><button class="btn ghost" data-tab="atividade" data-filter="assistidos">Meu histórico →</button></div>'+
 (last.length?groupGames(last.map(x=>x.g).sort((a,b)=>a.date.localeCompare(b.date))):'<div class="filler">Marque uma partida como assistida para começar seu histórico.</div>')+'</section>'+
 prefs(s);
}
function activity(s){
 let list=games.filter(g=>{const p=s.notes[g.id]||{};return filter==='assistidos'?!!p.watched:filter==='desejos'?!!p.wish&&!p.watched:+p.rating>0;});
 if(filter==='notas')list.sort((a,b)=>(+s.notes[b.id]?.rating||0)-(+s.notes[a.id]?.rating||0));
 else list.sort((a,b)=>b.date.localeCompare(a.date));
 return '<div class="switches profile-filter">'+Object.entries(filters).map(([key,label])=>'<button class="pill '+(filter===key?'active':'')+'" data-filter="'+key+'">'+label+'</button>').join('')+'</div>'+
 '<div class="section-title"><h2>'+esc(filters[filter])+'</h2><span class="small subtle">'+list.length+' partidas</span></div>'+
 groupGames(list.slice(0,limit))+(list.length>limit?'<p class="center"><button class="btn" id="loadMore">Carregar mais '+Math.min(30,list.length-limit)+' ↓</button></p>':'');
}
function rankings(s){
 const teams=[...s.teamCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
 return '<div class="grid two"><section class="card"><h2>Top jogadores</h2><p class="small subtle">Notas individuais da temporada</p>'+topPlayers(s,10)+'</section>'+
 '<section class="card"><h2>Melhores partidas</h2><p class="small subtle">Seus jogos mais bem avaliados</p>'+topGames(s,10)+'</section></div>'+
 '<section class="card section"><h2>Times mais assistidos</h2><p class="small subtle">Cada partida conta para as duas franquias envolvidas.</p>'+
 (teams.length?teams.map(([code,total],i)=>'<div class="profile-rank-item"><span class="rank-position">'+(i+1)+'</span><img src="'+esc(logo(code))+'" width="30" height="30" loading="lazy" alt=""><div class="rank-body"><a href="'+teamLink(code)+'">'+esc(TEAMS[code]?.[0]||code)+'</a></div><span class="profile-rank-score">'+total+' jogos</span></div>').join(''):'<div class="filler">Seu ranking aparece quando você marcar partidas como assistidas.</div>')+'</section>';
}
function achievements(s){
 const rated=s.rated.length,watched=s.watched.length,players=s.players.length;
 const fullLineup=Object.values(s.bundle.extras.lineups||{}).some(v=>Array.isArray(v)&&v.length>=5);
 const mvp=Object.keys(s.bundle.extras.gameMvp||{}).filter(id=>s.bundle.extras.gameMvp[id]).length;
 const items=[
 {icon:'🏀',title:'Primeira partida',desc:'Assistir a primeira partida',progress:watched,goal:1},
 {icon:'🎟️',title:'Torcedor presente',desc:'Assistir a 10 partidas',progress:watched,goal:10},
 {icon:'🔥',title:'Maratona NBA',desc:'Assistir a 25 partidas',progress:watched,goal:25},
 {icon:'🏟️',title:'Temporada intensa',desc:'Assistir a 50 partidas',progress:watched,goal:50},
 {icon:'★',title:'Primeira crítica',desc:'Avaliar uma partida',progress:rated,goal:1},
 {icon:'📊',title:'Olho clínico',desc:'Avaliar 10 partidas',progress:rated,goal:10},
 {icon:'👟',title:'Olheiro',desc:'Avaliar 10 jogadores',progress:players,goal:10},
 {icon:'🗳️',title:'Meu MVP',desc:'Escolher um MVP de jogo',progress:mvp,goal:1},
 {icon:'✋',title:'Técnico de sofá',desc:'Montar um quinteto pessoal',progress:fullLineup?1:0,goal:1},
 {icon:'🌎',title:'Conhecendo a liga',desc:'Assistir a jogos de 10 franquias diferentes',progress:s.viewedTeams.size,goal:10}
 ];
 const done=items.filter(x=>x.progress>=x.goal).length;
 return '<div class="section-title"><h2>Minhas conquistas</h2><span class="small subtle">'+done+' de '+items.length+' desbloqueadas</span></div>'+
 '<p class="subtle small">Desafios pessoais calculados pelos seus registros. Não exigem consultas extras ao Firebase.</p>'+
 '<div class="grid two profile-achievements">'+items.map(x=>{
 const ok=x.progress>=x.goal,pc=Math.min(x.progress/x.goal*100,100);
 return '<article class="card achievement '+(ok?'earned':'')+'"><span class="achievement-icon" aria-hidden="true">'+x.icon+'</span><div class="achievement-copy"><strong>'+esc(x.title)+'</strong><span class="small subtle">'+esc(x.desc)+'</span><div class="achievement-track"><i style="width:'+pc+'%"></i></div><span class="micro">'+(ok?'✓ Desbloqueada':Math.min(x.progress,x.goal)+' / '+x.goal)+'</span></div></article>';
 }).join('')+'</div>';
}
function render(){
 const s=snapshot(),heading='<nav class="tabs profile-tabs" aria-label="Áreas do perfil">'+Object.entries(tabs).map(([key,label])=>
 '<button type="button" class="tab '+(tab===key?'active':'')+'" data-tab="'+key+'">'+label+'</button>').join('')+'</nav>';
 root.innerHTML=header(s)+metrics(s)+heading+
 (tab==='resumo'?summary(s):tab==='atividade'?activity(s):tab==='rankings'?rankings(s):achievements(s));
 window.dispatchEvent(new Event('quadra:profile-render'));
}
function editNickname(){
 const v=getData().settings.nickname||'';
 modal('<h2>Personalizar perfil</h2><p class="subtle small">O apelido aparece somente no seu perfil do QUADRA e será sincronizado com suas preferências.</p><form id="nicknameForm"><div class="field"><label>Meu apelido</label><input id="nickname" class="control" maxlength="28" autocomplete="nickname" placeholder="Seu nome de torcedor" value="'+esc(v)+'"></div><div class="modal-footer"><button class="btn accent" type="submit">Salvar apelido</button></div></form>');
 $('#nicknameForm').onsubmit=e=>{e.preventDefault();setSettings({nickname:$('#nickname').value.trim().slice(0,28)});closeModal();render();toast('Perfil atualizado!');};
}
root.addEventListener('click',e=>{
 const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;limit=30;if(t.dataset.filter)filter=t.dataset.filter;history.replaceState(null,'','?tab='+encodeURIComponent(tab)+(tab==='atividade'?'&filtro='+encodeURIComponent(filter):''));render();return;}
 const f=e.target.closest('[data-filter]');if(f){filter=f.dataset.filter;limit=30;history.replaceState(null,'','?tab=atividade&filtro='+encodeURIComponent(filter));render();return;}
 if(handleWishes(e.target,render)){e.preventDefault();return;}
 if(e.target.closest('#loadMore')){limit+=30;render();return;}
 if(e.target.closest('#editNickname')){editNickname();return;}
 if(e.target.closest('#backup')){backup();toast('Backup completo baixado!');return;}
 if(e.target.closest('#importBackup')){$('#backupFile')?.click();return;}
});
root.addEventListener('change',e=>{if(e.target.id==='backupFile')restore(e.target.files?.[0],render);});
window.addEventListener('quadra:auth',e=>{account=e.detail||null;render();});
window.addEventListener('quadra:refresh',render);
root.innerHTML='<div class="filler">Preparando seu perfil…</div>';
loadGames(MONTHS).then(g=>{games=g;loaded=true;render()}).catch(e=>{console.warn('Perfil: agenda incompleta',e);games=[];loaded=true;render();});
