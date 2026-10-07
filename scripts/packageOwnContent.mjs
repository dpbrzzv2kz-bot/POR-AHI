import {cp,mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('../',import.meta.url)),workspace=resolve(app,'../..');
const source=resolve(workspace,'work/own-content-web'),target=resolve(workspace,'work/own-content-release');
if(!target.startsWith(workspace+sep))throw Error('Release must stay in workspace');
const html=await readFile(resolve(source,'index.html'),'utf8');
const entry=html.match(/src="([^"]+entry-[^"]+\.js)"/)?.[1];
if(!entry||!html.includes('manifest.webmanifest')||!html.includes('apple-touch-icon')||!html.includes('lang="es"'))throw Error('Mobile web metadata missing');
const bundle=await readFile(resolve(source,'.'+entry),'utf8');
if(!bundle.includes('edit_own_review')||!bundle.includes('content_management')||!bundle.includes('Editar o eliminar mi rese'))throw Error('Own content UI missing');
if(!bundle.includes('https://bxsllqteuafbusruspqd.supabase.co')||bundle.includes('http://127.0.0.1:8797'))throw Error('Wrong production endpoint');
if(!html.includes('Por Ahí'))throw Error('Brand title missing');
try{await stat(target);throw Error('Use a fresh release directory; do not mix exports');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(target,{recursive:true});
// Legal drafts remain saved in source, and their routes redirect while legalReady=false.
const excluded=['privacy','terms'].map(name=>resolve(source,name));
await cp(source,target,{recursive:true,filter:path=>!excluded.some(p=>path===p||path.startsWith(p+sep))});
for(const name of ['_headers','_redirects'])await cp(resolve(app,'web-preview',name),resolve(target,name));
const headers=await readFile(resolve(target,'_headers'),'utf8');
await writeFile(resolve(target,'_headers'),headers+'\n/manifest.webmanifest\n  Cache-Control: no-cache\n');
await writeFile(resolve(workspace,'work/own-content-package-check.json'),JSON.stringify({entry,target,legalDraftsExcluded:true,requiresMigration:'012_own_content.sql',published:false},null,2));
console.log('Feature release prepared; waiting for database activation approval');
