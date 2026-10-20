/* QUADRA — só carrega o controlador da página que foi aberta. */
import {toast} from './app.js?v=4';
const page=document.body.dataset.page;
const allowed=new Set(['home','games','teams','team','player','game','personal']);
if(!allowed.has(page))throw Error('Página QUADRA desconhecida: '+page);
try{await import('./pages/'+page+'.js?v=4');}
catch(e){console.error('Falha ao carregar página QUADRA',e);document.getElementById('pageContent').innerHTML='<div class="filler"><b>Não foi possível abrir esta página.</b>Atualize o navegador. Se continuar, utilize a versão anterior do QUADRA.</div>';toast('Não foi possível carregar a página');}
try{await import('./firebase-sync.js?v=6');}
catch(e){console.error('Falha na integração Firebase',e);}
