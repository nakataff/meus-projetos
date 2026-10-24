const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('detached cloud controls initialize and remount when profile settings appear',async()=>{
 const d=new JSDOM('<main></main>',{url:'https://example.com',runScripts:'outside-only'});
 try{await vm.runInContext('(async()=>{'+read('js/firebase-sync.js')+'})()',d.getInternalVMContext());d.window.document.body.innerHTML='<div id="firebaseAccountControl"></div>';d.window.dispatchEvent(new d.window.Event('quadra:profile-render'));assert(d.window.document.querySelector('#firebaseAccountControl button'));assert(d.window.document.querySelector('#qcloud-state').textContent.includes('Google'));}finally{d.window.close();}
});
test('automatic franchise catalog respects local roster membership and two-player limit',()=>{
 const ctx=vm.createContext({});vm.runInContext(read('data/franchises.js').replace(/export /g,'')+'\nglobalThis.catalog=FRANCHISE_PLAYERS;',ctx);
 for(const [code,rows] of Object.entries(ctx.catalog)){assert(rows.length<=2);const ids=JSON.parse(read('data/teams/'+code+'.json')).players.map(p=>String(p.id));for(const p of rows)assert(ids.includes(p.id));}
 assert.equal(ctx.catalog.BOS[0].name,'Jayson Tatum');assert.deepEqual(Array.from(ctx.catalog.PHI,p=>p.name),['Joel Embiid','LeBron James']);
});
