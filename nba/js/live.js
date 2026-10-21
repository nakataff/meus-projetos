/* QUADRA — placares em andamento. Fonte pública não oficial; falhas não travam o site.
 * Carregamento leve: 15 segundos durante jogos ao vivo, 2 minutos fora deles.
 * Os placares chegam por consulta HTTP, não por eventos instantâneos a cada cesta.
 */
import {currentDate,dayShift} from './app.js?v=12';

const URL_BASE='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
const LIVE_INTERVAL_MS=15000,IDLE_INTERVAL_MS=120000;
let lastSignature='',busy=false,pollTimer=null;
const liveMap=new Map();
window.QUADRA_LIVE_GAMES=liveMap;
window.QUADRA_LIVE_UPDATED_AT=null;

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
 const rawType=event.season?.type??competition?.type?.id??null;
 const seasonType=rawType!==null&&rawType!==''?Number(rawType):null;
 const status=phase.completed||state==='post'?'final':state==='in'?'live':'scheduled';
 const dateTime=new Date(event.date||'');
 if(!Number.isFinite(dateTime.getTime()))return null;
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(dateTime);
 const clock=String(event.status?.displayClock||'').trim();
 const period=Number(event.status?.period||0);
 const statusName=String(phase.name||'');
 const statusDetail=String(phase.shortDetail||event.status?.type?.detail||phase.description||'');
 return {
  id:eventId,date,
  away:code(away.team?.abbreviation),home:code(home.team?.abbreviation),
  status,scoreAway:score(away),scoreHome:score(home),
  period,clock,seasonType,statusName,statusDetail
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
  const hour=Number(new Intl.DateTimeFormat('en-GB',{
   timeZone:'America/Sao_Paulo',hour:'2-digit',hourCycle:'h23'
  }).format(new Date()));
  // Consultar também a noite anterior enquanto ainda há NBA em andamento.
  const yesterday=dayShift(today,-1);
  const previousLive=[...liveMap.values()].some(g=>g.date===yesterday&&g.status==='live');
  const days=(hour<8||previousLive)?[yesterday,today]:[today];
  const results=await Promise.allSettled(days.map(fetchDay));
  const fulfilled=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
  if(!results.some(r=>r.status==='fulfilled'))return;
  const all=new Map(fulfilled.map(x=>[x.id,x]));
  const signature=JSON.stringify([today,[...all]]); // A meia-noite também dispara atualização da tela.
  liveMap.clear();
  for(const [id,event] of all)liveMap.set(id,event);
  window.QUADRA_LIVE_UPDATED_AT=Date.now();
  if(signature!==lastSignature){
   lastSignature=signature;
   window.dispatchEvent(new Event('quadra:live-update'));
  }
 }catch(err){console.info('QUADRA: atualização de jogos em andamento temporariamente indisponível',err);}
 finally{busy=false;}
}
function nextInterval(){
 return [...liveMap.values()].some(g=>g.status==='live')?LIVE_INTERVAL_MS:IDLE_INTERVAL_MS;
}
function schedule(){
 clearTimeout(pollTimer);
 if(document.hidden)return;
 pollTimer=setTimeout(updateAndSchedule,nextInterval());
}
async function updateAndSchedule(){
 await update();
 schedule();
}
window.QUADRA_LIVE_REFRESH=updateAndSchedule;
updateAndSchedule();
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){clearTimeout(pollTimer);return;}
 updateAndSchedule();
});
window.addEventListener('online',updateAndSchedule);
