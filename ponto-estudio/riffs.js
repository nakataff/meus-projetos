/* Ponto Estúdio — original procedural riffs. Seeded rhythm grammar, constrained melodic states. */
(function(){
'use strict';
const MODES={
 chromatic:{label:'Cromático · 2 notas',intervals:[0,1],weight:[5,4],jump:1},
 dark:{label:'Sombrio · Frígio',intervals:[0,1,3,5],weight:[6,4,3,1],jump:3},
 bounce:{label:'Ritmado · 3 notas',intervals:[0,2,3],weight:[5,3,4],jump:3},
 minor:{label:'Melódico · Menor',intervals:[0,3,5,7],weight:[6,3,3,2],jump:5},
 tense:{label:'Tenso · Trítono',intervals:[0,1,6],weight:[6,4,1],jump:6},
 fifth:{label:'Marcante · Quinta',intervals:[0,2,7],weight:[6,3,2],jump:7}
};
const TEMPLATES={
 sparse:[[0,4,8,12],[0,3,8,14],[0,6,10,14],[0,4,10,13],[0,5,8,12,14],[0,3,7,11,14]],
 normal:[[0,3,6,8,12,14],[0,4,7,10,12,15],[0,2,6,9,12,14],[0,3,5,8,11,14],[0,2,4,8,10,13,15],[0,3,6,9,11,14,15],[0,4,6,8,11,13,15]],
 dense:[[0,2,3,5,8,10,12,14],[0,1,4,6,8,9,12,14],[0,2,4,6,8,10,13,15],[0,3,4,6,8,11,12,14,15],[0,2,5,6,8,10,11,13,15],[0,1,3,5,7,8,10,12,14,15]]
};
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}}
function choose(r,a){return a[Math.floor(r()*a.length)]}
function weighted(r,weights){let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){x-=weights[i];if(x<0)return i}return weights.length-1}
function shape(r,density,variant){let arr=choose(r,TEMPLATES[density]).slice();if(variant&&r()<.55){let i=1+Math.floor(r()*(arr.length-2)),shift=r()<.5?-1:1;arr[i]=Math.max(arr[i-1]+1,Math.min(arr[i+1]-1,arr[i]+shift))}return arr}
function makeRiff(seed,opt){
 const r=rng(seed),mode=MODES[opt.mode],root=opt.root,bars=opt.bars,variation=opt.variation/100;
 const motif=[];let prev=0,repeat=0;
 for(let bar=0;bar<Math.min(2,bars);bar++){
  const on=shape(r,opt.density,true);
  for(let i=0;i<on.length;i++){
   const s=on[i],gap=(on[i+1]??16)-s,last=bar===Math.min(2,bars)-1&&i===on.length-1;
   let weights=mode.intervals.map((n,j)=>{
    let diff=Math.abs(n-mode.intervals[prev]);return diff>mode.jump?0:mode.weight[j]*(j===prev?(repeat>=2?.25:1.25):1.5)*(s%4===0&&j===0?1.4:1)
   });
   let idx=last?0:weighted(r,weights);
   if(bar===0&&i===0&&r()<.65)idx=mode.intervals.length>1?1:0;
   repeat=idx===prev?repeat+1:0;prev=idx;
   let max=Math.max(1,gap-(r()<.75?1:0)),l=last?Math.max(1,gap-(r()<.4?1:0)):r()<.46?max:1+Math.floor(r()*max);
   let v=Math.round(76+(s%4===0?11:0)+r()*10);
   motif.push({s:bar*16+s,l,k:root+mode.intervals[idx],v});
  }
 }
 let notes=[],period=Math.min(2,bars)*16;
 for(let off=0;off<bars*16;off+=period){
  let cycle=off/period,part=motif.map(n=>({...n,s:n.s+off}));
  if(cycle>0&&variation>0){
   for(let i=0;i<part.length;i++){
    let n=part[i],end=Math.min(bars*16,off+period),next=part[i+1]?.s??end;
    if(n.s>=end)continue;
    if(i>0&&i<part.length-1&&r()<variation*.32){let lo=part[i-1].s+part[i-1].l,hi=next-n.l;n.s=Math.max(lo,Math.min(hi,n.s+(r()<.5?-1:1)))}
    if(i>0&&i<part.length-1&&r()<variation*.5){let candidates=mode.intervals.filter(x=>Math.abs(root+x-part[i-1].k)<=mode.jump&&Math.abs(root+x-part[i+1].k)<=mode.jump);if(candidates.length)n.k=root+choose(r,candidates)}
    if(r()<variation*.35)n.l=Math.max(1,Math.min(next-n.s,n.l+(r()<.5?-1:1)));
   }
  }
  notes.push(...part.filter(n=>n.s<bars*16).map(n=>({...n,l:Math.min(n.l,bars*16-n.s)})));
 }
 // Always resolve the final onset to the root; preserve safe range and monophony.
 if(notes.length)notes[notes.length-1].k=root;
 return notes;
}
function signature(ns){return ns.map(n=>[n.s,n.l,n.k].join(':')).join('|')}
function batch(seed,opt){let a=[],seen=new Set();for(let i=0;i<96&&a.length<8;i++){let id=(seed+Math.imul(i+1,2654435761))>>>0,ns=makeRiff(id,opt),sig=signature(ns);if(seen.has(sig))continue;seen.add(sig);a.push({seed:id,notes:ns})}return a}
const dlg=document.createElement('dialog');dlg.id='riffStudioDialog';dlg.style.cssText='width:min(900px,94vw);max-height:88vh;overflow:auto';
dlg.innerHTML='<div class="dialogHeader"><div><div class="eyebrow">GERADOR PROCEDURAL · PONTINHOS</div><h2>Riffs ritmados</h2></div><button id="riffClose">✕ Fechar</button></div><p style="margin:0 0 12px;color:#aebbc7">Motivos originais com poucas notas, síncopes, pausas e variações controladas. Use o BPM atual da playlist.</p><div class="riffSettings"><label>Estilo<select id="riffMode"></select></label><label>Instrumento<select id="riffInst"></select></label><label>Nota central<select id="riffRoot"></select></label><label>Compassos<select id="riffBars"><option>1</option><option>2</option><option selected>4</option><option>8</option><option>16</option></select></label><label>Densidade<select id="riffDensity"><option value="sparse">Espaçado</option><option value="normal" selected>Equilibrado</option><option value="dense">Acelerado</option></select></label><label>Variação <span id="riffVarText">35%</span><input id="riffVar" type="range" min="0" max="100" value="35"></label><label>Semente<input id="riffSeed" type="number" min="0" max="4294967295" step="1" value="1"></label><div class="toolbar"><button id="riffGenerate" class="primary">Gerar 8 novos</button><button id="riffRegenerate">Usar semente</button></div></div><div id="riffResults" class="riffResults"></div><div class="riffFooter"><label>Inserir em <select id="riffDestination"><option value="new">Nova faixa</option><option value="active">Faixa selecionada (substituir trecho)</option></select></label><label>Posição <select id="riffPosition"><option value="start">Início do arranjo</option><option value="cursor">Compasso da agulha</option></select></label><button id="riffStop">■ Parar</button><span id="riffStatus" role="status"></span></div><small style="color:#95a3b1">O instrumento pode ser trocado depois na própria faixa; todas as notas ficam editáveis.</small>';
document.body.append(dlg);
const css=document.createElement('style');css.textContent='.riffSettings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px;background:#28313a;border:1px solid #3f4a56;border-radius:7px}.riffSettings label{display:grid;gap:4px;color:#aab6c2;font-size:11px}.riffSettings input,.riffSettings select{width:100%;min-width:0}.riffSettings .toolbar{align-self:end}.riffResults{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.riffCard{padding:10px;background:#242d35;border:1px solid #3f4a56;border-radius:6px;min-width:0}.riffCard strong{font-size:13px}.riffCard small{color:#a7b5c2}.riffCard canvas{display:block;width:100%;height:72px;margin:8px 0;background:#171e24;border-radius:4px}.riffFooter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid #3f4a56;padding:10px 0;font-size:11px}.riffFooter label{display:flex;gap:5px;align-items:center}#riffStatus{color:#b5ee6b}.riffLaunch{border-color:#789957!important;color:#c7f3a0!important}@media(max-width:760px){.riffSettings{grid-template-columns:repeat(2,minmax(0,1fr))}.riffResults{grid-template-columns:1fr}}';document.head.append(css);
const el=id=>document.getElementById(id),option=(id,value,label)=>{let o=document.createElement('option');o.value=value;o.textContent=label;el(id).append(o)};
Object.entries(MODES).forEach(([k,m])=>option('riffMode',k,m.label));
for(let k=48;k<=84;k++)option('riffRoot',k,name(k));el('riffRoot').value=62;
let items=[],generatedOpt=null,previewToken=0;
const say=s=>el('riffStatus').textContent=s;
function settings(){return {mode:el('riffMode').value,root:+el('riffRoot').value,bars:+el('riffBars').value,density:el('riffDensity').value,variation:+el('riffVar').value}}
function halt(){previewToken++;stopAudition()}
function newSeed(){let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]}
function generate(randomize){halt();if(randomize)el('riffSeed').value=newSeed();let seed=Math.max(0,Math.min(4294967295,Math.floor(Number(el('riffSeed').value)||0)))>>>0;el('riffSeed').value=seed;generatedOpt=settings();items=batch(seed,generatedOpt);draw();say(items.length+' riffs gerados · '+p.bpm+' BPM')}
function draw(){const box=el('riffResults');box.replaceChildren();items.forEach((item,i)=>{
 let card=document.createElement('div');card.className='riffCard';let head=document.createElement('div');head.className='row';let t=document.createElement('strong');t.textContent='Riff '+String(i+1).padStart(2,'0');let info=document.createElement('small');info.textContent=item.notes.length+' notas · '+new Set(item.notes.map(n=>n.k)).size+' alturas';head.append(t,info);
 let canvas=document.createElement('canvas');canvas.width=640;canvas.height=96;let g=canvas.getContext('2d'),w=640,h=96,steps=generatedOpt.bars*16,lo=Math.min(...item.notes.map(n=>n.k)),hi=Math.max(...item.notes.map(n=>n.k));for(let j=0;j<=steps;j+=4){g.fillStyle=j%16===0?'#647783':'#35434c';g.fillRect(j/steps*w,0,1,h)}for(let n of item.notes){g.fillStyle=n.k===generatedOpt.root?'#a7d977':'#e5ae79';let y=hi===lo?40:8+(hi-n.k)/(hi-lo)*65;g.fillRect(n.s/steps*w+1,y,Math.max(2,n.l/steps*w-2),12)}
 let tools=document.createElement('div');tools.className='toolbar';let listen=uiButton('▶ Ouvir',()=>hear(item)),insert=uiButton('＋ Usar riff',()=>insertRiff(item));insert.className='primary';tools.append(listen,insert);card.append(head,canvas,tools);box.append(card);
})}
async function hear(item){halt();let ticket=previewToken,inst=el('riffInst').value,bpm=p.bpm;try{stopLive();stop();stopPreview();let ac=audio();await ac.resume();let sounds=await getSounds(inst);if(ticket!==previewToken||!dlg.open)return;let y=render(item.notes,sounds,generatedOpt.bars*240/bpm,bpm);auditionNode=node(y,false);auditionNode.start();say('Ouvindo · '+instName(inst)+' · '+bpm+' BPM')}catch(e){say('Falha ao ouvir: '+e.message)}}
function insertRiff(item){let inst=el('riffInst').value,opt=generatedOpt,at=el('riffPosition').value==='cursor'?Math.min(127,Math.floor(cursor/16))*16:0,end=at+opt.bars*16;if(end>2048){say('O riff ultrapassa 128 compassos. Escolha outra posição.');return}let target=el('riffDestination').value==='active'?tracks().find(t=>t.id===activeTrack&&t.kind==='notes'):null;if(el('riffDestination').value==='active'&&!target){say('Selecione uma faixa de instrumento na playlist.');return}if(target&&target.notes.some(n=>n.s<end&&n.s+n.l>at)&&!confirm('Substituir as notas nesse trecho da faixa?'))return;if(target&&target.inst!==inst&&!confirm('Trocar o instrumento de toda a faixa selecionada?'))return;if(!target&&tracks().length>=128){say('Limite de 128 faixas.');return}halt();editStudio(()=>{studio().bars=Math.max(studio().bars,Math.ceil(end/16));let ns=item.notes.map(n=>({...n,s:n.s+at,id:uid()}));if(target){target.inst=inst;let kept=[];for(let n of target.notes){if(n.s+n.l<=at||n.s>=end)kept.push(n);else{if(n.s<at)kept.push({...n,l:at-n.s});if(n.s+n.l>end)kept.push({...n,id:uid(),s:end,l:n.s+n.l-end})}}target.notes=[...kept,...ns].sort((a,b)=>a.s-b.s)}else{target=track(inst);target.label=instName(inst)+' · Riff';target.notes=ns;tracks().push(target)}activeTrack=target.id;selection.clear();for(let n of ns)selection.add(n.id);view=Math.floor(at/16);cursor=at});dlg.close();status('Riff inserido · '+opt.bars+' compassos · '+instName(inst))}
function open(){let inst=el('riffInst'),old=inst.value,t=tracks().find(t=>t.id===activeTrack&&t.kind==='notes');inst.replaceChildren();for(let k of [...new Set([...allInst(),custom])])option('riffInst',k,instName(k));inst.value=old&&[...inst.options].some(o=>o.value===old)?old:t?.inst??allInst()[0];el('riffPosition').value='start';dlg.showModal();if(!items.length)generate(true);else draw()}
el('riffClose').onclick=()=>dlg.close();dlg.addEventListener('close',halt);el('riffStop').onclick=()=>{halt();say('Prévia parada.')};el('riffGenerate').onclick=()=>generate(true);el('riffRegenerate').onclick=()=>generate(false);el('riffVar').oninput=()=>el('riffVarText').textContent=el('riffVar').value+'%';for(let id of ['riffMode','riffRoot','riffBars','riffDensity','riffVar'])el(id).addEventListener('change',()=>generate(false));el('riffInst').onchange=()=>{halt();say('Instrumento trocado. Ouça a mesma frase.')};
window.addEventListener('keydown',e=>{if(dlg.open)e.stopPropagation()},true);
let launch=uiButton('✦ Riffs ritmados',open);launch.className='riffLaunch';S('openGenerator').before(launch);
})();
