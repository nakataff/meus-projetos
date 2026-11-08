import {ALERT_ICON, alertRules as rules, esc, modal, closeModal, name, path, toast, parseTV, jsonFile} from './app.js?v=14';
import {fetchGameSummary} from './boxscore.js?v=3';
import {ALERT_RULES_KEY, ALERT_EVENTS, TV_LABELS, MAX_RULES, normalizeRules, wantsGame, matchPlatforms, gameMilestones, matchingAlerts} from './alerts-core.mjs?v=2';
import {PUSH_API} from './alerts-config.mjs?v=1';

const INBOX_KEY = 'quadra_alert_inbox_v1';
const DEVICE_KEY = 'quadra_push_device_v1';
const CHECK_MS = 30000;
const RULE_LABELS = {tv:'Transmissões no Brasil'};
const broadcasts = parseTV();
let bell, busy = false, liveModule, lastPoll = 0, playerTeams;
const completed = new Set();

function read(key, fallback) {
 try {return JSON.parse(localStorage.getItem(key)) ?? fallback;}
 catch {return fallback;}
}
const inbox = () => read(INBOX_KEY, []);
const device = () => read(DEVICE_KEY, '');
const ruleLabel = rule => RULE_LABELS[rule.kind] || rule.label || rule.id;
const labels = rule => rule.kind === 'tv' ? TV_LABELS : ALERT_EVENTS;
const sameRule = (a,b) => a.kind === b.kind && a.id === b.id;

export function alertButton(kind, id, label, team = '') {
 return '<button type="button" class="btn ghost dlq-alert-action" data-alert-kind="' + esc(kind) +
  '" data-alert-id="' + esc(id) + '" data-alert-label="' + esc(label) + '" data-alert-team="' + esc(team) +
  '">' + ALERT_ICON + '<span>Notificações</span></button>';
}

function refreshBell() {
 if (!bell) return;
 const unread = inbox().filter(item => !item.read).length;
 bell.querySelector('.dlq-alert-count').textContent = unread > 0 ? String(unread) : '';
 bell.setAttribute('aria-label', 'Notificações' + (unread ? ' · ' + unread + ' novas' : ''));
}

function refreshGameBells(prefs = rules()) {
 const active = new Set(prefs.filter(rule=>rule.kind==='game').map(rule=>rule.id));
 document.querySelectorAll('.dlq-game-bell').forEach(button=>{
  button.setAttribute('aria-pressed', String(active.has(button.dataset.alertId)));
 });
}

function write(key, value) {
 try {localStorage.setItem(key, JSON.stringify(value)); return true;}
 catch {toast('Não foi possível salvar neste navegador.'); return false;}
}

function addAlerts(items, showToast = true) {
 const feed = inbox();
 const known = new Set(feed.map(item => item.id));
 const fresh = items.filter(item => {
  if (known.has(item.id)) return false;
  known.add(item.id);
  return true;
 });
 if (!fresh.length || !write(INBOX_KEY, [...feed,...fresh].sort((a,b)=>b.at-a.at).slice(0,60))) return;
 refreshBell();
 if (showToast) {
  const newest = fresh.at(-1);
  toast(fresh.length > 1 ? fresh.length + ' novos avisos da NBA' : newest.title + ' · ' + newest.body);
 }
}

async function checkAlerts() {
 const prefs = rules(), now = Date.now();
 if (!prefs.length || busy || document.hidden || !navigator.onLine || now-lastPoll<CHECK_MS) return;
 busy = true;
 lastPoll = now;
 try {
  if (!window.QUADRA_LIVE_GAMES) {
   liveModule ||= import('./live.js?v=20261108-game-bell-v1').catch(error=>{liveModule=null;throw error;});
   await liveModule;
  }
  if (prefs.some(rule=>rule.kind==='player') && !playerTeams) {
   playerTeams = new Map((await jsonFile('data/search.json').catch(()=>({}))).players?.map(([id,,team])=>[String(id),team]));
  }
  const candidates = [...(window.QUADRA_LIVE_GAMES?.values() || [])]
   .filter(game=>['live','final'].includes(game.status) && now-game.startTime<7*3600000 && !completed.has(game.id))
   .map(game=>({game,platforms:matchPlatforms(game,broadcasts)}))
   .filter(({game,platforms})=>wantsGame(prefs,game,platforms,playerTeams));
  const items = [];
  // A agenda e o placar já estão na memória. Consultar lances só de partidas seguidas.
  for (let index=0; index<candidates.length; index+=4) {
   const result = await Promise.allSettled(candidates.slice(index,index+4).map(async ({game,platforms})=>{
    const payload = await fetchGameSummary(game);
    const summary = gameMilestones(payload,game);
    if (summary.markers.has('final')) completed.add(game.id);
    return matchingAlerts(rules(),game,summary,platforms,Date.now());
   }));
   items.push(...result.filter(item=>item.status==='fulfilled').flatMap(item=>item.value));
  }
  addAlerts(items.sort((a,b)=>a.at-b.at), !device());
 } catch (error) {
  console.info('QUADRA: alertas temporariamente indisponíveis',error);
 } finally {busy=false;}
}

function alertDialog(content) {
 modal('<div class="dlq-alert-dialog">' + content + '</div>');
}
function saveRules(next) {
 if (!write(ALERT_RULES_KEY, next)) return false;
 refreshGameBells(next);
 if (device()) syncDevice(next).catch(()=>toast('Preferências salvas aqui. Abra Notificações para tentar sincronizar o push.'));
 completed.clear();
 lastPoll=0;
 checkAlerts();
 return true;
}

function openRule(target, gameButton) {
 const existing = rules().find(rule=>sameRule(rule,target));
 const defaults = target.kind === 'tv' ? Object.keys(TV_LABELS) : ['start','final'];
 const selected = existing?.events || defaults;
 const hint = gameButton && !device() ? 'Os avisos aparecem enquanto o De La Quadra estiver aberto em primeiro plano.' :
  'Escolha os avisos que quer receber neste dispositivo.';
 const leaveRule = () => {
  if (!gameButton) return openInbox();
  closeModal();
  gameButton.focus();
 };
 alertDialog('<h2>' + esc(ruleLabel(target)) + '</h2><p class="small subtle">' + hint + '</p>' +
  '<form id="dlqAlertRule"><fieldset class="dlq-alert-choices"><legend>Quando avisar</legend>' +
  Object.entries(labels(target)).map(([key,label])=>'<label><input type="checkbox" name="event" value="'+esc(key)+'"'+
   (selected.includes(key)?' checked':'')+'> '+esc(label)+'</label>').join('') +
  '</fieldset><div class="modal-footer"><button type="button" class="btn ghost" id="dlqAlertBack">'+(gameButton?'Cancelar':'Voltar')+'</button>' +
  (existing ? '<button type="button" class="btn ghost" id="dlqAlertRemove">Remover alertas</button>' : '') +
  '<button class="btn accent" type="submit">Salvar alertas</button></div></form>');
 const form = document.getElementById('dlqAlertRule');
 form.querySelector('#dlqAlertBack').onclick = leaveRule;
 const remove = () => {
  if (saveRules(rules().filter(rule=>!sameRule(rule,target)))) leaveRule();
 };
 const removeButton = form.querySelector('#dlqAlertRemove');
 if (removeButton) removeButton.onclick = remove;
 form.onsubmit = event => {
  event.preventDefault();
  const events = new FormData(form).getAll('event');
  if (!events.length) return remove();
  const others = rules().filter(rule=>!sameRule(rule,target));
  if (others.length >= MAX_RULES) return toast('Limite de '+MAX_RULES+' regras de alerta neste dispositivo.');
  if (saveRules(normalizeRules([...others,{...target,events,since:Date.now()}]))) {
   leaveRule();
   toast('Alertas salvos.');
  }
 };
 form.querySelector('input')?.focus();
}

function openInbox() {
 const prefs = rules(), feed = inbox();
 const date = new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
 const tv = prefs.find(rule=>rule.kind==='tv');
 alertDialog('<h2>Notificações</h2><p class="small subtle">Use o sino da partida ou o botão no perfil de um time ou jogador. Os avisos por canal de TV ficam aqui.</p>' +
  '<div class="controls dlq-alert-controls"><button class="btn accent" id="dlqAlertTv" type="button">' +
  (tv?'Editar canais de TV':'Configurar alertas de TV')+'</button>' +
  (PUSH_API?'<button class="btn ghost" id="dlqAlertPush" type="button">'+(device()?'Desativar avisos com o site fechado':'Ativar avisos com o site fechado')+'</button>':'')+
  '</div><p class="small subtle" id="dlqPushStatus">'+
  (device()?'Avisos com o site fechado ativados neste dispositivo.':'Os avisos aparecem enquanto o De La Quadra estiver aberto em primeiro plano.')+'</p>'+
  '<h3>Meus alertas</h3><div class="dlq-alert-list">'+(prefs.length?prefs.map((rule,index)=>
   '<button class="dlq-alert-item" type="button" data-alert-index="'+index+'"><strong>'+esc(ruleLabel(rule))+
   '</strong><small>'+esc(rule.events.map(event=>labels(rule)[event]).join(' · '))+'</small></button>').join(''):
   '<p class="small subtle">Nenhum alerta configurado.</p>')+'</div><h3>Histórico recente</h3><div class="dlq-alert-list">'+
  (feed.length?feed.slice(0,20).map(item=>'<a class="dlq-alert-item" href="'+esc(path(item.link))+'"><strong>'+esc(item.title)+
   '</strong><small>'+esc(item.body)+' · '+esc(date.format(new Date(item.at)))+'</small></a>').join(''):
   '<p class="small subtle">Nenhum aviso recebido ainda.</p>')+'</div>');
 if (feed.some(item=>!item.read)) write(INBOX_KEY,feed.map(item=>({...item,read:true})));
 refreshBell();
 document.getElementById('dlqAlertTv').onclick = ()=>openRule({kind:'tv',id:'br',label:'Transmissões no Brasil'});
 document.querySelectorAll('[data-alert-index]').forEach(button=>{
  button.onclick=()=>openRule(prefs[Number(button.dataset.alertIndex)]);
 });
 const pushButton = document.getElementById('dlqAlertPush');
 if (pushButton) pushButton.onclick = ()=>changePush(pushButton);
 document.querySelector('#modalRoot [data-close]')?.focus();
}

async function api(route, init) {
 const result = await fetch(PUSH_API.replace(/\/$/,'') + '/' + route, init);
 if (!result.ok) throw Error('HTTP ' + result.status);
 return result.status === 204 ? null : result.json();
}
function deviceRequest(method, token, body) {
 return {method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)};
}
let syncQueue = Promise.resolve();
function syncDevice(next) {
 const token = device();
 const request = syncQueue.catch(()=>{}).then(()=>api('device',deviceRequest('PUT',token,{rules:next})));
 syncQueue = request;
 return request;
}
async function changePush(button) {
 const status = document.getElementById('dlqPushStatus');
 button.disabled = true;
 try {
  if (device()) {
   const token = device();
   await syncQueue.catch(()=>{});
   await api('device',deviceRequest('DELETE',token));
   const registration = await navigator.serviceWorker.getRegistration(path(''));
   const subscription = await registration?.pushManager.getSubscription();
   await subscription?.unsubscribe().catch(()=>{});
   write(DEVICE_KEY,'');
  } else {
   if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    status.textContent = /iPhone|iPad|iPod/i.test(navigator.userAgent) ?
     'No iPhone ou iPad, adicione o De La Quadra à Tela de Início e abra pelo ícone para ativar.' :
     'Este navegador não oferece avisos com o site fechado.';
    return;
   }
   if (await Notification.requestPermission() !== 'granted') {
    status.textContent = 'Autorize as notificações nas configurações do navegador e tente novamente.';
    return;
   }
   const {publicKey} = await api('key');
   const registration = await navigator.serviceWorker.register(path('sw.js'),{scope:path('')});
   const active = registration.active ? registration : await navigator.serviceWorker.ready;
   const existing = await active.pushManager.getSubscription();
   const subscription = existing || await active.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
   const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
   await api('device',deviceRequest('PUT',token,{subscription:subscription.toJSON(),rules:rules()}));
   if (!write(DEVICE_KEY,token)) await api('device',deviceRequest('DELETE',token));
  }
  if (button.isConnected) openInbox();
 } catch (error) {
  console.info('QUADRA: push indisponível',error);
  status.textContent = 'Não foi possível configurar o envio. Tente novamente em instantes.';
 } finally {button.disabled=false;}
}

export function mountAlerts() {
 const search = document.querySelector('.dlq-top .dlq-search-open');
 if (!search || document.getElementById('dlqAlerts')) return;
 const actions = document.createElement('div');
 actions.className = 'dlq-top-actions';
 search.before(actions);
 actions.append(search);
 actions.insertAdjacentHTML('beforeend','<button type="button" class="btn ghost dlq-alert-bell" id="dlqAlerts" aria-haspopup="dialog">'+ALERT_ICON+
  '<span class="dlq-alert-count" aria-hidden="true"></span></button>');
 bell = document.getElementById('dlqAlerts');
 bell.onclick = openInbox;
 document.addEventListener('click',event=>{
  const trigger = event.target.closest('[data-alert-kind]');
  if (trigger) {
   const {alertKind:kind,alertId:id,alertLabel:label,alertTeam:team} = trigger.dataset;
   openRule({kind,id,label:label||name(id),team},kind==='game'?trigger:null);
  }
 });
 window.addEventListener('quadra:live-update',checkAlerts);
 window.addEventListener('storage',event=>{
  refreshBell();
  if (!event.key || event.key===ALERT_RULES_KEY) refreshGameBells();
 });
 document.addEventListener('visibilitychange',checkAlerts);
 navigator.serviceWorker?.addEventListener('message',event=>{
  if (event.data?.type==='quadra-alert') addAlerts([event.data.alert],false);
 });
 if (device() && PUSH_API) syncDevice(rules()).catch(()=>{});
 setInterval(checkAlerts,CHECK_MS);
 refreshBell();
 checkAlerts();
}
