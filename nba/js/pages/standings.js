/* Classificação DE LA QUADRA 2026/27 — resultados finais com projeção ao vivo opcional. */
import {$,setupShared,EAST,WEST,TEAMS,name,logo,esc,path,teamLink,jsonFile,shortDate,gameLink} from '../app.js?v=10';

setupShared('standings','Classificação da NBA','Tabela geral, conferências Leste e Oeste e divisões da temporada regular 2026/27.');
const root=$('#pageContent');
const divisions={Leste:EAST,Oeste:WEST};
const conferenceOf=team=>Object.values(EAST).some(c=>c.includes(team))?'Leste':'Oeste';
const divisionOf=team=>Object.keys(EAST).find(c=>EAST[c].includes(team))||
 Object.keys(WEST).find(c=>WEST[c].includes(team))||'—';
let board=null,scope='general',division='all',focus=new URLSearchParams(location.search).get('time')||'';
let includeLive=true; // Projeção independente do histórico finalizado

const tally=t=>(t.w||0)+(t.l||0);
const ratio=t=>tally(t)?(t.w||0)/tally(t):0;
const order=rows=>rows.slice().sort((a,b)=>{
 const p=a=>tally(a)?ratio(a):-1;
 return p(b)-p(a)||
  ((b.pf-b.pa)-(a.pf-a.pa))||
  (b.w-a.w)||String(a.team).localeCompare(String(b.team),'pt-BR');
});
const percentage=t=>tally(t)?(ratio(t)*100).toFixed(1).replace('.',',')+'%':'—';
const divisionChoices=()=>Object.entries(divisions).flatMap(([conf,ds])=>Object.keys(ds).map(d=>({label:conf+' • '+d,value:conf+':'+d})));

// Só inclui confrontos da temporada regular, com pontuação realmente disponível.
// Os números oficiais do JSON não são alterados.
function liveFixtures(){
 const live=window.QUADRA_LIVE_GAMES;
 if(!live)return [];
 return [...live.values()].filter(g=>
  g.status==='live'&&g.seasonType===2&&
  TEAMS[g.away]&&TEAMS[g.home]&&g.away!==g.home&&
  Number.isFinite(g.scoreAway)&&Number.isFinite(g.scoreHome));
}
function projectRows(fixtures){
 const rows=(board?.teams||[]).map(t=>({...t,lastFive:[...(t.lastFive||[])]}));
 if(!includeLive)return rows;
 const byTeam=new Map(rows.map(r=>[r.team,r]));
 for(const g of fixtures){
  const away=byTeam.get(g.away),home=byTeam.get(g.home);
  if(!away||!home)continue;
  // Empate: jogo segue aberto, mas ainda não há vitória/derrota para projetar.
  if(g.scoreAway===g.scoreHome)continue;
  const winner=g.scoreAway>g.scoreHome?away:home;
  const loser=g.scoreAway>g.scoreHome?home:away;
  winner.w+=1;loser.l+=1;
  away.pf+=g.scoreAway;away.pa+=g.scoreHome;
  home.pf+=g.scoreHome;home.pa+=g.scoreAway;
  for(const team of [away,home])team.liveProjection=true;
 }
 return rows;
}
function liveScorecards(fixtures){
 if(!fixtures.length)return '';
 return '<section class="standings-live-box"><div class="standings-live-head"><span class="standings-live-dot" aria-hidden="true"></span>'+
  '<strong>Jogos em andamento</strong><span>Placar parcial • temporada regular</span></div>'+
  '<div class="standings-live-grid">'+fixtures.map(g=>
   '<a class="standings-live-game" href="'+gameLink({id:g.id,date:g.date})+'">'+
    '<span class="standings-live-team"><img src="'+esc(logo(g.away))+'" alt="" loading="lazy">'+esc(g.away)+'</span>'+
    '<strong>'+g.scoreAway+' <span>×</span> '+g.scoreHome+'</strong>'+
    '<span class="standings-live-team"><img src="'+esc(logo(g.home))+'" alt="" loading="lazy">'+esc(g.home)+'</span>'+
    '<small>'+esc(g.period>4?'Prorrogação':g.period>0?g.period+'º quarto':'Ao vivo')+
    (g.clock?' • '+esc(g.clock):'')+'</small></a>'
  ).join('')+'</div></section>';
}

function displayTable(rows,title){
 if(!rows.length)return '<div class="filler">Nenhuma equipe encontrada.</div>';
 const games=rows.some(t=>tally(t)>0),sorted=order(rows);
 return '<section class="section standings-section"><div class="section-title"><h2>'+esc(title)+'</h2>'+
 '<span class="small subtle">'+sorted.length+' equipes</span></div>'+
 (games?'':'<p class="info">Ainda não há partidas finalizadas da temporada regular neste grupo. A tabela será preenchida automaticamente.</p>')+
 '<div class="standings-scroll"><table class="standings-table"><thead><tr>'+
 '<th scope="col" class="standings-team-col">Pos. / equipe</th>'+
 '<th scope="col">J</th><th scope="col">V</th><th scope="col">D</th>'+
 '<th scope="col">%</th><th scope="col">PF</th><th scope="col">PS</th>'+
 '<th scope="col">SALDO</th><th scope="col">ÚLT. 5</th></tr></thead><tbody>'+
 sorted.map((r,i)=>{
 const rank=tally(r)?(i+1)+'º':'—';
 const streak=(r.lastFive||[]).map(x=>'<span class="standings-form '+(x==='W'?'win':'loss')+'">'+(x==='W'?'V':'D')+'</span>').join('');
 return '<tr class="'+(r.team===focus?'highlight ':'')+(r.liveProjection?'standings-projecting':'')+'"><th scope="row" class="standings-team-col">'+
 '<span class="standings-rank">'+rank+'</span><a href="'+teamLink(r.team)+'">'+
 '<img src="'+esc(logo(r.team))+'" alt="" loading="lazy" decoding="async"><span>'+
 '<b>'+esc(name(r.team))+'</b><small>'+esc(conferenceOf(r.team))+' • '+esc(divisionOf(r.team))+'</small>'+ (r.liveProjection?'<small class="standings-projection-label">↗ PROJEÇÃO AO VIVO</small>':'')+
 '</span></a></th>'+
 '<td>'+tally(r)+'</td><td>'+r.w+'</td><td>'+r.l+'</td>'+
 '<td class="standings-pct">'+percentage(r)+'</td>'+
 '<td>'+r.pf+'</td><td>'+r.pa+'</td>'+
 '<td class="'+((r.pf-r.pa)>0?'standings-pos':(r.pf-r.pa)<0?'standings-neg':'')+'">'+
 (r.pf-r.pa>0?'+':'')+(r.pf-r.pa)+'</td>'+
 '<td><div class="standings-last">'+(streak||'—')+'</div></td></tr>';
 }).join('')+'</tbody></table></div></section>';
}
function render(){
 if(!board)return;
 const fixtures=liveFixtures();
 const rows=projectRows(fixtures);
 const projected=includeLive?fixtures.filter(g=>g.scoreAway!==g.scoreHome).length:0;
 const grouped=scope==='general'?
  displayTable(rows,'Classificação geral • 30 franquias'):
  scope==='east'||scope==='west'?
  displayTable(rows.filter(t=>conferenceOf(t.team)===(scope==='east'?'Leste':'Oeste')),
   'Conferência '+(scope==='east'?'Leste':'Oeste')):
  division==='all'?Object.entries(divisions).map(([conf,divs])=>
    Object.entries(divs).map(([label,codes])=>
      displayTable(rows.filter(x=>codes.includes(x.team)),conf+' • Divisão '+label)).join('')).join(''):
    (()=>{
      const [conf,label]=division.split(':');const allowed=divisions[conf]?.[label]||[];
      return displayTable(rows.filter(t=>allowed.includes(t.team)),conf+' • Divisão '+label);
    })();
 root.innerHTML=
 '<div class="standings-summary"><div><span class="caps">TEMPORADA REGULAR 2026/27</span>'+
 '<h2>'+board.gamesCount+' '+(board.gamesCount===1?'partida finalizada':'partidas finalizadas')+'</h2>'+
 '<span class="small subtle">Último jogo finalizado: '+(board.lastGameDate?shortDate(board.lastGameDate):'nenhum')+'</span></div>'+
 '<div class="standings-help"><span>'+(fixtures.length?fixtures.length+' '+(fixtures.length===1?'jogo ao vivo':'jogos ao vivo')+' • consulta a cada 15s':'Resultados finais importados')+'</span>'+
 '<button type="button" class="btn ghost" id="standingsRefresh">↻ Atualizar</button></div></div>'+
 liveScorecards(fixtures)+
 '<div class="standings-live-options"><label><input id="standingsIncludeLive" type="checkbox" '+(includeLive?'checked':'')+'> Considerar resultados parciais na classificação</label>'+ (fixtures.length&&includeLive?'<span>'+projected+' '+(projected===1?'jogo projetado':'jogos projetados')+' • apenas enquanto houver vantagem no placar</span>':'')+'</div>'+ 
 '<div class="standings-switches">'+[
  ['general','Geral'],['east','Leste'],['west','Oeste'],['divisions','Divisões']
 ].map(([key,label])=>'<button type="button" class="pill '+(scope===key?'active':'')+
 '" data-standings-scope="'+key+'">'+label+'</button>').join('')+'</div>'+
 (scope==='divisions'?'<div class="controls"><select id="standingsDivision" class="control">'+
 '<option value="all">Todas as divisões</option>'+
 divisionChoices().map(x=>'<option value="'+esc(x.value)+'"'+(division===x.value?' selected':'')+'>'+
 esc(x.label)+'</option>').join('')+'</select></div>':'')+
 grouped+'<p class="standings-note">Resultados finais importados formam a classificação base. Quando ativada, a projeção considera temporariamente o placar dos jogos em andamento da temporada regular, podendo mudar a cada atualização; jogos empatados não recebem vitória nem derrota projetada. A sequência ÚLT. 5 inclui apenas resultados finais. Pré-temporada e playoffs ficam de fora. A classificação oficial da NBA usa outros critérios de desempate.</p>';
}
async function load(force=false){
 root.innerHTML='<div class="filler">Carregando a classificação da temporada…</div>';
 try{
  if(force){
   const r=await fetch(path('data/standings/2026-27.json'),{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   board=await r.json();
  }else board=await jsonFile('data/standings/2026-27.json');
  if(!Array.isArray(board?.teams)||board.teams.length!==30)throw Error('Classificação incompleta');
  render();
 }catch(e){
  console.warn('QUADRA classificação:',e);
  root.innerHTML='<div class="filler"><b>Não foi possível carregar a tabela</b>'+
  'Tente novamente mais tarde. O calendário e os elencos continuam disponíveis.'+
  '<p><button class="btn" id="standingsRefresh">Tentar novamente</button></p></div>';
 }
}
root.addEventListener('click',e=>{
 const scopeBtn=e.target.closest('[data-standings-scope]');
 if(scopeBtn){scope=scopeBtn.dataset.standingsScope;render();return;}
 if(e.target.closest('#standingsRefresh')){load(true);window.QUADRA_LIVE_REFRESH?.();return;}
});
root.addEventListener('change',e=>{
 if(e.target.id==='standingsDivision'){division=e.target.value;render();return;}
 if(e.target.id==='standingsIncludeLive'){includeLive=e.target.checked;render();}
});
window.addEventListener('quadra:live-update',()=>{if(board)render();});
load();
