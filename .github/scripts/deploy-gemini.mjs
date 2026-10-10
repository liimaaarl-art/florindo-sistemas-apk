import {readFile,appendFile} from 'node:fs/promises';
const project='odd-thunder-06895093',branch='br-late-night-b59w9eej',slug='florindoai';
if(!process.env.NEON_API_KEY||!process.env.GEMINI_API_KEY)throw Error('Configure os secrets NEON_API_KEY e GEMINI_API_KEY no GitHub.');
const base='https://console.neon.tech/api/v2/projects/'+project+'/branches/'+branch+'/functions/'+slug;
const headers={Authorization:'Bearer '+process.env.NEON_API_KEY};
const form=new FormData();
form.append('zip',new Blob([await readFile('backend/function.zip')],{type:'application/zip'}),'function.zip');
form.append('environment',JSON.stringify({GEMINI_API_KEY:process.env.GEMINI_API_KEY}));
form.append('runtime','nodejs24');
const response=await fetch(base+'/deployments',{method:'POST',headers,body:form,signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error('Neon recusou a publicação (HTTP '+response.status+'). Confira a permissão da chave NEON_API_KEY.');
let url='';
for(let attempt=0;attempt<24;attempt++){
 const r=await fetch(base,{headers,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Não foi possível verificar a publicação (HTTP '+r.status+').');
 const raw=await r.json(),f=raw.function||raw;
 const status=f.latest_deployment?.status||f.last_deployment?.status||f.deployment?.status||f.status;
 if(status==='failed')throw Error('A publicação do serviço Gemini falhou. Consulte Functions no Neon.');
 url=f.invocation_url||raw.invocation_url||'';
 if(url&&status==='completed')break;
 if(url&&f.latest_deployment?.state==='completed')break;
 if(url){const probe=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)}).catch(()=>null);if(probe?.status===401)break;}
 url='';await new Promise(resolve=>setTimeout(resolve,5000));
}
if(!url||!url.startsWith('https://'))throw Error('Neon ainda não confirmou a publicação. Consulte o estado da função florindoai.');
await appendFile(process.env.GITHUB_ENV,'FLORINDO_AI_URL='+url+'\n');
console.log('Serviço Gemini publicado: '+url);
