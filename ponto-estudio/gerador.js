'use strict';
const $=id=>document.getElementById(id),data=window.PONTO_DATA,add=(e,v,n)=>e.add(new Option(n,v)),clamp=(v,a,b)=>Math.min(b,Math.max(a,v)),rand=a=>a[Math.floor(Math.random()*a.length)],copy=x=>JSON.parse(JSON.stringify(x));
const labels=['Dó','Dó♯','Ré','Mi♭','Mi','Fá','Fá♯','Sol','Lá♭','Lá','Si♭','Si'],name=p=>labels[p%12]+(Math.floor(p/12)-1),scales={'Menor natural':[0,2,3,5,7,8,10],'Maior':[0,2,4,5,7,9,11],'Pentatônica menor':[0,3,5,7,10],'Dórica':[0,2,3,5,7,9,10],'Frígia':[0,1,3,5,7,8,10]};
const forms=[
 ['Sax · chamada e resposta',[0,3,5,8,12],[2,1,3,3,3],[2,3,1,2,0]],
 ['Nota longa com enfeite',[0,8,10,12],[7,1,1,4],[0,2,3,1]],
 ['Pergunta ascendente',[0,4,7,10],[3,2,2,5],[0,1,2,4]],
 ['Resposta descendente',[0,3,6,11],[2,2,4,5],[4,3,2,0]],
 ['Guitarra contratempo',[2,5,8,10,14],[2,1,1,3,2],[0,2,0,4,1]],
 ['Piano quebrado',[0,3,6,9,12],[3,2,3,2,4],[0,2,4,2,1]],
 ['Síncope carioca',[0,3,7,10,13],[2,3,2,2,3],[0,0,3,2,4]],
 ['Salto e retorno',[0,5,7,12],[4,2,3,4],[0,5,4,1]],
 ['Flauta corrida',[1,3,4,6,9,11,14],[2,1,2,2,1,3,2],[0,1,2,4,3,1,0]],
 ['Eco entre oitavas',[0,3,8,11],[2,4,2,4],[0,7,2,5]],
 ['Suspense lento',[0,6,12],[5,5,4],[0,1,4]],
 ['Escadinha de baile',[0,2,5,7,10,13],[2,2,2,2,3,3],[0,1,2,1,3,4]],
 ['Antecipação',[1,4,7,11,15],[2,2,4,3,1],[2,0,3,4,1]],
 ['Frase espaçada',[0,8,14],[6,4,2],[4,1,2]],
 ['Arpejo de cordas',[0,3,6,8,12],[2,2,2,3,4],[0,2,4,6,4]],
 ['Repique melódico',[0,4,5,7,10,14],[3,1,2,2,3,2],[0,2,1,3,4,1]]
];
forms.push(['Fraseado do ponto']);
const builtin=[...Object.keys(data.tones),...timbresPonto.names],custom='Corte do pacote';[...builtin,custom].forEach(n=>add($('inst'),n,n));forms.forEach((f,i)=>add($('form'),i,f[0]));labels.forEach((n,i)=>add($('root'),i,n));Object.keys(scales).forEach(n=>add($('scale'),n,n));for(let i=36;i<=96;i++){add($('pitch'),i,name(i));add($('origin'),i,name(i))}data.bank.forEach((v,i)=>add($('src'),i,v.n));
const saxId=data.bank.findIndex(s=>s.n.toLowerCase()==='pontinho - sax foda');$('src').value=saxId;$('origin').value=74;$('from').value=.52;$('ref').src='data:audio/mpeg;base64,'+data.ref;
let p={version:2,bpm:130,bars:2,root:2,scale:'Frígia',form:0,inst:'Sax do seu ponto',cut:{id:saxId,a:.52,len:.30,base:74},notes:[]},sel=0,hist=[],phraseState=0,playing=false,source=null,ctx=null,genId=0,epoch=0,preview=null;
const size=()=>p.bars*16,dt=()=>15/p.bpm,msg=t=>$('status').textContent=t,remember=()=>{const q={...p};delete q.studio;hist.push(copy(q));if(hist.length>40)hist.shift();$('undo').disabled=false};
function degree(d){let s=scales[p.scale],len=s.length;return 60+p.root+12*Math.floor(d/len)+s[((d%len)+len)%len]}
const referenceForm=forms.length-1, profiles=data.motifs;
const byId=new Map(profiles.map(m=>[m.id,m]));
add($('guide'),-1,'Alternar entre os pontos');
profiles.slice().sort((a,b)=>data.bank[a.id].n.localeCompare(data.bank[b.id].n,'pt-BR')).forEach(m=>add($('guide'),m.id,data.bank[m.id].n));
function reference(rotate=false){
 if(byId.has(p.guide))return byId.get(p.guide);
 if(!rotate&&byId.has(p.used))return byId.get(p.used);
 const pool=profiles.filter(m=>m.suggested&&m.id!==p.used&&m.events.length>=3);
 return rand(pool.length?pool:profiles);
}
const tempoStore='ponto-estudio-bpm-por-referencia';
function readTempos(){try{return JSON.parse(localStorage.getItem(tempoStore))||{}}catch{return {}}}
function refTempo(m){const bpm=p.refTempos?.[m.id];return Number.isFinite(bpm)&&bpm>=40&&bpm<=300?bpm:m.bpm}
function meter(m){
 const bpm=refTempo(m),step=15/bpm,last=m.events.at(-1);
 const elapsedBars=m.duration/step/16,near=Math.round(elapsedBars);
 const bars=p.method==='clean'&&near>0&&Math.abs(elapsedBars-near)<.12?near:Math.max(1,Math.ceil((m.duration/step-.98)/16),last?Math.ceil((Math.round(last[0]/step)+1)/16):1);
 const slots=new Map(),total=bars*16;
 for(const [start,end,k,v] of m.events){
  const onset=start/step,s=clamp(Math.round(onset),0,total-1),weight=(end-start)*v;
  if(!slots.has(s)||weight>slots.get(s).weight)slots.set(s,{s,weight,k,v,end,offset:clamp(onset-s,-.24,.24)});
 }
 const rows=[...slots.values()],notes=rows.map((n,i)=>[n.s,clamp(Math.round(n.end/step)-n.s,1,(rows[i+1]?.s??total)-n.s),n.k,n.v,n.offset]);
 return {...m,bpm,bars,notes};
}
function setTempo(reset){
 const m=byId.get(p.used);if(!m)return;
 const tempo=Number($('refBpm').value);
 if(!reset&&(!Number.isFinite(tempo)||tempo<40||tempo>300)){msg('Informe o BPM da referência entre 40 e 300.');return}
 remember();p.method='clean';p.guide=m.id;p.refTempos={...(p.refTempos??{})};
 if(reset)delete p.refTempos[m.id];else p.refTempos[m.id]=Math.round(tempo*100)/100;
 try{const all=readTempos();if(reset)delete all[m.id];else all[m.id]=p.refTempos[m.id];localStorage.setItem(tempoStore,JSON.stringify(all))}catch{}
 p.notes=compose();sel=0;changed();msg('Grade recalculada a partir dos tempos do áudio. O projeto toca a '+p.bpm+' BPM.');
}
$('applyTempo').onclick=()=>setTempo(false);$('autoTempo').onclick=()=>setTempo(true);
$('refBpm').onkeydown=e=>{if(e.key==='Enter')setTempo(false)};
function available(){return Array.from({length:34},(_,i)=>degree(i-16)).filter(k=>k>=48&&k<=84)}
function closest(arr,x){return arr.reduce((a,b)=>Math.abs(a-x)<=Math.abs(b-x)?a:b)}
function outline(m){
 const ratio=p.bars/m.bars,style=forms[p.form],fromRef=p.form===referenceForm;
 // Map the source from beginning to end. For a shorter loop choose one
 // representative per slot, keeping the actual first and last attacks.
 const slots=new Map();
 m.notes.forEach((n,j)=>{
  const pos=clamp(Math.round(n[0]*ratio),0,size()-1);
  const rank=(j===0||j===m.notes.length-1?10000:0)+n[1]*4+n[3];
  if(!slots.has(pos)||rank>slots.get(pos).rank)slots.set(pos,{pos,n,rank});
 });
 const rows=[...slots.values()];
 return rows.map(({pos,n},j)=>{
  const next=rows[j+1]?.pos??size();
  let length=Math.round(n[1]*ratio),gesture=0;
  if(!fromRef){
   const local=pos%16,starts=style[1];
   const idx=starts.reduce((best,s,i)=>Math.abs(s-local)<Math.abs(starts[best]-local)?i:best,0);
   gesture=style[3][idx]-style[3][0];
   length=Math.round(.7*length+.3*style[2][idx]);
  }
  return {s:pos,l:clamp(length,1,next-pos),offset:clamp(n[4]*ratio,-.24,.24),v:n[3],original:n[2],gesture};
 });
}
// Minimize the cost of the complete line, including its intervals, before choosing pitches.
function fitLine(targets,accent,scale){
 let costs=scale.map(k=>1.8*Math.abs(k-targets[0])),back=[];
 for(let j=1;j<targets.length;j++){
  const delta=targets[j]-targets[j-1],parents=[],next=scale.map(k=>{
   let best=Infinity,parent=0;
   scale.forEach((h,i)=>{const jump=k-h;
    const error=costs[i]+1.45*Math.abs(jump-delta)+.38*Math.max(0,Math.abs(jump)-5)+
     (Math.abs(delta)>=1&&jump*delta<=0?1.8:0)+(delta===0&&jump!==0?2:0);
    if(error<best){best=error;parent=i}});
   parents.push(parent);return best+Math.abs(k-targets[j])*(accent[j]?1.7:1.15);
  });back.push(parents);costs=next;
 }
 let idx=costs.indexOf(Math.min(...costs)),result=[scale[idx]];
 for(let j=back.length-1;j>=0;j--){idx=back[j][idx];result.unshift(scale[idx])}return result;
}
function basePhrase(m){
 const template=outline(m),scale=available(),pitch0=template[0].original;
 const anchor=degree(rand([0,0,2,scales[p.scale].length-1])),flavor=p.freedom??1;
 const width=flavor===0?1:rand(flavor===1?[.85,1,1.13]:[.75,1.2,1.45]);
 const wanted=template.map(n=>anchor+(n.original-pitch0)*width+n.gesture*(flavor===0?.35:.8));
 const ks=fitLine(wanted,template.map(n=>n.v>=86),scale);
 // Separate adjacent scale neighbours if a narrow chromatic figure collapsed during fitting.
 if(new Set(ks).size<3){
  const ranks=[...new Set(template.map(n=>n.original))].sort((a,b)=>a-b);
  const center=scale.indexOf(closest(scale,anchor)),r=ranks.indexOf(pitch0);
  template.forEach((n,j)=>ks[j]=scale[clamp(center+ranks.indexOf(n.original)-r,0,scale.length-1)]);
 }
 return template.map((n,j)=>({s:n.s,l:n.l,v:n.v,k:ks[j],offset:n.offset}));
}
function reply(motif,closing=false,force=false){
 const a=copy(motif),scale=available();if(!a.length)return a;
 const last=a.length-1,home=a[0].k,previous=a[Math.max(0,last-1)].k;
 const terminals=scale.filter(k=>Math.abs(k-previous)<=7&&Math.abs(k-home)<=7&&(force?k!==a[last].k:true));
 if(terminals.length){
  const targets=[home,degree(0),degree(2),degree(4)].map(k=>k+12*Math.round((previous-k)/12));
  const ordered=terminals.map(k=>({k,score:Math.abs(k-previous)*.55+Math.min(...targets.map(t=>Math.abs(k-t)))*1.5+Math.abs(k-home)*.25+(k===a[last].k?2:0)})).sort((a,b)=>a.score-b.score);
  a[last].k=rand(ordered.slice(0,closing?2:3)).k;
 }
 if(last>2&&(p.freedom??1)>0){const j=last-1,center=(a[j-1].k+a[last].k)/2;
  const options=scale.filter(k=>Math.abs(k-center)<=4&&k!==a[j].k);if(options.length)a[j].k=closest(options,center)}
 const room=16-a[last].s;a[last].l=closing?room:clamp(a[last].l,1,room);
 return a;
}
const patches=[
 ['Chão espaçado','Clarinete',2,'Pentatônica menor',[[0,6,0],[9,3,2],[16,6,0],[26,4,1]]],
 ['Guitarra no contratempo','Guitarra limpa',7,'Pentatônica menor',[[2,3,2],[10,3,0],[18,3,2],[25,2,1],[29,2,0]]],
 ['Flauta de baile','Flauta',9,'Menor natural',[[0,6,2],[8,3,1],[12,2,0],[16,6,2],[26,4,0]]],
 ['Piano de resposta','Piano elétrico',5,'Maior',[[2,5,2],[10,4,4],[18,5,2],[25,5,0]]],
 ['Sax segurado','Sax alto',2,'Menor natural',[[0,9,0],[12,3,1],[16,7,2],[26,5,0]]],
 ['Violão sincopado','Violão de nylon',4,'Pentatônica menor',[[0,4,0],[6,3,2],[12,2,1],[17,5,0],[26,4,2]]],
 ['Metais de chamada','Metais',7,'Menor natural',[[0,4,0],[6,3,2],[16,4,0],[22,3,2],[27,4,3]]],
 ['Piano minimal','Piano acústico',0,'Menor natural',[[0,7,0],[12,3,2],[20,8,1]]]
];
patches.forEach((x,i)=>add($('patch'),i,x[0]));
function patchNotes(i,variant=0){
 const [,inst,root,key,shape]=patches[i],mode=scales[key];
 return shape.map(([s,l,d],j)=>{
  if(variant%3===1&&j===shape.length-1)d=d===0?1:0;
  if(variant%3===2&&j===0)l=Math.max(2,l-2);
  return {s,l,k:60+root+mode[d],v:j===0?90:79,offset:0};
 });
}
function loadPatch(i){const [,inst,root,scale]=patches[i];Object.assign(p,{patch:i,variant:0,method:'preset',inst,root,scale,bars:2,fullLength:false,form:referenceForm,groove:0,freedom:0,notes:patchNotes(i)});sel=0}
function rhythmPhrase(m){
 const step=15/refTempo(m),ratio=p.bars/m.bars;
 const groups=new Map(),votes=Array(16).fill(0),out=[];
 for(const [time,weight] of m.attacks??[]){
  const s=clamp(Math.round(time/step*ratio),0,size()-1),bar=s>>4;
  if(!groups.has(bar))groups.set(bar,[]);groups.get(bar).push({s,weight});votes[s%16]+=weight;
 }
 // Recurring accents supply timing only. The written call and answer supply pitch.
 const shape=patches[0][4];p.root=2;p.scale='Pentatônica menor';
 for(const [bar,hits] of groups){
  const ranked=hits.map(h=>({...h,score:h.weight*(1+votes[h.s%16]/Math.max(.001,...votes))}));
  const strong=[];for(const h of ranked.sort((a,b)=>b.score-a.score)){
   if(strong.every(x=>Math.abs(x.s-h.s)>=6))strong.push(h);if(strong.length===2)break}
  strong.sort((a,b)=>a.s-b.s).forEach((h,j)=>{const n=shape[(bar%2)*2+j];out.push({s:h.s,k:62+scales[p.scale][n[2]],l:n[1],v:j?78:87,offset:0})});
 }
 out.forEach((n,j)=>n.l=clamp(n.l,1,Math.max(1,(out[j+1]?.s??size()+1)-n.s-1)));return out;
}

function cleanPhrase(m){
 // Only use sustained, periodic events; absent evidence leaves a rest.
 const stable=m.clean??[];
 p.rhythmOnly=stable.length<Math.max(2,m.duration/3);if(p.rhythmOnly)return rhythmPhrase(m);
 const model=meter({...m,events:stable}),ratio=p.bars/model.bars;
 const candidates=model.notes.map(([s,l,k,v])=>({s:clamp(Math.round(s*ratio),0,size()-1),l:Math.max(1,Math.round(l*ratio)),k,v}));
 const groups=new Map();for(let n of candidates){const bar=n.s>>4;if(!groups.has(bar))groups.set(bar,[]);groups.get(bar).push(n)}
 let chosen=[];for(const row of groups.values()){
  const keep=[];for(const n of row.sort((a,b)=>b.l*b.v-a.l*a.v)){
   if(keep.every(x=>Math.abs(n.s-x.s)>=4))keep.push(n);if(keep.length===3)break}
  chosen.push(...keep)}
 chosen.sort((a,b)=>a.s-b.s);
 const weights=Array(12).fill(0);for(const n of chosen)weights[n.k%12]+=n.l*n.v;
 const ranked=weights.map((w,k)=>({w,k})).filter(x=>x.w).sort((a,b)=>b.w-a.w).slice(0,4);
 const pcs=ranked.map(x=>x.k),sorted=chosen.map(n=>n.k).sort((a,b)=>a-b),center=clamp(sorted[sorted.length>>1],60,74);
 const palette=pcs.map(pc=>center+((pc-center+126)%12)-6);
 // Choose a key for subsequent edits; retain the stable pitch classes of the recording.
 let best=-Infinity;for(let root=0;root<12;root++)for(const scale of ['Menor natural','Maior','Pentatônica menor']){
  const degrees=scales[scale],score=ranked.reduce((v,x)=>v+(degrees.includes((x.k-root+12)%12)?x.w:0),0)+.1*weights[root];
  if(score>best){best=score;p.root=root;p.scale=scale}}
 return chosen.map((n,j)=>({s:n.s,k:palette[pcs.indexOf(n.k%12)]??closest(palette,n.k),l:clamp(n.l,1,Math.max(1,Math.min(size()-n.s,(chosen[j+1]?.s??size()+1)-n.s-1))),v:clamp(n.v,66,92),offset:0}));
}
$('patch').onchange=e=>{if(e.target.value==='')return;remember();loadPatch(+e.target.value);changed()};
$('quickVary').onclick=()=>{remember();if(p.method==='preset'){p.variant=((p.variant||0)+1)%3;p.notes=patchNotes(p.patch,p.variant);sel=0;changed()}else varyEnding()};
$('applyClean').onclick=()=>{remember();p.method='clean';p.form=referenceForm;p.fullLength=true;p.notes=compose();sel=0;changed();msg(p.notes.length?(p.rhythmOnly?'Usei os acentos do áudio com uma melodia pronta.':'Melodia simplificada da referência.'):'Nenhuma nota estável. Escolha um pontinho pronto ou outra referência.')};

function compose(rotate=false){
 const m=meter(reference(rotate));p.used=m.id;
 if(p.fullLength)p.bars=m.bars;
 if(p.method==='clean')return cleanPhrase(m);return m.notes.length?basePhrase(m):[];
}
function varyEnding(){if(p.method==='preset')p.method='edited';
 if(!p.notes.length)return;
 const last=p.notes[p.notes.length-1],barStart=Math.floor(last.s/16)*16;
 const boundary=Math.max(barStart,p.bars===1?8:0);
 const split=p.notes.findIndex(n=>n.s>=boundary);
 const index=split<0?p.notes.length-1:split;
 const first=p.notes[index].s,tail=p.notes.slice(index).map(n=>({...n,s:n.s-first}));
 const varied=reply(tail,false,true);
 // Keep the timing and trailing silence of the actual ending.
 p.notes=p.notes.slice(0,index).concat(varied.map((n,j)=>({...n,s:n.s+first,l:tail[j].l})));
 sel=index;changed();
}
$('groove').onchange=e=>{remember();p.groove=+e.target.value;changed()};
function guideLabel(){$('groove').value=p.groove??80;const sourceProfile=byId.get(p.used),m=sourceProfile?meter(sourceProfile):null;$('refBpm').value=m?.bpm??130;$('tempoType').textContent=p.refTempos?.[p.used]?'Informado por você':'Estimado';$('guide').value=p.guide??-1;$('freedom').value=p.freedom??1;$('hearGuide').disabled=!m;
 $('guideName').textContent=m?'Referência da frase · '+data.bank[m.id].n+' · áudio inteiro '+m.duration.toFixed(1).replace('.',',')+' s · '+m.bars+' compassos' + (m.events.length?'':' · nenhuma altura estável detectada'):'Projeto anterior · gere uma frase para associar uma referência.'}
$('guide').onchange=e=>{remember();p.method='clean';p.fullLength=true;p.guide=+e.target.value;p.notes=compose(true);sel=0;changed()};
$('freedom').onchange=e=>{remember();if(p.method==='preset')p.method='clean';p.freedom=+e.target.value;p.notes=compose();sel=0;changed()};
let hearingGuide=false;
$('hearGuide').onclick=async()=>{
 if(hearingGuide){stopPreview();return}
 const m=byId.get(p.used);if(!m)return;
 stopDesk();stop();stopPreview();hearingGuide=true;$('hearGuide').textContent='■ Parar referência';
 const token=genId;
 try{
  await audio().resume();const b=await decode(m.id);
  if(!hearingGuide||genId!==token||p.used!==m.id)return;
  const player=audio().createBufferSource();preview=player;player.buffer=b;
  player.connect(audio().destination);player.onended=()=>{if(preview===player)stopPreview()};
  player.start(0);
 }catch(e){stopPreview();msg('Não foi possível reproduzir a referência.')}
};
p.refTempos=readTempos();p.guide=12;p.used=12;loadPatch(0);
const pcmCache=new Map();function pcm(str){if(!pcmCache.has(str)){let raw=atob(str),arr=new Float32Array(raw.length/2);for(let i=0;i<arr.length;i++){let v=raw.charCodeAt(2*i)+256*raw.charCodeAt(2*i+1);arr[i]=(v>32767?v-65536:v)/32768}pcmCache.set(str,arr)}return pcmCache.get(str)}
function audio(){return ctx??=new AudioContext()}let decodedKey=-1,buf=null;
async function decode(id){if(decodedKey===id&&buf)return buf;const b=await audio().decodeAudioData(Uint8Array.from(atob(data.bank[id].d),c=>c.charCodeAt(0)).buffer);decodedKey=id;buf=b;return b}
function instrumentSounds(inst){if(timbresPonto.has(inst))return timbresPonto.sounds(inst);return Object.entries(data.tones[inst]).map(([k,v])=>({k:+k,y:pcm(v),sr:24000,loop:['Sax do seu ponto','Sax alto','Flauta','Clarinete','Metais','Lead quadrado'].includes(inst)}))}async function sampleSet(){if(p.inst!==custom)return instrumentSounds(p.inst);let c=copy(p.cut),b=await decode(c.id),sr=b.sampleRate,y=b.getChannelData(0),a=clamp(Math.floor(c.a*sr),0,y.length-2),end=clamp(Math.round((c.a+c.len)*sr),a+2,y.length);return [{k:c.base,y:y.subarray(a,end),sr,loop:true}]}
const RATE=44100;
function render(notes,sounds,secs,bpm){let out=new Float32Array(Math.round(secs*RATE));for(let n of notes){let sound=sounds.reduce((best,x)=>Math.abs(n.k-x.k)<Math.abs(n.k-best.k)?x:best),{y,sr,loop}=sound;let ratio=sr/RATE*2**((n.k-sound.k)/12),offset=Math.round(n.s*15/bpm*RATE),count=Math.min(out.length-offset,Math.round(n.l*15/bpm*RATE));let L=y.length,xf=Math.min(Math.floor(L*.16),Math.round(.022*sr)),lo=Math.floor(L*.32),cycle=L-lo-xf;for(let j=0;j<count;j++){let ix=j*ratio;if(loop&&ix>=L)ix=lo+xf+(ix-L)%cycle;if(ix>=L-1&&!loop)break;let k=Math.min(Math.floor(ix),L-2),f=ix-k,v=y[k]+(y[k+1]-y[k])*f;if(loop&&ix>=L-xf){let z=(ix-L+xf)/xf,idx=Math.min(L-1,lo+Math.floor(z*xf));v=v*(1-z)+y[idx]*z}let env=Math.min(1,j/(RATE*.006),(count-1-j)/(RATE*.027));out[offset+j]+=v*env*n.v*.008}}return out}
function performed(notes){
 const swing=(p.groove??80)/100;
 const starts=notes.map(n=>clamp(Math.round((n.s+(Number.isFinite(n.offset)?n.offset:0)*swing)*120),0,size()*120-1));
 return notes.map((n,i)=>{const start=starts[i],end=Math.min(starts[i+1]??size()*120,start+n.l*120);
 return {...n,s:start/120,l:Math.max(1,end-start)/120}});
}
async function mix(){let notes=performed(p.notes),bpm=p.bpm,secs=size()*dt(),sounds=await sampleSet();return render(notes,sounds,secs,bpm)}
function node(y,loop){let ac=audio(),b=ac.createBuffer(1,y.length,RATE);b.copyToChannel(y,0);let s=ac.createBufferSource();s.buffer=b;s.loop=loop;s.connect(ac.destination);return s}
function stop(){genId++;playing=false;if(source){source.stop();source=null}$('play').textContent='▶ Ouvir em loop';paint()}
function stopPreview(){hearingGuide=false;$('hearGuide').textContent='▶ Ouvir referência inteira';if(preview){try{preview.stop()}catch{}preview=null}$('ref').pause()}
async function play(replacing=false){stopDesk();if(hearingGuide)stopPreview();let token=++genId;let ac=audio();await ac.resume();let y=await mix();if(token!==genId)return;stopPreview();let s=node(y,true),now=ac.currentTime,offset=replacing&&playing?(now-epoch)%s.buffer.duration:0;if(source)source.stop();s.start(0,offset);source=s;epoch=now-offset;playing=true;$('play').textContent='■ Parar';if(!replacing)animate()}
function animate(){paint();if(playing)requestAnimationFrame(animate)}
function changed(){stopDesk();if(hearingGuide)stopPreview();draw();if(playing)play(true).catch(e=>msg(e.message))}
function selected(){return p.notes[sel]}
function draw(){deskDraw();$('patch').value=p.method==='preset'?p.patch:'';$('quickInfo').textContent=p.inst+' · '+p.notes.length+' notas · '+p.bars+' compassos'+(p.method==='clean'&&p.rhythmOnly?' · Ritmo da referência com melodia pronta':'');guideLabel();$('bars').value=p.fullLength?'full':p.bars;$('roll').style.minWidth=Math.min(10000,Math.max(640,48+p.bars*200))+'px';for(let k of ['inst','form','root','scale','bpm'])$(k).value=p[k];$('selected').replaceChildren();p.notes.forEach((n,i)=>add($('selected'),i,(i+1)+' · '+name(n.k)));sel=clamp(sel,0,Math.max(p.notes.length-1,0));$('selected').value=sel;let n=selected();for(let k of ['pitch','step','dur','vel','del','single'])$(k).disabled=!n;if(n){$('pitch').value=n.k;$('step').value=n.s+1;$('dur').value=n.l;$('vel').value=n.v}$('stats').textContent=p.notes.length+' notas · '+new Set(p.notes.map(n=>n.k)).size+' alturas';$('time').textContent=(size()*dt()).toFixed(2).replace('.',',')+' s';$('step').max=$('dur').max=size();paint()}
let drag=null,lastRange;function range(){let ks=p.notes.map(n=>n.k);let lo=clamp(Math.min(...ks,66)-2,36,83),hi=clamp(Math.max(...ks,74)+2,lo+10,96);return {lo,hi}}
function geom(){let c=$('roll'),w=c.clientWidth||1000,h=300,rg=drag?.rg??range();return {...rg,w,h,left:48,top:22,sw:(w-48)/size(),rh:(h-22)/(rg.hi-rg.lo+1)}}
function paint(){let c=$('roll'),g=c.getContext('2d'),{lo,hi,w,h,left,top,sw,rh}=geom(),dpr=window.devicePixelRatio||1;if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#111913';g.fillRect(0,0,w,h);g.font='10px monospace';for(let k=lo;k<=hi;k++){let y=top+(hi-k)*rh;g.fillStyle=[1,3,6,8,10].includes(k%12)?'#1a211c':'#232d24';g.fillRect(left,y,w-left,rh-1);g.fillStyle='#b7c5b4';g.fillText(name(k),5,y+rh*.72)}for(let s=0;s<size();s++){let x=left+s*sw;g.fillStyle=s%16===0?'#91a787':s%4===0?'#596b56':'#303a30';g.fillRect(x,top,1,h-top);if(s%4===0){g.fillStyle='#b8c6b4';g.fillText((1+(s>>4))+'.'+(1+((s%16)>>2)),x+3,15)}}p.notes.forEach((n,i)=>{let x=left+n.s*sw,y=top+(hi-n.k)*rh;g.fillStyle=i===sel?'#ffd090':'#b4df88';g.fillRect(x+1,y+1,Math.max(2,n.l*sw-2),rh-2);if(n.l*sw>37&&rh>10){g.fillStyle='#1a2b17';g.fillText(name(n.k),x+4,y+rh*.73)}});if(playing&&source){let x=left+((audio().currentTime-epoch)%source.buffer.duration)/source.buffer.duration*(w-left);g.fillStyle='#fff';g.fillRect(x,top,2,h-top)}}
function place(n,list){if(p.method==='preset')p.method='edited';let out=[];for(let a of list){if(a.s>=n.s+n.l||a.s+a.l<=n.s)out.push({...a});else if(a.s<n.s)out.push({...a,l:n.s-a.s});else if(a.s+a.l>n.s+n.l)out.push({...a,s:n.s+n.l,l:a.s+a.l-(n.s+n.l)})}out.push(n);out.sort((a,b)=>a.s-b.s);p.notes=out;sel=out.indexOf(n)}
function point(e,rg){let box=$('roll').getBoundingClientRect(),x=e.clientX-box.left,y=e.clientY-box.top;return {s:clamp(Math.floor((x-rg.left)/rg.sw),0,size()-1),k:clamp(rg.hi-Math.floor((y-rg.top)/rg.rh),36,96),x,y}}
const roll=$('roll');roll.onpointerdown=e=>{let rg=geom(),pos=point(e,rg);if(pos.x<rg.left||pos.y<rg.top)return;roll.setPointerCapture(e.pointerId);let i=p.notes.findIndex(n=>n.k===pos.k&&pos.s>=n.s&&pos.s<n.s+n.l);remember();if(i<0){place({s:pos.s,k:pos.k,l:Math.min(2,size()-pos.s),v:86},p.notes);i=sel}sel=i;let n=copy(selected());drag={rg,n,others:p.notes.filter((_,j)=>j!==sel),pos,resize:pos.x>rg.left+(n.s+n.l)*rg.sw-Math.min(10,.4*rg.sw)};draw()};
roll.onpointermove=e=>{if(!drag)return;let a=point(e,drag.rg),n={...drag.n};if(drag.resize)n.l=clamp(n.l+a.s-drag.pos.s,1,size()-n.s);else{n.s=clamp(n.s+a.s-drag.pos.s,0,size()-n.l);n.k=clamp(n.k+a.k-drag.pos.k,36,96)}place(n,drag.others);draw()};roll.onpointercancel=roll.onpointerup=()=>{if(drag){drag=null;changed()}};
function previewY(y){stopDesk();stop();stopPreview();let ac=audio();ac.resume();preview=node(y,false);preview.start()}
$('single').onclick=async()=>{let n=selected();if(n)previewY(render([{...n,s:0}],await sampleSet(),n.l*dt(),p.bpm))};
$('play').onclick=()=>{if(playing)stop();else play().catch(e=>msg('Falha na reprodução: '+e.message))};
$('gen').onclick=()=>{remember();p.method='detailed';p.notes=compose(true);sel=0;changed();msg('Frase detalhada gerada.')};
$('ending').onclick=()=>{remember();varyEnding()};
$('undo').onclick=()=>{if(!hist.length)return;const st=p.studio;p=hist.pop();if(st)p.studio=st;$('undo').disabled=!hist.length;changed()};
$('selected').onchange=e=>{sel=+e.target.value;draw()};
for(let [key,prop] of [['pitch','k'],['step','s'],['dur','l'],['vel','v']])$(key).onchange=e=>{let n=copy(selected());remember();let v=Math.round(+e.target.value);if(prop==='s'){n.s=clamp(v-1,0,size()-1);n.l=Math.min(n.l,size()-n.s)}else n[prop]=prop==='k'?clamp(v,36,96):prop==='l'?clamp(v,1,size()-n.s):clamp(v,1,100);place(n,p.notes.filter((_,i)=>i!==sel));changed()};
$('del').onclick=()=>{if(!selected())return;remember();p.notes.splice(sel,1);changed()};
$('bpm').onchange=e=>{remember();p.bpm=clamp(Math.round(+e.target.value)||130,60,220);changed()};
$('inst').onchange=e=>{remember();if(p.method==='preset')p.method='edited';p.inst=e.target.value;changed()};
$('form').onchange=e=>{remember();if(p.method==='preset')p.method='clean';p.form=+e.target.value;p.notes=compose();changed()};
$('root').onchange=e=>{remember();let v=+e.target.value,d=v-p.root;if(p.method==='preset')p.method='edited';p.root=v;p.notes.forEach(n=>n.k=clamp(n.k+d,36,96));changed()};
$('scale').onchange=e=>{remember();if(p.method==='preset')p.method='edited';p.scale=e.target.value;let allowed=Array.from({length:61},(_,i)=>36+i).filter(k=>scales[p.scale].includes((k-p.root+120)%12));p.notes.forEach(n=>n.k=allowed.reduce((a,k)=>Math.abs(k-n.k)<Math.abs(a-n.k)?k:a));changed()};
$('bars').onchange=e=>{remember();if(p.method==='preset')p.method='clean';p.fullLength=e.target.value==='full';if(!p.fullLength)p.bars=+e.target.value;p.notes=compose();sel=0;changed();msg('Frase refeita para a duração escolhida. Desfazer recupera a edição anterior.')};
function saveBlob(bytes,filename,type){let url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}
function wav(y){let bytes=new Uint8Array(44+y.length*2),v=new DataView(bytes.buffer),txt=(i,s)=>bytes.set(new TextEncoder().encode(s),i);txt(0,'RIFF');v.setUint32(4,bytes.length-8,true);txt(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,RATE,true);v.setUint32(28,RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);txt(36,'data');v.setUint32(40,y.length*2,true);for(let i=0;i<y.length;i++)v.setInt16(44+i*2,Math.round(clamp(y[i],-1,1)*32767),true);return bytes}
function midi(){let track=[],put=(...b)=>track.push(...b),varlen=x=>{let a=[x&127];while(x>>=7)a.unshift(128|x&127);return a},us=Math.round(60000000/p.bpm),programs=[0,4,27,28,24,65,73,71,61,80,65],pc=timbresPonto.has(p.inst)?timbresPonto.program(p.inst):(programs[builtin.indexOf(p.inst)]??0);put(0,255,81,3,us>>16,(us>>8)&255,us&255,0,255,88,4,4,2,24,8,0,192,pc);let tick=0;for(let n of performed(p.notes)){let s=Math.round(n.s*120),l=Math.round(n.l*120);put(...varlen(s-tick),144,n.k,Math.round(n.v*1.27),...varlen(l),128,n.k,0);tick=s+l}put(...varlen(size()*120-tick),255,47,0);let l=track.length;return Uint8Array.from([77,84,104,100,0,0,0,6,0,0,0,1,1,224,77,84,114,107,l>>>24,l>>>16,l>>>8,l,...track])}
const fname=()=>'Pontinho - '+p.inst+' - '+p.bpm+' BPM - '+p.bars+' comp';
$('wav').onclick=async()=>{if(!p.notes.length)return msg('Adicione uma nota antes de exportar.');let fn=fname();saveBlob(wav(await mix()),fn+'.wav','audio/wav');msg('Loop WAV exportado em 44,1 kHz, com a duração exata dos compassos.')};$('mid').onclick=()=>{saveBlob(midi(),fname()+'.mid','audio/midi');msg('MIDI exportado com notas, durações e andamento.')};
$('save').onclick=()=>saveBlob(JSON.stringify(p),'Pontinho-projeto.json','application/json');$('open').onclick=()=>$('file').click();
const bound=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
function valid(q){return q?.version===2&&(q.groove===undefined||[0,80,100].includes(q.groove))&&(q.freedom===undefined||[0,1,2].includes(q.freedom))&&(q.guide===undefined||q.guide===-1||byId.has(q.guide))&&(q.used===undefined||byId.has(q.used))&&bound(q.bpm,60,220)&&bound(q.bars,1,512)&&(q.fullLength===undefined||typeof q.fullLength==='boolean')&&bound(q.root,0,11)&&Object.hasOwn(scales,q.scale)&&bound(q.form,0,forms.length-1)&&[...builtin,custom].includes(q.inst)&&q.cut&&bound(q.cut.id,0,data.bank.length-1)&&bound(q.cut.base,36,96)&&Number.isFinite(q.cut.a)&&q.cut.a>=0&&Number.isFinite(q.cut.len)&&q.cut.len>=.029&&q.cut.len<=6&&Array.isArray(q.notes)&&q.notes.length<=q.bars*16&&q.notes.every((n,i)=>bound(n.s,0,q.bars*16-1)&&bound(n.l,1,q.bars*16-n.s)&&bound(n.k,36,96)&&bound(n.v,1,100)&&(n.offset===undefined||Number.isFinite(n.offset)&&Math.abs(n.offset)<=.24)&&(!i||n.s>=q.notes[i-1].s+q.notes[i-1].l))}
$('file').onchange=async e=>{try{let q=JSON.parse(await e.target.files[0].text());if(q.version===1){$('oldpanel').hidden=false;$('oldpanel').open=true;msg('Abra esse projeto no botão Abrir projeto da mesa anterior.');return}if(!valid(q)||(q.desk&&!deskValid(q.desk))||(q.method==='preset'&&!patches[q.patch]))throw Error();remember();stopDesk();stop();stopPreview();p=q;p.refTempos={...readTempos(),...(q.refTempos??{})};sel=0;syncCut();draw();msg('Projeto aberto.')}catch{msg('Arquivo de projeto inválido.')}finally{e.target.value=''}};
function syncCut(){$('src').value=p.cut.id;$('origin').value=p.cut.base;$('from').value=p.cut.a;$('span').value=p.cut.len}
async function readCut(){let id=+$('src').value,b=await decode(id),a=clamp(+$('from').value||0,0,Math.max(0,b.duration-.03)),len=Math.min(b.duration-a,clamp(+$('span').value||.30,.03,6));if(len<.029)throw Error('Escolha um trecho maior.');return {b,c:{id,a,len,base:+$('origin').value}}}
$('raw').onclick=async()=>{let {b,c}=await readCut();stopDesk();stop();stopPreview();await audio().resume();preview=audio().createBufferSource();preview.buffer=b;preview.connect(audio().destination);preview.start(0,c.a,c.len)};
$('useSample').onclick=async()=>{let {c}=await readCut();remember();p.cut=c;if(p.method==='preset')p.method='edited';p.inst=custom;syncCut();changed();msg('Corte aplicado a todas as notas da frase.')};
$('ref').onplay=()=>{stopDesk();stop();if(preview){preview.stop();preview=null}};
$('oldpanel').ontoggle=()=>{if(!$('oldpanel').open){let w=$('old').querySelector('iframe')?.contentWindow;w?.stop?.();w?.stopPreview?.();return}stop();stopPreview();if($('old').firstChild)return;let f=document.createElement('iframe');f.title='Mesa de batidas anterior';f.className='legacy';f.srcdoc=data.legacy.replace('BANKDATA',JSON.stringify(data.bank).replaceAll('<','\\u003c'));$('old').append(f)};
const elements=[
 ['Chamada longa',[[0,6,0],[16,6,0]]],['Resposta curta',[[9,3,2],[26,4,1]]],
 ['Contratempo',[[2,3,2],[10,2,0],[18,3,2],[26,2,1]]],['Frase de volta',[[21,3,2],[27,4,0]]],
 ['Nota sustentada',[[0,9,0],[18,7,1]]],['Toque de passagem',[[13,2,1],[29,2,2]]],
 ['Pergunta de piano',[[0,4,0],[6,4,2],[16,4,0],[22,4,2]]],
 ['Corda em síncope',[[0,3,0],[6,2,1],[16,3,0],[23,2,2]]],
 ['Resposta de metal',[[10,3,2],[28,3,0]]],
 ['Assovio sustentado',[[0,7,2],[16,8,1]]],
 ['Toque de madeira',[[9,2,0],[13,1,1],[26,2,0],[30,1,2]]],
 ['Chamada de fole',[[1,5,0],[9,3,1],[17,6,0]]],
 ['Volta dedilhada',[[13,2,2],[25,3,1],[30,1,0]]]
];
const arrangements=[
 ['Chão e resposta',2,[[0,'Clarinete'],[1,'Guitarra limpa']]],
 ['Funk de flauta',9,[[4,'Flauta'],[5,'Piano elétrico']]],
 ['Cordas de baile',4,[[2,'Violão de nylon'],[5,'Guitarra abafada']]],
 ['Sax e teclas',2,[[0,'Sax alto'],[1,'Piano acústico']]],
 ['Metais no corte',7,[[6,'Metais'],[5,'Clarinete']]],
 ['Mesa vazia',2,[]],
 ['Cavaco e sino',2,[[7,'Cavaquinho dedilhado'],[8,'Sino de vidro']]],
 ['Assovio e marimba',7,[[9,'Assovio suave'],[10,'Marimba']]],
 ['Sanfona e bandolim',4,[[11,'Sanfona curta'],[12,'Bandolim dobrado']]],
 ['Órgão e kalimba',5,[[0,'Órgão de baile'],[1,'Kalimba']]],
 ['Bambu e vibrafone',9,[[4,'Flauta de bambu'],[5,'Vibrafone']]],
 ['Lead e pluck',2,[[0,'Lead nasal'],[1,'Pluck elástico']]]
];
const kits=arrangements,sections=['Intro','Base','Virada','Pausa','Volta','Final'];
function elementNotes(el,root){return elements[el][1].map(([s,l,k])=>({s,l,k:60+root+[0,3,5][k],v:88}))}
function deskRow(el,inst,root){return {label:elements[el][0],inst,vol:78,on:true,notes:elementNotes(el,root)}}
function section(name,rows,bars=2,reps=1){return {name,rows:copy(rows),bars,reps}}
function makeDesk(style){
 const [,root,kit]=kits[style],rows=kit.map(([el,inst])=>deskRow(el,inst,root));
 if(!rows.length)return {style,root,blocks:[section('Base',[])]};
 const intro=section('Intro',rows.slice(0,1),1),base=section('Base',rows,2,2),fill=section('Virada',rows.slice(-1),1),back=section('Volta',rows);
 fill.rows[0].notes=[{s:6,l:3,k:60+root+5,v:84},{s:12,l:2,k:60+root+3,v:76}];
 for(const block of [intro,base,fill,back]){const extra=['Guitarra limpa','Piano elétrico','Flauta','Violão de nylon','Sax alto','Metais'];while(block.rows.length<6){const j=block.rows.length;block.rows.push({label:'Elemento '+(j+1),inst:extra[j],vol:78,on:true,notes:[]})}}return {style,root,blocks:[intro,base,fill,back]};
}
function oldRowsOK(d){return Array.isArray(d.rows)&&d.rows.length<=8&&d.rows.every(r=>r&&elements[r.el]&&builtin.includes(r.inst)&&Number.isFinite(r.vol)&&r.vol>=0&&r.vol<=100&&typeof r.on==='boolean')}
function deskValid(d){return !!d&&Number.isInteger(d.style)&&!!kits[d.style]&&(d.division===undefined||[4,8,16,32].includes(d.division))&&(d.waveId===undefined||byId.has(d.waveId))&&(d.waveTempo===undefined||Number.isFinite(d.waveTempo)&&d.waveTempo>=40&&d.waveTempo<=300)&&(d.waveOffset===undefined||Number.isFinite(d.waveOffset)&&Math.abs(d.waveOffset)<=86400)&&bound(d.root,0,11)&&(d.blocks===undefined?oldRowsOK(d):Array.isArray(d.blocks)&&d.blocks.length>=1&&d.blocks.length<=32&&d.blocks.every(b=>b&&sections.includes(b.name)&&bound(b.bars,1,512)&&bound(b.reps,1,16)&&Array.isArray(b.rows)&&b.rows.length<=8&&b.rows.every(r=>r&&typeof r.label==='string'&&r.label.length<=120&&builtin.includes(r.inst)&&bound(r.vol,0,100)&&typeof r.on==='boolean'&&Array.isArray(r.notes)&&r.notes.length<=8192&&r.notes.every((n,j)=>n&&bound(n.s*2,0,16383)&&bound(n.k,36,96)&&bound(n.l*2,1,16384)&&bound(n.v,1,100)&&(!j||n.s>r.notes[j-1].s)))));}
function deskState(){const d=p.desk??=makeDesk(0);if(!d.blocks){d.blocks=[section('Base',d.rows.map(r=>({...deskRow(r.el,r.inst,d.root),vol:r.vol,on:r.on})))];delete d.rows}return d}
let editBlock=0,page=0,deskLive=false,deskTimer,nextDesk,playedStep=0,deskToken=0,deskBus;
const current=()=>deskState().blocks[editBlock],width=b=>16*b.bars,totalSteps=()=>deskState().blocks.reduce((s,b)=>s+width(b)*b.reps,0);
function locate(s){const blocks=deskState().blocks;for(let i=0;i<blocks.length;i++){const b=blocks[i],period=width(b);if(s<period*b.reps)return {i,step:s%period};s-=period*b.reps}return {i:0,step:0}}
function atStep(b,s,fn){for(const r of b.rows){if(!r.on||!r.vol)continue;let i=r.notes.findIndex(n=>n.s===s);if(i<0)continue;let n=r.notes[i];fn(r,{...n,s:0,l:Math.min(n.l,(r.notes[i+1]?.s??width(b))-s,width(b)-s),v:n.v*r.vol/100})}}
function stopDesk(){deskToken++;deskLive=false;clearInterval(deskTimer);if(deskBus){deskBus._limiter?.disconnect();deskBus.disconnect();deskBus=null}$('deskPlay').textContent='▶ Tocar';$('deskPos').textContent='';deskHighlight(-1,-1)}
function deskHighlight(i,s){const marker=$('waveCursor');marker.hidden=i!==editBlock||Math.floor(s/16)!==page;if(!marker.hidden)marker.style.left=((s%16)/16*100)+'%';for(const el of $('deskRows').querySelectorAll('.hit-now'))el.classList.remove('hit-now');if(i===editBlock&&s>>4===page)for(const el of $('deskRows').querySelectorAll('[data-beat="'+Math.floor((s%16)*cellsPerBar()/16)+'"]'))el.classList.add('hit-now');for(const [j,el] of Array.from($('sequence').children).entries())el.classList.toggle('sounding',j===i)}
async function playDesk(){if(deskLive){stopDesk();return}stop();stopPreview();stopDesk();const token=deskToken,ctx=audio();await ctx.resume();if(token!==deskToken)return;deskLive=true;deskBus=ctx.createGain();deskBus.gain.value=.8;const limiter=ctx.createDynamicsCompressor();deskBus.connect(limiter).connect(ctx.destination);deskBus._limiter=limiter;
 $('deskPlay').textContent='■ Parar';playedStep=0;nextDesk=ctx.currentTime+.06;
 function tick(){while(nextDesk<ctx.currentTime+.09){const loop=$('deskMode').value==='loop';if(!loop&&playedStep>=totalSteps()){if(ctx.currentTime>=nextDesk)stopDesk();return}
 const {i,step}=loop?{i:editBlock,step:playedStep%width(current())}:locate(playedStep),b=deskState().blocks[i],at=nextDesk;
 atStep(b,step,(r,n)=>{const y=render([n],instrumentSounds(r.inst),n.l*dt(),p.bpm),buf=ctx.createBuffer(1,y.length,RATE);buf.copyToChannel(y,0);const src=ctx.createBufferSource();src.buffer=buf;src.connect(deskBus);src.start(at)});
 setTimeout(()=>{if(token===deskToken){deskHighlight(i,step);$('deskPos').textContent=b.name+' · compasso '+((step>>4)+1)}},Math.max(0,(at-ctx.currentTime)*1000));playedStep+=.5;nextDesk+=dt()/2}}
 tick();deskTimer=setInterval(tick,25);
}
function renderBar(b,bar,bpm=p.bpm){const beat=15/bpm,first=bar*16,last=first+16,duration=16*beat,y=new Float32Array(Math.round(duration*RATE));for(const r of b.rows){if(!r.on||!r.vol)continue;
 for(let i=0;i<r.notes.length;i++){let n=r.notes[i];if(n.s>=last)break;let len=Math.min(n.l,(r.notes[i+1]?.s??width(b))-n.s,width(b)-n.s);if(n.s+len<=first)continue;const wave=render([{...n,s:0,l:len,v:n.v*r.vol/100}],instrumentSounds(r.inst),len*beat,bpm),offset=Math.round((n.s-first)*beat*RATE);
 for(let k=Math.max(0,-offset);k<Math.min(wave.length,y.length-offset);k++)y[k+offset]+=wave[k]*.8;
 }}return y}
async function exportDesk(){const d=copy(deskState()),bpm=p.bpm,dt0=15/bpm,total=d.blocks.reduce((s,b)=>s+width(b)*b.reps,0),frames=Math.round(total*dt0*RATE);
 if(!d.blocks.some(b=>b.rows.some(r=>r.on&&r.vol&&r.notes.some(n=>n.s<width(b)))))return msg('Adicione uma nota a uma linha ativa para exportar.');
 if(frames*2>1.5e9)return msg('Reduza o número de repetições para exportar esse arranjo.');
 $('deskWav').disabled=true;try{const header=wav(new Float32Array(0)),view=new DataView(header.buffer);view.setUint32(4,36+frames*2,true);view.setUint32(40,frames*2,true);let parts=[header],barIndex=0;
 for(const b of d.blocks){const cache=[];for(let bar=0;bar<b.bars;bar++){const y=renderBar(b,bar,bpm);cache.push(wav(y).subarray(44))}
 for(let rep=0;rep<b.reps;rep++)for(const data of cache){const count=Math.round((barIndex+1)*16*dt0*RATE)-Math.round(barIndex*16*dt0*RATE);parts.push(data.subarray(0,count*2));if(count*2>data.length)parts.push(new Uint8Array(count*2-data.length));barIndex++}
 await new Promise(r=>setTimeout(r,0))}
 saveBlob(new Blob(parts),'Mesa - arranjo inteiro - '+bpm+' BPM.wav','audio/wav');msg('Arranjo inteiro exportado.')}finally{$('deskWav').disabled=false}}
function uiButton(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b}
function edit(fn,structure=false){if(structure)stopDesk();remember();fn();deskDraw()}
function selectBlock(i){if($('deskMode').value==='loop')stopDesk();editBlock=i;page=0;deskDraw()}
function order(from,to){const blocks=deskState().blocks;if(from===to||!blocks[from]||!blocks[to])return;edit(()=>{blocks.splice(to,0,blocks.splice(from,1)[0]);editBlock=to;page=0},true)}
const paletteNames=['Principal','Resposta','Passagem','Sustentação'];
const trackColors=['#f39577','#f6c273','#e5d38b','#cbdc95','#c2ec71','#74c6b2','#8ebde3','#d99bbc'];
const cellsPerBar=()=>deskState().division??16;
function noteAtColumn(r,s,unit){return r.notes.find(n=>n.s>=s&&n.s<s+unit)}
function noteAcross(r,s){return r.notes.find((n,i)=>n.s<s&&Math.min(n.s+n.l,r.notes[i+1]?.s??Infinity)>s)}
function writeSpan(r,col,last,dragged){
 const unit=16/cellsPerBar(),base=16*page,start=base+col*unit;
 const attack=noteAtColumn(r,start,unit),held=noteAcross(r,start),existing=attack||held;
 if(!dragged&&attack){r.notes=r.notes.filter(n=>n!==attack);return}
 const begin=dragged&&existing?Math.min(existing.s,base+Math.min(col,last)*unit):base+Math.min(col,last)*unit;
 const end=base+(Math.max(col,last)+1)*unit;
 const old=r.notes.filter(n=>n.s<begin||n.s>=end);
 for(const n of old)if(n.s<begin&&n.s+n.l>begin)n.l=begin-n.s;
 old.push({s:begin,l:end-begin,k:dragged&&existing?existing.k:+$('deskPitch').value,v:existing?.v??88});
 r.notes=old.sort((a,b)=>a.s-b.s);
}
const picked=new Set();let boxScope=null,boxPage=-1,anchorCell=null,clipboard=null;
function overlaps(r,n,a,b){const j=r.notes.indexOf(n);return n.s<b&&Math.min(n.s+n.l,r.notes[j+1]?.s??Infinity)>a}
function selectedEntries(){return current().rows.flatMap((r,i)=>r.notes.filter(n=>picked.has(n)).map(n=>({r,i,n})))}
function selectionUI(){
 const entries=selectedEntries(),count=entries.length;
 $('selCount').textContent=count+' nota'+(count===1?'':'s')+' selecionada'+(count===1?'':'s');
 for(const id of ['copySet','deleteSet','upSet','downSet'])$(id).disabled=!count;
 $('pasteSet').disabled=!clipboard||!anchorCell;$('insertSet').disabled=!anchorCell;
 for(const cell of $('deskRows').querySelectorAll('.cell')){const r=current().rows[+cell.dataset.row],a=page*16+Number(cell.dataset.beat)*16/cellsPerBar();cell.classList.toggle('picked',entries.some(x=>x.r===r&&overlaps(r,x.n,a,a+16/cellsPerBar())))}
}
function selectArea(r1,r2,c1,c2){picked.clear();const unit=16/cellsPerBar(),a=16*page+Math.min(c1,c2)*unit,b=16*page+(Math.max(c1,c2)+1)*unit;
 current().rows.slice(Math.min(r1,r2),Math.max(r1,r2)+1).forEach(r=>r.notes.forEach(n=>{if(overlaps(r,n,a,b))picked.add(n)}));selectionUI()}
function where(ev){const rows=Array.from($('deskRows').querySelectorAll('.sequencer-line')).slice(1);if(!rows.length)return null;
 const r=rows.findIndex(row=>ev.clientY<=row.getBoundingClientRect().bottom),i=r<0?rows.length-1:r;
 const first=rows[i].querySelector('.cell').getBoundingClientRect(),last=rows[i].lastElementChild.getBoundingClientRect();
 return {r:i,c:clamp(Math.floor((ev.clientX-first.left)*cellsPerBar()/(last.right-first.left)),0,cellsPerBar()-1)}}
$('deskRows').addEventListener('pointerdown',e=>{
 if(e.button!==0||!e.isPrimary||e.target.closest('select')||($('editTool').value==='draw'&&e.target.closest('.cell')))return;
 const start=where(e);if(!start)return;e.preventDefault();e.stopPropagation();const box=$('deskRows'),rect=box.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,id=e.pointerId;
 anchorCell=start;$('selTools').hidden=false;box.setPointerCapture(id);
 const mark=$('marquee');function move(ev){if(ev.pointerId!==id)return;let end=where(ev);if(!end)return;
 selectArea(start.r,end.r,start.c,end.c);mark.hidden=false;Object.assign(mark.style,{left:Math.min(x,ev.clientX-rect.left)+'px',top:Math.min(y,ev.clientY-rect.top)+'px',width:Math.abs(ev.clientX-rect.left-x)+'px',height:Math.abs(ev.clientY-rect.top-y)+'px'})}
 function end(ev){if(ev.pointerId!==id)return;mark.hidden=true;box.onpointermove=box.onpointerup=box.onpointercancel=box.onlostpointercapture=null}
 box.onpointermove=move;box.onpointerup=ev=>{move(ev);end(ev)};box.onpointercancel=box.onlostpointercapture=end;move(e);
},true);
$('allSet').onclick=()=>{picked.clear();current().rows.forEach(r=>r.notes.forEach(n=>{if(overlaps(r,n,page*16,(page+1)*16))picked.add(n)}));selectionUI()};
$('deleteSet').onclick=()=>edit(()=>{current().rows.forEach(r=>r.notes=r.notes.filter(n=>!picked.has(n)));picked.clear()});
for(const [id,d] of [['upSet',1],['downSet',-1]])$(id).onclick=()=>edit(()=>selectedEntries().forEach(({n})=>n.k=clamp(n.k+d,36,96)));
$('copySet').onclick=()=>{const es=selectedEntries();if(!es.length)return;let s=Math.min(...es.map(x=>x.n.s)),r=Math.min(...es.map(x=>x.i));clipboard=es.map(x=>({row:x.i-r,n:{...x.n,s:x.n.s-s}}));selectionUI()};
$('pasteSet').onclick=()=>{if(!clipboard||!anchorCell)return;const b=current(),at=page*16+anchorCell.c*16/cellsPerBar(),rows=clipboard.map(x=>({r:b.rows[x.row+anchorCell.r],n:{...x.n,s:x.n.s+at}}));
 if(rows.some(({r,n})=>!r||n.s+n.l>width(b)||r.notes.some(o=>overlaps(r,o,n.s,n.s+n.l)))){ $('selCount').textContent='Escolha espaço livre que comporte todas as notas.';return}
 edit(()=>{picked.clear();for(const {r,n} of rows){r.notes.push(n);r.notes.sort((a,b)=>a.s-b.s);picked.add(n)}})};
$('insertSet').onclick=()=>{if(!anchorCell)return;const {r,c}=anchorCell;edit(()=>writeSpan(current().rows[r],c,c,false))};
$('clearDesk').onclick=()=>edit(()=>{for(const b of deskState().blocks)for(const r of b.rows)r.notes=[];picked.clear();msg('Notas de todos os blocos apagadas. Use Desfazer para recuperar.')},true);
$('deskUndo').onclick=()=>$('undo').click();
$('editTool').onchange=()=>{$('selTools').hidden=$('editTool').value==='draw';picked.clear();selectionUI()};
let pitchTarget=null;
function closePitch(){pitchTarget=null;$('pitchDialog').hidden=true}
function auditionPitch(){if(!pitchTarget)return;const {r}=pitchTarget,k=+$('ctxKey').value+12*(+$('ctxOct').value+1);if(k<36||k>96)return;previewY(render([{s:0,k,l:3,v:85}],instrumentSounds(r.inst),3*dt(),p.bpm))}
function pitchMenu(e,r,col){const a=page*16+col*16/cellsPerBar(),n=noteAtColumn(r,a,16/cellsPerBar())||noteAcross(r,a);if(!n)return;
 e.preventDefault();$('ctxHint').textContent='';pitchTarget={r,n};$('ctxKey').value=n.k%12;$('ctxOct').value=Math.floor(n.k/12)-1;const box=$('pitchDialog');box.hidden=false;box.style.left=clamp(e.clientX,5,Math.max(5,window.innerWidth-box.offsetWidth-8))+'px';box.style.top=clamp(e.clientY,5,Math.max(5,window.innerHeight-box.offsetHeight-8))+'px';$('ctxKey').focus()}
labels.forEach((l,i)=>add($('ctxKey'),i,l));for(let i=2;i<=7;i++)add($('ctxOct'),i,i);
$('ctxListen').onclick=auditionPitch;$('ctxClose').onclick=closePitch;
$('ctxApply').onclick=()=>{if(!pitchTarget)return;const k=+$('ctxKey').value+12*(+$('ctxOct').value+1);if(k>96){$('ctxHint').textContent='Na oitava 7, escolha Dó. Para outra nota, use a oitava 6.';return}const {n}=pitchTarget;auditionPitch();closePitch();edit(()=>n.k=k)};
document.addEventListener('pointerdown',e=>{if(pitchTarget&&!$('pitchDialog').contains(e.target))closePitch()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePitch();$('selTools').hidden=true;picked.clear();selectionUI()}});
const overviewCache=new Map();
function overview(m,id,start,len){const c=$('overview'),g=c.getContext('2d'),w=c.width,h=c.height;
 if(!overviewCache.has(id)){const raw=waveCache.get(id),arr=new Uint8Array(w);for(let x=0;x<w;x++){
 const a=Math.floor(x*raw.length/w),b=Math.ceil((x+1)*raw.length/w);for(let i=a;i<b;i++)arr[x]=Math.max(arr[x],raw.charCodeAt(i))}overviewCache.set(id,arr)}
 const peaks=overviewCache.get(id);g.fillStyle='#131914';g.fillRect(0,0,w,h);g.fillStyle='#7bae9d';for(let i=0;i<w;i++){const hh=Math.max(1,h*peaks[i]/255);g.fillRect(i,(h-hh)/2,1,hh)}
 const x=w*start/m.duration,ww=w*len/m.duration;g.fillStyle='#b3ee8844';g.fillRect(x,0,ww,h);g.strokeStyle='#d4f69b';g.strokeRect(x,1,ww,h-2)}
function setWaveStart(start){const {m,len}=waveInfo();deskState().waveOffset=Math.round((clamp(start,-len,m.duration)-page*len)*1000)/1000;drawWave()}
for(const [id,all] of [['deskWave',false],['overview',true]]){
 const c=$(id);c.onpointerdown=e=>{if(e.button!==0||deskState().waveOff)return;e.preventDefault();stopPreview();remember();c.setPointerCapture(e.pointerId);const rect=c.getBoundingClientRect(),initial=e.clientX,{start,len,m}=waveInfo();
 const absolute=x=>(x-rect.left)/rect.width*m.duration;
 const grab=all&&absolute(initial)>=start&&absolute(initial)<=start+len?absolute(initial)-start:len/2;
 function move(ev){if(ev.pointerId===e.pointerId)setWaveStart(all?absolute(ev.clientX)-grab:start-(ev.clientX-initial)*len/rect.width)}
 function end(){c.onpointermove=c.onpointerup=c.onpointercancel=c.onlostpointercapture=null}
 c.onpointermove=move;c.onpointerup=ev=>{move(ev);end()};c.onpointercancel=c.onlostpointercapture=end;if(all)move(e)};
}
$('waveRemove').onclick=()=>{if(deskState().waveOff)return;edit(()=>{stopPreview();deskState().waveOff=true})};

function drawCells(row,r,index,div){
 const unit=16/div,buttons=[];
 for(let j=0;j<div;j++){
  const s=page*16+j*unit,n=noteAtColumn(r,s,unit),held=noteAcross(r,s);
  const cell=uiButton('',e=>{if(e.detail===0){if($('editTool').value==='select'){anchorCell={r:index,c:j};$('selTools').hidden=false;selectArea(index,index,j,j)}else edit(()=>writeSpan(r,j,j,false))}});
  cell.className='cell'+(n?' onset':held?' hold':'')+(j%(div/4)===0?' down':'');
  cell.dataset.beat=j;cell.dataset.row=index;cell.oncontextmenu=e=>pitchMenu(e,r,j);cell.title=r.inst+' · quadrado '+(j+1)+(n?' · '+name(n.k):'');cell.setAttribute('aria-label',cell.title);cell.setAttribute('aria-pressed',!!(n||held));
  cell.onpointerdown=e=>{
   if(e.button!==0||!e.isPrimary)return;e.preventDefault();cell.setPointerCapture(e.pointerId);
   const id=e.pointerId;let end=j,moved=false;
   function update(x){const left=buttons[0].getBoundingClientRect().left,right=buttons.at(-1).getBoundingClientRect().right;
    end=clamp(Math.floor((x-left)*div/(right-left)),0,div-1);moved||=end!==j;
    buttons.forEach((b,k)=>b.classList.toggle('stretch',k>=Math.min(end,j)&&k<=Math.max(end,j)))}
   const clear=()=>{cell.onpointermove=cell.onpointerup=cell.onpointercancel=cell.onlostpointercapture=null;buttons.forEach(b=>b.classList.remove('stretch'))};
   cell.onpointermove=ev=>{if(ev.pointerId===id)update(ev.clientX)};
   cell.onpointerup=ev=>{if(ev.pointerId!==id)return;update(ev.clientX);clear();edit(()=>writeSpan(r,j,end,moved))};cell.onpointercancel=cell.onlostpointercapture=clear;update(e.clientX)
  };buttons.push(cell);row.append(cell)
 }
}
const waveCache=new Map();
function waveInfo(){
 const d=deskState(),id=d.waveId??p.used??12,m=byId.get(id),bpm=d.waveTempo??refTempo(m),start=(d.waveOffset??0)+page*240/bpm;
 return {id,m,bpm,start,len:240/bpm};
}
function drawWave(){
 const off=!!deskState().waveOff;$('refDetail').hidden=$('overviewPanel').hidden=off;$('waveRemove').disabled=$('wavePlay').disabled=$('waveOffset').disabled=$('waveBpm').disabled=off;
 if(off){$('wavePick').value='';$('waveTime').textContent='Sem referência';return}
 const {id,m,bpm,start,len}=waveInfo();$('wavePick').value=id;$('waveBpm').value=Number(bpm.toFixed(2));$('waveOffset').value=deskState().waveOffset??0;
 $('waveTime').textContent=start.toFixed(2)+'–'+(start+len).toFixed(2)+' s · '+(start>=m.duration?'fim do áudio':'compasso '+(page+1));
 const c=$('deskWave'),g=c.getContext('2d'),w=c.width,h=c.height,div=cellsPerBar();
 if(!waveCache.has(id))waveCache.set(id,atob(data.waves[id]));const raw=waveCache.get(id);g.fillStyle='#131914';g.fillRect(0,0,w,h);
 for(let j=0;j<div;j++){g.fillStyle=j%(div/4)===0?'#74836e':'#39443a';g.fillRect(j*w/div,0,1,h)}
 g.fillStyle='#67bda6';for(let x=0;x<w;x++){const lo=Math.floor((start+len*x/w)*250),hi=Math.max(lo+1,Math.ceil((start+len*(x+1)/w)*250));let neg=0,pos=0;
  for(let i=Math.max(0,lo);i<hi&&i*2+1<raw.length;i++){neg=Math.max(neg,raw.charCodeAt(i*2));pos=Math.max(pos,raw.charCodeAt(i*2+1))}g.fillRect(x,h/2-pos*h/512,1,Math.max(1,(pos+neg)*h/512))}
 overview(m,id,start,len);
}
add($('wavePick'),'','Sem referência');
$('wavePick').onchange=e=>edit(()=>{let d=deskState();d.waveOff=e.target.value==='';if(d.waveOff){stopPreview();return}d.waveId=+e.target.value;delete d.waveTempo;d.waveOffset=0;stopPreview()});
$('waveBpm').onchange=e=>edit(()=>deskState().waveTempo=clamp(+e.target.value||130,40,300));
$('waveOffset').onchange=e=>edit(()=>deskState().waveOffset=clamp(+e.target.value||0,-86400,waveInfo().m.duration));
$('wavePlay').onclick=async()=>{stopDesk();stop();stopPreview();const {id,start,len,m}=waveInfo();if(deskState().waveOff||start>=m.duration||start+len<=0)return;const token=genId;await audio().resume();const b=await decode(id);if(token!==genId||id!==waveInfo().id)return;preview=audio().createBufferSource();preview.buffer=b;preview.connect(audio().destination);const at=Math.max(0,start),duration=Math.min(start+len,b.duration)-at;if(duration>0)preview.start(audio().currentTime+Math.max(0,-start),at,duration)};
$('divisions').onchange=e=>edit(()=>deskState().division=+e.target.value);
profiles.slice().sort((a,b)=>data.bank[a.id].n.localeCompare(data.bank[b.id].n,'pt-BR')).forEach(m=>add($('wavePick'),m.id,data.bank[m.id].n));
function deskDraw(){
 closePitch();const d=deskState();editBlock=clamp(editBlock,0,d.blocks.length-1);const b=current();page=clamp(page,0,b.bars-1);
 $('deskStyle').value=d.style;$('deskBpm').textContent=p.bpm+' BPM · '+totalSteps()/16+' compassos · '+(totalSteps()*dt()).toFixed(1)+' s';
 $('sectionName').value=b.name;$('sectionBars').value=b.bars;$('sectionReps').value=b.reps;$('rmBlock').disabled=d.blocks.length===1;$('dupBlock').disabled=$('addBlock').disabled=d.blocks.length>=32;$('moveLeft').disabled=editBlock===0;$('moveRight').disabled=editBlock===d.blocks.length-1;
 const seq=$('sequence');seq.replaceChildren();d.blocks.forEach((item,i)=>{const el=uiButton(item.name+' · '+item.bars+' comp.'+(item.reps>1?' ×'+item.reps:''),()=>selectBlock(i));el.className=i===editBlock?'chosen':'';el.draggable=true;el.ondragstart=e=>e.dataTransfer.setData('text/plain',String(i));el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const n=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(n))order(n,i)};seq.append(el)});
 $('deskPage').textContent='Compasso '+(page+1)+' de '+b.bars;$('prevPage').disabled=page===0;$('nextPage').disabled=page===b.bars-1;
 if(boxScope!==b||boxPage!==page){picked.clear();anchorCell=null;boxScope=b;boxPage=page}
 const div=cellsPerBar(),box=$('deskRows');box.replaceChildren();$('divisions').value=div;$('gridInner').style.setProperty('--div',div);$('gridInner').style.minWidth='0';
 const head=document.createElement('div');head.className='sequencer-line';head.append(document.createElement('span'));for(let j=0;j<div;j++){const el=document.createElement('small');el.textContent=j%(div/4)===0?1+j/(div/4):'·';head.append(el)}box.append(head);
 b.rows.forEach((r,i)=>{const row=document.createElement('div');row.className='sequencer-line';row.style.setProperty('--color',trackColors[i%8]);const inst=document.createElement('select');builtin.forEach(v=>add(inst,v,v));inst.value=r.inst;inst.title=r.label+' · trocar instrumento';inst.onchange=()=>edit(()=>r.inst=inst.value);row.append(inst);drawCells(row,r,i,div);box.append(row)});
 const mix=$('rowMix');mix.replaceChildren();b.rows.forEach((r,i)=>{const line=document.createElement('div');line.className='flex';const desc=document.createElement('span');desc.textContent=r.inst;line.append(desc);const part=document.createElement('select');add(part,'',r.label+' · trocar padrão');elements.forEach((x,j)=>add(part,j,x[0]));part.onchange=()=>{if(part.value!=='')edit(()=>{r.label=elements[+part.value][0];r.notes=elementNotes(+part.value,d.root)})};line.append(part);
 const vol=document.createElement('input');vol.type='range';vol.min=0;vol.max=100;vol.value=r.vol;vol.title='Volume';vol.onchange=()=>edit(()=>r.vol=+vol.value);line.append(vol,uiButton(r.on?'Silenciar':'Ativar',()=>edit(()=>r.on=!r.on)),uiButton('Remover',()=>edit(()=>b.rows.splice(i,1))));mix.append(line)});
 selectionUI();drawWave();
 $('deskAdd').disabled=$('copyMelody').disabled=b.rows.length>=8;$('deskEmpty').hidden=!!b.rows.length;
}
kits.forEach((k,i)=>add($('deskStyle'),i,k[0]));sections.forEach(k=>add($('sectionName'),k,k));builtin.forEach(k=>add($('newInst'),k,k));$('newInst').value='Guitarra limpa';
for(let k=48;k<=84;k++)add($('deskPitch'),k,name(k));$('deskPitch').value=62;
$('deskStyle').onchange=e=>edit(()=>{p.desk=makeDesk(+e.target.value);editBlock=page=0},true);
$('deskAdd').onclick=()=>edit(()=>{const b=current();if(b.rows.length<8)b.rows.push({label:paletteNames[b.rows.length%4],inst:$('newInst').value,vol:78,on:true,notes:[]})});
$('copyMelody').onclick=()=>{if(!p.notes.length)return msg('O editor precisa de pelo menos uma nota.');if(!builtin.includes(p.inst))return msg('Escolha um timbre instrumental no editor para levar o pontinho à mesa.');edit(()=>{const b=current();if(b.rows.length>=8)return;b.bars=Math.max(b.bars,p.bars);b.rows.push({label:'Pontinho do editor',inst:p.inst,vol:78,on:true,notes:copy(p.notes)})},true)};
$('deskMode').onchange=stopDesk;$('deskPlay').onclick=playDesk;$('deskWav').onclick=exportDesk;
$('sectionName').onchange=e=>edit(()=>current().name=e.target.value);
$('sectionBars').onchange=e=>edit(()=>current().bars=clamp(Math.round(+e.target.value)||1,1,512),true);
$('sectionReps').onchange=e=>edit(()=>current().reps=clamp(Math.round(+e.target.value)||1,1,16),true);
function appendBlock(duplicate){if(deskState().blocks.length>=32)return;edit(()=>{let b=duplicate?copy(current()):section('Base',current().rows.map(r=>({...r,notes:[]})),2);deskState().blocks.splice(++editBlock,0,b);page=0},true)}
$('addBlock').onclick=()=>appendBlock(false);$('dupBlock').onclick=()=>appendBlock(true);
$('rmBlock').onclick=()=>{if(deskState().blocks.length>1)edit(()=>{deskState().blocks.splice(editBlock,1);page=0},true)};
$('moveLeft').onclick=()=>order(editBlock,editBlock-1);$('moveRight').onclick=()=>order(editBlock,editBlock+1);
$('prevPage').onclick=()=>{page--;deskDraw()};$('nextPage').onclick=()=>{page++;deskDraw()};
window.addEventListener('resize',paint);syncCut();draw();
