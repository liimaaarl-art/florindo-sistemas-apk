import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256,validReset,matchesCode,passwordFields,sendRecoveryEmail,recovery} from './recovery.mjs';
const id='a'.repeat(64),code='012345',password='Uma senha nova 2026!';
test('code bound to request, strict input, constant-time hash comparison',()=>{
 assert(matchesCode(id,code,sha256(id+':'+code)));
 assert(!matchesCode('b'.repeat(64),code,sha256(id+':'+code)));
 assert(!matchesCode(id,code,'broken'));
 assert(validReset({requestId:id,code,password}));
 for(const p of ['', 'curta', 'x'.repeat(201)])assert(!validReset({requestId:id,code,password:p}));
 assert(!validReset({requestId:id,code:12345,password}));
});
test('new random salts produce hashes compatible with current login',()=>{
 const a=passwordFields(password),b=passwordFields(password);
 assert.notEqual(a.salt,b.salt);assert.notEqual(a.hash,b.hash);
 assert.equal(a.hash,createHash('md5').update(a.salt+password+a.salt).digest('hex'));
});
test('mail only goes to server-selected recipient; provider failures do not leak response',async()=>{
 let sent;
 await sendRecoveryEmail('owner@example.com',code,id,'private',async(url,options)=>{sent={url,options};return {ok:true}});
 const data=JSON.parse(sent.options.body);
 assert.deepEqual(data.to,['owner@example.com']);assert(data.text.includes(code));
 assert.equal(sent.options.headers['Idempotency-Key'],'reset/'+id);
 await assert.rejects(sendRecoveryEmail('owner@example.com',code,id,'private',async()=>({ok:false})),/mail_delivery_failed/);
});
function mockPool(row){
 const queries=[];
 const db={async query(sql,values=[]){
  queries.push({sql,values});
  if(sql.startsWith('SELECT r.*'))return {rows:row?[row]:[]};
  return {rows:[]};
 },release(){}};
 return {queries,async connect(){return db}};
}
function request(body){return new Request('https://example.com/auth/reset',{method:'POST',body:JSON.stringify(body)})}
function validRow(){return {id,user_id:'owner',active:true,username:'owner-login',delivered:true,consumed:false,attempts:0,expires_at:new Date(Date.now()+600000),code_hash:sha256(id+':'+code)}}
test('invalid code increments attempts and commits without changing password',async()=>{
 const pool=mockPool(validRow());
 const r=await recovery(request({requestId:id,code:'999999',password}),pool);
 assert.equal(r.status,400);
 assert(pool.queries.some(q=>q.sql.includes('attempts=attempts+1')));
 assert(pool.queries.some(q=>q.sql==='COMMIT'));
 assert(!pool.queries.some(q=>q.sql.startsWith('UPDATE public.florindo_app_users')));
});
test('expired, consumed, undelivered, inactive, exhausted codes never change password',async()=>{
 for(const patch of [{expires_at:new Date(0)},{consumed:true},{delivered:false},{active:false},{attempts:5}]){
  const pool=mockPool({...validRow(),...patch});
  assert.equal((await recovery(request({requestId:id,code,password}),pool)).status,400);
  assert(!pool.queries.some(q=>q.sql.startsWith('UPDATE public.florindo_app_users')));
 }
});
test('valid code atomically updates password, invalidates codes and revokes sessions',async()=>{
 const pool=mockPool(validRow());
 const r=await recovery(request({requestId:id,code,password}),pool);
 assert.equal(r.status,200);assert.equal(r.data.username,'owner-login');
 const sql=pool.queries.map(q=>q.sql);
 assert(sql.includes('BEGIN')&&sql.includes('COMMIT'));
 assert(sql.some(q=>q.startsWith('UPDATE public.florindo_app_users')));
 assert(sql.includes('DELETE FROM public.florindo_app_sessions WHERE user_id=$1'));
 assert(sql.includes('UPDATE florindo_auth_private.florindo_password_resets SET consumed=true WHERE user_id=$1'));
 assert(!JSON.stringify(r).includes(password));
});
test('missing mail key returns actionable error before querying database',async()=>{
 const pool=mockPool(null);
 const r=await recovery(new Request('https://example.com/auth/request-reset',{method:'POST',body:JSON.stringify({email:'owner@example.com'})}),pool,{});
 assert.equal(r.status,503);assert.equal(pool.queries.length,0);
});
