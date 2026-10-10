import test from 'node:test';
import assert from 'node:assert/strict';
import {appRPC} from './rpc.mjs';
const request=(name,args)=>new Request('https://example.com/rpc/'+name,{method:'POST',body:JSON.stringify(args)});
test('app RPC rejects unlisted operations and unauthenticated requests',async()=>{
 const pool={query(){throw Error('must not query')}};
 assert.equal((await appRPC(request('arbitrary_sql',{}),pool)).status,404);
 assert.equal((await appRPC(request('florindo_get_state',{}),pool)).status,401);
});
test('app RPC preserves synchronization result and binds SQL parameters',async()=>{
 const calls=[],token='a'.repeat(64),state={clients:[],projects:[],updates:[],contracts:[],finances:[]};
 const pool={async query(sql,values){calls.push({sql,values});return {rows:[sql.includes('check_token')?{ok:true}:{result:{saved:true}}]}}};
 const result=await appRPC(request('florindo_sync_state',{p_token:token,p_state:state}),pool);
 assert.equal(result.status,200);assert.deepEqual(result.data,{saved:true});
 assert.equal(calls[1].sql,'SELECT public.florindo_sync_state($1,$2::jsonb) AS result');
 assert.deepEqual(calls[1].values,[token,JSON.stringify(state)]);
});
test('expired token cannot read or write',async()=>{
 const calls=[],pool={async query(sql){calls.push(sql);return {rows:[{ok:false}]}}};
 assert.equal((await appRPC(request('florindo_get_state',{p_token:'a'.repeat(64)}),pool)).status,401);
 assert.equal(calls.length,1);
});
