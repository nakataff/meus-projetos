"""Generate at most two franchise highlights using local rosters only."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'nba'/'data'
PINNED={'BOS':['4065648'],'PHI':['3059318','1966']}
STARS=['Nikola Jokic','Shai Gilgeous-Alexander','Luka Doncic','Giannis Antetokounmpo','Stephen Curry','Kevin Durant','Anthony Edwards','Jayson Tatum','LeBron James','Joel Embiid','Victor Wembanyama','Anthony Davis','Jalen Brunson','Donovan Mitchell','Devin Booker','Cade Cunningham','Tyrese Haliburton','Paolo Banchero','Trae Young','Ja Morant','Kawhi Leonard','Damian Lillard','Zion Williamson','LaMelo Ball','Scottie Barnes','Bam Adebayo','Alperen Sengun','Domantas Sabonis','Cooper Flagg','Jaylen Brown','Tyrese Maxey']
def build_franchises():
 out={}
 for file in sorted((ROOT/'teams').glob('*.json')):
  code=file.stem;roster=json.loads(file.read_text()).get('players',[])
  statsfile=ROOT/'team-stats'/(code+'.json')
  stats=json.loads(statsfile.read_text()) if statsfile.exists() else {}
  rows=stats.get('regular',{}).get('players',[]) or stats.get('preseason',{}).get('players',[])
  pts={str(p['id']):p.get('pts',0)/max(1,p.get('gp',0)) for p in rows}
  if code in PINNED: chosen=[p for ident in PINNED[code] for p in roster if str(p['id'])==ident]
  else: chosen=sorted(roster,key=lambda p:(p['name'] in STARS,-STARS.index(p['name']) if p['name'] in STARS else -1000,pts.get(str(p['id']),0)),reverse=True)[:2]
  out[code]=[{'id':str(p['id']),'name':p['name']} for p in chosen]
 (ROOT/'franchises.js').write_text('/* Generated from local rosters; never personal selections. */\nexport const FRANCHISE_PLAYERS='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\nexport const isFranchise=(team,id)=>(FRANCHISE_PLAYERS[team]||[]).some(p=>p.id===String(id));\n')
if __name__=='__main__':build_franchises()
