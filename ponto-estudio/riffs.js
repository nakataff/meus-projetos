/* Ponto Estúdio — original procedural riffs. Seeded rhythm grammar, constrained melodic states. */
(function(){
'use strict';
const MODES={
 major:{label:'Harmônico · Maior',scale:[0,2,4,5,7,9,11],progressions:[[0,3,4,0],[0,5,4,0],[0,3,0,0]],contours:[[0,1,2,1],[0,2,1,0],[0,1,2,3]],kind:'tonal'},
 minor:{label:'Harmônico · Menor',scale:[0,2,3,5,7,8,10],progressions:[[0,5,3,0],[0,3,4,0],[0,5,4,0]],contours:[[0,1,2,1],[0,2,1,0],[0,-1,0,2]],kind:'tonal'},
 dark:{label:'Sombrio · Frígio',scale:[0,1,3,5,7,8,10],progressions:[[0,1,0,0],[0,3,1,0]],contours:[[0,1,0,-1],[0,2,1,0],[0,1,2,1]],kind:'tonal'},
 bounce:{label:'Ritmado · Menor',scale:[0,2,3,5,7,8,10],progressions:[[0,0,3,0],[0,5,4,0]],contours:[[0,2,1,0],[0,1,0,2],[0,0,2,1]],kind:'tonal'},
 fifth:{label:'Marcante · Quinta',scale:[0,2,4,5,7,9,11],progressions:[[0,3,4,0],[0,4,3,0]],contours:[[0,2,4,2],[0,4,3,2],[0,2,1,0]],kind:'tonal'},
 tense:{label:'Tensão e resolução · Menor harmônica',scale:[0,2,3,5,7,8,11],progressions:[[0,3,4,0],[0,5,4,0]],contours:[[0,1,2,1],[0,2,3,2],[0,-1,0,2]],kind:'tonal'},
 chromatic:{label:'Cromático · 2 notas',scale:[0,1],kind:'neighbor'}
};
const TEMPLATES={
 sparse:[[0,4,12],[0,6,12],[0,8,12],[0,4,8,12],[0,3,8,12],[0,6,10,12]],
 normal:[[0,3,6,8,12],[0,4,7,8,12],[0,2,4,8,12],[0,4,8,10,12],[0,3,8,11,12],[0,4,6,10,12]],
 dense:[[0,2,4,6,8,10,12],[0,3,4,6,8,11,12],[0,2,4,7,8,10,12],[0,3,5,8,10,11,12],[0,2,5,6,8,10,12],[0,2,4,6,8,12,14]]
};
// Quarter-note kick grid: 0,4,8,12; one step is a sixteenth.
const GROOVES={
 original:{label:'Original · livre',desc:'Mantém o gerador harmônico anterior, com síncopes livres.'},
 onbeat:{label:'No tempo · on-beat',desc:'Acentos principais junto do kick; subdivisões mais leves.',patterns:{
 sparse:[[0,4,8],[0,4,12],[0,8,12],[4,8,12],[0,4,8,12],[0,2,8],[0,4,10]],
 normal:[[0,4,8,12],[0,2,4,8,12],[0,4,8,10,12],[0,4,6,8,12],[0,4,8,12,14],[0,1,4,8,12],[0,4,7,8,12],[0,4,8,11,12]],
 dense:[[0,2,4,6,8,10,12,14],[0,1,4,6,8,10,12,14],[0,2,4,7,8,10,12,14],[0,2,4,6,8,9,12,14],[0,2,4,6,8,10,12,15],[0,3,4,6,8,11,12,14]]}},
 offbeat:{label:'Contratempo · offbeat',desc:'Acentos entre os kicks, deixando os ataques do beat livres.',patterns:{
 sparse:[[2,6,14],[2,10,14],[2,6,10],[6,10,14],[2,6,10,14],[2,3,10],[2,10,11],[6,10,11]],
 normal:[[2,6,10,14],[2,3,6,10,14],[2,6,7,10,14],[2,6,10,11,14],[2,6,10,14,15],[1,2,6,10,14],[2,5,6,10,14],[2,6,9,10,14]],
 dense:[[2,3,6,7,10,11,14,15],[1,2,5,6,9,10,13,14],[2,3,5,6,10,11,14,15],[1,2,6,7,9,10,14,15],[2,3,6,7,9,10,13,14],[1,2,6,7,10,11,13,14],[2,3,5,6,9,10,13,14]]}},
 after:{label:'Depois do kick · 1/16',desc:'Acentos uma semicolcheia depois da batida; espaço antes do próximo kick.',patterns:{
 sparse:[[1,5,13],[1,9,13],[1,5,9],[5,9,13],[1,5,9,13],[1,2,9],[1,9,10],[5,9,10]],
 normal:[[1,5,9,13],[1,3,5,9,13],[1,5,7,9,13],[1,5,9,11,13],[1,5,9,13,15],[1,2,5,9,13],[1,5,6,9,13],[1,5,9,10,13]],
 dense:[[1,3,5,7,9,11,13,15],[1,2,5,6,9,10,13,14],[1,3,5,6,9,11,13,14],[1,2,5,7,9,10,13,15],[1,3,5,7,9,10,13,14],[1,2,5,6,9,11,13,15]]}},
 alternate:{label:'Alternado · tempo / contratempo',desc:'Alterna ataques junto ao kick e entre kicks em tempos sucessivos.',patterns:{
 sparse:[[0,6,8],[0,6,14],[2,4,10],[2,10,12],[0,6,8,14],[2,4,10,12]],
 normal:[[0,6,8,14],[2,4,10,12],[0,3,6,8,14],[2,4,7,10,12],[0,6,8,11,14],[2,4,10,12,15]],
 dense:[[0,2,6,7,8,10,14,15],[2,3,4,6,10,11,12,14],[0,1,6,7,8,9,14,15],[1,2,4,5,9,10,12,13],[0,3,5,6,8,11,13,14],[1,2,4,7,9,10,12,15]]}},
 pickup:{label:'Anacruse · resolução no kick',desc:'Notas curtas e leves antes da batida, seguidas de uma nota forte no kick. O kick guia destaca as chegadas do motivo.',patterns:{
 sparse:[[2,4,10,12],[3,4,11,12],[1,4,9,12],[2,4,6,8],[5,8,10,12],[6,8,11,12],[1,4,11,12],[3,4,9,12],[2,4,9,10,12]],
 normal:[[1,3,4,9,11,12],[2,3,4,10,11,12],[1,2,4,9,10,12],[1,2,3,4,10,12],[2,4,9,10,11,12],[5,6,8,9,11,12],[5,7,8,10,11,12],[1,3,4,5,7,8],[1,3,4,7,8,11,12]],
 dense:[[1,2,3,4,9,10,11,12],[1,2,3,4,6,7,8,10,11,12],[2,3,4,5,6,7,8,10,11,12],[1,2,4,5,6,7,8,9,10,11,12],[1,2,3,4,5,7,8,9,11,12],[2,3,4,5,7,8,9,10,11,12],[1,3,4,5,6,7,8,10,11,12],[1,2,3,4,5,6,8,9,10,11,12]]}},
 behind:{label:'Levemente atrasado · behind the beat',desc:'Mesmo motivo livre, atrasado 18% de uma semicolcheia (cerca de 21 ms a 130 BPM).'}
};
function grooveRhythm(on,gate,closing,groove){
 if(!groove||groove==='original')return rhythmFor(on,gate,closing);
 if(groove==='pickup')return on.map((s,i)=>{
  let gap=(on[i+1]??16)-s,strong=s%4===0;
  // Accent hierarchy: preparations are short and get louder toward the landing.
  let v=strong?(i===on.length-1?100:96):62+(s%4)*6;
  let l=strong?Math.max(1,Math.min(gap,i===on.length-1&&closing?gap:Math.max(2,Math.round(gap*gate)))):Math.min(gap,1);
  return {s,l,v};
 });
 if(groove==='behind')return rhythmFor(on,gate,closing).map(n=>({...n,s:n.s+.18,l:Math.min(n.l,16-n.s-.18)}));
 let a=on.slice(),space=groove==='offbeat'||groove==='after',phase=a[0]%4===2||a[0]%4===1&&groove==='alternate'?1:0;
 return a.map((s,i)=>{
  let gap=(a[i+1]??16)-s,accent=groove==='offbeat'?s%4===2:groove==='after'?s%4===1:groove==='alternate'?s%4===((Math.floor(s/4)+phase)%2?2:0):s%4===0;
  let cap=space?Math.min(gap,4-s%4):gap;
  let l=i===a.length-1&&closing?cap:Math.max(1,Math.min(cap,Math.round(cap*gate)));
  return {s,l,v:accent?(i===0?94:90):77};
 });
}
function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}}
function choose(r,a){return a[Math.floor(r()*a.length)]}
const mod=(a,b)=>((a%b)+b)%b;
const tone=(scale,d)=>scale[mod(d,7)]+12*Math.floor(d/7);
function shapeAt(shape,i,n){let x=i*(shape.length-1)/Math.max(1,n-1),j=Math.floor(x);return shape[j]+(shape[Math.min(j+1,shape.length-1)]-shape[j])*(x-j)}
function chordTone(d,chord){return [0,2,4].includes(mod(d-chord,7))}
function rhythmFor(on,gate,closing){let a=on.slice();if(closing&&a.at(-1)>12)a.pop();return a.map((s,i)=>{let gap=(a[i+1]??16)-s;let l=i===a.length-1&&closing?gap:Math.max(1,Math.round(gap*gate));return {s,l,v:s%8===0?94:s%4===0?88:80}})}
function tonalBar(mode,shape,rhythm,chord,prev,opening,closing,answer,groove){
 const scale=mode.scale,deg=Array.from({length:11},(_,i)=>i-4),N=rhythm.length;
 // Dynamic programming: minimum cumulative cost of melodic contour, harmonic stability and voice leading.
 let layers=[];
 for(let i=0;i<N;i++){
  let n=rhythm[i],strong=groove&&groove!=='original'?n.v>=88||n.l>=4:n.s%4===0||n.l>=4,desired=shapeAt(shape,i,N);
  if(answer)desired=shapeAt(shape,N-1-i,N)*.65;
  let c=chord;
  if(closing&&n.s>=8)c=0;
  let local=deg.map(d=>{
   if(opening&&i===0&&d!==0&&groove!=='pickup')return Infinity;
   if(groove==='pickup'&&strong&&!chordTone(d,c)&&!(closing&&i===N-1))return Infinity;
   if(closing&&i===N-1&&d!==0)return Infinity;
   let cost=1.8*(d-desired)**2+(chordTone(d,c)?0:strong?11:2.5);
   if(closing&&i===N-2)cost+=Math.min(Math.abs(d-1),Math.abs(d+1))*3;
   if(i===0&&c!==0&&!chordTone(d,c))cost+=9;
   return cost;
  });
  let current=deg.map((d,j)=>{
   if(!Number.isFinite(local[j]))return {cost:Infinity,from:-1};
   let best={cost:Infinity,from:-1};
   if(i===0){let dist=prev===null?0:Math.abs(tone(scale,d)-tone(scale,prev));return {cost:local[j]+dist*.65+Math.max(0,dist-5)**2*4,from:-1}}
   for(let k=0;k<deg.length;k++){
    let distance=Math.abs(tone(scale,d)-tone(scale,deg[k])),direction=d-deg[k],wanted=shapeAt(shape,i,N)-shapeAt(shape,i-1,N);
    if(answer)wanted=-wanted;
    let transition=distance*.42+Math.max(0,distance-4)**2*2+(distance===0&&Math.abs(wanted)>.3?1.2:0)+(direction*wanted<0?1.5:0);
    if(!strong&&!chordTone(d,c)&&Math.abs(direction)>1)transition+=4;
    if(groove==='pickup'&&strong&&rhythm[i-1].v<88){transition+=Math.abs(direction)===1?-3:direction===0?3:Math.abs(direction)>2?6:0}
    let cost=layers[i-1][k].cost+transition+local[j];if(cost<best.cost)best={cost,from:k};
   }return best;
  });layers.push(current);
 }
 let idx=layers.at(-1).reduce((best,x,i,a)=>x.cost<a[best].cost?i:best,0),result=[];
 for(let i=N-1;i>=0;i--){result[i]=deg[idx];idx=layers[i][idx].from}
 return result;
}
function makeRiff(seed,opt){
 const r=rng(seed),mode=MODES[opt.mode],root=opt.root,bars=opt.bars,variation=opt.variation/100;
 const groove=opt.groove||'original',on=choose(r,(GROOVES[groove]?.patterns||TEMPLATES)[opt.density]),gate=choose(r,groove==='original'?[.72,.85,1]:[.48,.6,.72,.85,1]),phraseLen=Math.min(4,bars),shape=mode.contours?choose(r,mode.contours):null,progression=mode.progressions?choose(r,mode.progressions):null;
 const base=[];let previous=null;
 for(let bar=0;bar<phraseLen;bar++){
  let closing=bar===phraseLen-1,opening=bar===0,answer=bar===2&&phraseLen===4;
  let rhythm=grooveRhythm(on,closing?Math.max(.55,gate-variation*.22):gate,closing,groove);
  if(mode.kind==='neighbor'){
   // A repeated tonic–neighbor–tonic cell, with the dissonant note resolving immediately.
   const pattern=choose(r,[[0,1,0,0],[0,0,1,0],[0,1,0,1],[0,0,1,1]]);if(bar===0)previous=pattern;
   let pat=previous,heights=rhythm.map((n,i)=>groove==='pickup'?(n.v>=88?0:rhythm[i+1]?.v>=88?1:0):i===0||i===rhythm.length-1?0:pat[i%pat.length]);for(let i=1;i<heights.length;i++)if(heights[i-1]===1)heights[i]=0;if(!heights.includes(1)&&heights.length>2)heights[1]=1;for(let i=0;i<rhythm.length;i++){let n=rhythm[i];base.push({...n,s:bar*16+n.s,k:root+heights[i]})}
  }else{
   let chord=phraseLen===1?0:phraseLen===2?(bar===0?0:4):progression[bar];if(closing&&phraseLen>=4)chord=0;
   let degrees=tonalBar(mode,shape,rhythm,chord,previous,opening,closing,answer,groove);previous=degrees.at(-1);
   rhythm.forEach((n,i)=>base.push({...n,s:bar*16+n.s,k:root+tone(mode.scale,degrees[i])}));
  }
 }
 let result=[],period=phraseLen*16;
 for(let off=0;off<bars*16;off+=period){let cycle=off/period;for(let n of base){let at=n.s+off;if(at>=bars*16)break;let l=n.l;
   // Alter articulation of the answer only, never scatter new random pitches.
   if(cycle>0&&variation>0&&n.s>=period-16&&n.s%4!==0&&r()<variation*.65)l=Math.max(1,l-1);
   result.push({...n,s:at,l:Math.min(l,bars*16-at)});
 }}
 return result;
}
function signature(ns){return ns.map(n=>[n.s,n.l,n.k].join(':')).join('|')}
function batch(seed,opt){let a=[],seen=new Set();for(let i=0;i<192&&a.length<8;i++){let id=(seed+Math.imul(i+1,2654435761))>>>0,ns=makeRiff(id,opt),sig=signature(ns);if(seen.has(sig))continue;seen.add(sig);a.push({seed:id,notes:ns})}return a}
const dlg=document.createElement('dialog');dlg.id='riffStudioDialog';dlg.style.cssText='width:min(900px,94vw);max-height:88vh;overflow:auto';
dlg.innerHTML='<div class="dialogHeader"><div><div class="eyebrow">GERADOR HARMÔNICO · MOTIVOS</div><h2>Riffs ritmados</h2></div><button id="riffClose">✕ Fechar</button></div><p style="margin:0 0 12px;color:#aebbc7">Frases com motivo rítmico, acordes implícitos e resolução na tônica. A variação altera principalmente a articulação da resposta. Use o BPM atual da playlist.</p><div class="riffSettings"><label>Estilo<select id="riffMode"></select></label><label>Instrumento<select id="riffInst"></select></label><label>Encaixe rítmico<select id="riffGroove"></select></label><label>Nota central<select id="riffRoot"></select></label><label>Compassos<select id="riffBars"><option>1</option><option>2</option><option selected>4</option><option>8</option><option>16</option></select></label><label>Densidade<select id="riffDensity"><option value="sparse">Espaçado</option><option value="normal" selected>Equilibrado</option><option value="dense">Acelerado</option></select></label><label>Variação da resposta <span id="riffVarText">35%</span><input id="riffVar" type="range" min="0" max="100" value="35"></label><label>Semente<input id="riffSeed" type="number" min="0" max="4294967295" step="1" value="1"></label><div class="toolbar"><button id="riffGenerate" class="primary">Gerar 8 novos</button><button id="riffRegenerate">Usar semente</button></div></div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0;color:#aab6c2;font-size:12px"><span id="riffGrooveHint" style="flex:1"></span><label class="check"><input type="checkbox" id="riffKickGuide"> Ouvir com kick guia</label></div><div id="riffResults" class="riffResults"></div><div class="riffFooter"><label>Inserir em <select id="riffDestination"><option value="new">Nova faixa</option><option value="active">Faixa selecionada (substituir trecho)</option></select></label><label>Posição <select id="riffPosition"><option value="start">Início do arranjo</option><option value="cursor">Compasso da agulha</option></select></label><button id="riffStop">■ Parar</button><span id="riffStatus" role="status"></span></div><small style="color:#95a3b1">O instrumento pode ser trocado depois na própria faixa; todas as notas ficam editáveis.</small>';
document.body.append(dlg);
const css=document.createElement('style');css.textContent='.riffSettings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px;background:#28313a;border:1px solid #3f4a56;border-radius:7px}.riffSettings label{display:grid;gap:4px;color:#aab6c2;font-size:11px}.riffSettings input,.riffSettings select{width:100%;min-width:0}.riffSettings .toolbar{align-self:end}.riffResults{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.riffCard{padding:10px;background:#242d35;border:1px solid #3f4a56;border-radius:6px;min-width:0}.riffCard strong{font-size:13px}.riffCard small{color:#a7b5c2}.riffCard canvas{display:block;width:100%;height:72px;margin:8px 0;background:#171e24;border-radius:4px}.riffFooter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid #3f4a56;padding:10px 0;font-size:11px}.riffFooter label{display:flex;gap:5px;align-items:center}#riffStatus{color:#b5ee6b}.riffLaunch{border-color:#789957!important;color:#c7f3a0!important}@media(max-width:760px){.riffSettings{grid-template-columns:repeat(2,minmax(0,1fr))}.riffResults{grid-template-columns:1fr}}';document.head.append(css);
const el=id=>document.getElementById(id),option=(id,value,label)=>{let o=document.createElement('option');o.value=value;o.textContent=label;el(id).append(o)};
Object.entries(MODES).forEach(([k,m])=>option('riffMode',k,m.label));Object.entries(GROOVES).forEach(([k,m])=>option('riffGroove',k,m.label));el('riffGroove').value='original';
for(let k=48;k<=84;k++)option('riffRoot',k,name(k));el('riffRoot').value=62;
let items=[],generatedOpt=null,previewToken=0;
const say=s=>el('riffStatus').textContent=s;
function settings(){return {mode:el('riffMode').value,root:+el('riffRoot').value,bars:+el('riffBars').value,density:el('riffDensity').value,variation:+el('riffVar').value,groove:el('riffGroove').value}}
function halt(){previewToken++;stopAudition()}
function newSeed(){let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]}
function generate(randomize){halt();if(randomize)el('riffSeed').value=newSeed();let seed=Math.max(0,Math.min(4294967295,Math.floor(Number(el('riffSeed').value)||0)))>>>0;el('riffSeed').value=seed;generatedOpt=settings();el('riffGrooveHint').textContent=GROOVES[generatedOpt.groove].desc+(generatedOpt.groove==='pickup'?' O kick guia toca nas notas de resolução; não entra no arranjo.':' O kick guia marca os quatro tempos; não entra no arranjo.');items=batch(seed,generatedOpt);draw();say(items.length+' riffs gerados · '+p.bpm+' BPM')}
function draw(){const box=el('riffResults');box.replaceChildren();items.forEach((item,i)=>{
 let card=document.createElement('div');card.className='riffCard';let head=document.createElement('div');head.className='row';let t=document.createElement('strong');t.textContent='Riff '+String(i+1).padStart(2,'0');let info=document.createElement('small');info.textContent=item.notes.length+' notas · '+new Set(item.notes.map(n=>n.k)).size+' alturas';head.append(t,info);
 let canvas=document.createElement('canvas');canvas.width=640;canvas.height=96;let g=canvas.getContext('2d'),w=640,h=96,steps=generatedOpt.bars*16,lo=Math.min(...item.notes.map(n=>n.k)),hi=Math.max(...item.notes.map(n=>n.k));for(let j=0;j<=steps;j+=4){g.fillStyle=j%16===0?'#647783':'#35434c';g.fillRect(j/steps*w,0,1,h)}for(let n of item.notes){g.fillStyle=generatedOpt.groove==='pickup'?(n.v>=88?'#a7d977':'#819eaa'):generatedOpt.groove!=='original'&&n.v<88?'#819eaa':n.k===generatedOpt.root?'#a7d977':'#e5ae79';let y=hi===lo?40:8+(hi-n.k)/(hi-lo)*65;g.fillRect(n.s/steps*w+1,y,Math.max(2,n.l/steps*w-2),12)}
 let tools=document.createElement('div');tools.className='toolbar';let listen=uiButton('▶ Ouvir',()=>hear(item)),insert=uiButton('＋ Usar riff',()=>insertRiff(item));insert.className='primary';tools.append(listen,insert);card.append(head,canvas,tools);box.append(card);
})}
function addKickGuide(y,bpm,notes,groove){let beat=60/bpm,len=Math.round(RATE*.12);for(let i=0;i<y.length;i++)y[i]*=.78;let hits=groove==='pickup'?notes.filter(n=>n.v>=88&&n.s%4===0).map(n=>n.s/4):Array.from({length:Math.ceil(y.length/(beat*RATE))},(_,i)=>i);for(let b of hits){let offset=Math.round(b*beat*RATE);for(let i=0;i<len&&offset+i<y.length;i++){let t=i/RATE,phase=2*Math.PI*(47*t+3.3*(1-Math.exp(-t*40))),kick=Math.sin(phase)*Math.exp(-t*34)*Math.min(1,t*1200)*.22;y[offset+i]=Math.max(-1,Math.min(1,y[offset+i]+kick))}}}
async function hear(item){halt();let ticket=previewToken,inst=el('riffInst').value,bpm=p.bpm;try{stopLive();stop();stopPreview();let ac=audio();await ac.resume();let sounds=await getSounds(inst);if(ticket!==previewToken||!dlg.open)return;let y=render(item.notes,sounds,generatedOpt.bars*240/bpm,bpm);if(el('riffKickGuide').checked)addKickGuide(y,bpm,item.notes,generatedOpt.groove);auditionNode=node(y,false);auditionNode.start();say('Ouvindo · '+instName(inst)+' · '+bpm+' BPM')}catch(e){say('Falha ao ouvir: '+e.message)}}
function insertRiff(item){let inst=el('riffInst').value,opt=generatedOpt,at=el('riffPosition').value==='cursor'?Math.min(127,Math.floor(cursor/16))*16:0,end=at+opt.bars*16;if(end>2048){say('O riff ultrapassa 128 compassos. Escolha outra posição.');return}let target=el('riffDestination').value==='active'?tracks().find(t=>t.id===activeTrack&&t.kind==='notes'):null;if(el('riffDestination').value==='active'&&!target){say('Selecione uma faixa de instrumento na playlist.');return}if(target&&target.notes.some(n=>n.s<end&&n.s+n.l>at)&&!confirm('Substituir as notas nesse trecho da faixa?'))return;if(target&&target.inst!==inst&&!confirm('Trocar o instrumento de toda a faixa selecionada?'))return;if(!target&&tracks().length>=128){say('Limite de 128 faixas.');return}halt();editStudio(()=>{studio().bars=Math.max(studio().bars,Math.ceil(end/16));let ns=item.notes.map(n=>({...n,s:n.s+at,id:uid()}));if(target){target.inst=inst;let kept=[];for(let n of target.notes){if(n.s+n.l<=at||n.s>=end)kept.push(n);else{if(n.s<at)kept.push({...n,l:at-n.s});if(n.s+n.l>end)kept.push({...n,id:uid(),s:end,l:n.s+n.l-end})}}target.notes=[...kept,...ns].sort((a,b)=>a.s-b.s)}else{target=track(inst);target.label=instName(inst)+' · Riff';target.notes=ns;tracks().push(target)}activeTrack=target.id;selection.clear();for(let n of ns)selection.add(n.id);view=Math.floor(at/16);cursor=at});dlg.close();status('Riff inserido · '+opt.bars+' compassos · '+instName(inst))}
function open(){let inst=el('riffInst'),old=inst.value,t=tracks().find(t=>t.id===activeTrack&&t.kind==='notes');inst.replaceChildren();for(let k of [...new Set([...allInst(),custom])])option('riffInst',k,instName(k));inst.value=old&&[...inst.options].some(o=>o.value===old)?old:t?.inst??allInst()[0];el('riffPosition').value='start';dlg.showModal();if(!items.length)generate(true);else draw()}
el('riffClose').onclick=()=>dlg.close();dlg.addEventListener('close',halt);el('riffStop').onclick=()=>{halt();say('Prévia parada.')};el('riffGenerate').onclick=()=>generate(true);el('riffRegenerate').onclick=()=>generate(false);el('riffVar').oninput=()=>el('riffVarText').textContent=el('riffVar').value+'%';for(let id of ['riffMode','riffRoot','riffBars','riffDensity','riffVar','riffGroove'])el(id).addEventListener('change',()=>generate(false));el('riffInst').onchange=()=>{halt();say('Instrumento trocado. Ouça a mesma frase.')};
let launch=uiButton('✦ Riffs ritmados',open);launch.className='riffLaunch';S('openGenerator').before(launch);
})();
