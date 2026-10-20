import { $, setupShared, loadGames, currentDate, gameRow, groupGames, path, asset, getData, note, handleWishes, getSpoilers, esc, broadcastInfo, name, toast, MONTHS, niceDate } from '../app.js';
setupShared('home','Seu basquete. Seu histórico.','Acompanhe os jogos, visite suas equipes favoritas e continue seu diário de NBA.');
const root=$('#pageContent'),today=currentDate();
let games=[];
function cards(){
 const records=getData(),p=records.saved.notes,notes=Object.values(p);
 const watched=notes.filter(x=>x.watched).length,wished=notes.filter(x=>x.wish&&!x.watched).length,rated=notes.filter(x=>+x.rating>0).length;
 const avg=rated?(notes.reduce((acc,n)=>acc+(+n.rating||0),0)/rated).toFixed(1).replace('.',','):'—';
 return '<div class="grid four"><a class="card link" href="'+path('jogos/')+'"><div class="caps">Jogos cadastrados</div><h3>'+games.length+'</h3><p>Calendário consultado</p></a><a class="card link" href="'+path('meu-quadra/')+'"><div class="caps">Já assisti</div><h3>'+watched+'</h3><p>Partidas marcadas</p></a><a class="card link" href="'+path('meu-quadra/?tab=desejos')+'"><div class="caps">Quero assistir</div><h3>'+wished+'</h3><p>Na sua lista</p></a><a class="card link" href="'+path('meu-quadra/')+'"><div class="caps">Minha nota média</div><h3>'+avg+'</h3><p>'+rated+' jogos avaliados</p></a></div>';
}
function render(){
 const upcoming=games.filter(g=>g.date>=today),now=upcoming.filter(g=>g.date===today);
 const br=upcoming.filter(broadcastInfo).slice(0,4);
 const fav=getData().settings.fav,favGames=fav?upcoming.filter(g=>g.away===fav||g.home===fav).slice(0,4):[];
 root.innerHTML=cards()+
 '<section class="section"><div class="section-title"><h2>Jogos de hoje</h2><a class="btn" href="'+path('jogos/')+'">Ver agenda completa →</a></div>'+
 (now.length?groupGames(now.slice(0,10)):'<div class="filler"><b>Nenhum jogo listado hoje</b>Veja os próximos confrontos abaixo.</div>')+'</section>'+
 '<section class="section"><div class="section-title"><h2>Próximos com transmissão BR</h2><a class="btn ghost" href="'+path('jogos/?tv=br')+'">Todas as transmissões ↗</a></div>'+
 (br.length?groupGames(br):'<div class="filler">Não há transmissões brasileiras confirmadas no período carregado.</div>')+'</section>'+
 '<div class="grid two"><section class="card"><h3>🏀 Explorar as franquias</h3><p>Conferências Leste e Oeste, elencos, titulares e suas avaliações de atletas.</p><p style="margin-top:18px"><a class="btn accent" href="'+path('equipes/')+'">Ver 30 equipes →</a></p></section>'+
 '<section class="card"><h3>★ Meu QUADRA</h3><p>Seu ranking pessoal, jogadores favoritos, partidas assistidas e sincronização com Google.</p><p style="margin-top:18px"><a class="btn" href="'+path('meu-quadra/')+'">Meu histórico →</a></p></section></div>'+
 (fav?'<section class="section"><div class="section-title"><h2>Meu time: '+esc(name(fav))+'</h2><a class="btn ghost" href="'+path('equipe/?id='+fav)+'">Abrir elenco</a></div>'+(favGames.length?groupGames(favGames):'<p class="subtle">Próximos jogos serão exibidos quando divulgados.</p>')+'</section>':'');
}
root.innerHTML='<div class="filler">Carregando a agenda do mês…</div>';
const m=today.slice(0,7),i=MONTHS.indexOf(m),chosen=i===-1?['2026-10']:MONTHS.slice(i,i+2);
loadGames(chosen).then(rows=>{games=rows;render()}).catch(e=>{console.error(e);root.innerHTML='<div class="filler">Agenda indisponível. Tente novamente.</div>'});
root.addEventListener('click',e=>{if(handleWishes(e.target,render))e.preventDefault()});
window.addEventListener('quadra:refresh',render);
