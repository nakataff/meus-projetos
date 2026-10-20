/* QUADRA — placares em andamento. Fonte pública não oficial; falhas não travam o site.
 * Somente páginas de agenda/início/partida carregam este módulo.
 * Dados são consultados no máximo a cada 2 minutos, com a página visível.
 */
import {currentDate,dayShift} from './app.js?v=10';

const URL_BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
let lastSignature='',busy=false,completed=false;
const liveMap=new Map();
window.QUADRA_LIVE_GAMES=liveMap;

const translate={GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',PHO:'PHX',UTAH:'UTA',WSH:'WAS'};
function code(x){
 const a=String(x||'').toUpperCase();
 return translate[a]||a;
}
function score(c){
 if(c?.score===undefined||c?.score===null||c?.score==='')return null;
 const n=Number(c.score);
 return Number.isFinite(n)?n:null;
}
function normalize(event){
 const competition=event.competitions?.[0],teams=competition?.competitors||[];
 const home=teams.find(x=>x.homeAway==='home'),away=teams.find(x=>x.homeAway==='away');
 const eventId=String(event.id||'');
 if(!home||!away||!eventId)return null;
 const phase=event.status?.type||{},state=phase.state;
 const status=phase.completed||state==='post'?'final':state==='in'?'live':'scheduled';
 const dateTime=new Date(event.date||'');
 if(!Number.isFinite(dateTime.getTime()))return null;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(dateTime);
 const clock=String(event.status?.displayClock||'').trim();
 const period=Number(event.status?.period||0);
 return {
  id:eventId,date,
  away:code(away.team?.abbreviation),home:code(home.team?.abbreviation),
  status,scoreAway:score(away),scoreHome:score(home),
  period,clock
 };
}
async function fetchDay(date){
 const query=date.replaceAll('-','');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),9000);
 try{
  const response=await fetch(URL_BASE+'?dates='+query+'&limit=40',{cache:'no-store',signal:controller.signal});
  if(!response.ok)throw Error('HTTP '+response.status);
  const json=await response.json();
  return Array.isArray(json.events)?json.events.map(normalize).filter(Boolean):[];
 }finally{clearTimeout(timer);}
}
async function update(){
 if(document.hidden||busy||!navigator.onLine)return;
 busy=true;
 try{
  const today=currentDate();
  // Captura jogos que no Brasil cruzam a meia-noite da data americana.
  const days=[dayShift(today,-1),today];
  const results=await Promise.allSettled(days.map(fetchDay));
  const fulfilled=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
  if(!results.some(r=>r.status==='fulfilled'))return;
  const all=new Map(fulfilled.map(x=>[x.id,x]));
  const signature=JSON.stringify([...all]);
  liveMap.clear();
  for(const [id,event] of all)liveMap.set(id,event);
  completed=true;
  if(signature!==lastSignature){
   lastSignature=signature;
   window.dispatchEvent(new Event('quadra:live-update'));
  }
 }catch(err){console.info('QUADRA: atualização de jogos em andamento temporariamente indisponível',err);}
 finally{busy=false;}
}
update();
const interval=setInterval(update,120000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
window.addEventListener('online',update);
