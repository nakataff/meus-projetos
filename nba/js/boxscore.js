/* QUADRA — box score público não oficial e projeção de titulares (sem API paga). */
const ENDPOINT='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';
const ALIASES={GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',PHO:'PHX',UTAH:'UTA',WSH:'WAS'};
export const teamCode=value=>ALIASES[String(value||'').toUpperCase()]||String(value||'').toUpperCase();

function asNumber(value){
 if(value===undefined||value===null||value===''||value==='—')return null;
 const n=Number(value);
 return Number.isFinite(n)?n:null;
}
function parseStats(row,group){
 const keys=group.keys||[];
 const labels=group.labels||[];
 const entries={};
 const raw=Array.isArray(row.stats)?row.stats:[];
 for(let i=0;i<raw.length;i++){
  if(keys[i])entries[String(keys[i]).toLowerCase()]=raw[i];
  if(labels[i])entries[String(labels[i]).toLowerCase()]=raw[i];
 }
 function field(...names){
  for(const name of names){const value=entries[name.toLowerCase()];if(value!==undefined&&value!==null&&value!=='')return value;}
  return null;
 }
 return {
  pts:asNumber(field('points','pts')),
  reb:asNumber(field('rebounds','reb')),
  ast:asNumber(field('assists','ast')),
  stl:asNumber(field('steals','stl')),
  blk:asNumber(field('blocks','blk')),
  to:asNumber(field('turnovers','to')),
  min:field('minutes','min'),
  fg:field('fieldGoalsMade-fieldGoalsAttempted','fg'),
  three:field('threePointFieldGoalsMade-threePointFieldGoalsAttempted','3pt','3p'),
  plusMinus:field('plusMinus','plusMinusPoints','+/-'),
  hasStats:raw.length>0
 };
}
function parseStatus(payload){
 const match=payload?.header?.competitions?.[0];
 const status=match?.status||payload?.header?.status||{};
 const info=status.type||status;
 const state=info.state||'pre';
 return {
  status:info.completed===true||state==='post'?'final':state==='in'?'live':'scheduled',
  quarter:Number(status.period||0),
  clock:String(status.displayClock||'').trim(),
  statusName:String(info.name||''),
  statusDetail:String(info.shortDetail||info.detail||info.description||''),
  competitors:match?.competitors||[]
 };
}
function normalizePlayers(payload,game){
 const result={};
 const teams=payload?.boxscore?.players;
 if(!Array.isArray(teams))return result;
 for(const item of teams){
  const code=teamCode(item.team?.abbreviation);
  if(code!==game.away&&code!==game.home)continue;
  const players=new Map();
  for(const group of item.statistics||[]){
   for(const row of group.athletes||[]){
    const athlete=row.athlete||{};
    const id=String(athlete.id||'');
    if(!id)continue;
    const previous=players.get(id)||{};
    const stats=parseStats(row,group);
    const merged={...previous};
    for(const [field,value] of Object.entries(stats)){
      if(value!==null || !(field in merged))merged[field]=value;
    }
    const name=athlete.displayName||athlete.fullName||previous.name||'Jogador';
    players.set(id,{
      ...merged,
      id,name,number:String(athlete.jersey||previous.number||''),
      starter:previous.starter===true||row.starter===true,
      hasStats:previous.hasStats===true||stats.hasStats
    });
   }
  }
  if(players.size)result[code]=[...players.values()];
 }
 return result;
}
export function normalizeSummary(payload,game){
 if(!payload||!game)return null;
 const players=normalizePlayers(payload,game);
 const status=parseStatus(payload);
 const hasPlayers=Object.values(players).some(list=>list.length);
 const hasStats=Object.values(players).some(list=>list.some(p=>p.hasStats));
 const starters=Object.fromEntries([game.away,game.home].map(c=>[c,(players[c]||[]).filter(p=>p.starter).length]));
 const scores={};
 for(const team of status.competitors){
  const code=teamCode(team.team?.abbreviation);
  const score=asNumber(team.score);
  if(score!==null)scores[code]=score;
 }
 if(!hasPlayers&&status.status==='scheduled'&&Object.keys(scores).length===0)return null;
 return {
  box:hasPlayers?{id:String(game.externalId||String(game.id).replace(/^espn_/,'')),date:game.date,away:game.away,home:game.home,players,source:'ESPN',partial:status.status!=='final'}:null,
  status:status.status,
  quarter:status.quarter,
  clock:status.clock,
  statusName:status.statusName,
  statusDetail:status.statusDetail,
  scoreAway:scores[game.away]??null,
  scoreHome:scores[game.home]??null,
  starters,
  hasStats
 };
}
export async function fetchLiveBoxscore(game){
 const id=String(game?.externalId||String(game?.id||'').replace(/^espn_/,'')); 
 if(!/^[0-9]{7,15}$/.test(id))return null;
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),12000);
 try{
  const response=await fetch(ENDPOINT+'?event='+encodeURIComponent(id),{cache:'no-store',signal:abort.signal});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const raw=await response.json();
  return normalizeSummary(raw,game);
 }finally{clearTimeout(timeout);}
}
/** Projeta até cinco titulares pela frequência nas últimas cinco partidas com quinteto confirmado.
 * Não confundir esta projeção com notícia oficial ou previsão de um jornalista.
 */
export function projectStartingFive(team,game,allBoxes,roster=[]){
 const matches=Object.values(allBoxes||{})
  .filter(g=>g?.date && g.date<game.date && (g.away===team||g.home===team)
       && (g.players?.[team]||[]).filter(p=>p.starter).length>=5)
  .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
 if(!matches.length)return null;
 const available=new Set((roster||[]).map(p=>String(p.id)));
 const scores=new Map();
 for(let i=0;i<matches.length;i++){
  const match=matches[i];
  for(const p of match.players[team].filter(x=>x.starter)){
   const id=String(p.id);
   if(available.size && !available.has(id))continue;
   const previous=scores.get(id)||{player:p,count:0,weight:0,mostRecent:-1};
   previous.count++;previous.weight+=5-i;
   if(previous.mostRecent<0)previous.mostRecent=i;
   scores.set(id,previous);
  }
 }
 const players=[...scores.values()].sort((a,b)=>b.count-a.count||b.weight-a.weight||a.mostRecent-b.mostRecent)
  .slice(0,5).map(v=>v.player);
 return players.length?{players,lastDate:matches[0].date,sample:matches.length,complete:players.length===5}:null;
}
