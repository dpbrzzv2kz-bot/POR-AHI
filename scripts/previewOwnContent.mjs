import {readFile,writeFile,mkdir} from 'node:fs/promises';
const app=new URL('../',import.meta.url),out=new URL('../../work/',app);
const migration=(await readFile(new URL('supabase/012_own_content.sql',app),'utf8')).replace(/^begin;\r?\n/m,'').replace(/^commit;\r?\n?/m,'');
const tests=await readFile(new URL('supabase/verify_own_content.sql',app),'utf8');
const preview=tests.replace(/^begin;\r?\n/m,()=>`begin;\n${migration}\n`);
if(!preview.trimEnd().endsWith('rollback;')||preview.includes('\ncommit;'))throw Error('Preview must roll back');
await mkdir(out,{recursive:true});await writeFile(new URL('own-content-preview.sql',out),preview);
console.log('Reversible SQL preview prepared');
