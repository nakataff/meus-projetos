/* Format-specific comparison layouts. All informative content stays inside safe margins. */
import {COMPARISON_FIELDS,normalizeComparisonFields,comparisonValue} from './comparison-fields.js?v=20261024-comparison-options-v1';
export const COMPARISON_CARD_FORMATS=Object.freeze({
 landscape:{width:1200,height:630,label:'Horizontal • 1200 × 630'},
 square:{width:1080,height:1080,label:'Quadrado 1:1 • 1080 × 1080'},
 portrait:{width:1080,height:1350,label:'Feed 4:5 • 1080 × 1350'},
 story:{width:1080,height:1920,label:'Story 9:16 • 1080 × 1920'}
});
export function comparisonLayout(format='square',selectedFields,presentation='list'){
 const fields=normalizeComparisonFields(selectedFields).map(key=>COMPARISON_FIELDS.find(f=>f.key===key));
 const f=COMPARISON_CARD_FORMATS[format]||COMPARISON_CARD_FORMATS.square;
 const W=f.width,H=f.height,p=format==='landscape'?50:format==='story'?72:60;
 const top=format==='story'?210:format==='landscape'?28:56;
 const profileTop=format==='landscape'?124:format==='square'?208:format==='portrait'?230:370;
 const profileHeight=format==='landscape'?124:format==='square'?246:format==='portrait'?300:300;
 const tableTop=format==='landscape'?264:format==='square'?470:format==='portrait'?542:710;
 const rowH=format==='landscape'?35:format==='square'?55:format==='portrait'?76:80;
 const footerY=format==='landscape'?566:format==='square'?966:format==='portrait'?1218:1410;
 const gap=format==='landscape'?120:56,col=(W-2*p-gap)/2;
 const blocks=presentation==='blocks',columns=blocks&&fields.length>1?2:1,totalRows=Math.ceil(fields.length/columns),tableHeight=rowH*8,cellH=tableHeight/totalRows,cellW=(W-2*p-(columns-1)*14)/columns;
 return {W,H,p,top,compact:format==='landscape',safe:{x:p,y:format==='story'?192:24,w:W-2*p,h:(format==='story'?1536:H-24)-(format==='story'?192:24)},
  header:{x:p,y:top,w:W-2*p,h:format==='landscape'?80:132},
  profiles:[{x:p,y:profileTop,w:col,h:profileHeight},{x:W-p-col,y:profileTop,w:col,h:profileHeight}],
  rows:fields.map((field,i)=>{const full=blocks&&columns===2&&fields.length%2===1&&i===fields.length-1;return {...field,label:field.label.toLocaleUpperCase('pt-BR'),x:full?p:p+(i%columns)*(cellW+14),y:tableTop+Math.floor(i/columns)*cellH,w:full?W-2*p:cellW,h:cellH-(blocks?8:3)};}),presentation:blocks?'blocks':'list',
  footer:{x:p,y:footerY,w:W-2*p,h:format==='landscape'?36:64}};
}
const C={bg:'#0c1421',panel:'#1b2c40',ink:'#f5f7fd',muted:'#afbed3',accent:'#ff9d4d',best:'#a5f0c8'};
async function image(url){if(!url||!/^https?:\/\//.test(url))return null;return new Promise(resolve=>{const img=new Image();let done=false;const end=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};const timer=setTimeout(()=>end(null),6000);img.crossOrigin='anonymous';img.onload=()=>end(img);img.onerror=()=>end(null);img.src=url;});}
function box(ctx,r,color=C.panel,radius=14){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(r.x,r.y,r.w,r.h,radius);ctx.fill();}
function fit(ctx,img,r){if(!img)return;const scale=Math.min(r.w/img.naturalWidth,r.h/img.naturalHeight),w=img.naturalWidth*scale,h=img.naturalHeight*scale;ctx.drawImage(img,r.x+(r.w-w)/2,r.y+(r.h-h)/2,w,h);}
function text(ctx,value,r,size=24,color=C.ink,weight=800,lines=1,align='center'){
 size=Math.max(10,size);const content=String(value??'');let rows=[];
 for(let font=size;font>=10;font--){ctx.font=weight+' '+font+'px system-ui,-apple-system,Segoe UI,Arial,sans-serif';rows=[''];for(const word of content.split(/\s+/)){const i=rows.length-1,next=rows[i]?rows[i]+' '+word:word;if(ctx.measureText(next).width>r.w&&rows[i])rows.push(word);else rows[i]=next;}if(rows.length<=lines&&font*1.2*rows.length<=r.h){size=font;break;}}
 if(rows.length>lines)rows=[content]; // Native maxWidth compresses exceptionally long names without clipping.
 ctx.font=weight+' '+size+'px system-ui,-apple-system,Segoe UI,Arial,sans-serif';ctx.fillStyle=color;ctx.textBaseline='middle';ctx.textAlign=align;
 const lineH=Math.min(size*1.18,r.h/rows.length),x=align==='left'?r.x:align==='right'?r.x+r.w:r.x+r.w/2;
 rows.forEach((line,i)=>ctx.fillText(line,x,r.y+r.h/2+(i-(rows.length-1)/2)*lineH,r.w));
}
function value(v,key,mode){if(v===null||v===undefined||!Number.isFinite(Number(v)))return '—';const dec=mode==='average'||key==='rating';return Number(v).toLocaleString('pt-BR',{minimumFractionDigits:dec?1:0,maximumFractionDigits:dec?1:0});}
export async function buildComparisonCard(options={}){
 if(!Array.isArray(options.players)||options.players.length!==2||options.players[0].key===options.players[1].key)throw Error('Escolha dois jogadores diferentes.');
 const format=COMPARISON_CARD_FORMATS[options.format]?options.format:'square',l=comparisonLayout(format,options.selectedFields,options.presentation),{W,H,p}=l;
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas indisponível.');
 const gradient=ctx.createLinearGradient(0,0,W,H);gradient.addColorStop(0,'#192b43');gradient.addColorStop(1,C.bg);ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);ctx.fillStyle=C.accent;ctx.fillRect(0,0,W,8);
 const pics=await Promise.all(options.players.flatMap(v=>[image(v.headshot),image(v.teamLogo)]));
 const brand=await image(new URL('../assets/de%20la%20quadra.webp',import.meta.url).href);
 const logoRect={x:p,y:l.top,w:l.compact?220:260,h:l.compact?46:74};
 if(brand)fit(ctx,brand,logoRect);else text(ctx,'DE LA QUADRA',logoRect,28,C.accent,950,1,'left');
 text(ctx,'FRENTE A FRENTE',{x:l.compact?350:380,y:l.top,w:W-p-(l.compact?350:380),h:l.compact?46:74},l.compact?28:38,C.ink,950);
 const context=options.context||{};
 text(ctx,[context.title,context.subtitle].filter(Boolean).join(' · '),{x:p,y:l.top+(l.compact?50:82),w:W-2*p,h:l.compact?30:48},l.compact?16:22,C.muted,700,2,'left');
 l.profiles.forEach((r,i)=>{
  const v=options.players[i];box(ctx,r);
  const photo=l.compact?{x:r.x+14,y:r.y+12,w:100,h:96}:{x:r.x+(r.w-180)/2,y:r.y+12,w:180,h:format==='square'?128:180};
  fit(ctx,pics[i*2],photo);
  const nr=l.compact?{x:r.x+126,y:r.y+12,w:r.w-140,h:62}:{x:r.x+14,y:photo.y+photo.h+8,w:r.w-28,h:format==='square'?62:64};
  text(ctx,v.name,nr,l.compact?26:32,C.ink,900,2,l.compact?'left':'center');
  const teamY=l.compact?r.y+83:nr.y+nr.h+3;
  const logo={x:l.compact?r.x+126:r.x+18,y:teamY,w:28,h:28};fit(ctx,pics[i*2+1],logo);
  text(ctx,(v.teamName||v.teamCode)+(v.gp!==undefined?' · '+v.gp+' J':'') ,{x:logo.x+36,y:teamY,w:r.x+r.w-logo.x-46,h:30},l.compact?16:18,C.muted,750,1,'left');
 });
 text(ctx,'VS',{x:W/2-25,y:l.profiles[0].y+30,w:50,h:40},24,C.accent,950);
 l.rows.forEach((r,index)=>{
  if(l.presentation==='blocks'||index%2===0)box(ctx,r,'#203248',8);
  const a=options.players[0].stats[r.key],b=options.players[1].stats[r.key],valid=a!=null&&b!=null&&Number.isFinite(Number(a))&&Number.isFinite(Number(b));
  const winner=valid&&Number(a)!==Number(b)?(r.lower?Number(a)<Number(b):Number(a)>Number(b))?0:1:-1;
  if(l.presentation==='blocks'){
   const labelH=Math.min(r.h*.35,32),valueH=r.h-labelH;
   text(ctx,r.label,{x:r.x+12,y:r.y+2,w:r.w-24,h:labelH},Math.min(20,labelH*.7),C.muted,850);
   for(const [i,v] of [[0,a],[1,b]])text(ctx,comparisonValue(v,r,context.mode),{x:r.x+10+i*r.w/2,y:r.y+labelH,w:r.w/2-20,h:valueH},Math.min(46,valueH*.7),winner===i?C.best:C.ink,950);
   return;
  }
  const centerW=l.compact?200:220,valueW=(r.w-centerW)/2;
  text(ctx,comparisonValue(a,r,context.mode),{x:r.x+8,y:r.y,w:valueW-16,h:r.h},Math.min(l.compact?36:44,r.h*.63),winner===0?C.best:C.ink,950);
  text(ctx,r.label,{x:W/2-centerW/2,y:r.y,w:centerW,h:r.h},Math.min(l.compact?16:20,r.h*.48),C.muted,850,2);
  text(ctx,comparisonValue(b,r,context.mode),{x:W/2+centerW/2+8,y:r.y,w:valueW-16,h:r.h},Math.min(l.compact?36:44,r.h*.63),winner===1?C.best:C.ink,950);
 });
 text(ctx,context.mode==='average'?'MÉDIAS POR JOGO · NOTA DLQ NÃO OFICIAL':context.mode==='total'?'TOTAIS DA SELEÇÃO · NOTA DLQ EM MÉDIA':'DADOS DA PARTIDA · NOTA DLQ NÃO OFICIAL',{...l.footer,h:l.footer.h/2},l.compact?12:16,C.muted,750,1,'left');
 text(ctx,'DE LA QUADRA · nakataff.github.io/meus-projetos/nba',{...l.footer,y:l.footer.y+l.footer.h/2,h:l.footer.h/2},l.compact?12:16,C.accent,850,1,'left');
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Não foi possível gerar o card.');return blob;
}
