/* QUADRA — só carrega o controlador da página que foi aberta. */
import {toast} from './app.js?v=14';
try{const {mountNavigation}=await import('./navigation.js?v=20261108-game-bell-v1');mountNavigation();}
catch(e){console.info('Busca indisponível',e);}
const page=document.body.dataset.page;
const allowed=new Set(['home','games','teams','leaders','team','player','game','personal','standings','records']);
if(!allowed.has(page))throw Error('Página DE LA QUADRA desconhecida: '+page);
const version=['player','team'].includes(page)?'20261108-phone-push-v1':'20261108-rating-v3';
try{await import('./pages/'+page+'.js?v='+version);}
catch(e){console.error('Falha ao carregar página QUADRA',e);document.getElementById('pageContent').innerHTML='<div class="filler"><b>Não foi possível abrir esta página.</b>Atualize o navegador. Se continuar, utilize a versão anterior do site DE LA QUADRA.</div>';toast('Não foi possível carregar a página');}
if(['home','games','game','standings','leaders','records'].includes(page)){
  try{await import('./live.js?v=20261108-game-bell-v1');}
  catch(e){console.info('QUADRA: placar ao vivo indisponível',e);}
}
try{await import('./firebase-sync.js?v=20261024-login-v1');}
catch(e){console.error('Falha na integração Firebase',e);}

try{const {mountAlerts}=await import('./alerts.js?v=20261108-phone-push-v1');mountAlerts();}
catch(e){console.info('QUADRA: notificações indisponíveis',e);}
