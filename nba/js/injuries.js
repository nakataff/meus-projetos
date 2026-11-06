/* DE LA QUADRA — boletim de lesões importado pelo GitHub Actions.
 * Sem pedidos à ESPN no navegador e sem supor datas de retorno.
 */
import {jsonFile,esc} from './app.js?v=13';

let pending=null;
export function loadInjuries(){
 if(!pending) pending=jsonFile('data/injuries/current.json').then(data=>{
  if(!data?.players || !data?.checkedAt) return null;
  const last=Date.parse(data.checkedAt);
  // Nunca apresentar um boletim antigo como se fosse um status atual.
  if(!Number.isFinite(last) || Math.abs(Date.now()-last)>72*60*60*1000)return null;
  return data;
 }).catch(()=>null);
 return pending;
}

export function injuryFor(data,id,team=''){
 if(!data?.players)return null;
 const entry=data.players[String(id)];
 if(!entry || (team && entry.team && entry.team!==team))return null;
 return entry;
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
 abdomen:'Abdômen',rest:'Descanso'
};
function reasonText(info){
 const key=String(info?.reason||'').toLowerCase().trim();
 const reason=reasons[key]||info?.reason||'Não especificado';
 const side=String(info?.side||'').toLowerCase();
 return (side==='right'?'Direito — ':side==='left'?'Esquerdo — ':'')+reason;
}
function formatDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return '';
 const date=new Date(value+'T12:00:00Z');
 return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}).format(date);
}
function elapsedDays(value){
 if(!formatDate(value))return '';
 const days=Math.floor((Date.now()-new Date(value+'T12:00:00Z').getTime())/86400000);
 return days>=0?days:'';
}
export function injuryBadgeHTML(info){
 if(!info)return '';
 const label=injuryStatus(info.status);
 return '<span class="dlq-injury-badge" title="'+esc('Boletim ESPN: '+reasonText(info)+' • '+label)+'">✚ '+esc(label)+'</span>';
}
export function injuryCardHTML(info,checkedAt){
 if(!info)return '';
 const date=formatDate(info.returnDate);
 const today=new Date().toISOString().slice(0,10);
 const isOld=date && info.returnDate < today;
 const since=elapsedDays(info.firstSeen);
 const meta=since!==''?'No boletim do DE LA QUADRA há '+since+' '+(since===1?'dia':'dias'):'Data de início não informada';
 const returnText=date
  ?(isOld?'Previsão anterior: '+date+' (aguardando atualização)':'Retorno estimado: '+date)
  :'Retorno ainda sem previsão publicada';
 const detail=info.detail && !/^[\s\-]*$/.test(info.detail)?' • '+info.detail:'';
 return '<section class="dlq-injury-card" aria-label="Situação física do jogador">'+
 '<div class="dlq-injury-top"><span class="dlq-injury-kicker">BOLETIM DE LESÕES</span>'+injuryBadgeHTML(info)+'</div>'+
 '<h3>'+esc(reasonText(info))+esc(detail)+'</h3>'+
 '<p>'+esc(returnText)+'</p>'+
 '<div class="dlq-injury-meta"><span>'+esc(meta)+'</span><span>Fonte: ESPN • estimativa não oficial de retorno</span>'+
 (checkedAt?'<span>Consultado em '+esc(new Date(checkedAt).toLocaleDateString('pt-BR'))+'</span>':'')+
 '</div></section>';
}
