/* QUADRA — extensão gratuita para agenda completa, times e avaliações de jogadores */
(() => {
  'use strict';
  const KEY = 'quadra_nba_extra_2026_27_v1';
  const months = ['2026-10','2026-11','2026-12','2027-01','2027-02','2027-03','2027-04'];
  const eastern = {
    'Atlântico':['BOS','BKN','NYK','PHI','TOR'],
    'Central':['CHI','CLE','DET','IND','MIL'],
    'Sudeste':['ATL','CHA','MIA','ORL','WAS']
  };
  const western = {
    'Noroeste':['DEN','MIN','OKC','POR','UTA'],
    'Pacífico':['GSW','LAC','LAL','PHX','SAC'],
    'Sudoeste':['DAL','HOU','MEM','NOP','SAS']
  };
  const aliases = {GS:'GSW',NY:'NYK',SA:'SAS',NO:'NOP',UTAH:'UTA',WSH:'WAS',PHO:'PHX'};
  const stateDefault = {players:{},franchise:{},lineups:{},gameRatings:{},gameMvp:{},hideSpoilers:true};
  let state = {...stateDefault, ...safeRead(KEY,stateDefault)};
  if (!state.players || typeof state.players!=='object') state.players={};
  if (!state.lineups || typeof state.lineups!=='object') state.lineups={};
  if (!state.franchise || typeof state.franchise!=='object') state.franchise={};
  if (!state.gameRatings || typeof state.gameRatings!=='object') state.gameRatings={};
  if (!state.gameMvp || typeof state.gameMvp!=='object') state.gameMvp={};
  let conf='east',selectedTeam=settings.fav||'BOS',teamTab='roster',listMode='all',fullStatus='Buscando calendário completo…';
  const monthData=new Map(),rosterData=new Map(),statsData=new Map(),requests=new Map();
  const baseAllGames=allGames,baseRender=render,baseGameHtml=gameHtml,baseEditModal=editModal;
  const BRfmt = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const teamName=id=>formatTeam(id).name;
  const playerKey=id=>String(id||'');
  const teamGroup=code=>Object.entries({...eastern,...western}).find(([,codes])=>codes.includes(code))?.[0]||'';
  const teamConf=code=>Object.values(eastern).some(g=>g.includes(code))?'Leste':'Oeste';
  const isFuture=g=>g.date>=todayBR();
  function persistExtra(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{toast('Não foi possível salvar as notas dos jogadores. Faça backup.');}}
  function apiCode(x){x=String(x||'').toUpperCase();return aliases[x]||x;}
  async function getJson(url){
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),12000);
    try{let r=await fetch(url,{signal:controller.signal,cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}
    finally{clearTimeout(t);}
  }
  function formatBrasil(iso){
    const date=new Date(iso);
    if(isNaN(date.getTime()))return null;
    const bits=Object.fromEntries(BRfmt.formatToParts(date).map(x=>[x.type,x.value]));
    return {date:bits.year+'-'+bits.month+'-'+bits.day,time:bits.hour+':'+bits.minute};
  }
  function normalizeAPIEvent(ev){
    const c=ev.competitions?.[0],away=c?.competitors?.find(x=>x.homeAway==='away'),home=c?.competitors?.find(x=>x.homeAway==='home');
    if(!away||!home)return null;
    const a=apiCode(away.team?.abbreviation),h=apiCode(home.team?.abbreviation),dt=formatBrasil(ev.date);
    if(!teams[a]||!teams[h]||!dt)return null;
    const status=ev.status?.type,final=!!status?.completed;
    const g={id:String(ev.id),...dt,away:a,home:h,status:final?'final':'scheduled',stage:ev.season?.type||2};
    if(final){g.scoreAway=Number(away.score||0);g.scoreHome=Number(home.score||0);}
    return g;
  }
  async function loadMonth(month){
    if(monthData.has(month))return;
    if(requests.has('month:'+month))return requests.get('month:'+month);
    let task=(async()=>{
      let data;
      try{data=await getJson('./data/months/'+month+'.json');}catch{}
      if(!data?.events?.length) {
        try {
          const raw=await getJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates='+month.replace('-','')+'&limit=500');
          data={month,events:(raw.events||[]).map(normalizeAPIEvent).filter(Boolean)};
        }catch(err){console.warn('QUADRA: mês sem sincronização',month,err);}
      }
      if(data?.events?.length){
        monthData.set(month,data.events);
        updateStatus();
        refreshMonths();render();
      } else updateStatus();
    })().finally(()=>requests.delete('month:'+month));
    requests.set('month:'+month,task);return task;
  }
  function combinedGames(){
    const base=baseAllGames(),lookup=new Map(),merged=[],consumed=new Set();
    for(const row of base){
      if(row.away==='TBA'||row.home==='TBA')continue;
      const key=row.date+'|'+row.away+'|'+row.home;
      if(!lookup.has(key))lookup.set(key,[]);
      lookup.get(key).push(row);
    }
    const remote=[...monthData.values()].flat();
    const unique=new Map(remote.map(e=>[String(e.id),e]));
    for(const e of unique.values()){
      if(!e.away||!e.home||!e.date||!e.id)continue;
      const near = [e.date,dateShift(e.date,-1),dateShift(e.date,1)]
        .flatMap(d=>lookup.get(d+'|'+e.away+'|'+e.home)||[])
        .find(x=>!consumed.has(x.id));
      if(near)consumed.add(near.id);
      const stage=e.stage===1?'Pré-temporada':e.stage===3?'Playoffs':'Temporada regular';
      merged.push({...e,id:near?.id||('espn_'+e.id),externalId:String(e.id),
        platforms:near?.platforms||['LEAGUE'],stage:near?.stage==='Copa NBA'?'Copa NBA':stage,
        label:near?.label||'',custom:false,sourceDate:near?.sourceDate||e.date});
    }
    for(const g of base)if(!consumed.has(g.id))merged.push(g);
    return merged.sort((a,b)=>(a.date+' '+(a.time||'23:59')).localeCompare(b.date+' '+(b.time||'23:59')));
  }
  allGames=combinedGames;
  const baseNet=netHtml;
  netHtml = g => (g.platforms||[]).includes('LEAGUE')?'<span class="network">Sem TV BR confirmada</span>':baseNet(g);
  gameHtml = g => {
    let html=baseGameHtml(g);
    if(g.status==='final'){
      const score = state.hideSpoilers ? '<span class="qhidden-score">Placar oculto</span>' :
        '<span class="qscore-badge">'+esc(g.scoreAway)+' – '+esc(g.scoreHome)+'</span>';
      html=html.replace('<div class="details">','<div class="details">'+score);
    }
    return html;
  };
  function updateStatus(){
    const got=[...monthData.values()].flat().length,ok=monthData.size;
    fullStatus=ok?got+' registros de calendário carregados ('+ok+'/7 meses)':'Calendário básico disponível — sincronização pendente';
    const s=E('quadraDataStatus');if(s)s.firstElementChild.textContent=fullStatus;
  }
  const status = document.createElement('div');
  status.className='qdata-status';status.id='quadraDataStatus';
  status.innerHTML='<span>Buscando calendário completo…</span><button type="button" id="refreshNBA">Atualizar</button>';
  document.querySelector('.hero > div')?.append(status);
  const tvSelect=E('filterPlatform');
  tvSelect.insertAdjacentHTML('beforeend','<option value="BR">Só transmissões no Brasil</option><option value="LEAGUE">Sem TV BR informada</option>');
  E('filterStage').insertAdjacentHTML('beforeend','<option value="Playoffs">Playoffs</option>');
  E('tabs').insertAdjacentHTML('beforeend','<button class="tab" data-view="teams">Equipes</button>');
  const hideButton=document.createElement('button');
  hideButton.type='button';hideButton.className='btn';hideButton.id='toggleSpoilers';
  E('exportIcs').parentNode.prepend(hideButton);
  function syncSpoilers(){
    hideButton.textContent=state.hideSpoilers?'◉ Sem spoilers':'◎ Mostrar placares';
    hideButton.title=state.hideSpoilers?'Placar oculto: clique para mostrar':'Placar visível: clique para ocultar';
  }
  syncSpoilers();
  hideButton.onclick=()=>{state.hideSpoilers=!state.hideSpoilers;persistExtra();syncSpoilers();render()};
  const oldAgendaHTML=document.querySelector('.notice');
  if(oldAgendaHTML)oldAgendaHTML.innerHTML='Agenda da TV brasileira combinada com calendário geral, quando disponível. Dados externos via ESPN (interface pública não oficial). Resultados finais podem levar horas para atualizar; ainda não há sincronização com Firebase. <strong>Oculte placares para evitar spoilers.</strong>';
  render = function(){
    if(view==='teams'){
      renderStatsCards();
      E('tabs').querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
      renderTeams();
    }else baseRender();
  };
  function logo(code){
    const file=TEAM_LOGOS[code];return file?'<img loading="lazy" decoding="async" width="55" height="55" alt="" src="./assets/teams/'+encodeURIComponent(file)+'?v=2" onerror="this.style.display=\'none\'">':'';
  }
  function roster(code){
    const v=rosterData.get(code);return v?.players||[];
  }
  async function loadRoster(code){
    if(rosterData.has(code)||requests.has('roster:'+code))return;
    const task=(async()=>{
      let raw=null;
      try{raw=await getJson('./data/teams/'+code+'.json');}catch{}
      if(!raw?.players?.length){
        try{
          const esp=await getJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/'+code.toLowerCase()+'/roster');
          const arr=(esp.athletes||[]).flatMap(group=>group.items||[group]).map(x=>x.athlete||x).filter(x=>x.id&&x.displayName);
          raw={players:arr.map(p=>({id:String(p.id),name:p.displayName,number:p.jersey||'',position:p.position?.abbreviation||'',headshot:p.headshot?.href||''}))};
        }catch{}
      }
      rosterData.set(code,raw?.players?.length?raw:{players:[],unavailable:true});
      if(view==='teams'&&selectedTeam===code)render();
    })().finally(()=>requests.delete('roster:'+code));
    requests.set('roster:'+code,task);return task;
  }
  async function loadStats(month){
    if(statsData.has(month)||requests.has('stats:'+month))return;
    let work=(async()=>{
      try{const d=await getJson('./data/stats/'+month+'.json');if(d?.games)statsData.set(month,d.games);}
      catch{}
    })().finally(()=>requests.delete('stats:'+month));
    requests.set('stats:'+month,work);return work;
  }
  function lastConfirmedStarters(code){
    const matches=Object.values(Object.fromEntries([...statsData.values()].flatMap(x=>Object.entries(x)))).filter(v=>v.players?.[code]&&v.date<=todayBR()).sort((a,b)=>b.date.localeCompare(a.date));
    const match=matches.find(v=>v.players[code].some(p=>p.starter));
    return match?{date:match.date,ids:match.players[code].filter(p=>p.starter).map(p=>String(p.id))}:null;
  }
  function teamGames(code){
    return allGames().filter(g=>g.away===code||g.home===code).filter(isFuture).slice(0,6);
  }
  function playerCard(p){
    const personal=state.players[p.id]||{},f=state.franchise[selectedTeam]===p.id,own=(state.lineups[selectedTeam]||[]).includes(p.id);
    const last=lastConfirmedStarters(selectedTeam)?.ids.includes(p.id);
    const tags=(f?'<span class="qtag gold">★ Franchise</span>':'')+(last?'<span class="qtag green">✓ Último titular</span>':'')+(own?'<span class="qtag">Meu quinteto</span>':'');
    const picture=p.headshot?'<img class="avatar" loading="lazy" alt="" src="'+esc(p.headshot)+'" onerror="this.style.display=\'none\'">':'<span class="avatar avatar-fallback">'+esc(p.name.split(' ').map(x=>x[0]).slice(0,2).join(''))+'</span>';
    return '<div class="qplayerrow">'+picture+'<div class="summary"><strong>'+esc(p.name)+'</strong><small>#'+esc(p.number||'—')+' • '+esc(p.position||'Posição não informada')+'</small><div class="qpills">'+tags+'</div></div>'+(personal.rating?'<span class="rating">★ '+esc(personal.rating)+'</span>':'')+'<button data-player="'+esc(p.id)+'">Avaliar</button></div>';
  }
  function renderTeams(){
    const confGroups=conf==='east'?eastern:western,team=selectedTeam;
    const gallery=Object.entries(confGroups).map(([division,codes])=>'<div class="datehead"><b>'+esc(division)+'</b></div><div class="qtiles">'+codes.map(c=>'<button class="qteamcard '+(team===c?'active':'')+'" data-select-team="'+c+'" title="'+esc(teamName(c))+'">'+logo(c)+'<span>'+esc(teamName(c))+'</span></button>').join('')+'</div>').join('');
    const data=roster(team),last=lastConfirmedStarters(team),myLineup=state.lineups[team]||[];
    let body='';
    if(teamTab==='roster') {
      body='<div class="resulthead"><b>Elenco • '+data.length+' atletas</b><span>Toque para avaliar</span></div>'+
        (data.length?'<div class="qplayers">'+data.map(playerCard).join('')+'</div>':
        '<div class="qempty"><strong>Elenco ainda não carregado</strong>Abra o atualizador do GitHub Actions para preencher o cache. Tentamos também consultar a fonte diretamente no navegador.</div>');
    } else if(teamTab==='lineup'){
      body='<div class="panel"><h2>Quinteto titular confirmado</h2><p>'+(last?'Último jogo com titulares registrados: '+shortDate(last.date):'Ainda não há um box score final com quinteto confirmado. Não vamos inventar titulares.')+'</p>'+
      (last?'<div class="qplayers">'+data.filter(p=>last.ids.includes(p.id)).map(playerCard).join('')+'</div>':'')+'</div>'+
      '<div class="panel"><h2>Meu quinteto • '+myLineup.length+'/5</h2><p>Escolha seus cinco preferidos na avaliação de cada atleta. Essa seleção é pessoal, diferente do quinteto oficial.</p>'+
      (myLineup.length?'<div class="qplayers">'+data.filter(p=>myLineup.includes(p.id)).map(playerCard).join('')+'</div>':'<div class="qempty">Seu quinteto ainda está vazio</div>')+'</div>';
    } else if(teamTab==='games'){
      const upcoming=teamGames(team);
      body='<div class="resulthead"><b>Próximos jogos</b><span>'+upcoming.length+' exibidos</span></div>'+
        (upcoming.length?listHtml(upcoming):'<div class="qempty">Próximos jogos indisponíveis por enquanto</div>')+
        '<button class="btn" data-agenda-team="'+team+'">Ver agenda com filtro da equipe →</button>';
    } else {
      const rank=data.filter(p=>Number(state.players[p.id]?.rating)>0).sort((a,b)=>(state.players[b.id].rating||0)-(state.players[a.id].rating||0));
      body='<div class="panel"><h2>Minhas notas dos jogadores</h2><p>As avaliações são pessoais e não dependem da estatística oficial.</p>'+
        (rank.length?'<div class="qplayers">'+rank.map(playerCard).join('')+'</div>':'<div class="qempty">Avalie os atletas para montar seu ranking pessoal</div>')+'</div>';
    }
    E('content').innerHTML=
      '<div class="qconf"><strong>CONFERÊNCIAS</strong><div class="groupbtns"><button data-conference="east" class="'+(conf==='east'?'active':'')+'">LESTE</button><button data-conference="west" class="'+(conf==='west'?'active':'')+'">OESTE</button></div></div>'+
      gallery+'<section class="qteamhero">'+logo(team)+'<div><span class="eyebrow">CONFERÊNCIA '+teamConf(team).toUpperCase()+' • '+esc(teamGroup(team))+'</span><h2>'+esc(teamName(team))+'</h2><p>Elenco, avaliações e jogos da temporada 2026/27</p></div></section>'+
      '<nav class="qsubnav">'+[['roster','Elenco'],['lineup','Titulares'],['games','Próximos jogos'],['ratings','Minhas notas']].map(([a,b])=>'<button class="qtab '+(teamTab===a?'active':'')+'" data-teamtab="'+a+'">'+b+'</button>').join('')+'</nav>'+body+
      '<div class="qnotice">Os quintetos confirmados são extraídos de box scores finais; o quinteto pessoal é escolhido por você.</div>';
    if(!rosterData.has(team))loadRoster(team);
  }
  function playerModal(playerId,gameId=null){
    const p = roster(selectedTeam).find(x=>x.id===playerId)
      || [...rosterData.values()].flatMap(x=>x.players||[]).find(x=>x.id===playerId);
    if(!p){toast('Este jogador ainda não está no elenco importado.');return;}
    const personal=state.players[p.id]||{},gameRating=state.gameRatings[gameId+':'+p.id]||0;
    const value=gameId?gameRating:(personal.rating||0);
    const title=gameId?'Nota nesta partida':'Nota na temporada';
    const f=state.franchise[selectedTeam]===p.id,own=(state.lineups[selectedTeam]||[]).includes(p.id);
    showModal('<div class="modal-heading"><div><span class="eyebrow">MINHAS AVALIAÇÕES</span><h2>'+esc(p.name)+'</h2><p>'+esc(teamName(selectedTeam))+' • #'+esc(p.number||'—')+' • '+esc(p.position)+'</p></div><button class="btn icon ghost" data-modal-close>×</button></div>'+
      '<form id="qPlayerForm"><div class="formblock"><div class="qrate-header"><label>'+title+'</label><strong id="qRatingVal">'+(value?esc(value):'—')+'/10</strong></div><input class="rate-range" id="qPlayerRange" type="range" min="0" max="10" step=".5" value="'+esc(value)+'"></div>'+
      (!gameId?'<label class="checkline"><input id="qFranchise" type="checkbox" '+(f?'checked':'')+'> ★ Meu franchise player desta equipe</label><br><label class="checkline"><input id="qOwnStarter" type="checkbox" '+(own?'checked':'')+'> ✓ Meu quinteto titular (máximo de 5)</label><br><label class="checkline"><input id="qFavoritePlayer" type="checkbox" '+(personal.favorite?'checked':'')+'> ♥ Jogador favorito</label>':'<p class="help">Nota individual registrada apenas nesta partida. A nota da temporada é separada.</p>')+
      '<div class="modal-footer"><button class="btn ghost" type="button" data-modal-close>Cancelar</button><button class="btn primary" type="submit">Salvar avaliação ✓</button></div></form>');
    E('qPlayerRange').oninput=()=>E('qRatingVal').textContent=E('qPlayerRange').value+'/10';
    E('qPlayerForm').onsubmit=e=>{
      e.preventDefault();
      if(gameId){state.gameRatings[gameId+':'+p.id]=Number(E('qPlayerRange').value);}
      else {
        state.players[p.id]={...personal,rating:Number(E('qPlayerRange').value),favorite:E('qFavoritePlayer').checked};
        if(E('qFranchise').checked)state.franchise[selectedTeam]=p.id;
        else if(state.franchise[selectedTeam]===p.id)delete state.franchise[selectedTeam];
        const prev=(state.lineups[selectedTeam]||[]).filter(id=>id!==p.id);
        if(E('qOwnStarter').checked){
          if(prev.length>=5){toast('Seu quinteto já tem cinco jogadores. Remova um antes de adicionar outro.');return;}
          prev.push(p.id);
        }
        state.lineups[selectedTeam]=prev;
      }
      persistExtra();closeModal();render();toast('Avaliação salva!');
    };
  }
  function getFinalBox(g){
    const month=g.date.slice(0,7),events=statsData.get(month)||{},id=g.externalId||String(g.id).replace(/^espn_/,'');
    return events[id]||Object.values(events).find(x=>x.away===g.away&&x.home===g.home&&x.date===g.date);
  }
  function boxHtml(g,box){
    if(!box)return '<div class="qempty"><strong>Estatísticas finais ainda não disponíveis</strong>Os box scores aparecem depois da atualização automática. A fonte pode demorar a publicar os dados.</div>';
    if(state.hideSpoilers)return '<div class="qempty"><strong>Modo sem spoilers está ligado</strong>Para ver os box scores, use o botão “Sem spoilers” no topo e abra novamente a partida.</div>';
    let sections='';
    for(const code of [g.away,g.home]){
      const rows=(box.players||{})[code]||[];
      sections+='<h3>'+esc(teamName(code))+'</h3><div class="qscroll"><table class="qstats-table"><thead><tr><th>Jogador</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>Minha nota</th><th>MVP</th></tr></thead><tbody>'+
        rows.map(p=>'<tr><td>'+esc(p.name)+(p.starter?' <span class="qtag green">T</span>':'')+'</td><td>'+esc(p.min)+'</td><td>'+esc(p.pts)+'</td><td>'+esc(p.reb)+'</td><td>'+esc(p.ast)+'</td><td>'+esc(p.stl)+'</td><td>'+esc(p.blk)+'</td><td><button type="button" data-grade-game="'+esc(g.id)+'" data-player-id="'+esc(p.id)+'">'+(state.gameRatings[g.id+':'+p.id]??'Dar nota')+'</button></td><td><button type="button" data-mvp-game="'+esc(g.id)+'" data-player-id="'+esc(p.id)+'">'+(state.gameMvp[g.id]===p.id?'★ Escolhido':'☆ Votar')+'</button></td></tr>').join('')+'</tbody></table></div>';
    }
    return sections;
  }
  editModal = function(id){
    baseEditModal(id);
    const g=getGame(id);
    if(!g||!g.away||!g.home||g.away==='TBA')return;
    const form=E('editForm');if(!form)return;
    const pane=document.createElement('section');pane.className='qgame-stats';pane.dataset.gameId=id;
    pane.innerHTML='<h3>Estatísticas da partida</h3><div class="qbox-msg">Carregando estatísticas finais...</div>';
    form.querySelector('.modal-footer')?.before(pane);
    const renderBox=()=>{
      if(!document.querySelector('[data-game-id="'+CSS.escape(id)+'"]'))return;
      const box=getFinalBox(g);
      pane.innerHTML='<h3>Estatísticas individuais e votação de MVP</h3>'+boxHtml(g,box);
    };
    const month=g.date.slice(0,7);
    loadStats(month).then(renderBox);
    renderBox();
  };
  const baseExport=exportBackup;
  exportBackup = function(){
    download('quadra-nba-backup-completo.json',JSON.stringify({app:'quadra-nba',version:2,exportedAt:new Date().toISOString(),saved,settings,extras:state},null,2),'application/json;charset=utf-8');
    toast('Backup completo com avaliações de jogadores exportado!');
  };
  importBackupFile = function(file){
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const x=JSON.parse(reader.result);
        if(x.app!=='quadra-nba'||!x.saved||!x.saved.notes||!Array.isArray(x.saved.custom))throw Error('Arquivo não é backup válido do Quadra');
        if(!confirm('Restaurar este backup e substituir os dados pessoais atuais?'))return;
        saved={notes:x.saved.notes,custom:x.saved.custom};settings=x.settings||{fav:''};
        if(x.extras){state={...stateDefault,...x.extras};persistExtra();}
        persist();E('favTeam').value=settings.fav||'';closeModal();refreshMonths();render();toast('Backup restaurado!');
      }catch(e){toast('Falha ao importar: '+e.message);}
      finally{E('backupFile').value='';}
    };
    reader.readAsText(file);
  };
  // Clique nas logos/nos nomes dos times nos cards para navegar à franquia.
  const baseTeamHtml=teamHtml;
  teamHtml = (code,right=false)=>baseTeamHtml(code,right).replace('class="team ','data-open-team="'+esc(code)+'" role="button" tabindex="0" title="Abrir elenco" class="team ');
  document.addEventListener('click',e=>{
    const club=e.target.closest('[data-open-team]');
    if(club){
      selectedTeam=club.dataset.openTeam;conf=teamConf(selectedTeam)==='Leste'?'east':'west';teamTab='roster';view='teams';render();return;
    }
    const c=e.target.closest('[data-conference]');
    if(c){conf=c.dataset.conference;selectedTeam=conf==='east'?'BOS':'LAL';teamTab='roster';render();return;}
    const t=e.target.closest('[data-select-team]');
    if(t){selectedTeam=t.dataset.selectTeam;teamTab='roster';render();return;}
    const st=e.target.closest('[data-teamtab]');
    if(st){teamTab=st.dataset.teamtab;render();return;}
    const p=e.target.closest('[data-player]');
    if(p){playerModal(p.dataset.player);return;}
    const g=e.target.closest('[data-grade-game]');
    if(g){const game=getGame(g.dataset.gradeGame);selectedTeam=game.away;playerModal(g.dataset.playerId,game.id);return;}
    const m=e.target.closest('[data-mvp-game]');
    if(m){state.gameMvp[m.dataset.mvpGame]=m.dataset.playerId;persistExtra();editModal(m.dataset.mvpGame);toast('Seu MVP foi escolhido!');return;}
    const x=e.target.closest('[data-agenda-team]');
    if(x){E('filterTeam').value=x.dataset.agendaTeam;view='agenda';quick='upcoming';pageCount=60;render();return;}
    if(e.target.closest('#refreshNBA')){
      monthData.clear();loadEverything();toast('Atualizando dados disponíveis…');return;
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.closest('[data-open-team]')){e.preventDefault();e.target.click();}
  });
  async function loadEverything(){
    await loadMonth(months.includes(todayBR().slice(0,7))?todayBR().slice(0,7):'2026-10');
    const remaining=months.filter(m=>m!==todayBR().slice(0,7));
    for(let i=0;i<remaining.length;i+=2)await Promise.allSettled(remaining.slice(i,i+2).map(loadMonth));
    updateStatus();
  }
  syncSpoilers();
  updateStatus();
  render();
  loadEverything();
  // Carrega somente estatísticas dos meses recentes; outros meses são buscados ao abrir uma partida.
  loadStats(todayBR().slice(0,7)).then(()=>{if(view==='teams')render();});
  const previous=dateShift(todayBR(),-30).slice(0,7);
  if(previous!==todayBR().slice(0,7))loadStats(previous).then(()=>{if(view==='teams')render();});
})();