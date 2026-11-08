const test = require('node:test');
const assert = require('node:assert/strict');

test('Nota DLQ reserves 10 for exceptional performances across different stat profiles', async () => {
 const {performanceRating} = await import('../js/performance-rating.js');
 const game = {min:'34:00',pts:52,reb:24,ast:2,stl:2,blk:8,to:1,fg:'16-28',plusMinus:'+23'};

 assert.equal(performanceRating(game),10);
 assert.equal(performanceRating({...game,pts:70,reb:7,ast:4,stl:1,blk:1,to:3,fg:'24-34'}),10);
 assert.equal(performanceRating({...game,pts:34,reb:12,ast:21,stl:3,blk:0,to:3,fg:'13-22'}),10);
 assert.equal(performanceRating({...game,pts:22,reb:19,ast:6,stl:4,blk:10,to:2,fg:'9-15'}),10);

 // A atuação segue sendo 9,9 mesmo quando o valor bruto quase alcança o teto.
 assert.equal(performanceRating({...game,pts:42,reb:7,ast:13,stl:2,blk:1,to:2,fg:'14-24',plusMinus:'+16'}),9.9);
 assert.ok(performanceRating({...game,reb:5,ast:4,stl:1,blk:0,to:6,fg:'16-40',plusMinus:'0'})<9);
 assert.equal(performanceRating({...game,min:'00:00'}),null);
 assert.equal(performanceRating({min:'07:30',pts:0,reb:0,ast:0}),5.5);
});
