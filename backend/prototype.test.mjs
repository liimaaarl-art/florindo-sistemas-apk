import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prototypeAccess} from './prototype.mjs';
const key='a'.repeat(64);
const request=value=>new Request('https://example.com/prototype-access',{method:'POST',headers:{Authorization:'Bearer '+value}});
test('prototype provisioning requires private deployment key',async()=>{
 const pool={query(){throw Error('must not query')}};
 for(const value of ['', 'a', 'b'.repeat(64)])assert.equal((await prototypeAccess(request(value),pool,{PROTOTYPE_SETUP_KEY:key})).status,403);
 assert.equal((await prototypeAccess(request(key),pool,{})).status,403);
});
test('prototype never picks an account when multiple accounts exist',async()=>{
 const pool={async query(){return {rows:[{id:'first'},{id:'second'}]}}};
 assert.equal((await prototypeAccess(request(key),pool,{PROTOTYPE_SETUP_KEY:key})).status,409);
});
test('prototype session is random, time-limited, and only hashed in database',async()=>{
 const queries=[],pool={async query(sql,values){queries.push({sql,values});return {rows:sql.startsWith('SELECT')?[{id:'owner'}]:[]}}};
 const result=await prototypeAccess(request(key),pool,{PROTOTYPE_SETUP_KEY:key});
 assert.equal(result.status,200);assert.match(result.data.token,/^[a-f0-9]{64}$/);
 const inserted=queries.find(q=>q.sql.startsWith('INSERT'));
 assert.equal(inserted.values[0],createHash('md5').update(result.data.token).digest('hex'));
 assert.equal(inserted.values[1],'owner');assert(inserted.sql.includes("interval '90 days'"));
});
