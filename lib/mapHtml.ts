// Mapa para elegir el lugar de una reseña. Se muestra dentro de un WebView (iPhone/Android) o un iframe (web).
// Usa OpenStreetMap (mapa) y Nominatim (búsqueda por nombre): gratis, sin llaves, con límites de uso razonable.
export type PickedPlace = {lat: number; lng: number; label: string; address?: string};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export function mapHtml(initial?: PickedPlace | null) {
  const start = initial
    ? {lat: initial.lat, lng: initial.lng, zoom: 16, pin: true, label: initial.label, address: initial.address || ''}
    : {lat: 25.6866, lng: -100.3161, zoom: 12, pin: false, label: '', address: ''}; // Monterrey, sin pin
  const startJson = JSON.stringify(start).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<style>
html,body{height:100%;margin:0;font-family:-apple-system,system-ui,sans-serif;background:#F5F5F7}
#map{height:100%}
#bar{position:absolute;z-index:1000;top:10px;left:10px;right:10px;display:flex;gap:8px}
#q{flex:1;min-width:0;padding:13px 14px;border-radius:14px;border:1px solid #E5E5EB;font-size:16px;background:#fff;color:#17171C}
#go{padding:0 16px;border-radius:14px;border:0;background:#17171C;color:#fff;font-size:14px;font-weight:700}
#res{position:absolute;z-index:1000;top:64px;left:10px;right:10px;background:#fff;border-radius:14px;max-height:45%;overflow:auto;display:none;box-shadow:0 6px 24px rgba(0,0,0,.18)}
#res button{display:block;width:100%;text-align:left;padding:13px 14px;border:0;border-bottom:1px solid #E5E5EB;background:#fff;font-size:14px;color:#17171C}
</style></head><body>
<div id="bar"><input id="q" placeholder="Busca un lugar o toca el mapa" enterkeyhint="search" autocomplete="off"><button id="go" type="button">Buscar</button></div>
<div id="res"></div><div id="map"></div>
<script src="${LEAFLET_JS}" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
var start=${startJson};
var map=L.map('map',{zoomControl:false}).setView([start.lat,start.lng],start.zoom);
L.control.zoom({position:'bottomright'}).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var marker=null;
function send(o){var m=JSON.stringify(o);if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else window.parent.postMessage(m,'*');}
var geoToken=0;
function put(lat,lng,label,address){
  lat=Math.round(lat*1e6)/1e6;lng=Math.round(lng*1e6)/1e6;
  if(marker){marker.setLatLng([lat,lng]);}
  else{marker=L.marker([lat,lng],{draggable:true}).addTo(map);marker.on('dragend',function(){var p=marker.getLatLng();put(p.lat,p.lng,'');});}
  var token=++geoToken;
  send({lat:lat,lng:lng,label:label||'',address:address||''});
  if(!address){
    fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat='+lat+'&lon='+lng)
      .then(function(r){return r.json();})
      .then(function(d){if(token!==geoToken||!d||!d.display_name)return;send({lat:lat,lng:lng,label:label||'',address:String(d.display_name)});})
      .catch(function(){});
  }
}
map.on('click',function(e){document.getElementById('res').style.display='none';put(e.latlng.lat,e.latlng.lng,'');});
if(start.pin){put(start.lat,start.lng,start.label,start.address);}
function show(text){var box=document.getElementById('res');box.innerHTML='';var b=document.createElement('button');b.disabled=true;b.textContent=text;box.appendChild(b);box.style.display='block';}
function search(){
  var q=document.getElementById('q').value.trim();if(!q)return;
  show('Buscando…');
  fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q='+encodeURIComponent(q))
    .then(function(r){return r.json();})
    .then(function(rows){
      var box=document.getElementById('res');box.innerHTML='';
      if(!rows.length){show('Sin resultados. Prueba con otro nombre o toca el mapa.');return;}
      rows.forEach(function(row){
        var b=document.createElement('button');b.textContent=row.display_name;
        b.onclick=function(){box.style.display='none';map.setView([+row.lat,+row.lon],17);put(+row.lat,+row.lon,String(row.display_name).split(',')[0],String(row.display_name));};
        box.appendChild(b);
      });
      box.style.display='block';
    })
    .catch(function(){show('No se pudo buscar. Revisa tu conexión o toca el mapa.');});
}
document.getElementById('go').addEventListener('click',search);
document.getElementById('q').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();search();}});
</script></body></html>`;
}
