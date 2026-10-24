/* QUADRA — só carrega o controlador da página que foi aberta. */
import {toast} from './app.js?v=13';
try{const {mountNavigation}=await import('./navigation.js?v=20261024-search-shell-v1');mountNavigation();}
catch(e){console.info('Busca indisponível',e);}
const page=document.body.dataset.page;
const allowed=new Set(['home','games','teams','leaders','team','player','game','personal','standings']);
if(!allowed.has(page))throw Error('Página DE LA QUADRA desconhecida: '+page);
const controllerVersion=page==='team'?'20261024-team-results-v1':['game','leaders'].includes(page)?'20261024-roster-points-v1':page==='player'?'20261024-player-history-v1':'20261024-final-fast-v1';
try{await import('./pages/'+page+'.js?v='+controllerVersion);}
catch(e){console.error('Falha ao carregar página QUADRA',e);document.getElementById('pageContent').innerHTML='<div class="filler"><b>Não foi possível abrir esta página.</b>Atualize o navegador. Se continuar, utilize a versão anterior do site DE LA QUADRA.</div>';toast('Não foi possível carregar a página');}
if(['home','games','game','standings','leaders'].includes(page)){
  try{await import('./live.js?v=20261024-final-fast-v1');}
  catch(e){console.info('QUADRA: placar ao vivo indisponível',e);}
}
try{await import('./firebase-sync.js?v=7');}
catch(e){console.error('Falha na integração Firebase',e);}
