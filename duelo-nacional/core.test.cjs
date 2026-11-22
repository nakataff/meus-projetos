const {test}=require('node:test');
const assert=require('node:assert/strict');
const {layoutRounds,roundsForView,roundEdges,createPublisher}=require('./core.js');
const sample={slots:['mc31','mc13','mc6','mc15','mc9','mc8','mc2','mc10','mc23','mc27','mc22','mc19','mc5','mc30','mc29','mc17','mc3','mc11','mc21','mc12','mc14','mc20','mc0','mc28','mc24','mc7','mc16','mc1','mc4','mc18','mc26','mc25'],manualRounds:{1:['mc22','mc24','mc14','mc31','mc4','mc3','mc23','mc0','mc6','mc5','mc29','mc9','mc16','mc21','mc2','mc26'],2:Array(8).fill(null),3:Array(4).fill(null),4:Array(2).fill(null)},results:{}};
['mc31','mc6','mc9','mc2','mc23','mc22','mc5','mc29','mc3','mc21','mc14','mc0','mc24','mc16','mc4','mc26'].forEach((winnerId,i)=>sample.results['0-'+i]={winnerId});
['mc24','mc14','mc3','mc23','mc6','mc29','mc21'].forEach((winnerId,i)=>sample.results['1-'+i]={winnerId});
function rounds(state){
 let slots=state.slots;const out=[];
 for(let r=0;r<5;r++){
  slots=state.manualRounds[r]||slots;
  const ms=[];for(let m=0;m<slots.length/2;m++){
   const a=slots[2*m],b=slots[2*m+1],result=state.results[`${r}-${m}`];
   ms.push({r,m,a,b,winner:a&&b&&result?result.winnerId:null});
  }out.push(ms);slots=ms.map(m=>m.winner);
 }return out;
}
const wait=()=>new Promise(resolve=>setImmediate(resolve));
test('cada fase mantém 01 até o último duelo mesmo com sorteios posteriores',()=>{
 const data=structuredClone(sample);data.manualRounds[2]=['mc21','mc24',null,null,null,null,null,null];
 const original=rounds(data),before=JSON.stringify(original);
 for(const view of ['first','oitavas','quartas','semis','final']){
  const display=roundsForView(original,data.manualRounds,view);
  assert.deepEqual(display,original);
  for(const stage of display)assert.deepEqual(stage.map(m=>m.m),Array.from({length:stage.length},(_,i)=>i));
 }
 for(const view of ['all','a','b','all-first','all-round16','all-last']){
  const display=roundsForView(original,data.manualRounds,view);
  assert.deepEqual(display,layoutRounds(original,data.manualRounds));
  assert.equal(display[1][0].winner,'mc21');assert.equal(display[1][1].winner,'mc24');
 }
 assert.equal(JSON.stringify(original),before);
});
test('sorteio alinha as 16 origens sem alterar participantes, IDs ou resultados',()=>{
 const original=rounds(sample),before=JSON.stringify(original),layout=layoutRounds(original,sample.manualRounds);
 assert.equal(JSON.stringify(original),before);
 for(let i=0;i<8;i++){
  assert.equal(layout[0][2*i].winner,layout[1][i].a);
  assert.equal(layout[0][2*i+1].winner,layout[1][i].b);
 }
 assert.equal(layout[0][14].winner,'mc2');assert.equal(layout[0][15].winner,'mc26');
 const edges=roundEdges(layout[0],layout[1],true);assert.equal(edges.length,16);
 assert.equal(edges.find(e=>layout[0][e.from].winner==='mc4').to,2);
 assert.equal(edges.find(e=>layout[0][e.from].winner==='mc2').to,7);
});
test('fases futuras reorganizam as origens e conexões seguem os vencedores reais',()=>{
 const data=structuredClone(sample);data.manualRounds[2]=['mc21','mc24',null,null,null,null,null,null];
 const layout=layoutRounds(rounds(data),data.manualRounds);
 assert.equal(layout[1][0].winner,'mc21');assert.equal(layout[1][1].winner,'mc24');
 const edges=roundEdges(layout[1],layout[2],true);assert.equal(edges.length,2);assert.ok(edges.every(e=>e.to===0));
 for(const e of roundEdges(layout[0],layout[1],true))assert.ok([layout[1][e.to].a,layout[1][e.to].b].includes(layout[0][e.from].winner));
});
test('sem sorteio não inventa conexões; fase automática mantém a origem por ID',()=>{
 const source=[{m:1,winner:'B'},{m:0,winner:'A'}],target=[{m:0,a:null,b:null}];
 assert.deepEqual(roundEdges(source,target,true),[]);
 assert.deepEqual(roundEdges(source,target,false),[{from:0,to:0},{from:1,to:0}]);
});
test('salvamento automático não publica estado inalterado e agrupa cliques rápidos',async()=>{
 const writes=[];let sha='a';const p=createPublisher({delay:10000,read:async()=>({sha}),write:async input=>{writes.push(input);sha='b';return {sha}}});
 p.initialize({sha,state:{score:0}});p.changed({score:0});await p.flush();assert.equal(writes.length,0);
 p.changed({score:1});p.changed({score:2});await p.flush();assert.equal(writes.length,1);assert.deepEqual(writes[0].state,{score:2});assert.equal(p.hasPending(),false);p.dispose();
});
test('clique durante a gravação entra na fila e usa o SHA confirmado anterior',async()=>{
 let release;const gate=new Promise(resolve=>release=resolve),writes=[];let sha='a';
 const p=createPublisher({delay:10000,read:async()=>({sha}),write:async input=>{writes.push(structuredClone(input));if(writes.length===1)await gate;sha=String(writes.length);return {sha}}});
 p.initialize({sha,state:{score:0}});p.changed({score:1});const first=p.flush();await wait();
 p.changed({score:2});release();await first;await wait();
 assert.deepEqual(writes.map(w=>w.state.score),[1,2]);assert.deepEqual(writes.map(w=>w.sha),['a','1']);assert.equal(p.hasPending(),false);p.dispose();
});
test('falha mantém o resultado pendente para tentar novamente',async()=>{
 let offline=true,writes=0;const errors=[];
 const p=createPublisher({delay:10000,read:async()=>{if(offline)throw Error('offline');return {sha:'a'}},write:async()=>{writes++;return {sha:'b'}},onStatus:(kind,error)=>{if(error)errors.push(error.message)}});
 p.initialize({sha:'a',state:{score:0}});p.changed({score:1});await p.flush();assert.equal(p.hasPending(),true);assert.deepEqual(errors,['offline']);
 offline=false;await p.flush();assert.equal(writes,1);assert.equal(p.hasPending(),false);p.dispose();
});
test('outra sessão não é sobrescrita; desconectar cancela publicações agendadas',async()=>{
 let writes=0;const p=createPublisher({delay:10000,read:async()=>({sha:'new'}),write:async()=>{writes++;return {sha:'b'}}});
 p.initialize({sha:'old',state:{score:0}});p.changed({score:1});await p.flush();await p.flush();assert.equal(writes,0);assert.equal(p.hasPending(),true);p.dispose();
 const q=createPublisher({read:async()=>({sha:'a'}),write:async()=>{writes++}});q.initialize({sha:'a',state:{score:0}});q.changed({score:1});q.dispose();await q.flush();assert.equal(writes,0);
});

