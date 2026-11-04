'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const strip=s=>s.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
const shift=(day,offset)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
const fixture=[
 {id:'live',date:'2026-11-03',time:'19:00',away:'BOS',home:'LAL',status:'live',platforms:['LEAGUE']},
 {id:'finished',date:'2026-11-03',time:'18:00',away:'NYK',home:'BOS',status:'final',scoreAway:90,scoreHome:91,platforms:['ESPN']},
 {id:'plain',date:'2026-11-03',time:'20:00',away:'GSW',home:'BOS',status:'scheduled',platforms:['LEAGUE']},
 {id:'prime',date:'2026-11-03',time:'22:00',away:'LAL',home:'NYK',status:'scheduled',platforms:['PRIME']},
 {id:'espn',date:'2026-11-04',time:'21:00',away:'LAL',home:'BOS',status:'scheduled',platforms:['ESPN']},
 {id:'later',date:'2026-11-06',time:'21:00',away:'GSW',home:'NYK',status:'scheduled',platforms:['ESPN']}
];
async function settled(fn){for(let i=0;i<75;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}assert(fn(),'Home did not render');}
async function setup(fav='LAL'){
 const dom=new JSDOM('<body><div class="hero"></div><main id="pageContent"></main></body>',{url:'https://example.com/nba/',pretendToBeVisual:true,runScripts:'outside-only'});
 const w=dom.window,TEAMS={LAL:['Los Angeles Lakers'],BOS:['Boston Celtics'],GSW:['Golden State Warriors'],NYK:['New York Knicks']};
 const state={settings:{fav},extras:{players:{}},saved:{notes:{}}};
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const card=g=>'<article class="game-card" data-game-id="'+g.id+'">'+g.id+'</article>';
 Object.assign(w,{
  $:s=>w.document.querySelector(s),setupShared:()=>{},loadGames:async()=>fixture,
  currentDate:()=> '2026-11-03',dayShift:shift,groupGames:rows=>rows.map(card).join(''),
  effectiveGame:g=>g,path:s=>'/nba/'+s,getData:()=>state,setSettings:v=>{state.settings={...state.settings,...v};},
  note:()=>({}),handleWishes:()=>false,esc:escape,broadcastInfo:g=>g.platforms.some(p=>p==='ESPN'||p==='PRIME'),
  name:code=>TEAMS[code]?.[0]||code,logo:code=>'/logos/'+code+'.png',TEAMS,MONTHS:['2026-10','2026-11','2026-12'],
  playerLink:id=>'/player/'+id,jsonFile:async()=>({regular:{players:[]}}),
  gameLink:g=>'/games/'+g.id,gameRow:card,overnightGame:()=>false,shortDate:x=>x
 });
 vm.runInContext(strip(read('js/team-follows.mjs')),dom.getInternalVMContext());
 vm.runInContext(strip(read('js/pages/home.js')),dom.getInternalVMContext());
 await settled(()=>w.document.querySelector('.home-upcoming .game-card'));
 return {w,dom,state,$:s=>w.document.querySelector(s)};
}
test('Home prioriza ao vivo, depois proximos jogos com TV e deixa finalizados recolhidos abaixo',async()=>{
 const b=await setup(),{w}=b;
 try{
  const html=b.$('#pageContent').textContent;
  assert(b.$('.home-live'),'faltou bloco ao vivo');
  assert(b.$('.home-live [data-game-id="live"]'));
  assert.equal(b.$('.home-upcoming .game-card').getAttribute('data-game-id'),'prime','transmissão do Brasil deve vir antes de jogo sem TV');
  assert(!b.$('.home-upcoming [data-game-id="finished"]'));
  assert(!b.$('.home-brazil-tv [data-game-id="finished"]'));
  assert(b.$('.home-brazil-tv [data-game-id="espn"]'));
  assert(b.$('#homeResults'), 'finais de hoje devem ficar em seção recolhível');
  assert.equal(b.$('#homeResults').open,false);
  assert(b.$('.home-results [data-game-id="finished"]'));
  assert(html.indexOf('Próximos jogos')<html.indexOf('Meus times'));
  assert(html.indexOf('Meus times')<html.indexOf('Onde assistir no Brasil'));
  assert(html.indexOf('Onde assistir no Brasil')<html.indexOf('Jogos encerrados hoje'));
 }finally{w.close();}
});
test('multiplas equipes podem ser seguidas, navegadas e uma equipe principal preservada',async()=>{
 const b=await setup(),{w,state}=b;
 try{
  assert.equal(b.$('.home-team-identity h3').textContent,'Los Angeles Lakers');
  assert.equal(b.$('.home-carousel-controls span').textContent,'1 de 1');
  b.$('#homeAddTeam').value='BOS';
  b.$('#homeAddTeam').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.deepEqual(state.settings.followedTeams,['LAL','BOS']);
  assert.equal(state.settings.fav,'LAL');
  assert.equal(b.$('.home-team-identity h3').textContent,'Boston Celtics');
  assert.equal(b.$('.home-carousel-controls span').textContent,'2 de 2');
  b.$('[data-home-team-primary="BOS"]').click();
  assert.equal(state.settings.fav,'BOS');
  assert.equal(b.$('.home-team-identity h3').textContent,'Boston Celtics','troca de time principal deve manter o cartão selecionado');
  assert.equal(b.$('.home-carousel-controls span').textContent,'1 de 2');
  b.$('[data-home-team-step="1"]').click();
  assert.equal(b.$('.home-team-identity h3').textContent,'Los Angeles Lakers');
  b.$('[data-home-team-unfollow="LAL"]').click();
  assert.deepEqual(state.settings.followedTeams,['BOS']);
  assert.equal(state.settings.fav,'BOS');
  assert.equal(b.$('.home-carousel-controls span').textContent,'1 de 1');
 }finally{w.close();}
});
test('sem favorito anterior, adicionar equipe define primeiro principal; ainda pode seguir varias',async()=>{
 const b=await setup(''),{w,state}=b;
 try{
  assert(b.$('.home-teams-empty'));
  b.$('#homeAddTeam').value='NYK';
  b.$('#homeAddTeam').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(state.settings.fav,'NYK');
  assert.deepEqual(state.settings.followedTeams,['NYK']);
  assert(b.$('.home-team-identity h3').textContent.includes('New York'));
 }finally{w.close();}
});
test('preferencias antigas continuam validas, sem duplicar equipes e sem apagar favoritas',async()=>{
 const {trackedTeams,teamFollowChange}=await import('../js/team-follows.mjs');
 const teams={LAL:true,BOS:true,NYK:true};
 assert.deepEqual(trackedTeams({fav:'LAL'},teams),['LAL']);
 assert.deepEqual(trackedTeams({fav:'LAL',followedTeams:['BOS','BOS','INVAL','LAL']},teams),['LAL','BOS']);
 assert.deepEqual(teamFollowChange({fav:'LAL'},teams,'BOS','follow'),{fav:'LAL',followedTeams:['LAL','BOS']});
 assert.deepEqual(teamFollowChange({fav:'LAL',followedTeams:['LAL','BOS']},teams,'LAL','unfollow'),{fav:'',followedTeams:['BOS']});
 assert.deepEqual(teamFollowChange({fav:'LAL'},teams,'BOS','primary'),{fav:'BOS',followedTeams:['LAL','BOS']});
 assert.deepEqual(teamFollowChange({fav:'LAL'},teams,'OTHER','follow'),{});
});
