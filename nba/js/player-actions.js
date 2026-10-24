/* Shared comparison and contextual actions. Uses only the data already on screen. */
import {modal,esc,toast} from './app.js?v=13';
import {openPlayerCardComposer} from './share-card.js?v=20261024-compare-v1';
export const COMPARISON_FIELDS=Object.freeze([
 {key:'pts',label:'Pontos'},{key:'reb',label:'Rebotes'},{key:'ast',label:'Assistências'},
 {key:'stl',label:'Roubos'},{key:'blk',label:'Tocos'},{key:'threeM',label:'Bolas de 3'},
 {key:'to',label:'Turnovers',lower:true},{key:'rating',label:'Nota DLQ'},
 {key:'min',label:'Minutos'},{key:'fgpct',label:'Aproveitamento FG',percent:true},
 {key:'threepct',label:'Aproveitamento 3PT',percent:true}
]);
export function comparisonValue(value,field,mode='game'){
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return '—';
 const decimals=mode==='average'||field.key==='rating'||field.percent||field.key==='min';
 return Number(value).toLocaleString('pt-BR',{minimumFractionDigits:decimals?1:0,maximumFractionDigits:decimals?1:0})+(field.percent?'%':'');
}
export function openPlayerComparison({getPlayers,context,firstKey='',secondKey=''}){
 // Snapshot: a live update never silently changes the image being reviewed.
 const players=getPlayers().filter(p=>p?.key&&p.name),byKey=new Map(players.map(p=>[p.key,p]));
 if(players.length<2)return toast('A comparação precisa de dois jogadores com dados nesta seleção.');
 let left=byKey.has(firstKey)?firstKey:players[0].key;
 let right=byKey.has(secondKey)&&secondKey!==left?secondKey:players.find(p=>p.key!==left).key;
 const label=p=>p.name+' · '+p.teamCode;
 modal('<div class="dlq-comparison"><span class="caps">COMPARADOR DE JOGADORES</span><h2>Frente a frente</h2>'+
  '<p class="small subtle">'+esc(context.title)+' · '+esc(context.subtitle||'')+'</p>'+
  '<div class="comparison-pickers"><label>Jogador 1<select id="compareLeft" class="control"></select></label>'+
  '<button type="button" class="btn ghost" id="compareSwap" aria-label="Inverter jogadores">⇄</button>'+
  '<label>Jogador 2<select id="compareRight" class="control"></select></label></div>'+
  '<div id="comparisonResult" aria-live="polite"></div><div class="comparison-footer">'+
  '<span class="small subtle">Dados desta seleção. A Nota DLQ é calculada pelo site.</span>'+
  '<button type="button" class="btn accent" id="compareMakeCard">▣ Gerar card da comparação</button></div></div>');
 const root=document.querySelector('.dlq-comparison'),a=root.querySelector('#compareLeft'),b=root.querySelector('#compareRight');
 function render(){
  for(const [select,selected,other] of [[a,left,right],[b,right,left]]){
   select.innerHTML=players.map(p=>'<option value="'+esc(p.key)+'"'+(p.key===selected?' selected':'')+(p.key===other?' disabled':'')+'>'+esc(label(p))+'</option>').join('');
  }
  const p=byKey.get(left),q=byKey.get(right);
  root.querySelector('#comparisonResult').innerHTML='<div class="comparison-players">'+[p,q].map(v=>
   '<div><img src="'+esc(v.headshot||v.teamLogo)+'" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true"><strong>'+esc(v.name)+'</strong><span><img src="'+esc(v.teamLogo)+'" alt="">'+esc(v.teamName||v.teamCode)+(v.gp?' · '+v.gp+' jogos':'')+'</span></div>').join('')+'</div>'+
   '<div class="comparison-stats">'+COMPARISON_FIELDS.map(f=>{
    const x=p.stats[f.key],y=q.stats[f.key],valid=x!=null&&y!=null&&Number.isFinite(Number(x))&&Number.isFinite(Number(y));
    const winner=valid&&Number(x)!==Number(y)?(f.lower?Number(x)<Number(y):Number(x)>Number(y))?0:1:-1;
    return '<div><strong class="'+(winner===0?'comparison-best':'')+'">'+esc(comparisonValue(x,f,context.mode))+'</strong><span>'+esc(f.label)+'</span><strong class="'+(winner===1?'comparison-best':'')+'">'+esc(comparisonValue(y,f,context.mode))+'</strong></div>';
   }).join('')+'</div>';
 }
 a.onchange=()=>{if(a.value!==right){left=a.value;render();}};
 b.onchange=()=>{if(b.value!==left){right=b.value;render();}};
 root.querySelector('#compareSwap').onclick=()=>{[left,right]=[right,left];render();};
 root.querySelector('#compareMakeCard').onclick=()=>openPlayerCardComposer({kind:'comparison',players:[byKey.get(left),byKey.get(right)],context,player:{name:byKey.get(left).name+' vs '+byKey.get(right).name}});
 render();a.focus();
}

export function mountPlayerActions({root,selector,resolve,onCompare,onCard,onFollow,onDetails}){
 let timer=null,start=null,menu=null,returnFocus=null,suppressUntil=0;
 const cancel=()=>{clearTimeout(timer);timer=null;start=null;};
 function close(focus=false){if(!menu)return;menu.remove();menu=null;if(focus&&returnFocus?.isConnected)returnFocus.focus();}
 function open(row,x,y){
  const p=resolve(row);if(!p)return;cancel();close();returnFocus=document.activeElement;
  menu=document.createElement('div');menu.className='dlq-player-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Opções de '+p.name);
  menu.innerHTML='<strong>'+esc(p.name)+'</strong><a role="menuitem" href="'+esc(p.profileUrl)+'">Abrir perfil ↗</a>'+
   (onDetails?'<button role="menuitem" data-action="details">Ver dados da partida</button>':'')+
   '<button role="menuitem" data-action="compare">⇄ Comparar com outro jogador</button>'+
   '<button role="menuitem" data-action="card">▣ Gerar card individual</button>'+
   (onFollow?'<button role="menuitem" data-action="follow">'+(p.followed?'♡ Deixar de seguir':'♥ Seguir jogador')+'</button>':'')+
   '<button role="menuitem" data-action="link">Copiar link do perfil</button>';
  document.body.append(menu);
  const rect=menu.getBoundingClientRect(),vw=window.innerWidth,vh=window.innerHeight;
  menu.style.left=Math.max(8,Math.min(x,vw-rect.width-8))+'px';
  menu.style.top=Math.max(8,Math.min(y,vh-rect.height-8))+'px';
  menu.addEventListener('click',async e=>{const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;close();try{
   if(action==='compare')onCompare(p);
   if(action==='card')onCard(p);
   if(action==='follow')onFollow(p);
   if(action==='details')onDetails(p);
   if(action==='link'){const url=new URL(p.profileUrl,location.href).href;if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);else{const field=document.createElement('textarea');field.value=url;document.body.append(field);field.select();let copied=false;try{copied=!!document.execCommand?.('copy');}finally{field.remove();}if(!copied)throw Error('O navegador não permitiu copiar o link.');}toast('Link do perfil copiado.');}
  }catch(error){toast(error.message);}});
  menu.querySelector('[role=menuitem]')?.focus({preventScroll:true});
 }
 function context(e){const row=e.target.closest(selector);if(!row||!root.contains(row)||e.target.closest('input,textarea,select'))return;e.preventDefault();suppressUntil=Date.now()+700;open(row,e.clientX,e.clientY);}
 function pointerDown(e){if(e.pointerType==='mouse'||e.isPrimary===false||e.button>0)return;const row=e.target.closest(selector);if(!row||e.target.closest('button,input,select,textarea'))return;cancel();start={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{suppressUntil=Date.now()+900;open(row,e.clientX,e.clientY);},550);}
 function move(e){if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10)cancel();}
 function click(e){
  if(Date.now()<suppressUntil&&e.target.closest(selector)){e.preventDefault();e.stopImmediatePropagation();return;}
  const button=e.target.closest('[data-player-options]');if(!button)return;const row=button.closest(selector);if(!row)return;e.preventDefault();e.stopImmediatePropagation();const box=button.getBoundingClientRect();open(row,box.left,box.bottom+4);
 }
 function outside(e){if(menu&&!menu.contains(e.target))close();}
 function keyboard(e){
  if(menu){const options=[...menu.querySelectorAll('[role=menuitem]')];if(e.key==='Escape'){e.preventDefault();close(true);return;}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();let i=options.indexOf(document.activeElement);i=e.key==='Home'?0:e.key==='End'?options.length-1:(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[i]?.focus();return;}}
  const row=e.target.closest?.(selector);if(row&&root.contains(row)&&(e.key==='ContextMenu'||e.shiftKey&&e.key==='F10')){e.preventDefault();const box=row.getBoundingClientRect();open(row,box.left+20,box.top+20);}
 }
 const scroll=()=>{cancel();close();};
 root.addEventListener('contextmenu',context);root.addEventListener('pointerdown',pointerDown,{passive:true});document.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerup',cancel);document.addEventListener('pointercancel',cancel);root.addEventListener('click',click,true);
 document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keyboard);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',scroll);
 return {destroy(){cancel();close();root.removeEventListener('contextmenu',context);root.removeEventListener('pointerdown',pointerDown);document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',cancel);document.removeEventListener('pointercancel',cancel);root.removeEventListener('click',click,true);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);}};
}
