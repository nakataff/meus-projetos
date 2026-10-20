/* QUADRA — card social 1200x630 gerado no navegador, sem servidor e sem Firebase. */
const SIZE={width:1200,height:630};
const COLOR={base:'#0d121b',panel:'#192435',line:'#374961',orange:'#ff9a4c',white:'#f4f7fc',muted:'#a7b7cd'};
async function safeImage(url){
 if(!url||!/^https?:\/\//.test(url))return null;
 return await new Promise(resolve=>{
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>resolve(img);img.onerror=()=>resolve(null);
  img.src=url;
 });
}
function text(ctx,value,x,y,size=24,color=COLOR.white,bold=false,maxWidth){
 ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='middle';
 ctx.font=(bold?'900':'600')+' '+size+'px system-ui,Segoe UI,Arial,sans-serif';
 ctx.fillText(String(value??''),x,y,maxWidth);
}
function rounded(ctx,x,y,w,h,r=13,color=COLOR.panel){
 ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
}
function logo(ctx,image,x,y,size){
 if(!image)return;
 const scale=Math.min(size/image.naturalWidth,size/image.naturalHeight);
 const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
 ctx.drawImage(image,x+(size-w)/2,y+(size-h)/2,w,h);
}
function metric(ctx,x,y,n,caption){
 rounded(ctx,x,y,234,130,14,'#202f43');
 text(ctx,n,x+24,y+43,54,COLOR.white,true,182);
 text(ctx,caption,x+25,y+102,18,COLOR.muted,true);
}
function valid(v){return v!==null&&v!==undefined&&v!=='' ?String(v):'—';}
export async function exportPlayerImage({player,teamName,teamCode,teamLogo,headshot,gameLabel,date,score,opponent,opponentLogo,filename}){
 const canvas=document.createElement('canvas');
 canvas.width=SIZE.width;canvas.height=SIZE.height;
 const ctx=canvas.getContext('2d',{alpha:false});
 ctx.fillStyle=COLOR.base;ctx.fillRect(0,0,1200,630);
 const grad=ctx.createLinearGradient(0,0,1200,630);
 grad.addColorStop(0,'#14263e');grad.addColorStop(1,'#0d121b');
 ctx.fillStyle=grad;ctx.fillRect(0,0,1200,630);
 ctx.fillStyle=COLOR.orange;ctx.fillRect(0,0,1200,9);
 text(ctx,'QUADRA  /  NBA 2026–27',55,58,23,COLOR.orange,true);
 text(ctx,'DESEMPENHO INDIVIDUAL',55,101,18,COLOR.muted,true);
 const [portrait,primary,secondary]=await Promise.all([
  safeImage(headshot),safeImage(teamLogo),safeImage(opponentLogo)
 ]);
 rounded(ctx,51,146,250,320,23,'#25384f');
 if(portrait){
  const iw=portrait.naturalWidth,ih=portrait.naturalHeight,scale=Math.max(250/iw,320/ih);
  const w=iw*scale,h=ih*scale;
  ctx.save();ctx.beginPath();ctx.roundRect(51,146,250,320,23);ctx.clip();
  ctx.drawImage(portrait,51+(250-w)/2,146+(320-h)/2,w,h);ctx.restore();
 }else{
  text(ctx,String(player?.name||'?').charAt(0),128,298,138,COLOR.muted,true);
 }
 if(primary){rounded(ctx,247,414,95,95,19,'#182638');logo(ctx,primary,259,424,70);}
 text(ctx,String(player?.name||'Jogador'),335,185,45,COLOR.white,true,810);
 text(ctx,teamName||teamCode||'',339,234,23,COLOR.muted,true,800);
 text(ctx,(date||'')+'  •  '+(gameLabel||'NBA'),339,285,18,COLOR.muted,false,790);
 const p=player||{};
 metric(ctx,339,329,valid(p.pts),'PONTOS');
 metric(ctx,586,329,valid(p.reb),'REBOTES');
 metric(ctx,833,329,valid(p.ast),'ASSISTÊNCIAS');
 rounded(ctx,51,509,1098,74,13,'#1b293a');
 text(ctx,teamCode||'',75,548,25,COLOR.white,true);
 if(secondary)logo(ctx,secondary,180,520,48);
 text(ctx,'vs '+(opponent||''),240,547,23,COLOR.white,true,520);
 text(ctx,(score||'').trim(),870,548,28,COLOR.orange,true,245);
 text(ctx,'Dados da partida • Fonte pública não oficial',55,612,13,COLOR.muted);
 text(ctx,'QUADRA',1050,612,19,COLOR.orange,true);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',.95));
 if(!blob)throw Error('Não foi possível criar o PNG');
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=(filename||'quadra-jogador').replace(/[^a-z0-9._-]/gi,'-')+'.png';
 document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2500);
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
