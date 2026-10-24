import {TEAMS,name,logo,path,playerLink,teamLink,shortDate,jsonFile,currentDate} from './app.js?v=13';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let indexPromise;
function searchIndex(){
 if(!indexPromise)indexPromise=jsonFile('data/search.json').then(data=>[
  ...data.players.map(([id,label,team])=>({kind:'Jogadores',label,detail:name(team),image:logo(team),href:playerLink(id,team),search:normalize(label+' '+team+' '+name(team))})),
  ...data.games.map(([id,away,home,date,time])=>({kind:'Partidas',label:away+' × '+home,detail:shortDate(date)+(time?' • '+time:''),image:logo(home),href:path('jogo/?id='+encodeURIComponent(id)+'&data='+date),date,search:normalize(away+' '+name(away)+' '+home+' '+name(home)+' '+date+' '+shortDate(date))}))
 ]).catch(error=>{indexPromise=null;throw error;});
 return indexPromise;
}
export function mountNavigation(){
 const open=document.querySelector('.dlq-search-open'),dock=document.querySelector('.dlq-dock');
 if(!open)return;
 const toggle=dock?.querySelector('.dlq-dock-toggle');
 const setCollapsed=collapsed=>{
  dock.classList.toggle('is-collapsed',collapsed);
  toggle.setAttribute('aria-expanded',String(!collapsed));
  toggle.setAttribute('aria-label',collapsed?'Expandir barra inferior':'Recolher barra inferior');
 };
 if(toggle){
  try{setCollapsed(localStorage.getItem('dlq-dock-collapsed')==='1');}catch{}
  toggle.addEventListener('click',()=>{const collapsed=!dock.classList.contains('is-collapsed');setCollapsed(collapsed);try{localStorage.setItem('dlq-dock-collapsed',collapsed?'1':'0');}catch{}});
 }
 const dialog=document.createElement('dialog');dialog.className='dlq-search-dialog';
 dialog.setAttribute('aria-label','Busca geral');
 dialog.innerHTML='<div class="dlq-search-head"><input type="search" placeholder="Jogador, equipe ou partida…" aria-label="Pesquisar no site" autocomplete="off" spellcheck="false"><button type="button" aria-label="Fechar busca">Fechar</button></div><div class="dlq-search-results" aria-live="polite"></div>';
 document.body.append(dialog);
 const input=dialog.querySelector('input'),results=dialog.querySelector('.dlq-search-results');
 const sections=[['Início',''],['Jogos','jogos/'],['Classificação','classificacao/'],['Equipes','equipes/'],['Jogadores','melhores/'],['Meu perfil','perfil/']];
 const base=[...sections.map(([label,url])=>({kind:'Páginas',label,detail:'Atalho',href:path(url),search:normalize(label)})),...Object.keys(TEAMS).map(team=>({kind:'Equipes',label:name(team),detail:team,image:logo(team),href:teamLink(team),search:normalize(team+' '+name(team))}))];
 let loaded=[],state='idle',timer;
 const note=text=>{const p=document.createElement('p');p.className='dlq-search-note';p.textContent=text;results.append(p);};
 function render(){
  const query=normalize(input.value),tokens=query.split(/\s+/).filter(Boolean);
  results.replaceChildren();
  if(!query)note('Busque por nome, sigla da equipe ou data. Ex.: LeBron, Lakers, BOS LAL.');
  let count=0;
  for(const kind of ['Páginas','Equipes','Jogadores','Partidas']){
   let rows=[...base,...loaded].filter(row=>row.kind===kind&&(!query?kind==='Páginas':tokens.every(t=>row.search.includes(t))));
   if(kind==='Partidas'){
    const today=currentDate();
    rows.sort((a,b)=>Math.abs(Date.parse(a.date)-Date.parse(today))-Math.abs(Date.parse(b.date)-Date.parse(today)));
   }
   rows=rows.slice(0,kind==='Partidas'?5:6);
   if(!rows.length)continue;
   const h=document.createElement('h3');h.textContent=kind;results.append(h);
   for(const row of rows){
    const a=document.createElement('a');a.className='dlq-search-result';a.href=row.href;
    if(row.image){const img=document.createElement('img');img.src=row.image;img.alt='';img.loading='lazy';a.append(img);}
    const span=document.createElement('span'),b=document.createElement('b'),small=document.createElement('small');
    b.textContent=row.label;small.textContent=row.detail;span.append(b,small);a.append(span);results.append(a);count++;
   }
  }
  if(state==='loading')note('Carregando índice de jogadores e partidas…');
  else if(state==='error')note('Jogadores e partidas indisponíveis agora. Feche e abra a busca para tentar novamente.');
  else if(query&&!count)note('Nenhum resultado. Tente outro nome ou sigla.');
 }
 async function show(){
  if(dialog.open)return;
  dialog.showModal();input.focus();render();
  if(state==='ready')return;
  state='loading';render();
  try{loaded=await searchIndex();state='ready';}catch{state='error';}
  if(dialog.open)render();
 }
 open.addEventListener('click',show);
 input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(render,100);});
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{clearTimeout(timer);open.focus();});
 dialog.addEventListener('keydown',e=>{
  if(!['ArrowDown','ArrowUp'].includes(e.key))return;
  const links=[...results.querySelectorAll('a')];if(!links.length)return;
  e.preventDefault();const index=links.indexOf(document.activeElement);
  links[(index+(e.key==='ArrowDown'?1:-1)+links.length)%links.length].focus();
 });
 document.addEventListener('keydown',e=>{
  const editing=e.target.closest?.('input,textarea,select,[contenteditable="true"]');
  if((e.key.toLowerCase()==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!editing)){
   e.preventDefault();show();
  }
 });
}
