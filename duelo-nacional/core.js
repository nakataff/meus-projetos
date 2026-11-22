(function(root){
 'use strict';
 // Reorder only display copies. Match identifiers and official results stay intact.
 function layoutRounds(rounds,manualRounds={}){
  const layout=rounds.map(round=>round.slice());
  for(let r=layout.length-1;r>0;r--){
   const source=layout[r-1],assigned=Array(source.length).fill(null),used=new Set();
   for(let i=0;i<layout[r].length;i++)for(let side=0;side<2;side++){
    const target=layout[r][i],id=side?target.b:target.a;
    const from=Array.isArray(manualRounds[r])?source.findIndex(m=>id&&m.winner===id):source.findIndex(m=>m.m===target.m*2+side);
    if(from>=0&&!used.has(from)){assigned[i*2+side]=source[from];used.add(from)}
   }
   let next=0;layout[r-1]=assigned.map(m=>{if(m)return m;while(used.has(next))next++;return source[next++]});
  }
  return layout;
 }
 function roundEdges(source,destination,manual=false){
  const edges=[];
  source.forEach((from,fromIndex)=>{
   const toIndex=manual?destination.findIndex(to=>from.winner&&(to.a===from.winner||to.b===from.winner)):destination.findIndex(to=>to.m===Math.floor(from.m/2));
   if(toIndex>=0)edges.push({from:fromIndex,to:toIndex});
  });return edges;
 }
 function roundsForView(rounds,manualRounds,view){
  // Individual stages keep their recorded duel order; bracket views trace advancement.
  return ['first','oitavas','quartas','semis','final'].includes(view)
   ?rounds.map(round=>round.slice())
   :layoutRounds(rounds,manualRounds);
 }
 function createPublisher({read,write,onStatus=()=>{},onCommitted=()=>{},delay=250}){
  let sha='',published='',latest='',running=false,timer=null,disposed=false,conflict=false;
  const pending=()=>!!latest&&latest!==published;
  async function flush(){
   clearTimeout(timer);timer=null;
   if(disposed||running||conflict||!pending())return;
   const snapshot=latest;running=true;let success=false;onStatus('publishing');
   try{
    const live=await read();if(disposed)return;
    if(live.sha!==sha){conflict=true;throw Error('Outra sessão publicou resultados. Faça um Backup JSON do rascunho e recarregue antes de continuar.')}
    const result=await write({state:JSON.parse(snapshot),sha});
    if(disposed)return;
    sha=result.sha;published=snapshot;success=true;onCommitted(JSON.parse(snapshot),result);
    onStatus(pending()?'pending':'saved');
   }catch(error){if(!disposed)onStatus('error',error)}
   finally{running=false;if(success&&!disposed&&pending())void flush()}
  }
  return {
   initialize(value){sha=value.sha;published=latest=JSON.stringify(value.state);conflict=false},
   changed(state){if(disposed)return;latest=JSON.stringify(state);if(!pending())return;onStatus('pending');if(running||conflict)return;clearTimeout(timer);timer=setTimeout(flush,delay)},
   flush,
   hasPending:pending,
   dispose(){disposed=true;clearTimeout(timer)}
  };
 }
 const api={layoutRounds,roundsForView,roundEdges,createPublisher};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DueloCore=api;
})(globalThis);

