/* Estatísticas da temporada compartilhadas pelo ranking e pelos recordes. */
export function teamGamesFromRounds(data,phase='regular',recent=[]){
 const games=new Map();
 const add=(team,id)=>{
  if(!team||!id)return;
  if(!games.has(team))games.set(team,new Set());
  games.get(team).add(String(id));
 };
 for(const row of data?.[phase]||[])add(row[3],row[2]);
 const imported=new Set((data?.countedGameIds?.[phase]||[]).map(String));
 for(const record of recent){
  if(record?.phase!==phase||imported.has(String(record.event?.id)))continue;
  for(const row of record.athletes||[])add(row.team,record.event?.id);
 }
 return Object.fromEntries([...games].map(([team,ids])=>[team,ids.size]));
}
export function requiredHalf(teamGames){
 return Math.max(1,Math.ceil(Math.max(0,Number(teamGames)||0)/2));
}
export const GAME_RECORD_METRICS=[
 ['pts','Pontos','PTS'],['reb','Rebotes','REB'],['ast','Assistências','AST'],
 ['stl','Roubos','STL'],['blk','Tocos','BLK'],['threeM','Bolas de 3','3PT'],
 ['fgm','Cestas convertidas','FGM'],['min','Minutos','MIN'],['rating','NOTA DLQ','RTG']
];
export function gamePerformances(rows,players=[]){
 const playersById=new Map(players.map(p=>[String(p.id),p]));
 return (Array.isArray(rows)?rows:[]).map(row=>{
  const [id,round,gameId,team,pts,reb,ast,stl,blk,to,min,fgm,fga,threeM,threeA,rating]=row;
  const player=playersById.get(String(id));
  return {id:String(id),name:player?.name||'Jogador #'+id,team:String(team||player?.team||''),gameId:String(gameId),
   round:Number(round)||0,pts:Number(pts)||0,reb:Number(reb)||0,ast:Number(ast)||0,
   stl:Number(stl)||0,blk:Number(blk)||0,to:Number(to)||0,min:Number(min)||0,
   fgm:Number(fgm)||0,fga:Number(fga)||0,threeM:Number(threeM)||0,threeA:Number(threeA)||0,
   rating:rating===null||rating===undefined?null:Number(rating)};
 }).filter(p=>p.gameId&&p.id);
}
export function topSingleGames(performances,metric,limit=10){
 return performances.filter(p=>p[metric]!==null&&Number.isFinite(p[metric]))
  .sort((a,b)=>b[metric]-a[metric]||b.pts-a.pts||a.name.localeCompare(b.name,'pt-BR'))
  .slice(0,limit);
}
