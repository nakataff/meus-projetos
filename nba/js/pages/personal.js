import {$,setupShared,loadGames,MONTHS,getData,groupGames,esc,path,backup,restore,handleWishes,note,setSpoilers,getSpoilers,TEAMS,teamLink,toast} from '../app.js';
setupShared('personal','Meu QUADRA','Seu histórico pessoal, notas, favoritos, MVPs e backup.');
const root=$('#pageContent');let games=[],active=new URLSearchParams(location.search).get('tab')||'resumo';
const modes={resumo:'Resumo',assistidos:'Assistidos',desejos:'Quero assistir',notas:'Avaliações'};
function chosen(kind){
 return games.filter(g=>{const p=note(g.id);return kind==='assistidos'?p.watched:kind==='desejos'?(p.wish&&!p.watched):kind==='notas'?(+p.rating>0):false});
}
function draw(){
 const {saved,settings,extras}=getData(),notes=Object.values(saved.notes),watched=notes.filter(x=>x.watched).length;
 const rated=notes.filter(x=>+x.rating>0);
 const avg=rated.length?(rated.reduce((a,x)=>a+(+x.rating||0),0)/rated.length).toFixed(1).replace('.',','):'—';
 const players=Object.entries(extras.players||{}).filter(([,x])=>+x.rating>0).sort((a,b)=>b[1].rating-a[1].rating);
 let output='<div class="grid four"><div class="card"><div class="caps">Já assisti</div><h3>'+watched+'</h3><p>Jogos registrados</p></div><div class="card"><div class="caps">Nota média</div><h3>'+avg+'/10</h3><p>'+rated.length+' avaliações</p></div><div class="card"><div class="caps">Jogadores avaliados</div><h3>'+players.length+'</h3><p>Na temporada</p></div><div class="card"><div class="caps">Franchise players</div><h3>'+Object.keys(extras.franchise||{}).length+'</h3><p>Suas escolhas</p></div></div>'+
 '<nav class="tabs">'+Object.entries(modes).map(([id,label])=>'<button class="tab '+(active===id?'active':'')+'" data-mode="'+id+'">'+label+'</button>').join('')+'</nav>';
 if(active==='resumo'){
  output+='<div class="grid two"><section class="card"><h3>Melhores jogadores na minha avaliação</h3>'+
  (players.length?players.slice(0,10).map(([id,p],i)=>'<div class="player-row"><div class="pname"><b>#'+(i+1)+' • Atleta '+esc(id)+'</b><small>Nota pessoal</small></div><span class="muted-star">★ '+esc(p.rating)+'/10</span></div>').join(''):'<div class="filler">Avalie jogadores nos perfis das franquias para preencher seu ranking.</div>')+'</section>'+
  '<section class="card"><h3>Minhas preferências</h3><p>Time favorito: '+(settings.fav?'<a href="'+teamLink(settings.fav)+'">'+esc(TEAMS[settings.fav]?.[0]||settings.fav)+'</a>':'Não selecionado')+'</p><p style="margin-top:12px">Modo sem spoilers: '+(getSpoilers()?'ativado':'desativado')+'</p><p style="margin-top:14px"><button class="btn" id="toggleSpoilers">'+(getSpoilers()?'Mostrar placares':'Ocultar placares')+'</button></p></section></div>'+
  '<section class="card section"><h3>Meus dados e segurança</h3><p>O Firebase sincroniza suas avaliações entre aparelhos quando você entra com a mesma conta Google. Guarde também um backup JSON.</p><div class="controls"><button class="btn accent" id="backup">⇩ Exportar backup completo</button><button class="btn" id="importBackup">↥ Importar backup JSON</button><a class="btn ghost" href="'+path('versao-anterior/')+'">Versão anterior ↗</a></div><input type="file" id="backupFile" accept=".json,application/json" hidden></section>';
 }else{
  const list=chosen(active);if(active==='notas')list.sort((a,b)=>(+note(b.id).rating)-(+note(a.id).rating));
  output+='<div class="section-title"><h2>'+esc(modes[active])+'</h2><span class="small subtle">'+list.length+' partidas</span></div>'+groupGames(list.slice(0,100))+(list.length>100?'<p class="info">Exibindo 100 partidas. Use a agenda para consultar os demais registros.</p>':'');
 }
 root.innerHTML=output;
}
root.addEventListener('click',e=>{
 const t=e.target.closest('[data-mode]');if(t){active=t.dataset.mode;draw();history.replaceState(null,'','?tab='+encodeURIComponent(active));return;}
 if(handleWishes(e.target,draw)){e.preventDefault();return;}
 if(e.target.closest('#backup')){backup();toast('Backup baixado!');return;}
 if(e.target.closest('#importBackup')){$('#backupFile')?.click();return;}
 if(e.target.closest('#toggleSpoilers')){setSpoilers(!getSpoilers());draw();return;}
});
root.addEventListener('change',e=>{if(e.target.id==='backupFile')restore(e.target.files?.[0],draw);});
window.addEventListener('quadra:refresh',draw);
root.innerHTML='<div class="filler">Preparando seu histórico…</div>';
loadGames(MONTHS).then(g=>{games=g;draw()}).catch(()=>{games=[];draw();});
