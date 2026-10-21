/* DE LA QUADRA — imagens 1200×630, 1080×1080 e 1080×1920.
 * Geradas localmente: prévia, cópia, compartilhamento nativo ou PNG opcional.
 */
import {modal,closeModal,toast} from './app.js?v=13';
const COLOR={base:'#0c1421',panel:'#1f3046',line:'#3c526c',orange:'#ff9d4d',white:'#f5f7fd',muted:'#afbed3'};
export const PLAYER_CARD_FORMATS=Object.freeze({
 landscape:{width:1200,height:630,label:'Horizontal • 1200 × 630'},
 square:{width:1080,height:1080,label:'Quadrado 1:1 • 1080 × 1080'},
 story:{width:1080,height:1920,label:'Story 9:16 • 1080 × 1920'}
});
async function safeImage(url){
 if(!url||!/^https?:\/\//.test(url))return null;
 return new Promise(resolve=>{
  const image=new Image();image.crossOrigin='anonymous';
  image.onload=()=>resolve(image);image.onerror=()=>resolve(null);
  image.src=url;
 });
}
function txt(ctx,value,x,y,size=24,color=COLOR.white,weight=800,maxWidth){
 ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=color;
 ctx.font=weight+' '+size+'px system-ui,-apple-system,Segoe UI,Arial,sans-serif';
 ctx.fillText(String(value??''),x,y,maxWidth);
}
function rect(ctx,x,y,w,h,r=14,color=COLOR.panel){
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
function imageFit(ctx,image,x,y,w,h){
 if(!image)return;
 const iw=image.naturalWidth,ih=image.naturalHeight;
 const scale=Math.min(w/iw,h/ih),nw=iw*scale,nh=ih*scale;
 ctx.drawImage(image,x+(w-nw)/2,y+(h-nh)/2,nw,nh);
}
function portrait(ctx,image,x,y,w,h){
 rect(ctx,x,y,w,h,23,'#283b52');
 if(!image)return;
 const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight);
 const iw=image.naturalWidth*scale,ih=image.naturalHeight*scale;
 ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,23);ctx.clip();
 ctx.drawImage(image,x+(w-iw)/2,y+(h-ih)/2,iw,ih);ctx.restore();
}
function valid(v){return v!==null&&v!==undefined&&v!==''?String(v):'—';}
function avg(value,gp){return gp?Number(value||0)/gp:null;}
function number(v){return v===null||v===undefined?'—':Number(v).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});}
function summarize(options){
 const p=options.player||{};
 if(options.kind!=='season')return {gameCount:1,values:[valid(p.pts),valid(p.reb),valid(p.ast)],rating:options.rating??null,
  headings:['PONTOS','REBOTES','ASSISTÊNCIAS']};
 const season=options.season||{},gp=Number(season.gp)||0;
 return {gameCount:gp,values:[number(avg(season.pts,gp)),number(avg(season.reb,gp)),number(avg(season.ast,gp))],
  rating:season.ratingGames?number(avg(season.ratingSum,season.ratingGames)):null,
  headings:['PTS / JOGO','REB / JOGO','AST / JOGO']};
}
function metric(ctx,x,y,w,h,value,label,big=52){
 rect(ctx,x,y,w,h,15,'#24354b');
 txt(ctx,value,x+24,y+h*.39,big,COLOR.white,950,w-46);
 txt(ctx,label,x+24,y+h*.79,18,COLOR.muted,900,w-46);
}
function title(ctx,value,x,y,size,maxWidth){
 const name=String(value||'Jogador');
 txt(ctx,name,x,y,size,COLOR.white,950,maxWidth);
}
function brand(ctx,image,x,y,maxW,maxH,format){
 if(image)imageFit(ctx,image,x,y,maxW,maxH);
 else txt(ctx,'DE LA QUADRA',x,y+maxH*.52,31,COLOR.orange,950,maxW);
 const subtitle=format==='story'?'MÉDIAS DA TEMPORADA':'';
 return subtitle;
}
function ratingBlock(ctx,value,x,y,w=180,h=102){
 if(value===null||value===undefined||value==='')return;
 rect(ctx,x,y,w,h,15,'#2d3a4b');
 txt(ctx,'NOTA DLQ',x+15,y+27,16,COLOR.muted,900,w-30);
 txt(ctx,valid(value),x+15,y+h-30,43,COLOR.orange,950,w-30);
}
function matchLabel(o){
 if(o.kind==='season')return 'MÉDIAS POR PARTIDA • '+(o.phase==='preseason'?'PRÉ-TEMPORADA':'TEMPORADA REGULAR');
 return (o.date||'')+(o.gameLabel?' • '+o.gameLabel:'');
}
export async function buildPlayerCard(options={}){
 const format=PLAYER_CARD_FORMATS[options.format]||PLAYER_CARD_FORMATS.landscape;
 const {width:W,height:H}=format,mode=options.format||'landscape',stat=summarize(options);
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d',{alpha:false});
 const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#192b43');bg.addColorStop(1,'#0b111b');
 ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 ctx.fillStyle=COLOR.orange;ctx.fillRect(0,0,W,9);
 const [playerPic,teamPic,opponentPic,brandPic]=await Promise.all([
  safeImage(options.headshot),safeImage(options.teamLogo),safeImage(options.opponentLogo),
  safeImage(new URL('../assets/de%20la%20quadra.webp',import.meta.url).href)
 ]);
 const playerName=options.player?.name||'Jogador',teamName=options.teamName||options.teamCode||'NBA';
 const season=options.kind==='season';
 if(mode==='landscape'){
  brand(ctx,brandPic,54,24,220,73,mode);
  txt(ctx,season?'MÉDIAS DA TEMPORADA':'DESEMPENHO INDIVIDUAL',55,119,20,COLOR.muted,900,410);
  txt(ctx,'NBA 2026–27',337,63,18,COLOR.orange,900);
  ratingBlock(ctx,stat.rating,968,27,181,103);
  portrait(ctx,playerPic,52,157,248,307);
  if(teamPic){rect(ctx,244,403,94,90,18,'#182638');imageFit(ctx,teamPic,259,417,64,60);}
  title(ctx,playerName,335,181,44,798);
  txt(ctx,teamName,338,233,24,COLOR.muted,900,785);
  txt(ctx,matchLabel(options),338,282,17,COLOR.muted,600,799);
  for(let i=0;i<3;i++)metric(ctx,337+i*250,329,237,135,stat.values[i],stat.headings[i],53);
  rect(ctx,52,501,1097,82,13,'#1e2c3e');
  if(season){
   txt(ctx,'TEMPORADA 2026/27',76,528,18,COLOR.white,900);
   txt(ctx,stat.gameCount+' '+(stat.gameCount===1?'JOGO':'JOGOS')+' DISPUTADOS',76,559,20,COLOR.orange,900);
  }else{
   txt(ctx,options.teamCode||'',75,541,24,COLOR.white,950,99);
   imageFit(ctx,opponentPic,172,515,52,55);
   txt(ctx,'vs '+(options.opponent||''),234,541,22,COLOR.white,850,510);
   txt(ctx,String(options.score||''),905,541,26,COLOR.orange,950,208);
  }
  txt(ctx,season?'Médias de partidas finalizadas':'Dados da partida',55,613,12,COLOR.muted,700,620);
  txt(ctx,'DE LA QUADRA',972,613,18,COLOR.orange,950);
 }else if(mode==='square'){
  brand(ctx,brandPic,52,30,275,97,mode);
  txt(ctx,season?'MÉDIAS DA TEMPORADA':'DESEMPENHO INDIVIDUAL',56,164,23,COLOR.muted,900);
  txt(ctx,'NBA 2026–27',838,87,20,COLOR.orange,900,204);
  portrait(ctx,playerPic,53,217,350,460);
  if(teamPic){rect(ctx,333,588,88,82,16,'#1b2a3c');imageFit(ctx,teamPic,345,598,64,61);}
  title(ctx,playerName,440,272,50,591);
  txt(ctx,teamName,441,342,25,COLOR.muted,850,579);
  txt(ctx,matchLabel(options),441,395,18,COLOR.muted,600,582);
  ratingBlock(ctx,stat.rating,441,464,193,116);
  for(let i=0;i<3;i++)metric(ctx,53+i*328,733,313,153,stat.values[i],stat.headings[i],64);
  rect(ctx,53,916,974,80,15,'#1e2d40');
  if(season){
   txt(ctx,'TEMPORADA 2026/27 • '+stat.gameCount+' JOGOS',78,956,24,COLOR.orange,900,910);
  }else{
   imageFit(ctx,opponentPic,79,927,55,55);
   txt(ctx,options.gameLabel||('vs '+(options.opponent||'NBA')),147,955,22,COLOR.white,900,710);
  }
  txt(ctx,'DE LA QUADRA',54,1037,17,COLOR.orange,950,820);
 }else{
  // 9:16 deixa os ~20% inferiores livres, ideal para stories.
  brand(ctx,brandPic,76,62,360,143,mode);
  txt(ctx,'NBA 2026–27',736,138,23,COLOR.orange,950,290);
  txt(ctx,season?'MÉDIAS DA TEMPORADA':'DESEMPENHO INDIVIDUAL',80,264,29,COLOR.muted,950);
  txt(ctx,matchLabel(options),80,322,20,COLOR.muted,700,925);
  portrait(ctx,playerPic,78,376,924,560);
  if(teamPic){rect(ctx,852,800,135,122,22,'#16263c');imageFit(ctx,teamPic,867,811,105,98);}
  title(ctx,playerName,79,1012,72,928);
  txt(ctx,teamName,82,1095,35,COLOR.muted,900,912);
  ratingBlock(ctx,stat.rating,797,1133,205,125);
  for(let i=0;i<3;i++)metric(ctx,79+i*309,1272,297,165,stat.values[i],stat.headings[i],65);
  txt(ctx,season?stat.gameCount+' JOGOS DISPUTADOS • TEMPORADA 2026/27':
    (options.opponent?'vs '+options.opponent:'NBA 2026/27'),82,1481,24,COLOR.muted,850,913);
  // Rodapé informativo antes da área de ações do Story.
  txt(ctx,'DE LA QUADRA',82,1519,20,COLOR.orange,950,450);
 }
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob)throw Error('Não foi possível gerar a imagem');
 return blob;
}
function filename(options){
 const who=String(options.player?.name||'jogador').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/gi,'-');
 return 'DLQ-'+who+'-'+(options.kind==='season'?'medias':'partida')+'-'+(options.format||'landscape')+'.png';
}
async function performAction(blob,options,mode){
 const safeName=filename(options),file=new File([blob],safeName,{type:'image/png'});
 if(mode==='copy'){
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')
   throw Error('Este navegador não oferece cópia de imagem. Experimente Compartilhar.');
  await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
  return 'copied';
 }
 if(mode==='share'){
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   try{await navigator.share({files:[file],title:'DE LA QUADRA'});return 'shared';}
   catch(e){if(e?.name==='AbortError')return 'cancelled';throw e;}
  }
  return performAction(blob,options,'copy');
 }
 if(mode==='download'){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=safeName;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);return 'downloaded';
 }
 throw Error('Ação não reconhecida');
}
export async function exportPlayerImage(options={}){
 const blob=await buildPlayerCard(options);
 return performAction(blob,options,options.mode||'download');
}
export function openPlayerCardComposer(options={}){
 let selected='square',activeBlob=null,activeUrl=null,iteration=0;
 modal('<div class="dlq-card-maker"><h2>Gerar card do jogador</h2>'+
  '<p class="small subtle">Escolha o formato, confira a imagem e copie ou compartilhe sem precisar salvar o PNG.</p>'+
  '<div class="dlq-card-formats"><label for="dlqCardFormat">Formato</label>'+
  '<select class="control" id="dlqCardFormat">'+Object.entries(PLAYER_CARD_FORMATS).map(([key,f])=>
   '<option value="'+key+'"'+(selected===key?' selected':'')+'>'+f.label+'</option>').join('')+'</select></div>'+
  '<div class="dlq-card-preview" id="dlqCardPreview" role="status">Preparando imagem…</div>'+
  '<div class="dlq-card-actions">'+
  '<button class="btn accent" type="button" id="dlqCopyImage" disabled>Copiar imagem</button>'+
  '<button class="btn" type="button" id="dlqShareImage" disabled>Compartilhar</button>'+
  '<button class="btn ghost" type="button" id="dlqSaveImage" disabled>Salvar PNG</button></div></div>');
 const root=document.querySelector('#modalRoot .dlq-card-maker');
 if(!root)return;
 const preview=root.querySelector('#dlqCardPreview');
 const buttons=['dlqCopyImage','dlqShareImage','dlqSaveImage'].map(id=>root.querySelector('#'+id));
 const clear=()=>{if(activeUrl){URL.revokeObjectURL(activeUrl);activeUrl=null;}};
 // Limpa a prévia mesmo se a pessoa fechar tocando fora do modal ou Esc.
 const observer=new MutationObserver(()=>{if(!root.isConnected){iteration++;clear();observer.disconnect();}});
 observer.observe(document.querySelector('#modalRoot'),{childList:true,subtree:true});
 async function refresh(){
  const token=++iteration,opts={...options,format:selected};
  buttons.forEach(b=>b.disabled=true);
  preview.textContent='Preparando imagem…';
  try{
   const blob=await buildPlayerCard(opts);
   if(token!==iteration||!root.isConnected)return;
   clear();activeBlob=blob;activeUrl=URL.createObjectURL(blob);
   const img=document.createElement('img');img.src=activeUrl;img.alt='Prévia do card DE LA QUADRA';
   img.className='dlq-card-preview-image';preview.replaceChildren(img);
   buttons.forEach(b=>b.disabled=false);
  }catch(e){if(token===iteration){preview.textContent='Não foi possível gerar a imagem: '+e.message;}}
 }
 root.querySelector('#dlqCardFormat').onchange=e=>{selected=e.target.value;refresh();};
 buttons.forEach((button,i)=>{
  button.onclick=async()=>{
   if(!activeBlob)return;
   button.disabled=true;
   try{
    const result=await performAction(activeBlob,{...options,format:selected},['copy','share','download'][i]);
    if(result==='copied')toast('Imagem copiada! Cole no Instagram, WhatsApp ou onde preferir.');
    if(result==='shared')toast('Imagem enviada para compartilhamento.');
    if(result==='downloaded')toast('PNG salvo!');
   }catch(e){toast('Não foi possível completar: '+e.message);}
   finally{if(root.isConnected)button.disabled=false;}
  };
 });
 refresh();
}

export async function sharePlayerLink(url,title){
 if(typeof navigator.share==='function'){
  try{await navigator.share({url,title});return 'shared';}
  catch(e){if(e.name==='AbortError')return 'cancelled';}
 }
 if(navigator.clipboard?.writeText){
  await navigator.clipboard.writeText(url);
  return 'copied';
 }
 // Fallback para navegadores sem Clipboard API.
 const temp=document.createElement('textarea');temp.value=url;
 temp.style.position='fixed';temp.style.opacity='0';document.body.append(temp);
 temp.select();const success=document.execCommand('copy');temp.remove();
 if(!success)throw Error('Não foi possível copiar o link');
 return 'copied';
}
