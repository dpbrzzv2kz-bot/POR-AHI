import {palette as p} from './theme';

// Mapa para elegir el lugar de una reseña. Se muestra dentro de un WebView (iPhone/Android) o un iframe (web).
// Mapa moderno (vectorial, zoom fluido) con MapLibre GL y los mapas gratuitos de OpenFreeMap (datos de OpenStreetMap). Búsqueda por nombre: Nominatim. Sin llaves.
// Aviso: OpenFreeMap es gratis, pero es un servicio comunitario sin garantía; si la app crece conviene contratar un proveedor de mapas.
export type PickedPlace = {lat: number; lng: number; label: string; address?: string};

const MAP_CSS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
const MAP_JS = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';

export function mapHtml(initial?: PickedPlace | null) {
  const start = initial
    ? {lat: initial.lat, lng: initial.lng, zoom: 16, pin: true, label: initial.label, address: initial.address || ''}
    : {lat: 25.6866, lng: -100.3161, zoom: 12, pin: false, label: '', address: ''}; // Monterrey, sin pin
  const startJson = JSON.stringify(start).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAP_CSS}" crossorigin="">
<style>
html,body{height:100%;margin:0;font-family:-apple-system,system-ui,'Segoe UI',sans-serif;background:${p.canvas}}
#map{height:100%}
#bar{position:absolute;z-index:1000;top:12px;left:12px;right:12px;display:flex;align-items:center;gap:4px;background:#fff;border-radius:28px;box-shadow:0 4px 18px rgba(23,23,28,.18);padding:0 6px 0 4px;max-width:560px;margin:0 auto}
#bar button{border:0;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;width:44px;height:48px;padding:0;color:${p.ink}}
#q{flex:1;min-width:0;height:48px;border:0;outline:0;background:transparent;font-size:16px;color:${p.ink}}
#clr{display:none;font-size:22px;color:${p.muted}}
#res{position:absolute;z-index:1000;top:72px;left:12px;right:12px;max-width:560px;margin:0 auto;background:#fff;border-radius:18px;max-height:55%;overflow:auto;display:none;box-shadow:0 8px 28px rgba(23,23,28,.22)}
#res button{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;padding:13px 16px;border:0;border-bottom:1px solid ${p.line};background:#fff;cursor:pointer}
#res button:last-child{border-bottom:0}
#res b{display:block;font-size:15px;color:${p.ink};line-height:20px}
#res span.sub{display:block;font-size:12px;color:${p.muted};line-height:17px;margin-top:2px}
#res .ico{flex:none;width:30px;height:30px;border-radius:15px;background:${p.violetSoft};display:flex;align-items:center;justify-content:center;margin-top:1px}
#res .msg{padding:16px;font-size:14px;color:${p.muted};cursor:default}
.maplibregl-map{font-family:inherit}
.maplibregl-ctrl-group{border-radius:14px!important;box-shadow:0 4px 14px rgba(23,23,28,.2)!important;overflow:hidden}
.maplibregl-ctrl-group button{width:40px!important;height:40px!important}
.maplibregl-ctrl-attrib{font-size:10px!important}
.pin{filter:drop-shadow(0 4px 5px rgba(23,23,28,.35));animation:drop .28s ease-out}
@keyframes drop{from{transform:translateY(-22px);opacity:0}to{transform:translateY(0);opacity:1}}
</style></head><body>
<div id="bar"><button id="go" type="button" aria-label="Buscar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg></button><input id="q" placeholder="Busca un lugar o toca el mapa" enterkeyhint="search" autocomplete="off"><button id="clr" type="button" aria-label="Borrar búsqueda">&times;</button></div>
<div id="res"></div><div id="map"></div>
<script src="${MAP_JS}" crossorigin=""></script>
<script>
var start=${startJson};
var map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:[start.lng,start.lat],zoom:start.zoom-1,attributionControl:{compact:true}});
map.addControl(new maplibregl.NavigationControl({showCompass:false,visualizePitch:false}),'bottom-right');
var pinSvg='<svg width="38" height="48" viewBox="0 0 32 42"><path d="M16 1C8 1 2 7.2 2 15c0 10.5 14 26 14 26s14-15.5 14-26C30 7.2 24 1 16 1z" fill="${p.violet}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15" r="5.5" fill="${p.lime}"/></svg>';
var marker=null;
function send(o){var m=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else window.parent.postMessage(m,'*');}
var geoToken=0;
function put(lat,lng,label,address){
  lat=Math.round(lat*1e6)/1e6;lng=Math.round(lng*1e6)/1e6;
  if(marker){marker.setLngLat([lng,lat]);}
  else{var el=document.createElement('div');el.className='pin';el.innerHTML=pinSvg;marker=new maplibregl.Marker({element:el,draggable:true,anchor:'bottom'}).setLngLat([lng,lat]).addTo(map);marker.on('dragend',function(){var q2=marker.getLngLat();put(q2.lat,q2.lng,'');});}
  var token=++geoToken;
  send({lat:lat,lng:lng,label:label||'',address:address||''});
  if(!address){
    fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat='+lat+'&lon='+lng)
      .then(function(r){return r.json();})
      .then(function(d){if(token!==geoToken||!d||!d.display_name)return;send({lat:lat,lng:lng,label:label||(d.name?String(d.name):''),address:String(d.display_name)});})
      .catch(function(){});
  }
}
var res=document.getElementById('res'),q=document.getElementById('q'),clr=document.getElementById('clr');
map.on('click',function(e){res.style.display='none';q.blur();put(e.lngLat.lat,e.lngLat.lng,'');});
if(start.pin){put(start.lat,start.lng,start.label,start.address);}
function msg(text){res.innerHTML='';var d=document.createElement('div');d.className='msg';d.textContent=text;res.appendChild(d);res.style.display='block';}
function search(){
  var text=q.value.trim();if(!text)return;
  q.blur();msg('Buscando…');
  var b=map.getBounds();
  var view='&viewbox='+b.getWest()+','+b.getNorth()+','+b.getEast()+','+b.getSouth();
  fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=es'+view+'&q='+encodeURIComponent(text))
    .then(function(r){return r.json();})
    .then(function(rows){
      res.innerHTML='';
      if(!rows.length){msg('Sin resultados. Prueba con otro nombre o toca el mapa.');return;}
      rows.forEach(function(row){
        var full=String(row.display_name),parts=full.split(','),title=(row.name&&String(row.name))||parts[0].trim(),rest=parts.slice(1).join(',').trim();
        var b=document.createElement('button');b.type='button';
        var ico=document.createElement('span');ico.className='ico';ico.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="${p.violet}"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
        var box=document.createElement('span');var t=document.createElement('b');t.textContent=title;var s=document.createElement('span');s.className='sub';s.textContent=rest;box.appendChild(t);box.appendChild(s);
        b.appendChild(ico);b.appendChild(box);
        b.onclick=function(){res.style.display='none';map.flyTo({center:[+row.lon,+row.lat],zoom:16,duration:600});put(+row.lat,+row.lon,title,full);};
        res.appendChild(b);
      });
      res.style.display='block';
    })
    .catch(function(){msg('No se pudo buscar. Revisa tu conexión o toca el mapa.');});
}
document.getElementById('go').addEventListener('click',search);
q.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();search();}});
q.addEventListener('input',function(){clr.style.display=q.value?'flex':'none';if(!q.value)res.style.display='none';});
clr.addEventListener('click',function(){q.value='';clr.style.display='none';res.style.display='none';q.focus();});
</script></body></html>`;
}
