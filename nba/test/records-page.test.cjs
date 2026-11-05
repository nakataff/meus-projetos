'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const strip=s=>s.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
async function settle(condition){for(let i=0;i<50;i++){if(condition())return;await new Promise(r=>setTimeout(r,5));}assert(condition(),'página não renderizou');}
test('recordes exibem marcas de um jogo, mudam categoria e abrem a partida correta',async()=>{
 const dom=new JSDOM('<main id="pageContent"></main>',{url:'https://example.com/nba/recordes/',runScripts:'outside-only'}),w=dom.window;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rounds={regular:[['1',1,'game1','BOS',36,5,8,1,0,2,32,12,24,6,9,8.8],['2',1,'game1','LAL',40,8,4,3,2,2,35,15,28,4,10,9.4]],preseason:[]};
 const leaders={regular:[{id:'1',name:'Primeiro',team:'BOS'},{id:'2',name:'Segundo',team:'LAL'}],preseason:[]};
 const game={id:'espn_game1',externalId:'game1',date:'2026-11-01',away:'BOS',home:'LAL',scoreAway:110,scoreHome:101};
 const scrollCalls=[];
 w.HTMLElement.prototype.scrollIntoView=function(options){scrollCalls.push({id:this.id,options});};
 w.history.replaceState(null,'',w.location.pathname+w.location.search+'#ranking-recordes');
 Object.assign(w,{$:s=>w.document.querySelector(s),setupShared:()=>{},asset:s=>s,esc,logo:c=>'/'+c+'.png',name:c=>c,
  playerLink:(id,t)=>'/nba/jogador/?id='+id+'&team='+t,gameLink:g=>'/nba/jogo/?id='+g.id+'&data='+g.date,
  loadGames:async()=>[game],fetch:async p=>({ok:true,json:async()=>p.includes('rounds')?rounds:leaders})});
 try{
  vm.runInContext(strip(read('js/season-stats.mjs')),dom.getInternalVMContext());
  vm.runInContext(strip(read('js/pages/records.js')),dom.getInternalVMContext());
  await settle(()=>w.document.querySelector('.records-entry'));
  assert.equal(scrollCalls.length,1,'Link direto deve rolar ao ranking após carregar os dados');
  assert.equal(scrollCalls[0].id,'ranking-recordes');
  assert.equal(w.document.querySelector('.records-entry .records-player strong').textContent,'Segundo');
  assert(w.document.querySelector('.records-game a').href.includes('espn_game1'));
  w.document.querySelector('[data-record-metric="threeM"] .records-tile-photo').click();
  assert.equal(scrollCalls.length,2,'Clicar na foto deve descer ao ranking selecionado');
  assert.equal(scrollCalls[1].id,'ranking-recordes');
  assert.equal(scrollCalls[1].options.behavior,'smooth');
  assert.equal(w.document.querySelector('.records-entry .records-player strong').textContent,'Primeiro');
  assert.equal(w.document.querySelector('.records-entry .records-value strong').textContent,'6');
  assert.equal(w.document.querySelectorAll('.records-tile').length,9);
  assert.equal(w.document.querySelectorAll('.records-tile-photo').length,9);
  assert(w.document.querySelector('.records-tile-photo').getAttribute('src').includes('/2.png'));
  assert.equal(w.document.querySelector('.records-tile-photo').getAttribute('alt'),'');
  w.document.querySelector('[data-record-phase="preseason"]').click();
  assert(w.document.querySelector('#pageContent').textContent.includes('Ainda não há atuações'));
 }finally{w.close();}
});

test('recordes incluem um final recente empatado sem esperar o arquivo publicado e sem duplicar após o sync',async()=>{
 const dom=new JSDOM('<main id="pageContent"></main>',{url:'https://example.com/nba/recordes/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 const wemby={id:'5104157',name:'Victor Wembanyama',pts:52,reb:24,ast:2,stl:2,blk:8,to:2,min:'34',fg:'16-28',three:'1-8',hasStats:true};
 const event={id:'401909933',status:'final',seasonType:2,date:'2026-11-04',away:'DAL',home:'SAS',scoreAway:111,scoreHome:112};
 const cached=['luka',1,'earlier','LAL',52,8,10,2,0,4,38,17,30,8,18,10];
 const players=[{id:'luka',name:'Luka Doncic',team:'LAL'}],calls=[];
 let imported=false,now=Date.now();
 w.Date.now=()=>now;
 Object.assign(w,{$:s=>w.document.querySelector(s),setupShared:()=>{},asset:s=>s,esc:String,logo:c=>'/'+c+'.png',
  playerLink:(id,t)=>'/nba/jogador/?id='+id+'&team='+t,gameLink:g=>'/nba/jogo/?id='+g.id+'&data='+g.date,
  performanceRating:()=>10,loadGames:async()=>[],
  fetch:async p=>({ok:true,json:async()=>p.includes('rounds')?
   {regular:imported?[cached,[wemby.id,6,event.id,'SAS',52,24,2,2,8,2,34,16,28,1,8,10]]:[cached],preseason:[],
    countedGameIds:{regular:imported?['earlier',event.id]:['earlier'],preseason:[]}}:
   {regular:imported?[...players,wemby]:players,preseason:[]}}),
  fetchLiveBoxscore:async e=>{
   calls.push(e.id);
   const roster=code=>Array.from({length:5},(_,i)=>({id:code+i,name:code+i,min:'20',pts:10,reb:2,ast:2,hasStats:true}));
   return {status:'final',scoreAway:111,scoreHome:112,box:{players:{DAL:roster('DAL'),SAS:[wemby,...roster('SAS')]}}};
  }});
 try{
  vm.runInContext(strip(read('js/season-stats.mjs')),dom.getInternalVMContext());
  vm.runInContext(strip(read('js/pages/records.js')),dom.getInternalVMContext());
  const names=()=>[...w.document.querySelectorAll('.records-entry .records-player strong')].map(x=>x.textContent);
  await settle(()=>names().length===1);
  w.QUADRA_LIVE_GAMES=new Map([
   [event.id,event],['earlier',{...event,id:'earlier'}],['ongoing',{...event,id:'ongoing',status:'live'}]
  ]);
  w.dispatchEvent(new w.Event('quadra:live-update'));
  await settle(()=>names().includes(wemby.name));
  assert.deepEqual(calls,[event.id]);
  assert.deepEqual([...w.document.querySelectorAll('.records-place')].slice(0,2).map(x=>x.textContent),['1º','1º']);
  assert.match(w.document.querySelector('a[href*="espn_401909933"]').closest('.records-entry').textContent,/111 × 112/);
  imported=true;now+=121000;
  w.dispatchEvent(new w.Event('quadra:live-update'));
  await settle(()=>w.document.body.textContent.includes('6º jogo do atleta'));
  assert.equal(names().filter(x=>x===wemby.name).length,1);
  assert.deepEqual(calls,[event.id]);
 }finally{w.close();}
});
