const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
test('agenda filters locally with native broadcast select and searchable team checkboxes',async()=>{
 const d=new JSDOM('<main id="pageContent"></main>',{url:'https://example.com/nba/jogos/',runScripts:'outside-only'}),w=d.window;let loads=0;
 const g=(id,platforms)=>({id,platforms,date:'2026-10-24',away:'BOS',home:'LAL',stage:'Temporada regular'});
 Object.assign(w,{$:s=>w.document.querySelector(s),setupShared:()=>{},MONTHS:['2026-10'],loadGames:async()=>{loads++;return [g('espn',['ESPN']),g('prime',['PRIME']),g('both',['PRIME','ESPN']),g('league',['LEAGUE']),{...g('unknown',[]),away:'MIA',home:'NYK'}];},TEAMS:{BOS:['Boston Celtics'],LAL:['Los Angeles Lakers'],MIA:['Miami Heat'],NYK:['New York Knicks']},groupGames:list=>list.map(x=>x.id).join(','),gameRow:x=>'<b data-game="'+x.id+'">'+x.id+'</b>',handleWishes:()=>false,currentDate:()=> '2026-10-24',dayShift:(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+86400000*n).toISOString().slice(0,10),niceDate:x=>x,note:()=>({}),esc:String,qs:()=>null,modal:()=>{},closeModal:()=>{},overnightGame:()=>false});
 try{
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/pages/games.js'),'utf8').replace(/^import[^\n]*\n/,''),d.getInternalVMContext());await new Promise(r=>setImmediate(r));
 const $=s=>w.document.querySelector(s),ids=()=>[...w.document.querySelectorAll('[data-game]')].map(x=>x.dataset.game),pick=value=>{$('#broadcastGames').value=value;$('#broadcastGames').dispatchEvent(new w.Event('change',{bubbles:true}));},team=code=>$('[data-agenda-team="'+code+'"]').click();
 assert.equal($('#searchGames'),null);assert.equal($('#broadcastGames').tagName,'SELECT');assert.equal(ids().length,5);
 pick('ESPN');assert.deepEqual(ids(),['espn','both']);pick('PRIME');assert.deepEqual(ids(),['prime','both']);pick('OTHER');assert.deepEqual(ids(),['unknown']);pick('LEAGUE');assert.deepEqual(ids(),['league']);pick('');
 team('BOS');assert.equal(ids().length,4);team('MIA');assert.equal(ids().length,5);assert($('#teamFilterLabel').textContent.includes('2 equipes'));
 $('#agendaTeamSearch').value='lakers';$('#agendaTeamSearch').dispatchEvent(new w.Event('input',{bubbles:true}));assert(!$('[data-team-option="LAL"]').hidden);assert($('[data-team-option="BOS"]').hidden);assert.equal(ids().length,5);
 team('MIA');team('BOS');assert($('[data-agenda-team="ALL"]').checked);assert.equal(ids().length,5);assert.equal(loads,1);
 $('#teamGames').open=true;w.document.body.click();assert.equal($('#teamGames').open,false);
 }finally{w.close();}
});
