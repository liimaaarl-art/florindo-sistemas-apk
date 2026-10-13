import {readFile,appendFile} from 'node:fs/promises';
const project='odd-thunder-06895093',branch='br-late-night-b59w9eej',slug='florindoai';
if(!process.env.NEON_API_KEY||!process.env.GROQ_API_KEY)throw Error('Configuração do servidor incompleta.');
const base='https://console.neon.tech/api/v2/projects/'+project+'/branches/'+branch+'/functions/'+slug;
const headers={Authorization:'Bearer '+process.env.NEON_API_KEY};
const form=new FormData();
form.append('zip',new Blob([await readFile('backend/function.zip')],{type:'application/zip'}),'function.zip');
form.append('environment',JSON.stringify({GROQ_API_KEY:process.env.GROQ_API_KEY}));
form.append('runtime','nodejs24');
const response=await fetch(base+'/deployments',{method:'POST',headers,body:form,signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error('Neon recusou a publicação. HTTP '+response.status);
let url='';
for(let attempt=0;attempt<36;attempt++){
 const r=await fetch(base,{headers,signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('Não foi possível verificar a publicação. HTTP '+r.status);
 const raw=await r.json(),f=raw.function||raw;
 const status=f.current_deployment?.status||f.latest_deployment?.status||f.status;
 if(status==='failed')throw Error('A publicação do serviço falhou.');
 const candidate=f.invocation_url||raw.invocation_url||'';
 if(candidate&&status==='completed'){
  const probe=await fetch(candidate,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)}).catch(()=>null);
  if(probe&&probe.status===401){url=candidate;break}
 }
 await new Promise(resolve=>setTimeout(resolve,5000));
}
if(!url)throw Error('Neon ainda não confirmou a nova versão protegida do servidor.');
const html=await readFile('index.html','utf8');
if(!html.includes('FIRST_ACCESS_REGISTRATION'))throw Error('Cadastro de primeiro acesso não foi aplicado ao aplicativo.');
await appendFile(process.env.GITHUB_ENV,'FLORINDO_AI_URL='+url+'\n');
console.log('Servidor Groq atualizado e endpoint protegido confirmado.');
