/* QUADRA 3 • funções partilhadas, armazenamento e catálogo NBA */
export const ROOT = new URL('../', import.meta.url);
export const MONTHS = ['2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04'];
export const EAST = {'Atlântico':['BOS','BKN','NYK','PHI','TOR'],'Central':['CHI','CLE','DET','IND','MIL'],'Sudeste':['ATL','CHA','MIA','ORL','WAS']};
export const WEST = {'Noroeste':['DEN','MIN','OKC','POR','UTA'],'Pacífico':['GSW','LAC','LAL','PHX','SAC'],'Sudoeste':['DAL','HOU','MEM','NOP','SAS']};
export const TEAMS = {
ATL:['Atlanta Hawks','hawks.webp'],BOS:['Boston Celtics','boston.webp'],BKN:['Brooklyn Nets','nets.webp'],CHA:['Charlotte Hornets','hornets.webp'],CHI:['Chicago Bulls','bulls.webp'],CLE:['Cleveland Cavaliers','cavaliers.webp'],
DAL:['Dallas Mavericks','mavericks.webp'],DEN:['Denver Nuggets','denver.webp'],DET:['Detroit Pistons','pistons.webp'],GSW:['Golden State Warriors','gsw.webp'],HOU:['Houston Rockets','rockets.webp'],IND:['Indiana Pacers','pacers.webp'],
LAC:['LA Clippers','clippers.webp'],LAL:['Los Angeles Lakers','lakers.webp'],MEM:['Memphis Grizzlies','grizzlies.webp'],MIA:['Miami Heat','heat.webp'],MIL:['Milwaukee Bucks','bucks.webp'],MIN:['Minnesota Timberwolves','timberwolves.webp'],NOP:['New Orleans Pelicans','pelicans.webp'],
NYK:['New York Knicks','knicks.webp'],OKC:['Oklahoma City Thunder','okc.webp'],ORL:['Orlando Magic','magic.webp'],PHI:['Philadelphia 76ers','76ers.webp'],PHX:['Phoenix Suns','suns.webp'],POR:['Portland Trail Blazers','portland.webp'],
SAC:['Sacramento Kings','kings.webp'],SAS:['San Antonio Spurs','spurs.webp'],TOR:['Toronto Raptors','raptors.webp'],UTA:['Utah Jazz','jazz.webp'],WAS:['Washington Wizards','wizards.webp']
};
export const STORAGE='quadra_nba_2026_27_v1',SETTINGS='quadra_nba_settings_v1',EXTRAS='quadra_nba_extra_2026_27_v1';
export const $=s=>document.querySelector(s);
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const name=code=>TEAMS[code]?.[0]||code||'A definir';
export const asset=(path)=>new URL(path, ROOT).href;
export const logo=code=>TEAMS[code]?asset('assets/teams/'+encodeURIComponent(TEAMS[code][1])):asset('assets/nba.png');
export const path=(s='')=>new URL(s,ROOT).href;
export const currentDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function dayShift(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function niceDate(date){return new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric'});}
export const shortDate=date=>date?new Date(date+'T12:00:00Z').toLocaleDateString('pt-BR',{timeZone:'UTC'}):'—';
export function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback;}}
const blankSaved=()=>({notes:{},custom:[]});
const blankExtras=()=>({players:{},franchise:{},lineups:{},gameRatings:{},gameMvp:{},hideSpoilers:false});
export function getData(){const saved={...blankSaved(),...read(STORAGE,{})};const extras={...blankExtras(),...read(EXTRAS,{})};return {saved:{notes:saved.notes||{},custom:Array.isArray(saved.custom)?saved.custom:[]},settings:read(SETTINGS,{fav:''}),extras};}
export function emit(){window.dispatchEvent(new Event('quadra:local-change'));window.dispatchEvent(new Event('quadra:data'));}
export function modify(fn){const b=getData();fn(b);try{localStorage.setItem(STORAGE,JSON.stringify(b.saved));localStorage.setItem(SETTINGS,JSON.stringify(b.settings));localStorage.setItem(EXTRAS,JSON.stringify(b.extras));emit();return true}catch(e){toast('Não foi possível salvar neste navegador. Faça um backup.');console.warn(e);return false;}}
export const note=id=>getData().saved.notes[id]||{};
export function setNote(id,values){modify(b=>{b.saved.notes[id]={...b.saved.notes[id],...values,updated:new Date().toISOString()};});}
export function setSettings(values){modify(b=>{b.settings={...b.settings,...values,updatedAt:new Date().toISOString()};});}
export function setExtraGroup(group,key,value){modify(b=>{b.extras[group]={...b.extras[group],[key]:value};b.extras.updatedAt=new Date().toISOString();});}
// Compatibilidade com backups anteriores: a opção foi descontinuada.
export function setSpoilers(_hidden){}
export function getSpoilers(){return false;}
export function toggleWish(game){const p=note(game.id);setNote(game.id,{wish:!p.wish,watched:!p.wish?false:p.watched});}
export const qs=k=>new URLSearchParams(location.search).get(k);
export const teamLink=code=>path('equipe/?id='+encodeURIComponent(code));
export const playerLink=(id,team)=>path('jogador/?id='+encodeURIComponent(id)+'&team='+encodeURIComponent(team));
export const gameLink=g=>path('jogo/?id='+encodeURIComponent(g.id)+'&data='+encodeURIComponent(g.date));
export const tlogo=(c,size=48)=>'<img src="'+esc(logo(c))+'" width="'+size+'" height="'+size+'" loading="lazy" decoding="async" alt="'+esc(name(c))+'">';
export const stamp=p=>p?.updated||p?.updatedAt||'';
let toastTimeout;
export function toast(message){let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.append(t)}t.textContent=message;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.remove(),3900);}
export function modal(html){let d=$('#modalRoot');if(!d){d=document.createElement('div');d.id='modalRoot';document.body.append(d)}d.innerHTML='<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><button class="btn ghost" type="button" data-close style="float:right">✕ Fechar</button>'+html+'</div></div>';d.querySelector('[data-close]').onclick=closeModal;d.querySelector('.modal-back').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal()});document.addEventListener('keydown',onEsc);}
function onEsc(e){if(e.key==='Escape')closeModal();}
export function closeModal(){const d=$('#modalRoot');if(d)d.innerHTML='';document.removeEventListener('keydown',onEsc);}
export function download(filename,obj){const raw=typeof obj==='string'?obj:JSON.stringify(obj,null,2);const a=document.createElement('a');const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);}
export function backup(){download('quadra-nba-backup-completo.json',{app:'quadra-nba',version:3,exportedAt:new Date().toISOString(),...getData()});}
export function restore(file,callback){if(!file)return;file.text().then(s=>{let b=JSON.parse(s);if(b.app!=='quadra-nba'||!b.saved?.notes||!Array.isArray(b.saved?.custom))throw Error('Formato inválido');if(!confirm('Substituir seus registros locais pelos deste backup? Guarde o backup antigo antes.'))return;modify(x=>{x.saved=b.saved;x.settings=b.settings||{fav:''};x.extras={...blankExtras(),...(b.extras||{})};});toast('Backup restaurado');callback?.();}).catch(e=>toast('Falha ao importar: '+e.message));}
// Ponte compatível com firebase-sync.js original, mesma coleção e mesmas chaves Firestore.
window.QuadraBridge={
 snapshot(){return JSON.parse(JSON.stringify(getData()));},
 applyRemote(b){if(!b?.saved||!b?.settings||!b?.extras)return;try{
   localStorage.setItem(STORAGE,JSON.stringify({notes:b.saved.notes||{},custom:b.saved.custom||[]}));
   localStorage.setItem(SETTINGS,JSON.stringify(b.settings));
   localStorage.setItem(EXTRAS,JSON.stringify({...blankExtras(),...b.extras}));
   window.dispatchEvent(new Event('quadra:data'));
 }catch(e){console.error('Falha ao aplicar dados da nuvem',e);}}
};
const chunks=new Map();
export async function jsonFile(file){if(chunks.has(file))return chunks.get(file);const prom=fetch(asset(file),{cache:'default'}).then(r=>{if(!r.ok)throw Error('Arquivo '+file+' indisponível');return r.json()}).catch(err=>{chunks.delete(file);throw err;});chunks.set(file,prom);return prom;}
export const fetchRoster=async code=>(await jsonFile('data/teams/'+code+'.json')).players||[];
export async function fetchBox(month){try{return (await jsonFile('data/stats/'+month+'.json')).games||{}}catch{return {};}}
export async function fetchMonth(month){try{return (await jsonFile('data/months/'+month+'.json')).events||[]}catch{return [];}}
export function parseTV(){
 const raw=window.QUADRA_TV_RAW||'';let section='ESPN',result=[],seen=new Map();
 for(const original of raw.trim().split('\n')){
   const line=original.trim();if(!line||line.startsWith('#'))continue;
   if(line==='===PRIME==='){section='PRIME';continue;}if(line==='===PRE==='){section='PRE';continue;}
   const [base,desc='']=line.split('|'),[mmdd,hhmm,a,b]=base.trim().split(/\s+/);
   if(!mmdd||!hhmm||!a||!b)continue;
   const m=Number(mmdd.slice(0,2)),d=Number(mmdd.slice(2)),yr=m>=10?2026:2027;
   const src=yr+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
   const time=hhmm==='????'?'':hhmm.slice(0,2)+':'+hhmm.slice(2,4);
   const date=time&&Number(time.slice(0,2))<3?dayShift(src,1):src;
   const platform=section==='PRE'?'ESPN':section;
   const key=desc?'special-'+src+'-'+desc+'-'+platform+'-'+result.length:date+'-'+time+'-'+a+'-'+b;
   const id=key.replace(/[^a-zA-Z0-9-]/g,'_');
   if(seen.has(key)){const old=result[seen.get(key)];if(!old.platforms.includes(platform))old.platforms.push(platform);continue;}
   seen.set(key,result.length);
   result.push({id,date,time,away:a,home:b,platforms:[platform],stage:section==='PRE'?'Pré-temporada':desc?'Copa NBA':'Temporada regular',label:desc,custom:false,sourceDate:src});
 }
 return result;
}
const TV = parseTV();
export function joinGames(remote){
 const built=[...TV,...getData().saved.custom.filter(x=>x?.id&&x?.date)],look=new Map(),used=new Set(),out=[];
 for(const t of built){if(t.away==='TBA'||t.home==='TBA')continue;const key=t.date+'|'+t.away+'|'+t.home;const a=look.get(key)||[];a.push(t);look.set(key,a);}
 for(const g of new Map(remote.filter(x=>x?.id&&x.date).map(x=>[String(x.id),x])).values()){
   const p=[g.date,dayShift(g.date,-1),dayShift(g.date,1)].flatMap(d=>look.get(d+'|'+g.away+'|'+g.home)||[]).find(x=>!used.has(x.id));
   if(p)used.add(p.id);
   out.push({...g,id:p?.id||'espn_'+g.id,externalId:String(g.id),platforms:p?.platforms||['LEAGUE'],stage:p?.stage||(+g.stage===1?'Pré-temporada':+g.stage===3?'Playoffs':'Temporada regular'),label:p?.label||'',custom:false});
 }
 for(const g of built)if(!used.has(g.id))out.push(g);
 return out.sort((a,b)=>(a.date+' '+(a.time||'23:59')).localeCompare(b.date+' '+(b.time||'23:59')));
}
export async function loadGames(months=MONTHS){const list=(await Promise.all(months.map(fetchMonth))).flat();return joinGames(list);}
export function platform(g){const p=g.platforms||[];return p.includes('PRIME')&&p.includes('ESPN')?'Prime Video + ESPN':p.includes('PRIME')?'Prime Video':p.includes('ESPN')?'ESPN / Disney+':p.includes('LEAGUE')?'Sem TV BR informada':'Outra transmissão';}
export function platformLines(g){
 const channels=g.platforms||[];
 const espn=channels.includes('ESPN'),prime=channels.includes('PRIME');
 if(espn&&prime)return {lines:['ESPN / DISNEY+','PRIME VIDEO'],variant:'tv'};
 if(espn)return {lines:['ESPN / DISNEY+'],variant:'tv'};
 if(prime)return {lines:['PRIME VIDEO'],variant:'tv'};
 return {lines:['NBA LEAGUE PASS'],variant:'league'};
}
export function effectiveGame(g){
 const today=currentDate();
 const id=String(g.externalId||String(g.id||'').replace(/^espn_/,''));
 const live=window.QUADRA_LIVE_GAMES?.get(id);
 if(live && live.away===g.away && live.home===g.home &&
    (live.status==='live'||live.status==='final'||g.status==='live')){
  const changed={...g,status:live.status};
  if(live.scoreAway!==null && live.scoreHome!==null){
   changed.scoreAway=live.scoreAway;changed.scoreHome=live.scoreHome;
  }
  if(live.status==='live'){
   changed.livePeriod=live.period;changed.liveClock=live.clock;
  }
  return changed;
 }
 // Uma atualização antiga do JSON nunca deve sinalizar AO VIVO dias depois.
 if(g.status==='live'&&g.date<dayShift(today,-1))return {...g,status:'scheduled'};
 return g;
}
export function gameRow(g){
 const event=effectiveGame(g);
 const p=note(g.id),tv=platformLines(g),href=gameLink(g);
 const valid=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
 const official=(event.status==='live'||event.status==='final')&&valid(event.scoreAway)&&valid(event.scoreHome);
 const hasScore=official;
 const awayScore=event.scoreAway;
 const homeScore=event.scoreHome;
 const result=event.status==='final';
 const live=event.status==='live';
 const rawPeriod=Number(event.livePeriod);
 const quarter=rawPeriod>=5?'PRORROGAÇÃO':rawPeriod>=1?rawPeriod+'º QUARTO':'EM ANDAMENTO';
 const clock=live&&event.liveClock?String(event.liveClock).trim():'';
 const phase=live?quarter+(clock?' • '+clock:''):result?'FINAL':'';
 const leftWinner=result&&official&&Number(awayScore)>Number(homeScore);
 const rightWinner=result&&official&&Number(homeScore)>Number(awayScore);
 const middle=hasScore?
   '<span class="matchup-center has-score" aria-label="Placar '+esc(awayScore)+' a '+esc(homeScore)+(phase?' • '+esc(phase):'')+'">'+
   '<span class="matchup-score-pair">'+
   '<span class="matchup-score-box'+(leftWinner?' winner':'')+'">'+esc(awayScore)+'</span>'+
   '<span class="matchup-vs">VS</span>'+
   '<span class="matchup-score-box'+(rightWinner?' winner':'')+'">'+esc(homeScore)+'</span>'+
   '</span>'+(phase?'<span class="matchup-phase'+(live?' is-live':'')+'">'+esc(phase)+'</span>':'')+'</span>':
   '<span class="matchup-center no-score"><span class="matchup-vs">VS</span>'+
   (live?'<span class="matchup-phase is-live">'+esc(phase)+'</span>':'')+'</span>';
 const status=(p.watched?'<span class="tag finished">✓ Assistido</span>':'')+
   (p.rating?'<span class="tag accent">★ '+esc(p.rating)+'</span>':'');
 const channels=tv.lines.map(label=>'<span>'+esc(label)+'</span>').join('');
 const broadcast='<span class="broadcast-badge '+tv.variant+(tv.lines.length>1?' multi':'')+'" title="Transmissão: '+esc(tv.lines.join(' / '))+'">'+channels+'</span>';
 return '<article class="game-card game-card-link">'+
 '<div class="time">'+esc(g.time||'—')+'<small>BRASÍLIA</small>'+
 (live?'<span class="live-indicator"><i aria-hidden="true"></i>AO VIVO</span>':'')+'</div>'+
 '<a class="matchup" href="'+esc(href)+'" aria-label="Abrir partida: '+esc(name(g.away))+' x '+esc(name(g.home))+'">'+
 '<span class="club">'+tlogo(g.away,42)+'<span><strong>'+esc(name(g.away))+'</strong><small>'+esc(g.away)+'</small></span></span>'+
 middle+
 '<span class="club right">'+tlogo(g.home,42)+'<span><strong>'+esc(name(g.home))+'</strong><small>'+esc(g.home)+'</small></span></span></a>'+
 '<div class="game-meta"><div class="game-status">'+status+'</div>'+broadcast+
 '<button type="button" class="fav" title="'+(p.wish?'Remover da minha lista':'Quero assistir')+'" aria-label="'+(p.wish?'Remover da lista':'Quero assistir')+'" aria-pressed="'+!!p.wish+'" data-wish="'+esc(g.id)+'">'+(p.wish?'♥':'♡')+'</button></div></article>';
}
export function groupGames(list){let out='',last='';for(const g of list){if(g.date!==last){last=g.date;out+='<h3 class="dayhead">'+esc(niceDate(last))+'</h3>';}out+=gameRow(g);}return out||'<div class="filler"><b>Nenhum jogo encontrado</b>Tente outro filtro ou período.</div>';}
export function handleWishes(target,callback){const b=target.closest('[data-wish]');if(!b)return false;const id=b.dataset.wish;toggleWish({id});callback?.();return true;}
export function broadcastInfo(g){return (g.platforms||[]).some(p=>p==='ESPN'||p==='PRIME');}
export function primaryLink(code){return '<a class="btn" href="'+esc(teamLink(code))+'">Ver elenco</a>';}
export function showError(e){console.error(e);return '<div class="filler"><b>Não foi possível carregar os dados</b>'+esc(e.message||e)+'</div>';}
export function pageHeader(title,description,icon=''){const h=$('.hero');if(!h)return;h.innerHTML='<div><span class="eyebrow">NBA • TEMPORADA 2026/27</span><h1>'+esc(title)+'</h1><p>'+esc(description)+'</p></div>'+(icon?'<img class="hero-logo" src="'+esc(icon)+'" alt="">':'');}
export function setActive(page){document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===page));}
export function setupShared(page,title,description){
 setActive(page);pageHeader(title,description,asset('assets/dlq.webp'));
 document.title=title+' • DE LA QUADRA';
 window.addEventListener('quadra:data',()=>window.dispatchEvent(new Event('quadra:refresh')));
}
export function eventBox(box,g){
 const ext=g.externalId||String(g.id).replace(/^espn_/,'');
 return box[ext]||Object.values(box).find(x=>x.date===g.date&&x.away===g.away&&x.home===g.home);
}
export function newestStarting(code,boxes){
 const all=Object.values(boxes).filter(x=>x.players?.[code]?.some(p=>p.starter)).sort((a,b)=>b.date.localeCompare(a.date));
 const item=all[0];return item?{date:item.date,players:item.players[code].filter(p=>p.starter)}:null;
}
export function myRatingLabel(v){return Number(v)?Number(v).toLocaleString('pt-BR')+'/10':'Sem nota';}
