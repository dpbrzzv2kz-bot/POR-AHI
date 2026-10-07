import {access,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Patch only the already deployed web export. Do not include deferred legal screens.
const app=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const base=path.join(app,'web-preview');
const output=path.resolve(app,'../../work/por-ahi-mobile-web');
const expected='_expo/static/js/web/entry-dddfa0887deae8892dc752c39a17287d.js';
const input=await readFile(path.join(base,'index.html'),'utf8');
if(!input.includes(expected))throw new Error('The source export does not match the deployed Google sign-in version.');
async function assertNoLegalPages(folder){
  for(const name of ['privacy','terms']){
    try{await access(path.join(folder,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
    throw new Error(`Deferred legal pages found in ${folder}.`);
  }
}
await assertNoLegalPages(base);
const bundle=await readFile(path.join(base,expected),'utf8');
if(bundle.includes('Domicilio para privacidad')||bundle.includes('Eliminar cuenta'))throw new Error('The source bundle includes deferred account/privacy UI.');
await mkdir(output,{recursive:true});
await cp(base,output,{recursive:true});
await assertNoLegalPages(output);
const template=await readFile(path.join(app,'public/index.html'),'utf8');
const tags=template.split('<title>%WEB_TITLE%</title>')[1].split('<!--')[0].trim();
const html=input.replace('<html lang="en">','<html lang="es">').replace('<title>resenas-app</title>',`<title>Por Ahí</title>\n    ${tags}`);
if(!html.includes('rel="manifest"')||!html.includes('apple-mobile-web-app-capable'))throw new Error('Mobile metadata was not added.');
await writeFile(path.join(output,'index.html'),html);
for(const name of ['manifest.webmanifest','icons','install'])await cp(path.join(app,'public',name),path.join(output,name),{recursive:true});
const existingHeaders=await readFile(path.join(output,'_headers'),'utf8');
await writeFile(path.join(output,'_headers'),existingHeaders+'\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n  Cache-Control: no-cache\n/install/*\n  Cache-Control: no-cache\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(hash(await readFile(path.join(base,expected)))!==hash(await readFile(path.join(output,expected))))throw new Error('The existing app bundle changed.');
await writeFile(path.resolve(app,'../../work/mobile-web-package-check.json'),JSON.stringify({expected,unchangedJavaScript:true,legalScreensIncluded:false,output},null,2));
console.log(`Mobile web package prepared: ${output}`);
