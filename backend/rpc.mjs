export async function appRPC(req,pool){
 const name=new URL(req.url).pathname.split('/').pop();
 if(!['florindo_get_state','florindo_sync_state','florindo_logout'].includes(name))return {status:404,data:{error:'Operação não disponível.'}};
 let args;
 try{const raw=await req.text();if(raw.length>2000000)return {status:413,data:{error:'Dados muito longos.'}};args=JSON.parse(raw)}catch{return {status:400,data:{error:'Dados inválidos.'}}}
 const token=args?.p_token;
 if(typeof token!=='string'||token.length<20||token.length>1000)return {status:401,data:{error:'Acesso ao Neon indisponível.'}};
 const valid=(await pool.query('SELECT public.florindo_check_token($1) AS ok',[token])).rows[0]?.ok;
 if(valid!==true)return {status:401,data:{error:'Acesso ao Neon expirado. Atualize a versão de testes.'}};
 if(name==='florindo_sync_state'){
  if(!args.p_state||typeof args.p_state!=='object'||Array.isArray(args.p_state))return {status:400,data:{error:'Dados inválidos.'}};
  for(const entity of ['clients','projects','updates','contracts','finances'])if(!Array.isArray(args.p_state[entity]))return {status:400,data:{error:'Cadastros inválidos.'}};
  const result=await pool.query('SELECT public.florindo_sync_state($1,$2::jsonb) AS result',[token,JSON.stringify(args.p_state)]);
  return {status:200,data:result.rows[0].result};
 }
 const sql=name==='florindo_get_state'?'SELECT public.florindo_get_state($1) AS result':'SELECT public.florindo_logout($1) AS result';
 return {status:200,data:(await pool.query(sql,[token])).rows[0].result};
}
