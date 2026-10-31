import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openPayload,safePayloadPath} from '../lib/payload.mjs';
import {startServer} from '../lib/serve.mjs';
import {sha256} from '../lib/game.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'dfo-payload-'));
 const files={'play/index.html':'<body>private</body>','assets/private.js':'export const install=()=>{};'};
 for(const [rel,text]of Object.entries(files)){mkdirSync(join(root,rel,'..'),{recursive:true});writeFileSync(join(root,rel),text);}
 const manifest={format:1,version:'fixture',files:Object.entries(files).map(([path,b])=>({path,size:Buffer.byteLength(b),sha256:sha256(Buffer.from(b))})),mods:[{id:'private',name:'Private',module:'assets/private.js'}]};
 writeFileSync(join(root,'renderer-payload.json'),JSON.stringify(manifest));
 return {root,manifest,save(){writeFileSync(join(root,'renderer-payload.json'),JSON.stringify(manifest));},clean(){if(!root.startsWith(join(tmpdir(),'dfo-payload-')))throw Error('Unsafe fixture path');rmSync(root,{recursive:true,force:true});}};
}
test('explicit payload validates files and refuses traversal, duplicates and changed bytes',()=>{
 const f=fixture();try{
  const p=openPayload(f.root);assert.match(p.read('play/index.html').toString(),/private/);assert.equal(p.read('assets/stock.js'),null);
  writeFileSync(join(f.root,'assets/private.js'),'changed');assert.throws(()=>p.read('assets/private.js'),/changed/);
  for(const path of ['../x','a/../x','/absolute','a\\x','C:x','a//b','a\u0000b'])assert.equal(safePayloadPath(path),false);
  f.manifest.files.push(f.manifest.files[0]);f.save();assert.throws(()=>openPayload(f.root),/Invalid/);
 }finally{f.clean();}
});
test('private payload server is coherent, injects loader, serves only selected registry, keeps fixed port strict',async()=>{
 const f=fixture();let server;try{
  server=await startServer({payloadRoot:f.root,port:0,strictPort:true});
  const url=new URL(server.url);assert.match(await(await fetch(url)).text(),/dfo-mods\/boot.js/);
  const registry=await(await fetch(new URL('../assets/dfo-mods/registry.js',url))).text();assert.match(registry,/Private/);assert.doesNotMatch(registry,/skillhud|lootfilter/);
  assert.equal((await fetch(new URL('../assets/not-in-payload.js',url))).status,404);
  await assert.rejects(startServer({payloadRoot:f.root,strictPort:true,port:Number(url.port)}),/EADDRINUSE/);
  writeFileSync(join(f.root,'assets/private.js'),'changed');assert.equal((await fetch(new URL('../assets/private.js',url))).status,500);
 }finally{await server?.close();f.clean();}
});
