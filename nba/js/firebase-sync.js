/* Sincronização local-first do QUADRA; Firebase só é carregado se configurado. */
const cloudConfig = window.QUADRA_FIREBASE_CONFIG;
const cloudBar = document.createElement('div');
cloudBar.id = 'quadra-cloud';
cloudBar.className = 'qcloud';
cloudBar.innerHTML = '<div class="qcloud-info"><span class="qcloud-icon">☁</span><span id="qcloud-state">Verificando nuvem…</span></div><div id="qcloud-actions" class="qcloud-actions"></div>';
// O painel de conta aparece apenas dentro das configurações do Perfil.
function mountCloudControl(){
  const slot=document.getElementById('firebaseAccountControl');
  if(slot && cloudBar.parentElement!==slot)slot.appendChild(cloudBar);
}
window.addEventListener('quadra:profile-render',()=>ui());
const message = document.getElementById('qcloud-state');
const actions = document.getElementById('qcloud-actions');
const helpUrl = 'https://github.com/nakataff/meus-projetos/blob/main/nba/firebase/SETUP.md';
const appSeason = 'quadra-nba-2026-27';
const lastUserKey = 'quadra_cloud_user_v1';
const backupKey = 'quadra_cloud_pre_sync_backup_v1';
const months = ['2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04','2027-05'];
let sdk=null,auth=null,db=null,user=null,active=false,loading=false,unsubscribe=null,flushTimer=null,flushing=false;
let lastSynced=null;
const safeJson = x => JSON.stringify(x ?? null);
const clone = x => JSON.parse(safeJson(x));
const newest = x => {
  const a=Date.parse(x && (x.updated || x.updatedAt) || '');
  return Number.isFinite(a) ? a : 0;
};
const hasKeys = obj => obj && typeof obj==='object' && Object.keys(obj).length>0;
function setStatus(s){message.textContent=s;}
function addButton(name,fn){const b=document.createElement('button');b.type='button';b.textContent=name;b.className='qcloud-button';b.addEventListener('click',fn);actions.appendChild(b);return b;}
function ui(){
  mountCloudControl();
  actions.replaceChildren();
  if(!sdk){setStatus('Conta Google ainda não disponível');addButton('Ajuda',()=>location.href=helpUrl);return;}
  if(!user){setStatus('Entre com Google para sincronizar seus registros');addButton('Entrar com Google',login);return;}
  if(loading){setStatus('Conectando sua conta Google…');return;}
  if(active){
    setStatus('Conta Google conectada • salvamento automático');
    addButton('Sair da conta',logout);
  }else{
    setStatus('Conta conectada • aguardando sincronização');
    addButton('Tentar novamente',()=>syncFromCloud(true));
    addButton('Sair da conta',logout);
  }
}
function local(){
  return window.QuadraBridge?.snapshot() || null;
}
function gameMonth(id, bundle){
  let date='';
  const g = typeof window.getGame==='function'?window.getGame(id):null;
  if(g?.date)date=g.date;
  if(!date)date=(bundle?.saved?.custom||[]).find(g=>g.id===id)?.date || '';
  if(!date && /^\d{4}-\d\d-/.test(id))date=id.slice(0,7);
  const month=date.slice(0,7);
  return /^\d{4}-\d{2}$/.test(month)?month:'outros';
}
function notesByMonth(bundle){
  const result={};
  for(const [id,note] of Object.entries(bundle?.saved?.notes||{})){
    const name='games-'+gameMonth(id,bundle);
    if(!result[name])result[name]={};
    result[name][id]=note;
  }
  return result;
}
function fromDocuments(q){
  const bundle={saved:{notes:{},custom:[]},settings:{fav:''},extras:{}};
  for(const item of q.docs){
    const value=item.data()||{};
    if(item.id.startsWith('games-'))Object.assign(bundle.saved.notes,value.notes||{});
    else if(item.id==='custom')bundle.saved.custom=Array.isArray(value.custom)?value.custom:[];
    else if(item.id==='preferences')bundle.settings=value.settings||{fav:''};
    else if(item.id==='extras')bundle.extras=value.extras||{};
  }
  return bundle;
}
function merge(localBundle,remoteBundle){
  const a=localBundle||{saved:{notes:{},custom:[]},settings:{},extras:{}};
  const b=remoteBundle||{saved:{notes:{},custom:[]},settings:{},extras:{}};
  const output={saved:{notes:{},custom:[]},settings:{},extras:{}};
  const la=a.saved?.notes||{},rb=b.saved?.notes||{};
  for(const id of new Set([...Object.keys(la),...Object.keys(rb)])){
    if(!(id in la))output.saved.notes[id]=rb[id];
    else if(!(id in rb))output.saved.notes[id]=la[id];
    else output.saved.notes[id]=newest(la[id])>newest(rb[id])?la[id]:rb[id];
  }
  const custom=new Map((b.saved?.custom||[]).filter(g=>g&&g.id).map(g=>[g.id,g]));
  for(const game of a.saved?.custom||[]){
    if(game && game.id && (!custom.has(game.id)||newest(game)>newest(custom.get(game.id))))custom.set(game.id,game);
  }
  output.saved.custom=[...custom.values()];
  const aSet=a.settings||{},bSet=b.settings||{};
  output.settings = Object.keys(bSet).length===0 ? aSet
    : Object.keys(aSet).length===0 ? bSet
    : (newest(aSet)>newest(bSet)?aSet:bSet);
  const localExtra=a.extras||{},remoteExtra=b.extras||{};
  const priority=newest(localExtra)>newest(remoteExtra);
  output.extras={...remoteExtra,...localExtra};
  for(const field of ['players','franchise','lineups','gameRatings','gameMvp']){
    output.extras[field]=priority
      ? {...(remoteExtra[field]||{}),...(localExtra[field]||{})}
      : {...(localExtra[field]||{}),...(remoteExtra[field]||{})};
  }
  const chosenTimestamp=priority?localExtra.updatedAt:remoteExtra.updatedAt;
  if(chosenTimestamp)output.extras.updatedAt=chosenTimestamp;
  else delete output.extras.updatedAt;
  // Evita spoilers entre dispositivos: cada aparelho mantém sua preferência.
  output.extras.hideSpoilers=localExtra.hideSpoilers ?? true;
  return output;
}
// Firestore rejeita valores undefined; normalizar sem modificar o estado local.
function firestoreSafe(value){return JSON.parse(JSON.stringify(value));}
function cloudCollection(){return sdk.collection(db,'users',user.uid,'quadra');}
function cloudDocument(name){return sdk.doc(db,'users',user.uid,'quadra',name);}
async function writeAll(bundle){
  const notes=notesByMonth(bundle);
  const jobs=[];
  for(const [name,group] of Object.entries(notes)){
    jobs.push(sdk.setDoc(cloudDocument(name),firestoreSafe({notes:group,version:1,updatedAt:new Date().toISOString()}),{merge:true}));
  }
  jobs.push(sdk.setDoc(cloudDocument('preferences'),firestoreSafe({settings:bundle.settings||{},version:1,updatedAt:new Date().toISOString()}),{merge:true}));
  jobs.push(sdk.setDoc(cloudDocument('extras'),firestoreSafe({extras:bundle.extras||{},version:1,updatedAt:new Date().toISOString()}),{merge:true}));
  jobs.push(sdk.setDoc(cloudDocument('custom'),firestoreSafe({custom:bundle.saved?.custom||[],version:1,updatedAt:new Date().toISOString()}),{merge:true}));
  await Promise.all(jobs);
}
function pendingSummary(bundle){
  const g=Object.keys(bundle?.saved?.notes||{}).length;
  const p=Object.keys(bundle?.extras?.players||{}).length;
  return g+' partidas e '+p+' avaliações de atletas';
}
function saveRecoveryCopy(bundle){
  if(localStorage.getItem(backupKey))return;
  try{localStorage.setItem(backupKey,JSON.stringify({date:new Date().toISOString(),data:bundle}));}
  catch{setStatus('Armazenamento local cheio: faça o backup JSON antes de continuar.');}
}
function apply(bundle){
  window.QuadraBridge.applyRemote(bundle);
}
function startListener(){
  if(unsubscribe)unsubscribe();
  unsubscribe=sdk.onSnapshot(cloudCollection(),q=>{
    if(!active || !user || q.metadata.hasPendingWrites)return;
    const previousLocal=local();
    const wasDirty=lastSynced && safeJson(previousLocal)!==safeJson(lastSynced);
    const merged=merge(previousLocal,fromDocuments(q));
    if(safeJson(previousLocal)!==safeJson(merged)){apply(merged);}
    if(!wasDirty)lastSynced=clone(merged);
    else schedule();
  },err=>{console.warn('QUADRA: escuta Firestore',err);setStatus('Nuvem indisponível: seus dados continuam neste aparelho');});
}
async function syncFromCloud(manual=false){
  if(!user || loading)return;
  loading=true;ui();
  try{
    const fresh=local();
    if(!fresh)throw Error('Aguarde o QUADRA terminar de carregar.');
    if(!localStorage.getItem(lastUserKey))saveRecoveryCopy(fresh);
    else if(localStorage.getItem(lastUserKey)!==user.uid){
      if(!window.confirm('Este aparelho foi usado com outra conta. Mesclar os dados locais à conta Google atual? Faça um backup antes se tiver dúvidas.')){
        throw Error('Troca de conta cancelada: dados locais preservados.');
      }
      saveRecoveryCopy(fresh);
    }
    const remote=fromDocuments(await sdk.getDocs(cloudCollection()));
    const merged=merge(fresh,remote);
    await writeAll(merged);
    lastSynced=clone(merged);
    apply(merged);
    localStorage.setItem(lastUserKey,user.uid);
    active=true;
    startListener();
    if(manual) setStatus('Dados atualizados entre seus dispositivos');
  }catch(e){
    console.error('QUADRA Firebase',e);
    setStatus('Falha na sincronização: '+(e.code||e.message||e)+'. Dados locais preservados.');
  }finally{loading=false;if(active)ui(); else {actions.replaceChildren();addButton('Tentar novamente',()=>syncFromCloud(true));addButton('Sair',logout);}}
}
async function flush(){
  if(!active||!user||!lastSynced||flushing)return;
  const current=local();if(!current)return;
  if(safeJson(current)===safeJson(lastSynced))return;
  flushing=true;setStatus('Salvando alterações na nuvem…');
  const previous=lastSynced;
  const noteDelta={};
  for(const [id,info] of Object.entries(current.saved?.notes||{})){
    if(safeJson(info)!==safeJson(previous.saved?.notes?.[id])){
      const month='games-'+gameMonth(id,current);
      if(!noteDelta[month])noteDelta[month]={};
      noteDelta[month][id]=info;
    }
  }
  try{
    const jobs=[];
    for(const [name,notes] of Object.entries(noteDelta)){
      jobs.push(sdk.setDoc(cloudDocument(name),firestoreSafe({notes,updatedAt:new Date().toISOString(),version:1}),{merge:true}));
    }
    if(safeJson(current.saved?.custom)!==safeJson(previous.saved?.custom)){
      jobs.push(sdk.setDoc(cloudDocument('custom'),firestoreSafe({custom:current.saved?.custom||[],updatedAt:new Date().toISOString(),version:1}),{merge:true}));
    }
    if(safeJson(current.settings)!==safeJson(previous.settings)){
      jobs.push(sdk.setDoc(cloudDocument('preferences'),firestoreSafe({settings:current.settings,updatedAt:new Date().toISOString(),version:1}),{merge:true}));
    }
    if(safeJson(current.extras)!==safeJson(previous.extras)){
      jobs.push(sdk.setDoc(cloudDocument('extras'),firestoreSafe({extras:current.extras,updatedAt:new Date().toISOString(),version:1}),{merge:true}));
    }
    await Promise.all(jobs);
    lastSynced=clone(current);
    setStatus('☑ Alterações salvas no Google');
  }catch(e){
    console.warn('QUADRA Firebase: dados mantidos localmente, aguardando reconexão',e);
    setStatus('Sem conexão: alterações preservadas neste aparelho');
  }finally{
    flushing=false;
    if(active && lastSynced && safeJson(local())!==safeJson(lastSynced))schedule();
  }
}
function schedule(){
  if(!active)return;
  clearTimeout(flushTimer);
  flushTimer=setTimeout(flush,1200);
}
async function login(){
  try{await sdk.signInWithPopup(auth,new sdk.GoogleAuthProvider());}
  catch(e){console.warn('Login Google',e);setStatus('Não foi possível entrar: '+(e.code||'verifique pop-ups e domínio autorizado'));}
}
async function logout(){
  try{
    if(flushTimer){clearTimeout(flushTimer);await flush();}
    if(unsubscribe){unsubscribe();unsubscribe=null;}
    active=false;user=null;lastSynced=null;
    await sdk.signOut(auth);
    setStatus('Você saiu da conta Google. Histórico local preservado.');
    ui();
  }catch(e){setStatus('Falha ao sair: '+(e.code||e.message));}
}
window.addEventListener('quadra:local-change',schedule);
window.addEventListener('online',()=>{if(active)syncFromCloud();});
window.addEventListener('pagehide',()=>{if(flushTimer)clearTimeout(flushTimer);if(active)flush();});
if(!cloudConfig || !cloudConfig.apiKey || !cloudConfig.projectId || !cloudConfig.appId){
  ui();
}else{
  try{
    const version='12.19.0';
    const root='https://www.gstatic.com/firebasejs/'+version+'/';
    const [appModule,authModule,fireModule]=await Promise.all([
      import(root+'firebase-app.js'),
      import(root+'firebase-auth.js'),
      import(root+'firebase-firestore.js')
    ]);
    sdk={...authModule,...fireModule};
    const app=appModule.initializeApp(cloudConfig);
    auth=authModule.getAuth(app);
    db=fireModule.getFirestore(app);
    authModule.onAuthStateChanged(auth, async person=>{
      if(unsubscribe){unsubscribe();unsubscribe=null;}
      user=person||null;active=false;lastSynced=null;
      // Apenas identidade da conta ativa na interface. Não grava dados novos no Firestore.
      window.QUADRA_ACCOUNT=person?{
        name:person.displayName||'',
        email:person.email||'',
        photoURL:person.photoURL||''
      }:null;
      window.dispatchEvent(new CustomEvent('quadra:auth',{detail:window.QUADRA_ACCOUNT}));
      ui();
      if(user)await syncFromCloud();
    },err=>setStatus('Firebase Authentication: '+(err.code||err.message)));
  }catch(e){
    console.error('Falha ao carregar Firebase',e);
    setStatus('Não foi possível iniciar Firebase: '+(e.message||e));
    actions.replaceChildren();addButton('Ajuda',()=>location.href=helpUrl);
  }
}
