// Todo lo que se pone sobre una story: texto, emojis, stickers, dibujos y un filtro de color.
// x e y son la posición del centro (0 a 1 del ancho y del alto), size es el tamaño de letra como fracción del ancho y rot los grados de giro.
export type OverlayType='text'|'emoji'|'location'|'mention'|'time'|'brand'|'countdown'|'poll'|'question'|'draw'|'filter';
export type TextFont='clasica'|'serif'|'maquina'|'manuscrita';
export type TextAlign='left'|'center'|'right';
export type TextBg='none'|'solid'|'soft';
export type FilterName='warm'|'cool'|'mono'|'vivid'|'fade';
export type StoryOverlay={
 id:string;type:OverlayType;text:string;x:number;y:number;size:number;rot:number;color:string;
 font?:TextFont;align?:TextAlign;bg?:TextBg;      // texto
 options?:string[];                                  // encuesta: dos respuestas
 endsAt?:string;                                     // cuenta regresiva (fecha ISO)
 userId?:string;                                     // mención
 width?:number;points?:number[];                     // dibujo: grosor (fracción del ancho) y puntos x1,y1,x2,y2…
 name?:FilterName;                                   // filtro
};

export const OVERLAY_LIMIT=20;      // textos, emojis y stickers
export const STROKE_LIMIT=40;       // trazos de dibujo
export const STROKE_POINT_LIMIT=150;
export const overlayColors=['#FFFFFF','#17171C','#D4FF38','#6929DD','#FF4D6D','#FFB02E','#2EC4B6','#3A86FF'] as const;
export const overlayEmojis=['😍','🔥','😂','🥹','😎','🤩','😋','🤤','😮','😅','🙈','🍕','🌮','🍔','🍣','🍺','☕','🍰','🍦','🥂','🎉','✨','💜','❤️','👏','🙌','👀','💯','📍','🌴','🌅','🏖️','🎶','🛍️','🏙️','🚗','✈️','⭐','💥','🍻'] as const;
export const textFonts:{key:TextFont;label:string}[]=[{key:'clasica',label:'Clásica'},{key:'serif',label:'Serif'},{key:'maquina',label:'Máquina'},{key:'manuscrita',label:'Manuscrita'}];
export const storyFilters:{name:FilterName;label:string}[]=[{name:'warm',label:'Cálido'},{name:'cool',label:'Frío'},{name:'mono',label:'Blanco y negro'},{name:'vivid',label:'Vívido'},{name:'fade',label:'Desvanecido'}];
export const strokeWidths=[.006,.012,.024] as const;
export const countdownPresets=[{label:'En 1 hora',ms:3600e3},{label:'Mañana',ms:24*3600e3},{label:'En 3 días',ms:3*24*3600e3},{label:'En 1 semana',ms:7*24*3600e3}] as const;
export const textSizeRange={min:.04,max:.16,default:.07} as const;
export const emojiSizeRange={min:.1,max:.45,default:.2} as const;
export const stickerSizeRange={min:.04,max:.12,default:.055} as const;

const textTypes:OverlayType[]=['text','emoji','location','mention','time','brand','countdown','poll','question'];
const stickerTypes:OverlayType[]=['location','mention','time','brand','countdown','poll','question'];
const fonts:TextFont[]=['clasica','serif','maquina','manuscrita'],aligns:TextAlign[]=['left','center','right'],backgrounds:TextBg[]=['none','solid','soft'],filterNames:FilterName[]=['warm','cool','mono','vivid','fade'];
const textMax:Partial<Record<OverlayType,number>>={text:120,emoji:8,location:60,mention:40,time:30,brand:20,countdown:40,poll:80,question:80};

const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;
const clip=(value:unknown,max:number)=>typeof value==='string'?[...value].slice(0,max).join('').trim():'';
export const isSticker=(type:OverlayType)=>stickerTypes.includes(type);
export const isInteractiveSticker=(type:OverlayType)=>type==='poll'||type==='question';
export const sizeRange=(type:OverlayType)=>type==='text'?textSizeRange:type==='emoji'?emojiSizeRange:stickerSizeRange;
export const defaultSize=(type:OverlayType)=>sizeRange(type).default;
const normalizeRotation=(value:number)=>{const mod=((value%360)+360)%360;return Math.round(mod>180?mod-360:mod);};
export const rotationOf=(value:number)=>normalizeRotation(value);

// Reduce un trazo: quita puntos casi iguales y limita la cantidad para que la story pese poco.
export function simplifyStroke(points:number[]):number[]{
 const out:number[]=[];
 for(let i=0;i+1<points.length;i+=2){
  const x=Math.round(clamp(points[i],0,1)*1000)/1000,y=Math.round(clamp(points[i+1],0,1)*1000)/1000;
  const n=out.length;
  if(n>=2&&Math.hypot(out[n-2]-x,out[n-1]-y)<.004)continue;
  out.push(x,y);
 }
 const count=out.length/2;
 if(count<=STROKE_POINT_LIMIT)return out;
 const step=(count-1)/(STROKE_POINT_LIMIT-1),thin:number[]=[];
 for(let i=0;i<STROKE_POINT_LIMIT;i++){const index=Math.round(i*step);thin.push(out[index*2],out[index*2+1]);}
 return thin;
}

// Lo que llega de la base de datos (o de otra persona) nunca se dibuja sin limpiar: tipos, límites, colores y fechas válidas.
export function sanitizeOverlays(value:unknown):StoryOverlay[]{
 if(!Array.isArray(value))return [];
 const result:StoryOverlay[]=[];
 let items=0,strokes=0,filter=false;
 for(const raw of value.slice(0,OVERLAY_LIMIT+STROKE_LIMIT+1)){
  if(!raw||typeof raw!=='object')continue;
  const row=raw as Record<string,unknown>;
  const type=typeof row.type==='string'?(row.type as OverlayType):null;
  if(!type||!(textTypes.includes(type)||type==='draw'||type==='filter'))continue;
  const id=typeof row.id==='string'&&row.id.length>0&&row.id.length<=40?row.id:String(result.length);
  const color=typeof row.color==='string'&&/^#[0-9A-Fa-f]{6}$/.test(row.color)?row.color.toUpperCase():'#FFFFFF';
  if(type==='filter'){
   if(filter||!filterNames.includes(row.name as FilterName))continue;
   filter=true;result.push({id,type,text:'',x:.5,y:.5,size:0,rot:0,color,name:row.name as FilterName});continue;
  }
  if(type==='draw'){
   if(strokes>=STROKE_LIMIT||!Array.isArray(row.points))continue;
   const numbers=row.points.slice(0,STROKE_POINT_LIMIT*2).map(finite);
   if(numbers.length<4||numbers.length%2||numbers.some(n=>n===null))continue;
   const points=simplifyStroke(numbers as number[]);
   if(points.length<4)continue;
   const width=finite(row.width);
   strokes++;result.push({id,type,text:'',x:.5,y:.5,size:0,rot:0,color,width:clamp(width??.012,.003,.06),points});continue;
  }
  if(items>=OVERLAY_LIMIT)continue;
  const text=clip(row.text,textMax[type]??60);
  const x=finite(row.x),y=finite(row.y),size=finite(row.size);
  if(x===null||y===null||size===null)continue;
  if(!text&&type!=='countdown')continue;
  const range=sizeRange(type);
  const item:StoryOverlay={id,type,text,x:clamp(x,0,1),y:clamp(y,0,1),size:clamp(size,range.min,range.max),rot:normalizeRotation(finite(row.rot)??0),color};
  if(type==='text'){
   item.font=fonts.includes(row.font as TextFont)?(row.font as TextFont):'clasica';
   item.align=aligns.includes(row.align as TextAlign)?(row.align as TextAlign):'center';
   item.bg=backgrounds.includes(row.bg as TextBg)?(row.bg as TextBg):'none';
  }
  if(type==='poll'){
   const options=Array.isArray(row.options)?row.options.slice(0,2).map(option=>clip(option,30)):[];
   if(options.length!==2||options.some(option=>!option))continue;
   item.options=options;
  }
  if(type==='countdown'){
   const when=typeof row.endsAt==='string'?Date.parse(row.endsAt):NaN;
   if(!Number.isFinite(when))continue;
   item.endsAt=new Date(when).toISOString();
  }
  if(type==='mention'&&typeof row.userId==='string'&&/^[0-9a-f-]{36}$/i.test(row.userId))item.userId=row.userId.toLowerCase();
  items++;result.push(item);
 }
 return result;
}

// Texto del contador: días, horas y minutos que faltan.
export function countdownText(endsAt:string|undefined,now:number):string{
 const end=endsAt?Date.parse(endsAt):NaN;
 if(!Number.isFinite(end))return '';
 const left=end-now;
 if(left<=0)return 'Ya llegó';
 const minutes=Math.floor(left/60000),days=Math.floor(minutes/1440),hours=Math.floor((minutes%1440)/60);
 return days>0?`${days} d ${hours} h`:hours>0?`${hours} h ${minutes%60} min`:`${Math.max(1,minutes)} min`;
}
