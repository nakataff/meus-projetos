/* Nota de desempenho QUADRA — fórmula própria, não é a nota do SofaScore.
 * Utiliza somente estatísticas verificáveis do box score. Nota automática não
 * substitui o voto pessoal de 0 a 10 e não é armazenada no Firebase.
 */
const number=v=>{
 if(v===null||v===undefined||v===''||v==='—')return null;
 const n=Number(v);return Number.isFinite(n)?n:null;
};
function madeMissed(raw){
 const match=String(raw??'').match(/^(\d+)\s*-\s*(\d+)$/);
 return match?{made:+match[1],missed:Math.max(0,+match[2]-+match[1])}:null;
}
/** Retorna null se não houver box score suficiente para dar nota. */
export function performanceRating(player){
 if(!player)return null;
 const pts=number(player.pts),reb=number(player.reb),ast=number(player.ast);
 const stl=number(player.stl),blk=number(player.blk),tov=number(player.to);
 const minutes=number(String(player.min??'').replace("'",'')),fg=madeMissed(player.fg);
 const plus=number(player.plusMinus);
 if(pts===null||reb===null||ast===null|| (minutes!==null&&minutes<=0))return null;
 // Pesos fixos: produção ofensiva, rebotes, criação, defesa e eficiência.
 let value=5.8+pts*0.105+reb*0.13+ast*0.19+
   (stl??0)*0.32+(blk??0)*0.28-(tov??0)*0.23-
   (fg?.missed??0)*0.13+
   Math.max(-0.25,Math.min(0.25,(plus??0)*0.015));
 // Produção alta com pouco tempo não é penalizada; participação muito curta
 // recebe ligeiro desconto para evitar um MVP por uma única cesta.
 if(minutes!==null&&minutes<8)value-=0.35;
 return Math.round(Math.max(1,Math.min(10,value))*10)/10;
}
export function ratingLabel(value){
 return value===null?'—':value.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
}
export function topPerformance(playersByTeam){
 const list=[];
 for(const [team,players] of Object.entries(playersByTeam||{}))
  for(const player of players||[]){
   const rating=performanceRating(player);
   if(rating!==null)list.push({team,player,rating});
  }
 list.sort((a,b)=>b.rating-a.rating||
  (Number(b.player.pts)||0)-(Number(a.player.pts)||0)||
  (Number(b.player.ast)||0)-(Number(a.player.ast)||0));
 return list[0]||null;
}
export const RATING_EXPLANATION='Nota QUADRA: avaliação automática e experimental (1 a 10) baseada em pontos, rebotes, assistências, roubos, tocos, desperdícios, arremessos errados e saldo de pontos. Não é uma nota oficial da NBA ou do SofaScore; os valores podem mudar durante o jogo.';
