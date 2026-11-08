export const ALERT_EVENTS = Object.freeze({
 start:'Início de jogo', q1:'Fim do 1º quarto', q2:'Fim do 2º quarto / intervalo',
 q3:'Fim do 3º quarto', q4:'Fim do 4º quarto', final:'Fim de jogo'
});
export const TV_LABELS = Object.freeze({ESPN:'ESPN / Disney+', PRIME:'Prime Video'});
export const ALERT_WINDOW = 8 * 60 * 1000;
export const MAX_RULES = 20;
export const ALERT_RULES_KEY = 'quadra_alert_rules_v1';
export const ESPN_NBA = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const TEAM_ALIASES = {GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',PHO:'PHX',UTAH:'UTA',WSH:'WAS'};
const code = raw => TEAM_ALIASES[raw] || raw;
const idPattern = /^[0-9]{7,15}$/;

export function gameAlertId(game) {
 const id = String(game.externalId || game.id || '').replace(/^espn_/, '');
 return idPattern.test(id) ? id : '';
}

export const brDate = date => new Intl.DateTimeFormat('en-CA', {
 timeZone:'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit'
}).format(date);

export function shiftDate(date, days) {
 const day = new Date(date + 'T12:00:00Z');
 day.setUTCDate(day.getUTCDate() + days);
 return day.toISOString().slice(0,10);
}

export function normalizeRules(input, now = Date.now()) {
 if (!Array.isArray(input)) return [];
 const result = new Map();
 for (const rule of input.slice(0, MAX_RULES)) {
  if (!rule || !['team','player','tv','game'].includes(rule.kind)) continue;
  const id = String(rule.id ?? '');
  if (rule.kind === 'team' && !/^[A-Z]{3}$/.test(id) ||
      rule.kind === 'player' && !/^[0-9]{1,15}$/.test(id) ||
      rule.kind === 'game' && !idPattern.test(id) ||
      rule.kind === 'tv' && id !== 'br') continue;
  const available = rule.kind === 'tv' ? TV_LABELS : ALERT_EVENTS;
  const events = Array.isArray(rule.events) ? [...new Set(rule.events.filter(e => typeof e === 'string' && Object.hasOwn(available,e)))] : [];
  if (!events.length) continue;
  const since = Number.isFinite(rule.since) ? Math.min(now, Math.max(0,rule.since)) : now;
  const label = typeof rule.label === 'string' ? rule.label.trim().slice(0,95) : id;
  const team = typeof rule.team === 'string' && /^[A-Z]{3}$/.test(rule.team) ? rule.team : '';
  result.set(rule.kind + ':' + id, {kind:rule.kind,id,events,since,label,team});
 }
 return [...result.values()];
}

export function parseBroadcasts(raw) {
 const result=[], seen=new Map();
 let section='ESPN';
 for (const original of raw.trim().split('\n')) {
  const line=original.trim();
  if (!line || line.startsWith('#')) continue;
  if (line==='===PRIME===') {section='PRIME'; continue;}
  if (line==='===PRE===') {section='PRE'; continue;}
  const [base,desc='']=line.split('|'), [mmdd,hhmm,a,b]=base.trim().split(/\s+/);
  if (!mmdd || !hhmm || !a || !b) continue;
  const m=Number(mmdd.slice(0,2)), d=Number(mmdd.slice(2)), yr=m>=10?2026:2027;
  const src=yr+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const time=hhmm==='????'?'':hhmm.slice(0,2)+':'+hhmm.slice(2,4);
  const date=time&&Number(time.slice(0,2))<3?shiftDate(src,1):src;
  const platform=section==='PRE'?'ESPN':section;
  const key=desc?'special-'+src+'-'+desc+'-'+platform+'-'+result.length:date+'-'+time+'-'+a+'-'+b;
  const id=key.replace(/[^a-zA-Z0-9-]/g,'_');
  if (seen.has(key)) {
   const old=result[seen.get(key)];
   if (!old.platforms.includes(platform)) old.platforms.push(platform);
   continue;
  }
  seen.set(key,result.length);
  result.push({id,date,time,away:a,home:b,platforms:[platform],stage:section==='PRE'?'Pré-temporada':desc?'Copa NBA':'Temporada regular',label:desc,custom:false,sourceDate:src});
 }
 return result;
}

export function matchPlatforms(game, broadcasts) {
 const games = broadcasts.filter(row => row.away === game.away && row.home === game.home && row.time);
 const near = games.map(row => ({row, distance:Math.abs(Date.parse(row.date+'T'+row.time+':00-03:00')-game.startTime)}))
  .filter(item => item.distance <= 3*3600000).sort((a,b)=>a.distance-b.distance);
 if (!near.length) return [];
 const first=near[0].row;
 return [...new Set(near.filter(({row})=>row.date===first.date).flatMap(({row})=>row.platforms))];
}

export function alertGame(raw) {
 const competition = raw.competitions?.[0];
 const teams = competition?.competitors || [];
 const home = code(teams.find(team => team.homeAway === 'home')?.team?.abbreviation);
 const away = code(teams.find(team => team.homeAway === 'away')?.team?.abbreviation);
 const id = String(raw.id || '');
 const startTime = Date.parse(raw.date);
 const phase = raw.status?.type || competition?.status?.type || {};
 if (!home || !away || !idPattern.test(id) || !Number.isFinite(startTime)) return null;
 const status = phase.completed || phase.state === 'post' ? 'final' : phase.state === 'in' ? 'live' : 'scheduled';
 return {id,home,away,status,startTime,date:brDate(new Date(startTime))};
}

export function wantsGame(rules, game, platforms, playerTeams = new Map()) {
 return rules.some(rule => {
  if (rule.kind === 'tv') return platforms.some(channel => rule.events.includes(channel));
  if (rule.kind === 'game') return rule.id === gameAlertId(game);
  if (rule.kind === 'player') {
   const team = playerTeams.get(rule.id) || rule.team;
   return !team || [game.away,game.home].includes(team);
  }
  return [game.away,game.home].includes(rule.id);
 });
}

export function gameMilestones(payload, game) {
 const plays = Array.isArray(payload?.plays) ? payload.plays : [];
 const players = new Map();
 const markers = new Map();
 let first = null;
 for (const play of plays) {
  const at = Date.parse(play.wallclock);
  const period = Number(play.period?.number);
  const text = String(play.text || '');
  if (!Number.isFinite(at) || !Number.isInteger(period) || period < 1) continue;
  const score = Number.isInteger(play.awayScore) && Number.isInteger(play.homeScore) ?
   game.away + ' ' + play.awayScore + ' × ' + play.homeScore + ' ' + game.home : '';
  const marker = {at, score};
  if (!first || at < first.at) first = marker;
  for (const participant of play.participants || []) {
   const id = String(participant.athlete?.id || '');
   if (id && (!players.has(id) || at < players.get(id))) players.set(id,at);
  }
  if (period <= 4 && /\bend of (?:the )?.*\bquarter\b/i.test(text)) markers.set('q'+period,marker);
  if (game.status === 'final' && /\bend of (?:the )?game\b/i.test(text)) markers.set('final',marker);
 }
 if (first) markers.set('start',first);
 const athletes = new Map((payload?.boxscore?.players || []).flatMap(team =>
  (team.statistics || []).flatMap(group => (group.athletes || []).map(row => {
   const stat = key => row.stats?.[group.keys?.indexOf(key)];
   return [String(row.athlete?.id),{
    starter:row.starter,dnp:row.didNotPlay,minutes:stat('minutes'),
    line:[['points','PTS'],['rebounds','REB'],['assists','AST']].map(([key,label])=>{
     const value=stat(key);
     return /^\d+$/.test(value)?value+' '+label:'';
    }).filter(Boolean).join(' / ')
   }];
  }))));
 return {markers,players,athletes};
}

export function matchingAlerts(rules, game, summary, platforms, now = Date.now()) {
 const {markers,players,athletes} = summary;
 const alerts = [];
 const started = markers.get('start');
 const names = game.away + ' × ' + game.home;
 const link = 'jogo/?id=' + encodeURIComponent(game.id) + '&data=' + encodeURIComponent(game.date);
 for (const [event,marker] of markers) {
  if (marker.at < now - ALERT_WINDOW || marker.at > now + 30_000) continue;
  const matched = rules.filter(rule => {
   if (marker.at < rule.since || rule.kind === 'tv' || !rule.events.includes(event)) return false;
   if (rule.kind === 'team') return [game.away,game.home].includes(rule.id);
   if (rule.kind === 'game') return rule.id === gameAlertId(game);
   const row = athletes.get(rule.id);
   if (row?.dnp === true) return false;
   const appeared = players.get(rule.id);
   return row?.starter === true || appeared !== undefined && (event === 'start' ? appeared <= now : appeared <= marker.at) ||
    event === 'final' && Number.parseFloat(row?.minutes) > 0;
  });
  const channels = event === 'start' && started ? platforms.filter(channel => rules.some(rule =>
   rule.kind === 'tv' && rule.events.includes(channel) && marker.at >= rule.since)) : [];
  if (!matched.length && !channels.length) continue;
  const watched = [...new Set(matched.filter(rule=>rule.kind==='player').map(rule=>{
   const line=event==='final'?athletes.get(rule.id)?.line:'';
   return rule.label+(line?' '+line:'');
  }))];
  const title = channels.length ? 'NBA ao vivo · ' + channels.map(channel=>TV_LABELS[channel]).join(' + ') : ALERT_EVENTS[event];
  alerts.push({id:game.id+':'+event, at:marker.at, title,
   body:[event === 'start' ? names : marker.score || names, ...watched].join(' · '), link});
 }
 return alerts.sort((a,b)=>a.at-b.at);
}
