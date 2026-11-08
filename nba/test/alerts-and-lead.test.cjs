const test = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

const game = {
 id:'401909938',away:'DEN',home:'IND',date:'2026-11-07',status:'final',
 startTime:Date.parse('2026-11-07T22:00:00Z')
};
const play = (period,clock,wallclock,awayScore,homeScore,text='',participants=[]) => ({
 period:{number:period},clock:{displayValue:clock},wallclock:'2026-11-07T'+wallclock+'Z',awayScore,homeScore,text,
 participants:participants.map(id=>({athlete:{id}}))
});

test('alerts honor each quarter, confirmed TV and player participation without repeating kickoff',async()=>{
 const {parseBroadcasts,matchPlatforms,normalizeRules,gameMilestones,matchingAlerts} = await import('../js/alerts-core.mjs');
 const tv=parseBroadcasts('1107 1900 DEN IND\n===PRIME===\n1108 1900 DEN IND');
 const channels=matchPlatforms(game,tv);
 assert.deepEqual(channels,['ESPN']);
 const rules=normalizeRules([
  {kind:'team',id:'DEN',events:['start','q1','q4','final'],since:game.startTime},
  {kind:'player',id:'3978',label:'DeMar DeRozan',events:['start','q1','final'],since:game.startTime},
  {kind:'player',id:'555',label:'Não entrou',events:['q1','final'],since:game.startTime},
  {kind:'tv',id:'br',events:['ESPN','PRIME'],since:game.startTime}
 ]);
 const payload={plays:[
  play(1,'12:00','22:05:00',0,0),
  play(1,'03:30','22:25:00',17,23,'Substituição',['3978']),
  play(1,'0.0','22:31:00',20,25,'End of the 1st Quarter'),
  play(4,'0.0','23:58:00',98,105,'End of the 4th Quarter'),
  play(4,'0.0','23:58:00',98,105,'End of Game')
 ],boxscore:{players:[{statistics:[{
  keys:['minutes','points','rebounds','assists'],
  athletes:[{athlete:{id:'3978'},stats:['29','18','5','4']},{athlete:{id:'555'},didNotPlay:true}]
 }]}]}};
 const summary=gameMilestones(payload,game);
 const get=at=>matchingAlerts(rules,game,summary,channels,Date.parse('2026-11-07T'+at+'Z'));
 assert.deepEqual(get('22:06:00').map(a=>a.title),['NBA ao vivo · ESPN / Disney+']);
 const [quarter]=get('22:32:00');
 assert.equal(quarter.id,'401909938:q1');
 assert.match(quarter.body,/DEN 20 × 25 IND · DeMar DeRozan/);
 assert.doesNotMatch(quarter.body,/Não entrou/);
 const [fourth,final]=get('23:59:00');
 assert.equal(fourth.id,'401909938:q4');
 assert.match(final.body,/DeMar DeRozan 18 PTS \/ 5 REB \/ 4 AST/);
 assert.equal(get('23:59:00').length,2);
 assert.equal(matchingAlerts(rules.map(rule=>({...rule,since:Date.parse('2026-11-07T23:58:30Z')})),game,summary,channels,Date.parse('2026-11-07T23:59:00Z')).length,0);
});

test('game alerts use the ESPN event ID and deduplicate overlapping team alerts',async()=>{
 const {gameAlertId,normalizeRules,wantsGame,matchingAlerts} = await import('../js/alerts-core.mjs');
 const card={...game,id:'2026-11-07-1900-DEN-IND',externalId:game.id};
 const rematch={...game,id:'401909940'};
 const now=game.startTime+3600000;
 const summary={markers:new Map([['q2',{at:now,score:'DEN 50 × 47 IND'}],['q1',{at:now-30*60000}]])};
 const [rule,...invalid]=normalizeRules([
  {kind:'game',id:gameAlertId(card),events:['q2','ESPN'],since:game.startTime},
  {kind:'game',id:card.id,events:['q2'],since:game.startTime}
 ],now);
 assert.deepEqual(invalid,[]);
 assert.deepEqual(rule.events,['q2']);
 assert.equal(gameAlertId({id:'espn_'+game.id}),game.id);
 assert.equal(gameAlertId({id:card.id}),'');
 assert.equal(wantsGame([rule],card,[]),true);
 assert.equal(wantsGame([rule],rematch,[]),false);
 assert.deepEqual(matchingAlerts([rule],rematch,summary,[],now),[]);
 const overlapping={kind:'team',id:game.away,events:['q2'],since:game.startTime};
 const alerts=matchingAlerts([rule,overlapping],game,summary,[],now);
 assert.deepEqual(alerts.map(alert=>alert.id),[game.id+':q2']);
 assert.equal(alerts[0].title,'Fim do 2º quarto / intervalo');
});

test('lead chart follows actual scores across a lead change and overtime',async()=>{
 const {leadTimeline,renderLeadChart,selectLeadPoint} = await import('../js/lead-chart.mjs');
 const points=leadTimeline([
  {period:1,clock:'12:00',scoreAway:0,scoreHome:0},
  {period:1,clock:'11:30',scoreAway:2,scoreHome:0},
  {period:2,clock:'10:40',scoreAway:25,scoreHome:31},
  {period:5,clock:'03:00',scoreAway:100,scoreHome:104},
  {period:5,clock:'0.0',scoreAway:110,scoreHome:108},
  {period:5,clock:'0.0',scoreAway:null,scoreHome:null}
 ]);
 assert.deepEqual(points.map(p=>p.time),[0,30,800,3000,3180]);
 const dom=new JSDOM(renderLeadChart(points,game,'final',String));
 try {
  const {document}=dom.window;
  assert.equal(document.querySelectorAll('.dlq-lead-fill').length,2);
  assert.match(document.querySelector('.dlq-lead-periods').textContent,/PR 1/);
  const slider=document.querySelector('input');
  assert.match(slider.getAttribute('aria-valuetext'),/DEN \+2/);
  slider.value=2;
  selectLeadPoint(slider,points,game);
  assert.match(document.querySelector('output').value,/IND \+6/);
 } finally {dom.window.close();}
});
