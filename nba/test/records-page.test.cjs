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
 Object.assign(w,{$:s=>w.document.querySelector(s),setupShared:()=>{},asset:s=>s,esc,logo:c=>'/'+c+'.png',name:c=>c,
  playerLink:(id,t)=>'/nba/jogador/?id='+id+'&team='+t,gameLink:g=>'/nba/jogo/?id='+g.id+'&data='+g.date,
  loadGames:async()=>[game],jsonFile:async p=>p.includes('rounds')?rounds:leaders});
 try{
  vm.runInContext(strip(read('js/season-stats.mjs')),dom.getInternalVMContext());
  vm.runInContext(strip(read('js/pages/records.js')),dom.getInternalVMContext());
  await settle(()=>w.document.querySelector('.records-entry'));
  assert.equal(w.document.querySelector('.records-entry .records-player strong').textContent,'Segundo');
  assert(w.document.querySelector('.records-game a').href.includes('espn_game1'));
  w.document.querySelector('[data-record-metric="threeM"]').click();
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
