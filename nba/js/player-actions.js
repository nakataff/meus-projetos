/* Shared comparison and contextual actions. Uses only loaded data and lazy round summaries. */
import {modal,esc,toast} from './app.js?v=13';
import {openPlayerCardComposer} from './share-card.js?v=20261024-comparison-options-v1';
import {COMPARISON_FIELDS,DEFAULT_CARD_FIELDS,normalizeComparisonFields,comparisonValue} from './comparison-fields.js?v=20261024-comparison-options-v1';
export function openPlayerComparison({getPlayers,context,firstKey='',secondKey='',seasonOptions=null,initialSelection=null}){
 const selection=initialSelection?{...initialSelection,rounds:[...(initialSelection.rounds||[])]}:null;
 let players=getPlayers(selection).filter(p=>p?.key&&p.name),byKey=new Map(players.map(p=>[p.key,p]));
 if(players.length<2)return toast('A comparação precisa de dois jogadores nesta fase.');
 let left=byKey.has(firstKey)?firstKey:players[0].key;
 let right=byKey.has(secondKey)&&secondKey!==left?secondKey:
  (players.find(p=>p.key!==left&&context.mode==='game'&&p.teamCode!==byKey.get(left).teamCode)||players.find(p=>p.key!==left)).key;
 let fields=[...DEFAULT_CARD_FIELDS],presentation='list',pickSide='',loading=false,scopeError=false,rosterLimit=60,iteration=0;
 const option=(value,label,selected)=>'<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';
 function currentContext(){if(!selection)return {...context};return {mode:selection.mode,title:(selection.phase==='preseason'?'Pré-temporada':'Temporada regular')+' 2026/27',subtitle:(selection.rounds.length?'Rodada'+(selection.rounds.length>1?'s ':' ')+selection.rounds.join(', '):'Todas as rodadas')+' · '+(selection.mode==='average'?'Médias por jogo':'Soma total')};}
 modal('<div class="dlq-comparison"><span class="caps">COMPARADOR DE JOGADORES</span><h2>Frente a frente</h2><p class="small subtle" id="comparisonContext"></p>'+
  (selection?'<div class="comparison-scope"><label>Fase<select id="comparisonPhase" class="control">'+option('regular','Temporada regular',selection.phase==='regular')+option('preseason','Pré-temporada',selection.phase==='preseason')+'</select></label><label>Rodada<select id="comparisonRound" class="control"></select></label><label>Calcular por<select id="comparisonMode" class="control">'+option('average','Média por jogo',selection.mode==='average')+option('total','Soma total',selection.mode==='total')+'</select></label></div><p class="small subtle comparison-round-note">Rodada N = N-ésima partida de cada atleta na fase. Quem não jogou aparece sem dados.</p>':'')+
  '<div class="comparison-selected" id="comparisonSelected"></div>'+
  '<section class="comparison-picker" id="comparisonPicker" hidden><div class="section-title"><h3 id="comparisonPickerTitle">Escolher jogador</h3><button type="button" class="btn ghost" id="comparisonPickerClose">Fechar</button></div><label class="comparison-search">Buscar por nome ou equipe<input class="control" type="search" id="comparisonSearch" placeholder="Digite o nome do jogador…" autocomplete="off"></label><p class="small subtle comparison-sort-note" id="comparisonSortNote"></p><div id="comparisonRoster"></div></section>'+
  '<details class="comparison-display-options"><summary>Personalizar estatísticas e visual</summary><div class="comparison-view-options" role="group" aria-label="Visual da comparação"><button type="button" class="btn ghost" data-comparison-view="list" aria-pressed="true">☷ Lista</button><button type="button" class="btn ghost" data-comparison-view="blocks" aria-pressed="false">▦ Blocos</button></div><div class="comparison-field-presets"><span class="small subtle">Estatísticas na tela e no card</span><button type="button" class="btn ghost" data-field-preset="essential">Essenciais</button><button type="button" class="btn ghost" data-field-preset="all">Todas</button></div><div class="comparison-field-checks">'+COMPARISON_FIELDS.map(f=>'<label><input type="checkbox" data-comparison-field="'+f.key+'"'+(fields.includes(f.key)?' checked':'')+'>'+esc(f.label)+'</label>').join('')+'</div></details>'+
  '<p class="small subtle" id="comparisonStatus" role="status"></p><button type="button" class="btn ghost comparison-retry" id="comparisonRetry" hidden>↻ Recarregar dados</button><div id="comparisonResult" aria-live="polite"></div><div class="comparison-footer"><span class="small subtle">A imagem usa este recorte e estas estatísticas. Você pode ajustar o visual antes de salvar.</span><button type="button" class="btn accent" id="compareMakeCard">▣ Gerar card da comparação</button></div></div>');
 const root=document.querySelector('.dlq-comparison'),$=s=>root.querySelector(s),picker=$('#comparisonPicker'),search=$('#comparisonSearch'),status=$('#comparisonStatus');
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
 function renderRoster(){
  const query=normalize(search.value),other=pickSide==='left'?right:left,selected=pickSide==='left'?left:right;
  const points=p=>p.stats?.pts!==null&&p.stats?.pts!==undefined&&p.stats.pts!==''&&Number.isFinite(Number(p.stats.pts))?Number(p.stats.pts):-Infinity;
  const filtered=players.filter(p=>normalize(p.name+' '+p.teamCode+' '+p.teamName).includes(query)).sort((a,b)=>points(b)-points(a)||a.name.localeCompare(b.name,'pt-BR'));
  $('#comparisonSortNote').textContent=currentContext().mode==='average'?'Maior média de pontos primeiro, dentro de cada equipe.':'Mais pontos primeiro, dentro de cada equipe.';
  const shown=filtered.slice(0,rosterLimit),teams=[...new Set(shown.map(p=>p.teamCode))].sort();
  $('#comparisonRoster').innerHTML=teams.length?teams.map(code=>{const roster=shown.filter(p=>p.teamCode===code),sample=roster[0];return '<section class="comparison-roster-team"><h4><img src="'+esc(sample.teamLogo)+'" alt="">'+esc(sample.teamName||code)+'<small>'+roster.length+'</small></h4><div>'+roster.map(p=>'<button type="button" data-compare-pick="'+esc(p.key)+'" aria-pressed="'+(p.key===selected)+'"'+(p.key===other?' disabled':'')+'><img src="'+esc(p.headshot||p.teamLogo)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true"><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.position||p.teamCode)+(p.gp!==undefined?' · '+p.gp+' jogos':'')+'</small></span><span class="comparison-roster-score"><b>'+esc(p.stats?.pts===null||p.stats?.pts===undefined?'Sem dados':comparisonValue(p.stats.pts,{key:'pts'},currentContext().mode)+(currentContext().mode==='average'?' PTS/J':' PTS'))+'</b><small aria-hidden="true">'+(p.key===other?'Em uso':p.key===selected?'✓':'＋')+'</small></span></button>').join('')+'</div></section>';}).join('')+(filtered.length>rosterLimit?'<p class="small subtle">'+shown.length+' de '+filtered.length+' jogadores. Use a busca para encontrar pelo nome.</p><button type="button" class="btn ghost" data-compare-more>Ver mais jogadores</button>':''):'<p class="filler">Nenhum jogador com esse nome nesta fase.</p>';
 }
 function openPicker(side){pickSide=side;rosterLimit=60;picker.hidden=false;$('#comparisonPickerTitle').textContent='Escolher jogador '+(side==='left'?'1':'2');search.value='';renderRoster();search.focus();}
 function renderSelection(){
  const p=byKey.get(left),q=byKey.get(right);
  $('#comparisonSelected').innerHTML=[['left',p],['right',q]].map(([side,v],i)=>'<button type="button" class="comparison-selected-player" data-compare-side="'+side+'" aria-label="Trocar jogador '+(i+1)+': '+esc(v?.name||'Escolher')+'">'+(v?'<img src="'+esc(v.headshot||v.teamLogo)+'" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true"><span><small>JOGADOR '+(i+1)+'</small><strong>'+esc(v.name)+'</strong><small><img src="'+esc(v.teamLogo)+'" alt="">'+esc(v.teamName||v.teamCode)+(v.gp!==undefined?' · '+v.gp+' jogos':'')+'</small></span>':'Escolher jogador')+'<span class="comparison-change">Trocar ⌄</span></button>').join('')+'<button type="button" class="btn ghost comparison-swap" id="compareSwap" aria-label="Inverter jogadores">⇄</button>';
 }
 function renderRounds(){if(!selection)return;const max=seasonOptions.getRoundMax(selection.phase);$('#comparisonRound').innerHTML=option('','Todas as rodadas',!selection.rounds.length)+(selection.rounds.length>1?option('custom','Rodadas '+selection.rounds.join(', '),true):'')+Array.from({length:max},(_,i)=>option(String(i+1),'Rodada '+(i+1),selection.rounds.length===1&&selection.rounds[0]===i+1)).join('');}
 function render(){
  renderSelection();if(pickSide&&!picker.hidden)renderRoster();$('#comparisonContext').textContent=[currentContext().title,currentContext().subtitle].filter(Boolean).join(' · ');
  const p=byKey.get(left),q=byKey.get(right);$('#compareMakeCard').disabled=loading||scopeError||!p||!q;
  if(scopeError){$('#comparisonResult').innerHTML='';return;}
  if(!p||!q){$('#comparisonResult').innerHTML='<div class="filler">Não há dois jogadores disponíveis nesta fase.</div>';return;}
  const mode=currentContext().mode;
  $('#comparisonResult').innerHTML=(p.gp===0||q.gp===0?'<p class="info">'+[p,q].filter(v=>v.gp===0).map(v=>esc(v.name)).join(' e ')+' sem partida no recorte selecionado.</p>':'')+
   '<div class="comparison-stats'+(presentation==='blocks'?' comparison-stat-blocks':'')+'">'+fields.map(key=>{const f=COMPARISON_FIELDS.find(f=>f.key===key),x=p.stats[key],y=q.stats[key],valid=x!=null&&y!=null&&Number.isFinite(Number(x))&&Number.isFinite(Number(y)),winner=valid&&Number(x)!==Number(y)?(f.lower?Number(x)<Number(y):Number(x)>Number(y))?0:1:-1;return '<div data-comparison-stat="'+key+'"><strong class="'+(winner===0?'comparison-best':'')+'">'+esc(comparisonValue(x,f,mode))+'</strong><span>'+esc(f.label)+'</span><strong class="'+(winner===1?'comparison-best':'')+'">'+esc(comparisonValue(y,f,mode))+'</strong></div>';}).join('')+'</div>';
 }
 async function refreshScope(){
  const token=++iteration;loading=true;scopeError=false;$('#comparisonRetry').hidden=true;status.textContent=selection?.rounds.length?'Carregando dados das rodadas…':'Atualizando seleção…';$('#compareMakeCard').disabled=true;
  try{if(selection?.rounds.length)await seasonOptions.ensureRounds();if(token!==iteration||!root.isConnected)return;
   players=getPlayers(selection).filter(p=>p?.key&&p.name);byKey=new Map(players.map(p=>[p.key,p]));
   if(!byKey.has(left))left=players[0]?.key||'';if(!byKey.has(right)||right===left)right=players.find(p=>p.key!==left)?.key||'';
   status.textContent='';loading=false;renderRounds();render();if(pickSide)renderRoster();
  }catch(error){if(token===iteration&&root.isConnected){loading=false;scopeError=true;$('#comparisonRetry').hidden=false;status.textContent=error.message+' Use Recarregar dados para tentar novamente.';$('#comparisonResult').innerHTML='';}}
 }
 root.addEventListener('click',e=>{if(e.target.closest('#comparisonRetry')){refreshScope();return;}if(e.target.closest('[data-compare-more]')){rosterLimit+=60;renderRoster();return;}const side=e.target.closest('[data-compare-side]');if(side){openPicker(side.dataset.compareSide);return;}const pick=e.target.closest('[data-compare-pick]');if(pick&&!pick.disabled){if(pick.dataset.comparePick===(pickSide==='left'?right:left))return;if(pickSide==='left')left=pick.dataset.comparePick;else right=pick.dataset.comparePick;picker.hidden=true;pickSide='';render();return;}if(e.target.closest('#comparisonPickerClose')){picker.hidden=true;pickSide='';return;}if(e.target.closest('#compareSwap')){[left,right]=[right,left];render();return;}
  const view=e.target.closest('[data-comparison-view]');if(view){presentation=view.dataset.comparisonView;root.querySelectorAll('[data-comparison-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===view)));render();}
  const preset=e.target.closest('[data-field-preset]');if(preset){fields=preset.dataset.fieldPreset==='all'?COMPARISON_FIELDS.map(f=>f.key):[...DEFAULT_CARD_FIELDS];root.querySelectorAll('[data-comparison-field]').forEach(c=>c.checked=fields.includes(c.dataset.comparisonField));render();}
 });
 root.addEventListener('change',e=>{const field=e.target.closest('[data-comparison-field]');if(field){const chosen=[...root.querySelectorAll('[data-comparison-field]:checked')].map(c=>c.dataset.comparisonField);if(!chosen.length){field.checked=true;status.textContent='Escolha pelo menos uma estatística.';return;}fields=normalizeComparisonFields(chosen);status.textContent='';render();return;}
  if(!selection)return;
  if(e.target.id==='comparisonPhase'){selection.phase=e.target.value;selection.rounds=[];refreshScope();}
  if(e.target.id==='comparisonRound'){selection.rounds=e.target.value==='custom'?selection.rounds:e.target.value?[Number(e.target.value)]:[];refreshScope();}
  if(e.target.id==='comparisonMode'){selection.mode=e.target.value;refreshScope();}
 });
 search.addEventListener('input',()=>{rosterLimit=60;renderRoster();});
 $('#compareMakeCard').onclick=()=>{const p=byKey.get(left),q=byKey.get(right);if(loading||scopeError||!p||!q)return;openPlayerCardComposer({kind:'comparison',players:[p,q],context:currentContext(),selectedFields:[...fields],presentation,player:{name:p.name+' vs '+q.name}});};
 renderRounds();render();
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
