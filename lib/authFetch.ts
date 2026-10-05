// Bound auth network requests so a lost connection does not lock the form.
export function createAuthFetch(fetcher:typeof fetch=fetch,timeoutMs=20000):typeof fetch{
 return async(input,init)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(!new URL(url).pathname.startsWith('/auth/v1/'))return fetcher(input,init);
  const controller=new AbortController(),source=init?.signal||(typeof Request!=='undefined'&&input instanceof Request?input.signal:null);
  const abort=()=>controller.abort();
  if(source?.aborted)abort();else source?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeoutMs);
  try{return await fetcher(input,{...init,signal:controller.signal});}
  finally{clearTimeout(timer);source?.removeEventListener('abort',abort);}
 };
}
