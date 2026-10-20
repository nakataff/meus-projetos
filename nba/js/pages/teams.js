import {$,setupShared,EAST,WEST,name,logo,teamLink,esc,jsonFile,path} from '../app.js?v=9';
setupShared('teams','Franquias da NBA','As 30 equipes por conferência e divisão, com suas campanhas e elencos.');
const root=$('#pageContent');
let conference='east',standings=null;
function campaign(code){
 const item=standings?.teams?.find(row=>row.team===code);
 return item?'<small class="team-tile-campaign">'+item.w+'V • '+item.l+'D</small>':'';
}
function draw(){
 const groups=conference==='east'?EAST:WEST;
 root.innerHTML='<div class="switches"><button class="pill '+(conference==='east'?'active':'')+
 '" data-conference="east">CONFERÊNCIA LESTE</button><button class="pill '+(conference==='west'?'active':'')+
 '" data-conference="west">CONFERÊNCIA OESTE</button></div>'+
 Object.entries(groups).map(([division,codes])=>
 '<section class="section"><div class="section-title"><h2>Divisão '+esc(division)+'</h2>'+
 '<span class="subtle small">5 equipes</span></div><div class="tiles">'+
 codes.map(code=>'<a class="tile" href="'+esc(teamLink(code))+'"><img loading="lazy" decoding="async" src="'+
 esc(logo(code))+'" alt=""><span>'+esc(name(code))+campaign(code)+'</span></a>').join('')+
 '</div></section>').join('')+
 '<p class="center" style="margin:23px 0"><a class="btn" href="'+path('classificacao/')+
 '">Ver classificação completa →</a></p>';
}
root.addEventListener('click',e=>{
 const button=e.target.closest('[data-conference]');
 if(button){conference=button.dataset.conference;draw();}
});
draw();
jsonFile('data/standings/2026-27.json').then(data=>{standings=data;draw();})
 .catch(err=>console.info('Campanhas indisponíveis',err));
