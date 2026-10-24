const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
test('agenda uses one team field and locally matches any selected broadcaster without duplicating games',async()=>{
 const d=new JSDOM('<main id="pageContent"></main>',{url:'https://example.com/nba/jogos/',runScripts:'outside-only'}),w=d.window;let loads=0;
 const g=(id,platforms)=>({id,platforms,date:'2026-10-24',away:'BOS',home:'LAL',stage:'Temporada regular'});
 Object.assign(w,{$:s=>w.document.querySelector(s),setupShared:()=>{},MONTHS:['2026-10'],loadGames:async()=>{loads++;return [g('espn',['ESPN']),g('prime',['PRIME']),g('both',['PRIME','ESPN']),g('league',['LEAGUE']),g('unknown',[])];},TEAMS:{BOS:['Boston Celtics'],LAL:['Los Angeles Lakers']},groupGames:list=>list.map(x=>x.id).join(','),gameRow:x=>'<b data-game="'+x.id+'">'+x.id+'</b>',handleWishes:()=>false,currentDate:()=> '2026-10-24',dayShift:(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+86400000*n).toISOString().slice(0,10),niceDate:x=>x,note:()=>({}),esc:String,qs:()=>null,modal:()=>{},closeModal:()=>{},overnightGame:()=>false});
 try{
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/pages/games.js'),'utf8').replace(/^import[^\n]*\n/,''),d.getInternalVMContext());await new Promise(r=>setImmediate(r));
 const $=s=>w.document.querySelector(s),ids=()=>[...w.document.querySelectorAll('[data-game]')].map(x=>x.dataset.game),click=p=>$('[data-broadcast="'+p+'"]').click();
 assert.equal($('#searchGames'),null);assert($('#teamGames'));assert.equal(ids().length,5);
 click('ESPN');assert.deepEqual(ids(),['espn','both']);click('PRIME');assert.deepEqual(ids(),['espn','prime','both']);assert($('#broadcastFilterLabel').textContent.includes('2 locais'));
 click('ESPN');click('PRIME');assert.equal(ids().length,5);assert($('[data-broadcast="ALL"]').checked);
 click('OTHER');assert.deepEqual(ids(),['unknown']);click('ALL');click('LEAGUE');assert.deepEqual(ids(),['league']);assert.equal(loads,1);
 }finally{w.close();}
});
