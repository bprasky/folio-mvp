const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function fixture({ addresses = [{address:'93.184.216.34',family:4}], status=200, headers={'content-type':'image/png'}, chunks=[Buffer.from('image')], stall=false, dnsStall=false }={}) {
  let calls=0, pinned;
  const request=(_url,options,callback)=>{
    calls++;options.lookup('fixture.test',{},(_error,address)=>pinned=address);
    const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{
      const res=new EventEmitter();res.statusCode=status;res.headers=headers;res.destroy=()=>req.emit('close');callback(res);
      if(!stall){for(const chunk of chunks)res.emit('data',chunk);res.emit('end');req.emit('close');}
    });req.destroy=error=>{req.emit('error',error);req.emit('close');};return req;
  };
  const mocks={'node:dns/promises':{lookup:()=>dnsStall?new Promise(()=>{}):Promise.resolve(addresses)},'node:http':{request},'node:https':{request},'ipaddr.js':require('ipaddr.js')};
  function load(file){const exports={};vm.runInNewContext(`(function(require,exports){${ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText}\n})`,{URL,Buffer,setTimeout,clearTimeout,console})(name=>{assert(name in mocks,name);return mocks[name];},exports);return exports;}
  const transport=load('src/lib/server/safe-product-url.ts');mocks['./safe-product-url']=transport;
  const images=load('src/lib/server/project-image-input.ts');
  return {...transport,...images,calls:()=>calls,pinned:()=>pinned};
}
test('transport pins the validated public address and rejects mixed DNS answers before connecting',async()=>{
  const valid=fixture();await valid.safeProductResource('https://fixture.test/image');assert.equal(valid.pinned(),'93.184.216.34');
  const mixed=fixture({addresses:[{address:'93.184.216.34',family:4},{address:'127.0.0.1',family:4}]});
  await assert.rejects(mixed.safeProductResource('https://fixture.test/image'));assert.equal(mixed.calls(),0);
});
test('redirects to metadata/private hosts never make a second connection',async()=>{
  const f=fixture({status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}});
  await assert.rejects(f.fetchProjectImage('https://fixture.test/image'));assert.equal(f.calls(),1);
});
test('stream limit, stalled response, and stalled DNS all fail closed',async()=>{
  await assert.rejects(fixture({chunks:[Buffer.alloc(5),Buffer.alloc(5)]}).safeProductResource('https://fixture.test/image',{maxBytes:8}));
  await assert.rejects(fixture({stall:true}).safeProductResource('https://fixture.test/image',{timeoutMs:15}));
  const dns=fixture({dnsStall:true});await assert.rejects(dns.safeProductResource('https://fixture.test/image',{timeoutMs:15}));assert.equal(dns.calls(),0);
});
test('non-image and unsuccessful responses cannot become project assets',async()=>{
  await assert.rejects(fixture({headers:{'content-type':'text/html'}}).fetchProjectImage('https://fixture.test/image'));
  await assert.rejects(fixture({status:500}).fetchProjectImage('https://fixture.test/image'));
});
