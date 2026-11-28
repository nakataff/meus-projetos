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
// Align preparatory cells to real kick positions, including the following bar.
const RESOLUTION_LABELS={auto:'Automática (original)',start:'Início de cada compasso (inclui o 1º)',beat2:'Segundo tempo',beat3:'Terceiro tempo',beat4:'Quarto tempo',next:'Início do próximo compasso',custom:'Padrão de kick personalizado'};
function resolutionTargets(opt){
 let a=[],limit=opt.bars*16,mode=opt.resolution;
 if(mode==='next'||mode==='start'){for(let t=mode==='start'?0:16;t<=limit;t+=16)a.push(t)}
 else {let steps=mode==='custom'?(opt.kicks||[0]).filter(x=>Number.isInteger(x)&&x>=0&&x<16):[{beat2:4,beat3:8,beat4:12}[mode]];steps=[...new Set(steps)].sort((a,b)=>a-b);for(let b=0;b<opt.bars;b++)for(let k of steps)a.push(b*16+k);if(mode==='custom'&&opt.extra&&steps.includes(0))a.push(limit)}
 return a;
}
function alignedRiff(seed,opt){
 let r=rng(seed),mode=MODES[opt.mode],targets=resolutionTargets(opt),out=[],prev=null,prevTarget=-Infinity;
 let options={sparse:[[1],[2],[3],[4],[5],[2,1],[4,1]],normal:[[3,1],[4,2],[4,1],[3,2,1],[5,3,1],[6,3,1],[5,2,1]],dense:[[3,2,1],[4,3,1],[5,3,2,1],[6,4,2,1],[7,5,3,1],[6,4,3,2,1],[7,6,4,2,1]]};
 let motif=choose(r,options[opt.density]),art=choose(r,[.6,.8,1]),hold=choose(r,[2,3,4]),shape=mode.contours?choose(r,mode.contours):null,progression=mode.progressions?choose(r,mode.progressions):null;
 for(let i=0;i<targets.length;i++){
  let t=targets[i],last=i===targets.length-1,lower=Math.max(0,Number.isFinite(prevTarget)?prevTarget+1:0);
  let prep=motif.map(d=>t-d).filter(x=>x>=lower&&x<t);
  if(!prep.length&&t>lower)prep=[t-1];
  let seq=[...prep,t],rhythm=seq.map((x,j)=>({s:x,l:j===seq.length-1?hold:Math.min(seq[j+1]-x,Math.max(.5,art)),v:j===seq.length-1?100:Math.round(64+18*(j+1)/seq.length)}));
  let nextStart=i+1<targets.length?Math.max(t+1,targets[i+1]-Math.max(...motif)):Infinity;
  rhythm.at(-1).l=Math.max(1,Math.min(hold,nextStart-t,last&&t<opt.bars*16?opt.bars*16-t:Infinity));
  if(out.length){let previous=out.at(-1);previous.l=Math.min(previous.l,seq[0]-previous.s)}
  if(mode.kind==='neighbor'){
   rhythm.forEach((n,j)=>out.push({...n,k:opt.root+(j===rhythm.length-2?1:0)}));
  }else{
   let chord=last?0:progression[Math.max(0,Math.floor((t-1)/16))%progression.length];
   let degrees=tonalBar(mode,shape,rhythm,chord,prev,false,last,i%4===2,'pickup');prev=degrees.at(-1);
   rhythm.forEach((n,j)=>out.push({...n,k:opt.root+tone(mode.scale,degrees[j])}));
  }
  prevTarget=t;
 }
 return out;
}
function riffLength(notes,opt){return Math.max(opt.bars*16,...notes.map(n=>n.s+n.l))}
function riffDisplayBars(notes,opt){return Math.ceil(riffLength(notes,opt)/16)}
function makeRiff(seed,opt){
 if(opt.groove==='pickup'&&opt.resolution&&opt.resolution!=='auto')return alignedRiff(seed,opt);
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
dlg.innerHTML='<div class="dialogHeader"><div><div class="eyebrow">GERADOR HARMÔNICO · MOTIVOS</div><h2>Riffs ritmados</h2></div><button id="riffClose">✕ Fechar</button></div><p style="margin:0 0 12px;color:#aebbc7">Frases com motivo rítmico, acordes implícitos e resolução na tônica. A variação altera principalmente a articulação da resposta. Use o BPM atual da playlist.</p><div class="riffSettings"><label>Estilo<select id="riffMode"></select></label><label>Instrumento<select id="riffInst"></select></label><label>Encaixe rítmico<select id="riffGroove"></select></label><label>Nota central<select id="riffRoot"></select></label><label>Compassos<select id="riffBars"><option>1</option><option>2</option><option selected>4</option><option>8</option><option>16</option></select></label><label>Densidade<select id="riffDensity"><option value="sparse">Espaçado</option><option value="normal" selected>Equilibrado</option><option value="dense">Acelerado</option></select></label><label>Variação da resposta <span id="riffVarText">35%</span><input id="riffVar" type="range" min="0" max="100" value="35"></label><label>Semente<input id="riffSeed" type="number" min="0" max="4294967295" step="1" value="1"></label><div class="toolbar"><button id="riffGenerate" class="primary">Gerar 8 novos</button><button id="riffRegenerate">Usar semente</button><button id="riffSurprise">✦ Me surpreenda</button></div></div><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0;color:#aab6c2;font-size:12px"><span id="riffGrooveHint" style="flex:1"></span><label class="check"><input type="checkbox" id="riffKickGuide"> Ouvir com kick guia</label><button id="riffLoopTop" aria-pressed="false">↻ Loop do riff</button><button id="riffPrevious">◀ Riff anterior</button><button id="riffPreviousBatch">↶ Geração anterior</button><button id="riffPauseTop">Ⅱ Pausar</button><button id="riffStopTop">■ Parar</button><small>Espaço: tocar / pausar</small></div><section id="riffBeatPanel" style="padding:10px;margin:10px 0;border:1px solid #4c6563;border-radius:6px;background:#203334"><div class="toolbar" style="flex-wrap:wrap"><strong style="color:#b9e7dc">BATIDA DE REFERÊNCIA</strong><button id="riffBeatImport">＋ Importar batida</button><input id="riffBeatFile" type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a" hidden><button id="riffBeatHear">▶ Só batida</button><button id="riffBeatMute">🔊 Mutar batida</button><button id="riffBeatRemove">Remover</button></div><label style="display:block;margin:8px 0">Áudio <select id="riffBeatPick" style="max-width:100%"></select></label><div id="riffBeatControls" hidden><div class="riffSettings" style="background:transparent;border:0;padding:4px"><label>BPM da batida<input id="riffBeatBpm" type="number" min="40" max="300" step="0.01"></label><label>BPM do projeto<input id="riffProjectBpm" type="number" min="60" max="220"></label><label>Posição (s)<input id="riffBeatOffset" type="number" step="0.01"></label><label>Volume da batida<input id="riffBeatVol" type="range" min="0" max="100"></label></div><div class="toolbar" style="flex-wrap:wrap"><button id="riffBeatMatch">Igualar BPM</button><label><input id="riffBeatLoop" type="checkbox"> Repetir batida</label><label><input id="riffBeatPreview" type="checkbox"> Ouvir junto ao riff</label><label><input id="riffBeatMix" type="checkbox"> Ouvir na playlist</label></div></div><small id="riffBeatInfo" style="display:block;color:#b9c9c6;margin-top:6px"></small></section><section id="riffResolutionPanel" hidden style="padding:10px;border:1px solid #526455;border-radius:6px;margin:10px 0"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><label>Posição da resolução <select id="riffResolution"></select></label><small id="riffTailInfo" style="color:#b5ee6b"></small></div><div id="riffCustomPanel" hidden><small>Marque onde o grave/kick bate em cada compasso (16 subdivisões).</small><div id="riffKickGrid" style="display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:3px;margin:8px 0"></div><label><input type="checkbox" id="riffExtra" checked> Incluir resolução final no início do próximo compasso (se o primeiro passo estiver marcado)</label></div></section><div id="riffResults" class="riffResults"></div><div class="riffFooter"><label>Inserir em <select id="riffDestination"><option value="new">Nova faixa</option><option value="active">Faixa selecionada (substituir trecho)</option></select></label><label>Posição <select id="riffPosition"><option value="start">Início do arranjo</option><option value="cursor">Compasso da agulha</option></select></label><button id="riffLoop" aria-pressed="false">↻ Loop do riff</button><button id="riffStop">■ Parar</button><span id="riffStatus" role="status"></span></div><small style="color:#95a3b1">O instrumento pode ser trocado depois na própria faixa; todas as notas ficam editáveis.</small>';
document.body.append(dlg);
const css=document.createElement('style');css.textContent='.riffSettings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px;background:#28313a;border:1px solid #3f4a56;border-radius:7px}.riffSettings label{display:grid;gap:4px;color:#aab6c2;font-size:11px}.riffSettings input,.riffSettings select{width:100%;min-width:0}.riffSettings .toolbar{align-self:end}.riffResults{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}.riffCard{padding:10px;background:#242d35;border:1px solid #3f4a56;border-radius:6px;min-width:0}.riffCard strong{font-size:13px}.riffCard small{color:#a7b5c2}.riffCard canvas{display:block;width:100%;height:72px;margin:8px 0;background:#171e24;border-radius:4px}.riffFooter{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid #3f4a56;padding:10px 0;font-size:11px}.riffFooter label{display:flex;gap:5px;align-items:center}#riffStatus{color:#b5ee6b}.riffLaunch{border-color:#789957!important;color:#c7f3a0!important}@media(max-width:760px){.riffSettings{grid-template-columns:repeat(2,minmax(0,1fr))}.riffResults{grid-template-columns:1fr}}';document.head.append(css);
const el=id=>document.getElementById(id),option=(id,value,label)=>{let o=document.createElement('option');o.value=value;o.textContent=label;el(id).append(o)};
Object.entries(MODES).forEach(([k,m])=>option('riffMode',k,m.label));Object.entries(GROOVES).forEach(([k,m])=>option('riffGroove',k,m.label));el('riffGroove').value='original';Object.entries(RESOLUTION_LABELS).forEach(([k,v])=>option('riffResolution',k,v));el('riffResolution').value='next';
for(let k=48;k<=84;k++)option('riffRoot',k,name(k));el('riffRoot').value=62;
let items=[],generatedOpt=null,previewToken=0,kickSteps=new Set([0,8]);
const say=s=>el('riffStatus').textContent=s;
function settings(){return {mode:el('riffMode').value,root:+el('riffRoot').value,bars:+el('riffBars').value,density:el('riffDensity').value,variation:+el('riffVar').value,groove:el('riffGroove').value,resolution:el('riffResolution').value,kicks:[...kickSteps].sort((a,b)=>a-b),extra:el('riffExtra').checked}}
function syncResolutionUI(){let on=el('riffGroove').value==='pickup';el('riffResolutionPanel').hidden=!on;el('riffCustomPanel').hidden=!on||el('riffResolution').value!=='custom';let box=el('riffKickGrid');box.replaceChildren();for(let i=0;i<16;i++){let b=uiButton(String(i+1),()=>{if(kickSteps.has(i)){if(kickSteps.size===1)return;kickSteps.delete(i)}else kickSteps.add(i);generate(false)});b.type='button';b.style.cssText='min-width:0;padding:5px 1px;'+(kickSteps.has(i)?'background:#a7d977;color:#17231a;':'');b.title='Tempo '+(Math.floor(i/4)+1)+' · subdivisão '+(i%4+1);b.setAttribute('aria-pressed',String(kickSteps.has(i)));box.append(b)}}
let riffLoopOn=false,previewMix=null,previewCache=null,pausedAt=0,selectedItem=null,loading=false,genHistory=[],batchInst=null;
function releasePreview(m){if(!m)return;try{m.beat?.stop()}catch{}try{m.main?.disconnect();m.beat?.disconnect();m.gain?.disconnect()}catch{}if(previewMix===m)previewMix=null}
function halt(clear=true){previewToken++;loading=false;let m=previewMix;stopAudition();releasePreview(m);if(clear){previewCache=null;pausedAt=0}syncPlaybackButtons()}
function syncLoopButtons(){for(let id of ['riffLoop','riffLoopTop']){let b=el(id);b.textContent=riffLoopOn?'↻ Loop ligado':'↻ Loop do riff';b.classList.toggle('active',riffLoopOn);b.setAttribute('aria-pressed',String(riffLoopOn))}}
function toggleRiffLoop(){riffLoopOn=!riffLoopOn;syncLoopButtons();if(previewMix){previewMix.main.loop=riffLoopOn;if(previewMix.beat)previewMix.beat.loop=riffLoopOn;say(riffLoopOn?'Loop do riff ligado.':'Loop desligado · termina no fim da passagem.')}else say(riffLoopOn?'Loop do riff ligado.':'Loop do riff desligado.')}
function playPreviewLayers(ac,y,beatY=null,offset=0){let make=a=>{let b=ac.createBuffer(1,a.length,RATE);b.copyToChannel(a,0);let n=ac.createBufferSource();n.buffer=b;n.loop=riffLoopOn;return n};let main=make(y),beat=beatY?make(beatY):null,gain=ac.createGain();gain.gain.value=ref()?.muted?0:1;main.connect(ac.destination);if(beat)beat.connect(gain).connect(ac.destination);let at=ac.currentTime+.035,m={main,beat,gain,at,offset,duration:y.length/RATE};previewMix=m;previewCache={y,beatY};pausedAt=offset;auditionNode=main;main.onended=()=>{if(previewMix!==m)return;if(auditionNode===main)auditionNode=null;releasePreview(m);pausedAt=0;syncPlaybackButtons()};main.start(at,offset);if(beat)beat.start(at,offset);syncPlaybackButtons()}
function newSeed(){let a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]}
function generate(randomize,skipHistory=false){if(!skipHistory)rememberGeneration();halt();selectedItem=null;if(randomize)el('riffSeed').value=newSeed();let seed=Math.max(0,Math.min(4294967295,Math.floor(Number(el('riffSeed').value)||0)))>>>0;el('riffSeed').value=seed;generatedOpt=settings();batchInst=el('riffInst').value;syncResolutionUI();el('riffGrooveHint').textContent=GROOVES[generatedOpt.groove].desc+(generatedOpt.groove==='pickup'?' O kick guia toca nas notas de resolução; não entra no arranjo.':' O kick guia marca os quatro tempos; não entra no arranjo.');items=batch(seed,generatedOpt);window.riffStudioLibrary?.remember(items.map((it,i)=>({title:'Riff '+String(i+1).padStart(2,'0'),notes:it.notes,opt:generatedOpt,seed,inst:el('riffInst').value,bpm:p.bpm,updated:Date.now()})));let extra=items.some(it=>riffLength(it.notes,generatedOpt)>generatedOpt.bars*16);el('riffTailInfo').textContent=extra?generatedOpt.bars+' compassos de motivo + resolução no compasso '+(generatedOpt.bars+1)+' · espaço extra automático':'Resolução dentro dos '+generatedOpt.bars+' compassos';draw();say(items.length+' riffs gerados · '+p.bpm+' BPM')}
function draw(){syncRiffBeat();const box=el('riffResults');box.replaceChildren();items.forEach((item,i)=>{
 let card=document.createElement('div');card.className='riffCard';let head=document.createElement('div');head.className='row';let t=document.createElement('strong');t.textContent=item.title||'Riff '+String(i+1).padStart(2,'0');let info=document.createElement('small');info.textContent=item.notes.length+' notas · '+new Set(item.notes.map(n=>n.k)).size+' alturas · '+riffDisplayBars(item.notes,generatedOpt)+' comp. · '+timeFmt(riffLength(item.notes,generatedOpt)*15/p.bpm);head.append(t,info);
 let canvas=document.createElement('canvas');canvas.width=640;canvas.height=96;let g=canvas.getContext('2d'),w=640,h=96,steps=riffDisplayBars(item.notes,generatedOpt)*16,lo=Math.min(...item.notes.map(n=>n.k)),hi=Math.max(...item.notes.map(n=>n.k));if(steps>generatedOpt.bars*16){let x=generatedOpt.bars*16/steps*w;g.fillStyle='#40592c66';g.fillRect(x,0,w-x,h)}for(let j=0;j<=steps;j+=4){g.fillStyle=j%16===0?'#647783':'#35434c';g.fillRect(j/steps*w,0,1,h);if(j%16===0&&j<steps){g.fillStyle='#b7c5ce';g.font='10px sans-serif';g.fillText(String(j/16+1),j/steps*w+3,10)}}for(let n of item.notes){g.fillStyle=generatedOpt.groove==='pickup'?(n.v>=88?'#a7d977':'#819eaa'):generatedOpt.groove!=='original'&&n.v<88?'#819eaa':n.k===generatedOpt.root?'#a7d977':'#e5ae79';let y=hi===lo?40:15+(hi-n.k)/(hi-lo)*58;g.fillRect(n.s/steps*w+1,y,Math.max(2,n.l/steps*w-2),12)}
 let tools=document.createElement('div');tools.className='toolbar';let listen=uiButton('▶ Ouvir',()=>{if(selectedItem===item&&(previewMix||loading||previewCache&&pausedAt>0))togglePreview();else hear(item)}),stopBtn=uiButton('■ Parar',()=>{if(selectedItem===item)stopRiff()}),insert=uiButton('＋ Usar riff',()=>insertRiff(item));listen.dataset.riffPlay=String(i);stopBtn.dataset.riffStop=String(i);insert.className='primary';tools.append(listen,stopBtn,insert);card.dataset.riffIndex=String(i);card.append(head,canvas,tools);box.append(card);
});syncPlaybackButtons()}
function addKickGuide(y,bpm,notes,groove){let beat=60/bpm,len=Math.round(RATE*.12);for(let i=0;i<y.length;i++)y[i]*=.78;let hits=groove==='pickup'?notes.filter(n=>n.v>=88).map(n=>n.s/4):Array.from({length:Math.ceil(y.length/(beat*RATE))},(_,i)=>i);for(let b of hits){let offset=Math.round(b*beat*RATE);for(let i=0;i<len&&offset+i<y.length;i++){let t=i/RATE,phase=2*Math.PI*(47*t+3.3*(1-Math.exp(-t*40))),kick=Math.sin(phase)*Math.exp(-t*34)*Math.min(1,t*1200)*.22;y[offset+i]=Math.max(-1,Math.min(1,y[offset+i]+kick))}}}
async function hear(item){halt();selectedItem=item;loading=true;syncPlaybackButtons();let ticket=previewToken,inst=el('riffInst').value,bpm=p.bpm,opt=copy(generatedOpt),r=ref()&&ref().preview!==false?copy(ref()):null,start=el('riffPosition').value==='cursor'?Math.min(127,Math.floor(cursor/16))*240/bpm:0;try{stopLive();stop();stopPreview();let ac=audio();await ac.resume();let sounds=await getSounds(inst);if(ticket!==previewToken||!dlg.open)return;let y=render(item.notes,sounds,riffLength(item.notes,opt)*15/bpm,bpm);if(el('riffKickGuide').checked)addKickGuide(y,bpm,item.notes,opt.groove);let beatY=r?new Float32Array(y.length):null,mixed=r?await mixReferenceInto(beatY,bpm,start,r):false;if(ticket!==previewToken||!dlg.open)return;for(let i=0;i<y.length;i++)y[i]*=.72;if(beatY)for(let i=0;i<beatY.length;i++)beatY[i]*=.72;loading=false;playPreviewLayers(ac,y,mixed?beatY:null);say('Ouvindo · '+instName(inst)+' · '+bpm+' BPM'+(mixed?(ref()?.muted?' · batida mutada':' + batida'):r?' · batida fora do trecho/volume zero':'')+(riffLoopOn?' · LOOP':''))}catch(e){if(ticket===previewToken){loading=false;syncPlaybackButtons();say('Falha ao ouvir: '+e.message)}}}
function insertRiff(item){let inst=el('riffInst').value,opt=generatedOpt,at=el('riffPosition').value==='cursor'?Math.min(127,Math.floor(cursor/16))*16:0,end=at+riffLength(item.notes,opt);if(end>2048){say('O riff ultrapassa 128 compassos. Escolha outra posição.');return}let target=el('riffDestination').value==='active'?tracks().find(t=>t.id===activeTrack&&t.kind==='notes'):null;if(el('riffDestination').value==='active'&&!target){say('Selecione uma faixa de instrumento na playlist.');return}if(target&&target.notes.some(n=>n.s<end&&n.s+n.l>at)&&!confirm('Substituir as notas nesse trecho da faixa?'))return;if(target&&target.inst!==inst&&!confirm('Trocar o instrumento de toda a faixa selecionada?'))return;if(!target&&tracks().length>=128){say('Limite de 128 faixas.');return}halt();editStudio(()=>{studio().bars=Math.max(studio().bars,Math.ceil(end/16));let ns=item.notes.map(n=>({...n,s:n.s+at,id:uid()}));if(target){target.inst=inst;let kept=[];for(let n of target.notes){if(n.s+n.l<=at||n.s>=end)kept.push(n);else{if(n.s<at)kept.push({...n,l:at-n.s});if(n.s+n.l>end)kept.push({...n,id:uid(),s:end,l:n.s+n.l-end})}}target.notes=[...kept,...ns].sort((a,b)=>a.s-b.s)}else{target=track(inst);target.label=instName(inst)+' · Riff';target.notes=ns;tracks().push(target)}target.riffMeta={opt:copy(opt),seed:+el('riffSeed').value,updated:Date.now()};activeTrack=target.id;selection.clear();for(let n of ns)selection.add(n.id);view=Math.floor(at/16);cursor=at;let needed=riffDisplayBars(item.notes,opt);if(needed>opt.bars&&+S('sZoom').value<needed){let z=[...S('sZoom').options].map(o=>+o.value).filter(v=>v>=needed).sort((a,b)=>a-b)[0];if(z)S('sZoom').value=String(z)}});dlg.close();status('Riff inserido · '+opt.bars+' compassos'+(riffDisplayBars(item.notes,opt)>opt.bars?' + resolução no compasso seguinte':'')+' · '+instName(inst))}
let lastStudio=null;
function refreshInstruments(preferred){let inst=el('riffInst'),t=tracks().find(t=>t.id===activeTrack&&t.kind==='notes');inst.replaceChildren();for(let k of [...new Set([...allInst(),custom])])option('riffInst',k,instName(k));inst.value=[...inst.options].some(o=>o.value===preferred)?preferred:t?.inst??allInst()[0]}
function barsValue(n){let sel=el('riffBars');for(let o of [...sel.options])if(o.dataset.temporary)o.remove();if(![...sel.options].some(o=>+o.value===n)){let o=document.createElement('option');o.value=n;o.textContent=n;o.dataset.temporary='1';sel.append(o)}sel.value=String(n)}
function setSettings(opt){el('riffMode').value=MODES[opt.mode]?opt.mode:'major';el('riffRoot').value=String(Math.max(48,Math.min(84,opt.root||62)));barsValue(Math.max(1,Math.min(128,opt.bars||4)));el('riffDensity').value=TEMPLATES[opt.density]?opt.density:'normal';el('riffVar').value=opt.variation??35;el('riffVarText').textContent=el('riffVar').value+'%';el('riffGroove').value=GROOVES[opt.groove]?opt.groove:'original';el('riffResolution').value=RESOLUTION_LABELS[opt.resolution]?opt.resolution:'next';kickSteps=new Set(Array.isArray(opt.kicks)&&opt.kicks.length?opt.kicks:[0,8]);el('riffExtra').checked=opt.extra!==false;syncResolutionUI()}
function open(){let changed=lastStudio!==studio();lastStudio=studio();refreshInstruments(changed?null:el('riffInst').value);el('riffPosition').value='start';if(changed){items=[];generatedOpt=null;genHistory=[];selectedItem=null;setSettings({});let lib=window.riffStudioLibrary;if(lib?.projectItems().length){lib.library('project');return}if(lib?.read().length){lib.library('recent');return}}dlg.showModal();if(!items.length)generate(true);else draw()}
window.riffStudioBridge={
 fresh(){if(lastStudio!==studio()){items=[];generatedOpt=null;genHistory=[];selectedItem=null}lastStudio=studio();refreshInstruments(el('riffInst').value);setSettings({});el('riffPosition').value='start';if(!dlg.open)dlg.showModal();generate(true)},
 load(item){if(lastStudio!==studio()){items=[];generatedOpt=null;genHistory=[]}else rememberGeneration();halt();selectedItem=null;lastStudio=studio();refreshInstruments(item.inst);setSettings(item.opt);el('riffSeed').value=item.seed??1;el('riffPosition').value='start';generatedOpt=settings();batchInst=el('riffInst').value;items=[{title:item.title,notes:copy(item.notes),seed:item.seed}];el('riffGrooveHint').textContent='Riff recuperado com as notas originais. Troque o instrumento ou gere novas opções.';el('riffTailInfo').textContent=riffDisplayBars(item.notes,generatedOpt)>generatedOpt.bars?'Inclui resolução no compasso extra.':'';if(!dlg.open)dlg.showModal();draw();say('Riff recuperado'+(el('riffInst').value!==item.inst?' · instrumento original indisponível; escolha outro.':' · BPM atual: '+p.bpm))}
};
el('riffClose').onclick=()=>dlg.close();dlg.addEventListener('close',halt);el('riffStop').onclick=el('riffStopTop').onclick=stopRiff;el('riffPauseTop').onclick=togglePreview;el('riffPrevious').onclick=previousRiff;el('riffPreviousBatch').onclick=previousGeneration;el('riffSurprise').onclick=surprise;el('riffGenerate').onclick=()=>generate(true);el('riffRegenerate').onclick=()=>generate(false);el('riffVar').oninput=()=>el('riffVarText').textContent=el('riffVar').value+'%';for(let id of ['riffMode','riffRoot','riffBars','riffDensity','riffVar','riffGroove','riffResolution','riffExtra'])el(id).addEventListener('change',()=>generate(false));el('riffInst').onchange=()=>{halt();batchInst=el('riffInst').value;say('Instrumento trocado. Ouça a mesma frase.')};
function syncRiffBeat(){let r=ref(),pick=el('riffBeatPick'),source=S('sRefPick');if(!pick||!source)return;pick.replaceChildren(...Array.from(source.options,o=>o.cloneNode(true)));pick.value=r?.key??'';el('riffBeatControls').hidden=!r;el('riffBeatHear').disabled=!r;el('riffBeatRemove').disabled=!r;let mute=el('riffBeatMute');mute.disabled=!r;mute.textContent=r?.muted?'🔇 Batida mutada':'🔊 Mutar batida';mute.classList.toggle('active',!!r?.muted);mute.setAttribute('aria-pressed',String(!!r?.muted));if(r){el('riffBeatBpm').value=r.bpm;el('riffProjectBpm').value=p.bpm;el('riffBeatOffset').value=+r.offset.toFixed(3);el('riffBeatVol').value=r.vol;el('riffBeatLoop').checked=!!r.loop;el('riffBeatPreview').checked=r.preview!==false;el('riffBeatMix').checked=r.mix;el('riffBeatInfo').textContent=labelMedia(r.key)+' · '+r.bpm+' BPM → '+p.bpm+' BPM · '+(r.preview!==false?'ativa nas prévias':'silenciada nas prévias')+(r.bpm!==p.bpm?' · ajuste de velocidade pode alterar o tom.':'')}else el('riffBeatInfo').textContent='Importe uma batida para testar o encaixe dos pontinhos. A mesma batida será compartilhada com a playlist.'}
function editBeat(fn){halt();if(!ref())return;editStudio(fn);syncRiffBeat();draw()}
el('riffLoop').onclick=el('riffLoopTop').onclick=toggleRiffLoop;el('riffBeatMute').onclick=toggleReferenceMute;window.riffBeatMuteChanged=()=>{if(previewMix){let ac=audio();previewMix.gain.gain.setTargetAtTime(ref()?.muted?0:1,ac.currentTime,.012)}syncRiffBeat()};
el('riffBeatImport').onclick=()=>el('riffBeatFile').click();
el('riffBeatFile').onchange=async e=>{let file=e.target.files[0];e.target.value='';if(!file)return;halt();say('Importando batida…');await importMedia(file,'ref');syncRiffBeat();say(ref()?'Batida disponível. Informe o BPM original.':'Não foi possível importar a batida.')};
el('riffBeatPick').onchange=()=>{halt();setReference(el('riffBeatPick').value);syncRiffBeat()};
el('riffBeatRemove').onclick=()=>{halt();removeReference();syncRiffBeat()};
el('riffBeatHear').onclick=async()=>{halt();let ticket=previewToken,r=ref()?copy(ref()):null;if(!r)return;try{stopLive();let ac=audio();await ac.resume();let length=items.length?riffLength(items[0].notes,generatedOpt)*stepSec():4*240/p.bpm;let y=new Float32Array(Math.round(length*RATE));await mixReferenceInto(y,p.bpm,el('riffPosition').value==='cursor'?Math.min(127,Math.floor(cursor/16))*240/p.bpm:0,r);if(ticket!==previewToken||!dlg.open)return;playPreviewLayers(ac,new Float32Array(y.length),y);say('Ouvindo apenas a batida · '+p.bpm+' BPM'+(ref()?.muted?' · mutada':'')+(riffLoopOn?' · LOOP':''))}catch(e){say(e.message)}};
el('riffBeatBpm').onchange=()=>editBeat(()=>ref().bpm=clamp(+el('riffBeatBpm').value||p.bpm,40,300));el('riffBeatOffset').onchange=()=>editBeat(()=>ref().offset=clamp(+el('riffBeatOffset').value||0,-86400,86400));el('riffBeatVol').onchange=()=>editBeat(()=>ref().vol=+el('riffBeatVol').value);el('riffBeatLoop').onchange=()=>editBeat(()=>ref().loop=el('riffBeatLoop').checked);el('riffBeatPreview').onchange=()=>editBeat(()=>ref().preview=el('riffBeatPreview').checked);el('riffBeatMix').onchange=()=>editBeat(()=>ref().mix=el('riffBeatMix').checked);
el('riffProjectBpm').onchange=()=>editBeat(()=>{p.bpm=clamp(Math.round(+el('riffProjectBpm').value)||130,60,220);S('bpm').value=p.bpm});el('riffBeatMatch').onclick=()=>editBeat(()=>{p.bpm=clamp(Math.round(ref().bpm),60,220);S('bpm').value=p.bpm});
function syncPlaybackButtons(){let i=items.indexOf(selectedItem);let b=el('riffPauseTop');if(!b)return;b.textContent=previewMix||loading?'Ⅱ Pausar':pausedAt>0?'▶ Continuar':'▶ Tocar';el('riffPrevious').disabled=i<=0;el('riffPreviousBatch').disabled=!genHistory.length;for(let card of el('riffResults').querySelectorAll('[data-riff-index]')){let active=+card.dataset.riffIndex===i;card.style.borderColor=active?'#a7d977':'';let play=card.querySelector('[data-riff-play]'),stop=card.querySelector('[data-riff-stop]');play.textContent=active&&(previewMix||loading)?'Ⅱ Pausar':active&&pausedAt>0?'▶ Continuar':'▶ Ouvir';stop.disabled=!active||(!previewMix&&!loading&&!pausedAt)}}
function stopRiff(){halt();say('Prévia parada.')}
async function togglePreview(){if(loading){halt();say('Prévia cancelada.');return}if(previewMix){let m=previewMix,elapsed=Math.max(0,audio().currentTime-m.at)+m.offset;pausedAt=riffLoopOn?elapsed%m.duration:Math.min(elapsed,m.duration-.001);halt(false);say('Pausado · '+timeFmt(pausedAt));return}if(previewCache&&pausedAt>0){let ac=audio(),ticket=++previewToken;await ac.resume();if(ticket!==previewToken||!dlg.open)return;playPreviewLayers(ac,previewCache.y,previewCache.beatY,pausedAt);say('Prévia retomada.');return}let item=selectedItem||items[0];if(item)hear(item)}
function previousRiff(){let i=items.indexOf(selectedItem);if(i>0)hear(items[i-1]);else if(!selectedItem&&items.length)hear(items[0])}
function rememberGeneration(){if(!generatedOpt||!items.length)return;genHistory.push({opt:copy(generatedOpt),items:copy(items),seed:+el('riffSeed').value,inst:batchInst||el('riffInst').value});if(genHistory.length>24)genHistory.shift()}
function previousGeneration(){let g=genHistory.pop();if(!g)return;halt();selectedItem=null;setSettings(g.opt);refreshInstruments(g.inst);batchInst=el('riffInst').value;generatedOpt=copy(g.opt);items=copy(g.items);el('riffSeed').value=g.seed;el('riffGrooveHint').textContent=GROOVES[generatedOpt.groove].desc;el('riffTailInfo').textContent=items.some(it=>riffLength(it.notes,generatedOpt)>generatedOpt.bars*16)?'Inclui resolução no compasso extra.':'';draw();say('Geração anterior recuperada.')}
const SURPRISE_PROFILES=[
 {mode:'minor',groove:'pickup',density:'normal',inst:/clarinete|sax|flauta/i,variation:20,resolution:'next'},
 {mode:'dark',groove:'offbeat',density:'normal',inst:/sax|clarinete|metais/i,variation:25},
 {mode:'major',groove:'alternate',density:'normal',inst:/piano|guitarra|marimba/i,variation:25},
 {mode:'bounce',groove:'after',density:'dense',inst:/clarinete|flauta|synth/i,variation:15},
 {mode:'fifth',groove:'onbeat',density:'normal',inst:/metais|guitarra|piano/i,variation:20},
 {mode:'tense',groove:'pickup',density:'normal',inst:/sax|clarinete|piano/i,variation:15,resolution:'beat3'}
];
function surprise(){
 rememberGeneration();let r=rng(newSeed()),profiles=SURPRISE_PROFILES.filter(x=>x.mode!==generatedOpt?.mode||x.groove!==generatedOpt?.groove),profile=choose(r,profiles.length?profiles:SURPRISE_PROFILES),root=generatedOpt?.root??(+el('riffRoot').value||62);
 // Preserve the selected tonal center and project's BPM; vary the musical treatment, not arbitrary notes.
 let options=[...el('riffInst').options].map(o=>o.value).filter(k=>k!==custom),matches=options.filter(k=>profile.inst.test(instName(k))&&k!==el('riffInst').value);let inst=choose(r,matches.length?matches:options.filter(k=>k!==el('riffInst').value).length?options.filter(k=>k!==el('riffInst').value):options);
 setSettings({...profile,root,bars:generatedOpt?.bars>=8?8:4,resolution:profile.resolution||'next',kicks:[0,8],extra:true});if(inst)el('riffInst').value=inst;generate(true,true);
 // Favor phrases with manageable leaps, clear resolution, and at least two pitches.
 let score=it=>{let ns=it.notes,distinct=new Set(ns.map(n=>n.k)).size,leaps=ns.slice(1).map((n,i)=>Math.abs(n.k-ns[i].k));return (ns.at(-1).k===generatedOpt.root?20:0)+Math.min(distinct,5)*2-leaps.reduce((a,d)=>a+Math.max(0,d-3)**2,0)/Math.max(1,leaps.length)-(distinct<2?15:0)};
 items.sort((a,b)=>score(b)-score(a));draw();say('Surpresa · '+MODES[generatedOpt.mode].label+' · '+instName(el('riffInst').value));if(items.length)hear(items[0])
}
document.addEventListener('keydown',e=>{if(!dlg.open||e.code!=='Space'||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.repeat||e.isComposing||e.target.matches('input,select,textarea')||e.target.isContentEditable||S('beatLibraryDialog')?.open)return;e.preventDefault();e.stopImmediatePropagation();togglePreview()},true);
let launch=uiButton('✦ Riffs ritmados',open);launch.className='riffLaunch';S('openGenerator').before(launch);
})();
