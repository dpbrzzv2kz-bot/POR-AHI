import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('../',import.meta.url)),workspace=resolve(app,'../..');
const root=resolve(workspace,'work/urban-design-preview');
if(!root.startsWith(workspace+sep))throw Error('Preview must stay inside the workspace');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
createServer(async(req,res)=>{try{
 const path=decodeURIComponent(new URL(req.url,'http://127.0.0.1:8820').pathname);
 if(path==='/preview.html'){res.writeHead(200,{'Content-Type':types['.html']}).end(await readFile(resolve(app,'tests/designPreview.html')));return;}
 if(/^\/(privacy|terms)(\/|$)/.test(path)){res.writeHead(404).end();return;}
 let file=resolve(root,'.'+path);if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 if(path==='/'||!extname(file))file=resolve(root,'index.html');
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file));
 }catch{res.writeHead(404).end('Not found');}
}).listen(8820,'127.0.0.1',()=>console.log('Urban design preview: http://127.0.0.1:8820/preview.html'));
