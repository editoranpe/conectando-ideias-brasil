import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { provisionD1 } from '../scripts/provision-d1.mjs';
const uuid = '12345678-abcd-4def-8abc-123456789012';
const accountId = 'a'.repeat(32), token = 'b'.repeat(32);
const config = { name: 'conectando-ideias-brasil', main: './src/worker.ts' };
async function fixture(run) { const dir=await mkdtemp(join(tmpdir(),'cib-'));try{const file=join(dir,'wrangler.jsonc');await writeFile(file,JSON.stringify(config));return await run(file);}finally{await rm(dir,{recursive:true,force:true});}}
const resp=(obj)=>({ok:true,status:200,json:async()=>({success:true,result:obj})});
test('uses existing D1 and writes DB binding',async()=>fixture(async file=>{ const calls=[];const fetcher=async(url,opts)=>{calls.push([url,opts]);return resp([{name:'conectando-ideias-brasil-db',uuid}]);};const result=await provisionD1({accountId,token,configPath:file,fetcher});assert.equal(result.created,false);assert.equal(calls.length,1);const loaded=JSON.parse(await readFile(file,'utf8'));assert.equal(loaded.d1_databases[0].database_id,uuid);}));
test('creates D1 if absent',async()=>fixture(async file=>{const methods=[];const fetcher=async(url,opts)=>{methods.push(opts.method);return opts.method==='POST'?resp({name:'conectando-ideias-brasil-db',uuid}):resp([])};const result=await provisionD1({accountId,token,configPath:file,fetcher});assert.equal(result.created,true);assert.deepEqual(methods,['GET','POST']);}));
test('refuses to overwrite existing DB binding',async()=>fixture(async file=>{await writeFile(file,JSON.stringify({...config,d1_databases:[{binding:'DB',database_name:'other',database_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}]}));const fetcher=async()=>resp([{name:'conectando-ideias-brasil-db',uuid}]);await assert.rejects(()=>provisionD1({accountId,token,configPath:file,fetcher}),/different database/);}));