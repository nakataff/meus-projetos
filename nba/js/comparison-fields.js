/* One catalog for the comparison, its preview and exported images. */
export const COMPARISON_FIELDS=Object.freeze([
 {key:'pts',label:'Pontos'},{key:'reb',label:'Rebotes'},{key:'ast',label:'Assistências'},
 {key:'stl',label:'Roubos'},{key:'blk',label:'Tocos'},{key:'threeM',label:'Bolas de 3'},
 {key:'to',label:'Turnovers',lower:true},{key:'rating',label:'Nota DLQ'},
 {key:'min',label:'Minutos'},{key:'fgpct',label:'Aproveitamento FG',percent:true},
 {key:'threepct',label:'Aproveitamento 3PT',percent:true}
]);
export const DEFAULT_CARD_FIELDS=Object.freeze(['pts','reb','ast','stl','blk','threeM','to','rating']);
export function normalizeComparisonFields(keys){
 const valid=new Set(COMPARISON_FIELDS.map(f=>f.key));
 const selected=Array.isArray(keys)?[...new Set(keys)].filter(k=>valid.has(k)):[];
 return selected.length?selected:[...DEFAULT_CARD_FIELDS];
}
export function comparisonValue(value,field,mode='game'){
 if(value===null||value===undefined||value===''||!Number.isFinite(Number(value)))return '—';
 const decimals=mode==='average'||field.key==='rating'||field.percent||field.key==='min';
 return Number(value).toLocaleString('pt-BR',{minimumFractionDigits:decimals?1:0,maximumFractionDigits:decimals?1:0})+(field.percent?'%':'');
}
