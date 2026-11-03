'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
let load;
async function stats(){return load ||= import('../js/season-stats.mjs');}
test('metade dos jogos usa partidas unicas do time, arredonda para cima e evita duplicacao por atleta',async()=>{
 const {teamGamesFromRounds,requiredHalf}=await stats();
 const rows=[
  ['a',1,'g1','BOS'],['b',1,'g1','BOS'],['a',2,'g2','BOS'],
  ['a',3,'g3','BOS'],['a',4,'g4','BOS'],['a',5,'g5','BOS'],
  ['x',1,'g1','LAL'],['x',2,'g2','LAL']
 ];
 const data={regular:rows,preseason:[],countedGameIds:{regular:['g1','g2','g3','g4','g5']}};
 const counts=teamGamesFromRounds(data,'regular');
 assert.deepEqual(counts,{BOS:5,LAL:2});
 assert.equal(requiredHalf(counts.BOS),3);
 assert.equal(requiredHalf(counts.LAL),1);
 assert.equal(requiredHalf(8),4);
 assert.equal(requiredHalf(0),1);
 const recent=[{phase:'regular',event:{id:'g6'},athletes:[{team:'BOS'},{team:'BOS'},{team:'LAL'}]}];
 assert.deepEqual(teamGamesFromRounds(data,'regular',recent),{BOS:6,LAL:3});
 data.countedGameIds.regular.push('g6');
 assert.deepEqual(teamGamesFromRounds(data,'regular',recent),{BOS:5,LAL:2});
});
test('recordes consideram cada partida, nao a media nem a quantidade de jogos',async()=>{
 const {gamePerformances,topSingleGames}=await stats();
 const rows=[
  ['1',1,'j1','BOS',37,5,9,2,1,3,35,15,26,7,12,9.2],
  ['1',2,'j2','BOS',42,6,7,1,0,2,38,16,27,8,13,9.6],
  ['2',1,'j2','LAL',44,8,4,4,2,1,40,19,28,5,10,9.4]
 ];
 const people=[{id:'1',name:'Jogador A',team:'BOS'},{id:'2',name:'Jogador B',team:'LAL'}];
 const perf=gamePerformances(rows,people);
 assert.equal(perf.length,3);
 assert.deepEqual(topSingleGames(perf,'pts',2).map(x=>[x.name,x.pts]),[['Jogador B',44],['Jogador A',42]]);
 assert.deepEqual(topSingleGames(perf,'threeM',2).map(x=>x.threeM),[8,7]);
 assert.deepEqual(topSingleGames(perf,'rating',1).map(x=>x.gameId),['j2']);
 assert.equal(topSingleGames(perf,'pts',20).filter(x=>x.id==='1').length,2);
});
