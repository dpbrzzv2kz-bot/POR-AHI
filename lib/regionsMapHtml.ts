// Mapa del mundo por estados/provincias (Natural Earth, dominio público, simplificado en assets/regions.json).
// Se dibuja con un canvas, sin red ni librerías. Los estados donde hay al menos un punto se pintan de lima.
export type VisitedPoint = {lat: number; lng: number};

export function regionsMapHtml(regionsJson: string, points: VisitedPoint[], expanded = false) {
  const data = regionsJson.replace(/</g, '\\u003c');
  const pts = JSON.stringify(points.map(p => [p.lat, p.lng])).replace(/</g, '\\u003c');
  // Versión ampliada: el mapa mide 2400 px de ancho, se desplaza y se acerca con los dedos.
  const viewport = expanded ? 'width=device-width,initial-scale=1,minimum-scale=0.15,maximum-scale=5,user-scalable=yes' : 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no';
  const pageStyle = expanded ? 'overflow:auto' : 'height:100%;overflow:hidden';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="${viewport}">
<style>html,body{margin:0;background:#0B0B0F;${pageStyle}}canvas{display:block}</style></head><body>
<canvas id="c" role="img" aria-label="Mapa de estados reseñados"></canvas>
<script>
var R=${data};
var PTS=${pts};
var EXP=${expanded ? 'true' : 'false'};
R=R.filter(function(x){return !!x.n;});
(function(){
var cv=document.getElementById('c'),ctx=cv.getContext('2d');
var TOP=84,BOTTOM=-58;
function inRing(x,y,r){var c=false,n=r.length/2,j=n-1;for(var i=0;i<n;i++){var xi=r[2*i],yi=r[2*i+1],xj=r[2*j],yj=r[2*j+1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;j=i;}return c;}
function inRegion(x,y,reg){var b=reg.b;if(x<b[0]||x>b[2]||y<b[1]||y>b[3])return false;for(var p=0;p<reg.p.length;p++){var poly=reg.p[p];if(inRing(x,y,poly[0])){var hole=false;for(var h=1;h<poly.length;h++){if(inRing(x,y,poly[h])){hole=true;break;}}if(!hole)return true;}}return false;}
var visited={},names=[];
function segD2(x,y,ax,ay,bx,by){var dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy,t=l?((x-ax)*dx+(y-ay)*dy)/l:0;if(t<0)t=0;else if(t>1)t=1;var qx=ax+t*dx-x,qy=ay+t*dy-y;return qx*qx+qy*qy;}
// Si un punto cae en la costa y la simplificación lo deja fuera de todo estado, se asigna el más cercano (máx. ~35 km).
function nearest(x,y){var M=0.35,best=-1,bd=M*M;for(var i=0;i<R.length;i++){var b=R[i].b;if(x<b[0]-M||x>b[2]+M||y<b[1]-M||y>b[3]+M)continue;for(var p=0;p<R[i].p.length;p++){var r=R[i].p[p][0],n=r.length/2;for(var q=0;q<n;q++){var q2=(q+1)%n,d=segD2(x,y,r[2*q],r[2*q+1],r[2*q2],r[2*q2+1]);if(d<bd){bd=d;best=i;}}}}return best;}
var totals={},byC={};R.forEach(function(x){totals[x.a]=(totals[x.a]||0)+1;});
function mark(i){if(!visited[R[i].i]){visited[R[i].i]=1;names.push(R[i].n);var a=R[i].a,c=byC[a]||(byC[a]={a:a,v:0,t:totals[a],names:[]});c.v++;c.names.push(R[i].n);}}
for(var k=0;k<PTS.length;k++){var py=PTS[k][0],px=PTS[k][1],found=-1;for(var i=0;i<R.length;i++){if(inRegion(px,py,R[i])){found=i;break;}}if(found<0)found=nearest(px,py);if(found>=0)mark(found);}
function draw(){
  var dpr=window.devicePixelRatio||1,W=EXP?2400:(document.documentElement.clientWidth||360),H=Math.round(W*(TOP-BOTTOM)/360);
  cv.style.width=W+'px';cv.style.height=H+'px';cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0B0B0F';ctx.fillRect(0,0,W,H);ctx.lineWidth=0.4;ctx.strokeStyle='#0B0B0F';
  for(var pass=0;pass<2;pass++){
    ctx.fillStyle=pass?'#D4FF38':'#2A2A33';
    for(var i=0;i<R.length;i++){
      var reg=R[i];if((!!visited[reg.i])!==(pass===1))continue;
      ctx.beginPath();
      for(var p=0;p<reg.p.length;p++){for(var q=0;q<reg.p[p].length;q++){var r=reg.p[p][q];
        for(var k=0;k<r.length;k+=2){var x=(r[k]+180)/360*W,y=(TOP-r[k+1])/(TOP-BOTTOM)*H;if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
        ctx.closePath();}}
      ctx.fill('evenodd');ctx.stroke();
    }
  }
}
function send(o){var m=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else window.parent.postMessage(m,'*');}
draw();window.addEventListener('resize',draw);
if(EXP&&PTS.length){var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9,HH=2400*(TOP-BOTTOM)/360;for(var m=0;m<PTS.length;m++){var X=(PTS[m][1]+180)/360*2400,Y=(TOP-PTS[m][0])/(TOP-BOTTOM)*HH;if(X<x0)x0=X;if(X>x1)x1=X;if(Y<y0)y0=Y;if(Y>y1)y1=Y;}window.scrollTo(Math.max(0,(x0+x1)/2-window.innerWidth/2),Math.max(0,(y0+y1)/2-window.innerHeight/2));}
var countries=Object.keys(byC).map(function(k){return byC[k];}).sort(function(a,b){return b.v-a.v;}).slice(0,60);
send({count:names.length,total:R.length,countries:countries});
})();
</script></body></html>`;
}
