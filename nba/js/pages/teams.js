import {$,setupShared,EAST,WEST,name,logo,teamLink,esc} from '../app.js?v=5';
setupShared('teams','Franquias da NBA','As 30 equipes divididas por conferência e divisão. Clique num escudo para conferir elenco, quintetos e jogos.');
const root=$('#pageContent');
let conference='east';
function draw(){
 const groups=conference==='east'?EAST:WEST;
 root.innerHTML='<div class="switches"><button class="pill '+(conference==='east'?'active':'')+'" data-conference="east">CONFERÊNCIA LESTE</button><button class="pill '+(conference==='west'?'active':'')+'" data-conference="west">CONFERÊNCIA OESTE</button></div>'+
 Object.entries(groups).map(([division,codes])=>'<section class="section"><div class="section-title"><h2>Divisão '+esc(division)+'</h2><span class="subtle small">5 equipes</span></div><div class="tiles">'+codes.map(code=>'<a class="tile" href="'+esc(teamLink(code))+'"><img loading="lazy" decoding="async" src="'+esc(logo(code))+'" alt=""><span>'+esc(name(code))+'</span></a>').join('')+'</div></section>').join('');
}
root.addEventListener('click',e=>{const b=e.target.closest('[data-conference]');if(b){conference=b.dataset.conference;draw()}});
draw();
