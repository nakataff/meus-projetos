const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
test('global search loads one lazy index, filters locally and remembers compact dock',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const dom=new JSDOM(html,{url:'https://example.com/nba/',runScripts:'outside-only'}),w=dom.window;
 let requests=0;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 Object.assign(w,{TEAMS:{BOS:[],LAL:[]},name:c=>c==='BOS'?'Boston Celtics':'Los Angeles Lakers',logo:c=>'/'+c+'.png',path:s=>'/nba/'+s,playerLink:(id,t)=>'/nba/jogador/?id='+id+'&team='+t,teamLink:c=>'/nba/equipe/?id='+c,shortDate:s=>s,currentDate:()=> '2026-10-24',jsonFile:async()=>{requests++;return {players:[['1','João <script>','BOS'],['2','Outro','LAL']],games:[['11','BOS','LAL','2026-10-24','20:00']]};}});
 const source=fs.readFileSync(path.join(__dirname,'../js/navigation.js'),'utf8').replace(/^import[^\n]*\n/,'').replace(/export /g,'');
 try{
 vm.runInContext(source+'\nmountNavigation();',dom.getInternalVMContext());
 const $=s=>w.document.querySelector(s),type=async s=>{$('.dlq-search-head input').value=s;$('.dlq-search-head input').dispatchEvent(new w.Event('input'));await new Promise(r=>setTimeout(r,120));};
 assert.equal(requests,0);$('.dlq-search-open').click();await new Promise(r=>setImmediate(r));assert.equal(requests,1);
 await type('joao');assert($('.dlq-search-results').textContent.includes('João <script>'));assert.equal($('.dlq-search-results script'),null);
 await type('BOS LAL');assert($('.dlq-search-result').href.includes('id=11'));assert.equal(requests,1);
 $('.dlq-search-head button').click();$('.dlq-search-open').click();await type('lakers');assert.equal(requests,1);assert($('.dlq-search-results').textContent.includes('Los Angeles Lakers'));
 $('.dlq-dock-toggle').click();assert($('.dlq-dock').classList.contains('is-collapsed'));assert.equal(w.localStorage.getItem('dlq-dock-collapsed'),'1');assert.equal($('.dlq-dock-toggle').getAttribute('aria-expanded'),'false');
 const nav=[...w.document.querySelectorAll('.mainnav a')].map(a=>a.textContent);assert.deepEqual(nav,['Jogos','Classificação','Equipes','Jogadores']);
 }finally{w.close();}
});
