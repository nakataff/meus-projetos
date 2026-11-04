/* Preferências de equipes: preserva settings.fav como time principal antigo. */
export function trackedTeams(settings={},known={}){
 const valid=code=>typeof code==='string'&&Object.prototype.hasOwnProperty.call(known,code);
 const primary=valid(settings?.fav)?settings.fav:null;
 const saved=Array.isArray(settings?.followedTeams)?settings.followedTeams:[];
 return [...new Set([primary,...saved.filter(valid)].filter(Boolean))];
}
export function teamFollowChange(settings={},known={},code,action){
 if(typeof code!=='string'||!Object.prototype.hasOwnProperty.call(known,code))return {};
 const all=trackedTeams(settings,known);
 if(action==='follow'){
  const updated=all.includes(code)?all:[...all,code];
  return {followedTeams:updated,fav:settings.fav||code};
 }
 if(action==='unfollow'){
  const updated=all.filter(x=>x!==code);
  return {followedTeams:updated,fav:settings.fav===code?'':(settings.fav||'')};
 }
 if(action==='primary'){
  const updated=all.includes(code)?all:[...all,code];
  return {followedTeams:updated,fav:settings.fav===code?'':code};
 }
 return {};
}
