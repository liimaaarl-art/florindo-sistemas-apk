import {createHash,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export function validReset(body){
 return typeof body?.requestId==='string'&&/^[a-f0-9]{64}$/.test(body.requestId)&&typeof body.code==='string'&&/^\d{6}$/.test(body.code)&&typeof body.password==='string'&&body.password.length>=12&&body.password.length<=200;
}
export function matchesCode(id,code,hash){
 const actual=sha256(id+':'+code);
 return typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)&&timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(hash,'hex'));
}
// Keep the current login hash format; only the server handles the salt and hash.
export function passwordFields(password){
 const salt=randomBytes(32).toString('hex');
 return {salt,hash:createHash('md5').update(salt+password+salt).digest('hex')};
}
const generic='Se o e-mail estiver cadastrado, você receberá um código válido por 15 minutos. Confira também o spam.';
const invalid='Código inválido ou expirado. Solicite um novo código.';
export async function sendRecoveryEmail(email,code,id,key,transport=fetch){
 const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'reset/'+id},body:JSON.stringify({from:'Florindo Sistemas <onboarding@resend.dev>',to:[email],subject:'Recuperação de acesso · Florindo Sistemas',text:'Seu código de recuperação é: '+code+'\n\nEle vale por 15 minutos e só pode ser usado uma vez. Se você não solicitou, ignore este e-mail.'}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('mail_delivery_failed');
}
export async function recovery(req,pool,env=process.env,transport=fetch){
 const path=new URL(req.url).pathname.replace(/\/$/,'');
 if(!['/auth/request-reset','/auth/reset'].includes(path))return {status:404,data:{error:'Rota não encontrada.'}};
 let body;
 try{const raw=await req.text();if(raw.length>4096)return {status:413,data:{error:'Dados muito longos.'}};body=JSON.parse(raw)}catch{return {status:400,data:{error:'Dados inválidos.'}}}
 if(path==='/auth/request-reset'){
  if(!env.RESEND_API_KEY)return {status:503,data:{error:'Recuperação por e-mail ainda não configurada. Falta cadastrar RESEND_API_KEY no GitHub.'}};
  if(typeof body?.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return {status:400,data:{error:'Informe um e-mail válido.'}};
  const id=randomBytes(32).toString('hex'),code=String(randomInt(0,1000000)).padStart(6,'0'),email=body.email.trim().toLowerCase();
  const db=await pool.connect();let user;
  try{
   await db.query('BEGIN');
   await db.query("SELECT pg_advisory_xact_lock(hashtext('florindo-password-recovery'))");
   const counts=(await db.query("SELECT count(*)::int AS n FROM florindo_auth_private.florindo_password_resets WHERE created_at>now()-interval '1 hour'")).rows[0];
   if(counts.n>=30){await db.query('ROLLBACK');return {status:429,data:{error:'Muitas solicitações. Aguarde antes de tentar novamente.'}}}
   user=(await db.query('SELECT u.id,a.email FROM florindo_auth_private.florindo_recovery_accounts a JOIN public.florindo_app_users u ON u.id=a.user_id WHERE lower(a.email)=$1 AND u.active=true',[email])).rows[0];
   if(user){
    const recent=(await db.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE created_at>now()-interval '1 minute')::int AS recent FROM florindo_auth_private.florindo_password_resets WHERE user_id=$1 AND created_at>now()-interval '1 hour'",[user.id])).rows[0];
    if(recent.n>=5||recent.recent>0){await db.query('ROLLBACK');return {status:200,data:{message:generic,requestId:id}}}
   }
   await db.query('INSERT INTO florindo_auth_private.florindo_password_resets(id,user_id,code_hash) VALUES($1,$2,$3)',[id,user?.id||null,sha256(id+':'+code)]);
   await db.query('COMMIT');
  }catch{await db.query('ROLLBACK').catch(()=>{});return {status:503,data:{error:'Não foi possível solicitar a recuperação. Tente novamente.'}}}finally{db.release()}
  if(user){
   try{await sendRecoveryEmail(user.email,code,id,env.RESEND_API_KEY,transport);await pool.query('UPDATE florindo_auth_private.florindo_password_resets SET delivered=true WHERE id=$1 AND consumed=false',[id])}
   catch{await pool.query('UPDATE florindo_auth_private.florindo_password_resets SET consumed=true WHERE id=$1',[id]).catch(()=>{});return {status:503,data:{error:'Não foi possível enviar o e-mail. Confira a configuração do Resend e tente novamente em um minuto.'}}}
  }
  return {status:200,data:{message:generic,requestId:id}};
 }
 if(!validReset(body))return {status:400,data:{error:'Informe o código de 6 dígitos e uma senha de 12 a 200 caracteres.'}};
 const db=await pool.connect();
 try{
  await db.query('BEGIN');
  await db.query("SELECT pg_advisory_xact_lock(hashtext('florindo-password-recovery'))");
  const row=(await db.query('SELECT r.*,u.active,u.username FROM florindo_auth_private.florindo_password_resets r LEFT JOIN public.florindo_app_users u ON u.id=r.user_id WHERE r.id=$1 FOR UPDATE OF r',[body.requestId])).rows[0];
  if(!row||!row.user_id||!row.active||!row.delivered||row.consumed||row.attempts>=5||new Date(row.expires_at).getTime()<=Date.now()){await db.query('ROLLBACK');return {status:400,data:{error:invalid}}}
  if(!matchesCode(body.requestId,body.code,row.code_hash)){
   await db.query('UPDATE florindo_auth_private.florindo_password_resets SET attempts=attempts+1 WHERE id=$1',[row.id]);
   await db.query('COMMIT');return {status:400,data:{error:invalid}};
  }
  // Serialize multiple valid reset requests for one account.
  await db.query('SELECT id FROM public.florindo_app_users WHERE id=$1 FOR UPDATE',[row.user_id]);
  const fields=passwordFields(body.password);
  await db.query('UPDATE public.florindo_app_users SET password_salt=$2,password_hash=$3,updated_at=now() WHERE id=$1',[row.user_id,fields.salt,fields.hash]);
  await db.query('DELETE FROM public.florindo_app_sessions WHERE user_id=$1',[row.user_id]);
  await db.query('UPDATE florindo_auth_private.florindo_password_resets SET consumed=true WHERE user_id=$1',[row.user_id]);
  await db.query('COMMIT');
  return {status:200,data:{message:'Senha alterada. Entre com a nova senha.',username:row.username}};
 }catch{await db.query('ROLLBACK').catch(()=>{});return {status:503,data:{error:'Não foi possível alterar a senha. Tente novamente.'}}}finally{db.release()}
}
