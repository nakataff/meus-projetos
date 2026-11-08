/* DE LA QUADRA — boletim de lesões importado pelo GitHub Actions.
 * Cache estático primeiro; boletim público ao vivo se o cache da publicação estiver atrasado.
 */
import {jsonFile,esc,currentDate} from './app.js?v=14';

const FEED='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries';
const CACHE='dlq:nba-injuries:v3';
const teamIds='ATL BOS NOP CHI CLE DAL DEN DET GSW HOU IND LAC LAL MIA MIL MIN BKN NYK ORL PHI PHX POR SAC SAS OKC UTA WAS TOR MEM CHA'.split(' ');
const codes={GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',UTAH:'UTA',WSH:'WAS',PHO:'PHX'};
let pending=null;
function usable(data,hours){
 const age=Date.now()-Date.parse(data?.checkedAt||'');
 return data?.schemaVersion===3&&data.players&&age>=-300000&&age<=hours*3600000;
}
function espnPlayerId(person){
 if(/^\d+$/.test(person?.id||''))return String(person.id);
 for(const link of person?.links||[]){
  try{
   const u=new URL(link.href);
   if(!['espn.com','www.espn.com'].includes(u.hostname))continue;
   const match=u.pathname.match(/^\/nba\/player\/(?:[a-z-]+\/)?_\/id\/(\d+)(?:\/|$)/);
   if(match)return match[1];
  }catch{}
 }
 return '';
}
export function parseLiveInjuries(source,previous,checkedAt=new Date().toISOString()){
 if(!Array.isArray(source?.injuries))return null;
 const players={};
 for(const group of source.injuries){
  const raw=String(group?.team?.abbreviation||'').toUpperCase();
  const team=codes[raw]||raw||teamIds[Number(group?.team?.id??group?.id)-1];
  if(!teamIds.includes(team))continue;
  for(const row of Array.isArray(group.injuries)?group.injuries:[group]){
   const id=espnPlayerId(row?.athlete),name=row?.athlete?.displayName||row?.athlete?.fullName;
   const status=typeof row?.status==='string'?row.status:'';
   if(!id||!name||!status||/^(active|healthy|available)$/i.test(status))continue;
   const details=row.details||{},injury=row.injury||{};
   const reason=details.type||injury.type||'',old=previous?.players?.[id];
   players[id]={id,name,team,status,reason:typeof reason==='string'?reason:reason?.name||'',
    detail:details.detail||injury.detail||'',side:details.side||injury.location||'',
    returnDate:String(details.returnDate||row.returnDate||row.expectedReturnDate||'').slice(0,10),
    firstSeen:old?.team===team&&old?.reason===reason?old.firstSeen:checkedAt.slice(0,10)};
  }
 }
 return Object.keys(players).length?{schemaVersion:3,checkedAt,players}:null;
}
export function loadInjuries(){
 if(!pending)pending=(async()=>{
  let session;
  try{session=JSON.parse(sessionStorage.getItem(CACHE));}catch{}
  if(usable(session,1/3))return session;
  const snapshot=await jsonFile('data/injuries/current.json').catch(()=>null);
  if(usable(snapshot,4))return snapshot;
  try{
   const res=await fetch(FEED,{signal:AbortSignal.timeout(6500)});
   if(res.ok){
    const fresh=parseLiveInjuries(await res.json(),snapshot);
    if(fresh){
     try{sessionStorage.setItem(CACHE,JSON.stringify(fresh));}catch{}
     return fresh;
    }
   }
  }catch{}
  return usable(snapshot,72)?snapshot:usable(session,72)?session:null;
 })().catch(()=>null);
 return pending;
}
function medical(entry){
 return entry&& !/\b(rest|suspension|suspended|personal|not with team|assignment|g league)\b/i.test(String(entry.reason||'')+' '+String(entry.detail||''));
}
export function injuryFor(data,id,team=''){
 const entry=data?.players?.[String(id)];
 if(!medical(entry)||(team&&entry.team!==team))return null;
 return entry;
}
export function injuryList(data){
 return Object.values(data?.players||{}).filter(medical);
}
export function injuryStatus(raw){
 const s=String(raw||'').toLowerCase();
 if(s.includes('out')||s.includes('inactive')||s.includes('injured reserve'))return 'Fora';
 if(s.includes('doubt'))return 'Improvável';
 if(s.includes('question'))return 'Em dúvida';
 if(s.includes('probab'))return 'Provável';
 if(s.includes('day'))return 'Dia a dia';
 return raw||'Lesionado';
}
const reasons={
 knee:'Joelho',hamstring:'Posterior da coxa',ankle:'Tornozelo',foot:'Pé',
 back:'Costas',wrist:'Punho',hand:'Mão',shoulder:'Ombro',hip:'Quadril',
 achilles:'Tendão de Aquiles',calf:'Panturrilha',groin:'Virilha',
 quadriceps:'Quadríceps',illness:'Doença',concussion:'Concussão',
 elbow:'Cotovelo',neck:'Pescoço',finger:'Dedo',thigh:'Coxa',
 abdomen:'Abdômen',rest:'Descanso',leg:'Perna',toe:'Dedo do pé',eye:'Olho',heel:'Calcanhar',undisclosed:'Não informado'
};
export function injuryReason(info){
 const key=String(info?.reason||'').toLowerCase().trim();
 const reason=reasons[key]||info?.reason||'Não especificado';
 const side=String(info?.side||'').toLowerCase();
 return (side==='right'?'Direito — ':side==='left'?'Esquerdo — ':'')+reason;
}
function formatDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';
 const date=new Date(value+'T12:00:00Z');
 return Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value?'':new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}).format(date);
}
function elapsedDays(value){
 if(!formatDate(value))return '';
 const days=Math.floor((Date.now()-new Date(value+'T12:00:00Z').getTime())/86400000);
 return days>=0?days:'';
}
export function injuryReturnText(info){
 const date=formatDate(info?.returnDate);
 if(!date)return 'Sem previsão de retorno';
 return info.returnDate<currentDate()?'Previsão anterior: '+date+' (aguardando atualização)':'Retorno estimado: '+date;
}
export function injuryBadgeHTML(info,compact=false){
 if(!info)return '';
 const label=injuryStatus(info.status),description='Boletim de lesões: '+label+' · '+injuryReason(info);
 return '<span class="dlq-injury-badge'+(compact?' dlq-injury-cross':'')+'" role="img" aria-label="'+esc(description)+'" title="'+esc(description)+'">'+
  '<span aria-hidden="true">✚</span>'+(compact?'':' '+esc(label))+'</span>';
}
export function injuryCardHTML(info,checkedAt){
 if(!info)return '';
 const since=elapsedDays(info.firstSeen);
 const meta=since!==''?'No boletim do DE LA QUADRA há '+since+' '+(since===1?'dia':'dias'):'Data de início não informada';
 const details={surgery:'Cirurgia',inflammation:'Inflamação',sprain:'Entorse',strain:'Distensão',soreness:'Dor',fracture:'Fratura'};
 const detail=info.detail&&!/^[\s\-]*$/.test(info.detail)?' · '+(details[String(info.detail).toLowerCase()]||info.detail):'';
 return '<section class="dlq-injury-card" aria-label="Situação física do jogador">'+
 '<div class="dlq-injury-top"><span class="dlq-injury-kicker">BOLETIM DE LESÕES</span>'+injuryBadgeHTML(info)+'</div>'+
 '<h3>'+esc(injuryReason(info))+esc(detail)+'</h3>'+
 '<p>'+esc(injuryReturnText(info))+'</p>'+
 '<div class="dlq-injury-meta"><span>'+esc(meta)+'</span><span>Fonte: ESPN • estimativa, sujeita a mudança</span>'+
 (checkedAt?'<span>Consultado em '+esc(new Date(checkedAt).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}))+'</span>':'')+
 '</div></section>';
}
