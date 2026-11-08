import {DurableObject} from 'cloudflare:workers';
import webPush from 'web-push';
import {
 ALERT_WINDOW, ESPN_NBA, alertGame, brDate, shiftDate,
 parseBroadcasts, matchPlatforms, wantsGame, gameMilestones, matchingAlerts, normalizeRules
} from '../../nba/js/alerts-core.mjs';

const DAY = 86400000;
const MAX_SENDS = 24;
const MAX_DEVICES = 1000;
const getStore = env => env.ALERTS.getByName('nba');
const json = (body,status=200) => Response.json(body,{status});

function validSubscription(input) {
 const {endpoint,keys} = input || {};
 if (typeof endpoint !== 'string' || endpoint.length > 1800 || !keys ||
     !/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh) || !/^[A-Za-z0-9_-]{22}$/.test(keys.auth)) return null;
 let url;
 try {url=new URL(endpoint);} catch {return null;}
 const host=url.hostname;
 const allowed=host==='fcm.googleapis.com' || host==='updates.push.services.mozilla.com' ||
  host==='push.services.mozilla.com' || host.endsWith('.push.apple.com') ||
  /^(?:[a-z0-9-]+\.)?notify\.windows\.com$/.test(host);
 if (!allowed || url.protocol!=='https:' || url.port || url.username || url.password || url.hash) return null;
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}

async function digest(raw) {
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export default {
 async fetch(request,env) {
  const origin = new URL(env.SITE_URL).origin;
  if (request.headers.get('Origin') !== origin) return new Response(null,{status:403});
  const cors = {'Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store'};
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers:{
   ...cors,'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS',
   'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'
  }});
  const {pathname}=new URL(request.url);
  let result;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) result=json({error:'push_unavailable'},503);
  else if (pathname==='/key' && request.method==='GET') result=json({publicKey:env.VAPID_PUBLIC_KEY});
  else if ((pathname==='/device' && ['PUT','DELETE'].includes(request.method)) ||
           (pathname==='/test' && request.method==='POST')) {
   const token=/^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization')||'')?.[1];
   if (!token) result=json({error:'invalid_token'},401);
   else {
    const id=await digest(token);
    const store=getStore(env);
    if (pathname==='/test') {
     const status=await store.test(id);
     result=status===204?new Response(null,{status}):json({error:'test_unavailable'},status);
    } else if (request.method==='DELETE') {
     await store.remove(id);
     result=new Response(null,{status:204});
    } else {
     const length=Number(request.headers.get('Content-Length')||0);
     if (length>8192) result=json({error:'payload_too_large'},413);
     else {
      const body=await request.text();
      let data;
      try {if(body.length<=8192)data=JSON.parse(body);} catch {}
      if (!data || !Array.isArray(data.rules)) result=json({error:'invalid_rules'},400);
      else {
       const subscription=validSubscription(data.subscription);
       if (data.subscription && !subscription) result=json({error:'invalid_subscription'},400);
       else {
        const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
        const status=await store.save(id,subscription,normalizeRules(data.rules),ip);
        result=status===204?new Response(null,{status}):json({error:'device_unavailable'},status);
       }
      }
     }
    }
   }
  } else result=json({error:'not_found'},404);
  const response=new Response(result.body,result);
  for (const [key,value] of Object.entries(cors)) response.headers.set(key,value);
  return response;
 },
 async scheduled(_event,env,ctx) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT) ctx.waitUntil(getStore(env).poll());
 }
};

async function checkedFetch(url) {
 const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
 if (!response.ok) throw Error('Falha na fonte: HTTP '+response.status);
 return response;
}

export class AlertStore extends DurableObject {
 constructor(ctx,env) {
  super(ctx,env);
  this.sql=ctx.storage.sql;
  this.site=new URL(env.SITE_URL);
  this.sql.exec(`
   CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY, endpoint TEXT NOT NULL UNIQUE, subscription TEXT NOT NULL,
    rules TEXT NOT NULL, joined INTEGER NOT NULL, ip TEXT NOT NULL, touched INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS devices_by_ip ON devices(ip,joined);
   CREATE TABLE IF NOT EXISTS deliveries (
    device TEXT NOT NULL, event TEXT NOT NULL, at INTEGER NOT NULL,
    PRIMARY KEY (device,event)
   );
   CREATE INDEX IF NOT EXISTS deliveries_by_time ON deliveries(at);
   CREATE TABLE IF NOT EXISTS expired_games (id TEXT PRIMARY KEY, at INTEGER NOT NULL);
  `);
  this.polling=false;
 }
 remove(id) {
  this.sql.exec('DELETE FROM devices WHERE id = ?',id);
  this.sql.exec('DELETE FROM deliveries WHERE device = ?',id);
 }
 save(id,subscription,rules,ip) {
  const now=Date.now();
  const old=this.sql.exec('SELECT id FROM devices WHERE id = ?',id).toArray()[0];
  if (old) {
   this.sql.exec('UPDATE devices SET rules = ?, touched = ? WHERE id = ?',JSON.stringify(rules),now,id);
   return 204;
  }
  if (!subscription) return 404;
  if (this.sql.exec('SELECT id FROM devices WHERE endpoint = ?',subscription.endpoint).toArray().length) return 409;
  const {total}=this.sql.exec('SELECT count(*) AS total FROM devices').one();
  const {recent}=this.sql.exec('SELECT count(*) AS recent FROM devices WHERE ip = ? AND joined > ?',ip,now-3600000).one();
  if (total>=MAX_DEVICES || recent>=12) return 429;
  this.sql.exec('INSERT INTO devices VALUES (?, ?, ?, ?, ?, ?, ?)',id,subscription.endpoint,JSON.stringify(subscription),JSON.stringify(rules),now,ip,now);
  return 204;
 }
 async refreshSiteData(now) {
  if (this.dataAt && now-this.dataAt<3600000) return;
  const [channels,search]=await Promise.allSettled([
   checkedFetch(new URL('js/broadcasts.js',this.site)).then(r=>r.text()).then(source=>{
    const value=/window\.QUADRA_TV_RAW\s*=\s*("(?:[^"\\]|\\.)*")\s*;/.exec(source)?.[1];
    if (!value) throw Error('Agenda brasileira indisponível');
    return parseBroadcasts(JSON.parse(value));
   }),
   checkedFetch(new URL('data/search.json',this.site)).then(r=>r.json()).then(data=>
    new Map(data.players.map(([id,,team])=>[String(id),team])))
  ]);
  if (channels.status==='fulfilled') this.broadcasts=channels.value;
  if (search.status==='fulfilled') this.playerTeams=search.value;
  this.dataAt=now-(channels.status==='fulfilled'&&search.status==='fulfilled'?0:55*60000);
 }
 async send(device,alert) {
  const details=webPush.generateRequestDetails(JSON.parse(device.subscription),JSON.stringify(alert),{
   TTL:Math.max(1,Math.ceil((alert.at+ALERT_WINDOW-Date.now())/1000)),
   urgency:'high',topic:alert.id.replace(':','-'),
   vapidDetails:{subject:this.env.VAPID_SUBJECT,publicKey:this.env.VAPID_PUBLIC_KEY,privateKey:this.env.VAPID_PRIVATE_KEY}
  });
  const response=await fetch(details.endpoint,{
   method:details.method,headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(8000)
  });
  await response.body?.cancel();
  if (response.ok) this.sql.exec('INSERT OR IGNORE INTO deliveries VALUES (?, ?, ?)',device.id,alert.id,Date.now());
  else if (response.status===404 || response.status===410) this.remove(device.id);
  else if (response.status===400 || response.status===413) this.sql.exec('INSERT OR IGNORE INTO deliveries VALUES (?, ?, ?)',device.id,alert.id,Date.now());
  else console.warn('Falha no provedor Web Push',response.status);
  return response.ok;
 }
 async test(id) {
  const device=this.sql.exec('SELECT id,subscription FROM devices WHERE id = ?',id).toArray()[0];
  if (!device) return 404;
  const at=Date.now();
  const accepted=this.sql.exec(
   'INSERT INTO deliveries VALUES (?, ?, ?) ON CONFLICT(device,event) DO UPDATE SET at = excluded.at WHERE deliveries.at <= ? RETURNING at',
   id,'test',at,at-60000
  ).toArray().length;
  if (!accepted) return 429;
  try {
   const alert={id:'test',at,title:'De La Quadra',body:'As notificações estão funcionando neste dispositivo.',link:'jogos/'};
   return await this.send(device,alert)?204:502;
  } catch (error) {
   console.warn('Falha no teste de Web Push',error.message);
   return 502;
  }
 }
 async poll() {
  if (this.polling) return;
  this.polling=true;
  try {
   const now=Date.now();
   this.sql.exec('DELETE FROM deliveries WHERE at < ?',now-DAY);
   this.sql.exec('DELETE FROM expired_games WHERE at < ?',now-DAY);
   this.sql.exec("DELETE FROM devices WHERE rules = '[]' AND touched < ?",now-30*DAY);
   const devices=this.sql.exec("SELECT * FROM devices WHERE rules != '[]' ORDER BY joined").toArray()
    .map(device=>({...device,savedRules:device.rules,rules:normalizeRules(JSON.parse(device.rules),now).map(rule=>({...rule,since:Math.max(device.joined,rule.since)}))}));
   if (!devices.length) return;
   await this.refreshSiteData(now);
   const date=brDate(new Date(now));
   const range=[shiftDate(date,-1),date].map(day=>day.replaceAll('-','')).join('-');
   const data=await checkedFetch(ESPN_NBA+'scoreboard?dates='+range+'&limit=40').then(r=>r.json());
   const expired=new Set(this.sql.exec('SELECT id FROM expired_games').toArray().map(row=>row.id));
   const candidates=(data.events||[]).map(alertGame)
    .filter(game=>game&&game.status!=='scheduled'&&game.startTime>now-7*3600000&&!expired.has(game.id))
    .map(game=>{
     const platforms=matchPlatforms(game,this.broadcasts||[]);
     return {game,platforms,devices:devices.filter(device=>wantsGame(device.rules,game,platforms,this.playerTeams))};
    }).filter(item=>item.devices.length);
   const sends=[];
   for (let i=0;i<candidates.length;i+=4) {
    const batch=await Promise.allSettled(candidates.slice(i,i+4).map(async item=>{
     const payload=await checkedFetch(ESPN_NBA+'summary?event='+item.game.id).then(r=>r.json());
     return {...item,payload};
    }));
    for (const result of batch) {
     if (result.status!=='fulfilled') continue;
     const {game,platforms,payload,devices:recipients}=result.value;
     const summary=gameMilestones(payload,game);
     if (summary.markers.get('final')?.at<now-ALERT_WINDOW) {
      this.sql.exec('INSERT OR IGNORE INTO expired_games VALUES (?, ?)',game.id,now);
      continue;
     }
     for (const device of recipients) {
      for (const alert of matchingAlerts(device.rules,game,summary,platforms,now)) sends.push({device,alert});
     }
    }
   }
   const delivered=new Set(this.sql.exec('SELECT device,event FROM deliveries WHERE at >= ?',now-ALERT_WINDOW-DAY/24)
    .toArray().map(row=>row.device+':'+row.event));
   const pending=sends.sort((a,b)=>a.alert.at-b.alert.at)
    .filter(({device,alert})=>!delivered.has(device.id+':'+alert.id)).slice(0,MAX_SENDS);
   for (let i=0;i<pending.length;i+=5) {
    await Promise.allSettled(pending.slice(i,i+5).map(async ({device,alert})=>{
     const current=this.sql.exec('SELECT rules FROM devices WHERE id = ?',device.id).toArray()[0];
     if (current?.rules===device.savedRules) await this.send(device,alert);
    }));
   }
  } finally {this.polling=false;}
 }
}
