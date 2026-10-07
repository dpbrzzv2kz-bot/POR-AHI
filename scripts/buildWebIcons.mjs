import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {Buffer} from 'node:buffer';

// Code-native provisional mark: the arrow already used beside the app's name.
const target=fileURLToPath(new URL('../public/icons/',import.meta.url));
await mkdir(target,{recursive:true});
await writeFile(`${target}/icon.svg`,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#243d31" d="M0 0h512v512H0z"/><path d="M176 336 336 176M176 176h160v160" fill="none" stroke="#f9f7ef" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/></svg>\n');
function crc32(bytes){let value=0xffffffff;for(const byte of bytes){value^=byte;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);}return(value^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,crc]);}
function distance(x,y,a,b,c,d){const t=Math.max(0,Math.min(1,((x-a)*(c-a)+(y-b)*(d-b))/((c-a)**2+(d-b)**2)));return Math.hypot(x-a-t*(c-a),y-b-t*(d-b));}
function png(size){
  const pixels=Buffer.alloc((size*3+1)*size),bg=[36,61,49],fg=[249,247,239];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let ink=0;
    for(const dy of [.25,.75])for(const dx of [.25,.75]){
      const px=(x+dx)*512/size,py=(y+dy)*512/size;
      if(Math.min(distance(px,py,176,336,336,176),distance(px,py,176,176,336,176),distance(px,py,336,176,336,336))<=22)ink+=.25;
    }
    for(let c=0;c<3;c++)pixels[y*(size*3+1)+1+x*3+c]=Math.round(bg[c]+ink*(fg[c]-bg[c]));
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
for(const [name,size] of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]])await writeFile(`${target}/${name}`,png(size));
console.log('Provisional SVG and 180/192/512 px PNG icons generated.');
