const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
test('team summary and games show recent finals newest first without duplicating them as upcoming',async()=>{
 const dom=new JSDOM('<main id="pageContent"></main>',{url:'https://example.com/nba/equipe/?id=BOS',runScripts:'outside-only'}),w=dom.window;
 let loads=0,months;
 const fixtures=[
  {id:'old',away:'BOS',home:'LAL',date:'2026-09-30',status:'final'},
  {id:'today-final',away:'LAL',home:'BOS',date:'2026-10-24',status:'final'},
  {id:'future',away:'BOS',home:'LAL',date:'2026-10-25',status:'scheduled'},
  {id:'other',away:'MIA',home:'LAL',date:'2026-10-24',status:'final'}
 ];
 Object.assign(w,{$:s=>w.document.querySelector(s),setupShared:()=>{},TEAMS:{BOS:[],LAL:[]},EAST:{Atlantic:['BOS']},WEST:{Pacific:['LAL']},name:x=>x,logo:x=>x,esc:String,qs:()=> 'BOS',fetchRoster:async()=>[],loadGames:async m=>{loads++;months=Array.from(m);return fixtures;},MONTHS:['2026-09','2026-10','2026-11'],currentDate:()=> '2026-10-24',shortDate:x=>x,teamLink:x=>x,playerLink:x=>x,path:x=>x,jsonFile:async()=>({}),getData:()=>({settings:{},extras:{}}),setSettings:()=>{},modify:()=>{},modal:()=>{},closeModal:()=>{},toast:()=>{},groupGames:list=>list.map(g=>'<a class="test-game" href="/jogo/?id='+g.id+'">'+g.id+'</a>').join(''),handleWishes:()=>false,effectiveGame:g=>g});
 try{
 const code=fs.readFileSync(require('node:path').join(__dirname,'../js/pages/team.js'),'utf8').replace(/^import[\s\S]*?from[^\n]*\n/m,'');
 vm.runInContext(code,dom.getInternalVMContext());
 for(let i=0;i<30&&!w.document.querySelector('.test-game');i++)await new Promise(r=>setTimeout(r,5));
 const ids=()=>[...w.document.querySelectorAll('.test-game')].map(a=>a.textContent);
 assert.deepEqual(ids(),['today-final','old']);
 assert.deepEqual(months,['2026-09','2026-10','2026-11']);
 w.document.querySelector('[data-tab="jogos"]').click();
 assert.deepEqual(ids(),['today-final','old','future']);
 w.document.querySelector('[data-tab="resumo"]').click();
 w.document.querySelector('[data-tab="jogos"]').click();
 assert.equal(loads,1);
 }finally{w.close();}
});
