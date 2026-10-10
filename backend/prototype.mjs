import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
export async function prototypeAccess(req,pool,env=process.env){
 const expected=env.PROTOTYPE_SETUP_KEY||'',provided=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 if(!/^[a-f0-9]{64}$/.test(expected)||!/^[a-f0-9]{64}$/.test(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))return {status:403,data:{error:'Acesso negado.'}};
 const users=(await pool.query('SELECT id FROM public.florindo_app_users WHERE active=true ORDER BY created_at LIMIT 2')).rows;
 if(users.length!==1)return {status:409,data:{error:'O protótipo exige uma única conta ativa.'}};
 const token=randomBytes(32).toString('hex'),hash=createHash('md5').update(token).digest('hex');
 await pool.query("INSERT INTO public.florindo_app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '365 days')",[hash,users[0].id]);
 return {status:200,data:{token}};
}
