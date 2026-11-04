import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createGithubClient } from '../src/github/client.mjs';
import { createIssueImages } from '../src/services/images.mjs';
import { ProofError } from '../src/errors.mjs';

const url='https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111';
const png=Buffer.from('89504e470d0a1a0a00000000','hex');
const binary=(bytes,type='image/png',status=200)=>Buffer.concat([Buffer.from(`HTTP/2.0 ${status} OK\r\nContent-Type: ${type}\r\n\r\n`),bytes]);

test('私有附件使用固定gh原地址Buffer读取，不放宽JSON REST或泄露授权',async()=>{
  const calls=[];
  const github=createGithubClient({run:async(args,input,options)=>{calls.push({args,input,options});return{stdout:binary(png)};}});
  const image=await github.readImage(url);
  assert.equal(image.mimeType,'image/png');assert.deepEqual(image.bytes,png);
  assert.equal(calls.length,1);assert.ok(calls[0].args.includes(url));assert.ok(calls[0].args.includes('Accept: application/octet-stream'));
  assert.equal(calls[0].options.binary,true);assert.equal(calls[0].options.timeout,20000);assert.equal(calls[0].options.maxBuffer,5*1024*1024+64*1024);
  await assert.rejects(github.request('GET',url),{code:'GITHUB_PATH'});
});

test('媒体拒绝任意URL、危险协议和无成员能力之外的文件格式',async()=>{
  let calls=0;
  const github=createGithubClient({run:async()=>{calls++;return{stdout:binary(Buffer.from('<svg onload="attack()"/>'),'image/svg+xml')};}});
  for(const source of ['http://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111','https://evil.test/secret','https://github.com@evil.test/image','https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111?redirect=x','data:image/png;base64,AA=='])await assert.rejects(github.readImage(source),{code:'IMAGE_SOURCE_REJECTED'});
  assert.equal(calls,0);await assert.rejects(github.readImage(url),{code:'IMAGE_UNSUPPORTED'});assert.equal(calls,1);
});

test('存在企业凭据时历史图片域也不进入gh传输，避免向附件主机附加凭据',async()=>{
  // 子进程只注入测试值，不读取或继承本机真实凭据。
  const result=spawnSync(process.execPath,['--input-type=module','-e',`
    import assert from 'node:assert/strict';
    import {createGithubClient} from ${JSON.stringify(new URL('../src/github/client.mjs',import.meta.url).href)};
    let calls=0;
    const github=createGithubClient({run:async(args)=>{calls++;assert.equal(args[2],'github.com');assert.equal(new URL(args.at(-1)).hostname,'github.com');return{stdout:Buffer.from(${JSON.stringify(binary(png).toString('base64'))},'base64')};}});
    for(const source of ['https://user-images.githubusercontent.com/1/asset.png','https://private-user-images.githubusercontent.com/1/asset.png'])await assert.rejects(github.readImage(source),{code:'IMAGE_SOURCE_REJECTED'});
    assert.equal(calls,0);await github.readImage(${JSON.stringify(url)});assert.equal(calls,1);
  `],{encoding:'utf8',windowsHide:true,env:{GH_TOKEN:'dummy-test-public-token',GH_ENTERPRISE_TOKEN:'dummy-test-enterprise-token',GITHUB_ENTERPRISE_TOKEN:'dummy-test-enterprise-alternate'}});
  assert.equal(result.status,0,result.stderr);
});

test('图片工具仅页面可见，私有字节不进入结构正文，实际resource contents明确CSP',async t=>{
  const {createIssueServer,APP_URI}=await import('../src/server.mjs');
  const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');
  const {InMemoryTransport}=await import('@modelcontextprotocol/sdk/inMemory.js');
  const image={mimeType:'image/png',base64:png.toString('base64'),byteLength:png.length};
  const server=createIssueServer({html:'<h1>image</h1>',issues:{execute:async()=>({schemaVersion:1,identity:8,data:{}})},tasks:{execute:async()=>({})},images:{execute:async()=>({envelope:{schemaVersion:1,identity:8,data:{mimeType:image.mimeType,byteLength:image.byteLength}},image})}});
  const client=new Client({name:'image-test',version:'1'}),[left,right]=InMemoryTransport.createLinkedPair();await server.connect(left);await client.connect(right);t.after(async()=>{await client.close();await server.close();});
  const {tools}=await client.listTools(),tool=tools.find(item=>item.name==='issue-hub-image');assert.ok(tool);assert.deepEqual(tool._meta.ui.visibility,['app']);assert.equal(tool.annotations.readOnlyHint,true);assert.equal(tool._meta['openai/ui'],undefined);
  assert.equal(APP_URI,'ui://issue-hub/app-v2.html');assert.equal(tools.find(item=>item.name==='issue-hub-open')._meta.ui.resourceUri,APP_URI);assert.equal(tools.filter(item=>item._meta?.['openai/ui']?.entrypoints?.some(entry=>entry.type==='global')).length,1);
  const result=await client.callTool({name:tool.name,arguments:{repositoryKey:'a'.repeat(20),number:191,url,expectedIdentity:'8'}});
  assert.ok(!result.isError);assert.equal(result._meta['issue-hub/image'].base64,image.base64);assert.ok(!JSON.stringify(result.structuredContent).includes(image.base64));assert.ok(!JSON.stringify(result.content).includes(image.base64));
  const resource=await client.readResource({uri:APP_URI});assert.deepEqual(resource.contents[0]._meta.ui.csp,{connectDomains:[],resourceDomains:['data:'],frameDomains:[]});
  const compatibility=await client.readResource({uri:'ui://issue-hub/app.html'});assert.equal(compatibility.contents[0].text,resource.contents[0].text);assert.deepEqual(compatibility.contents[0]._meta,resource.contents[0]._meta);
  assert.equal((await client.callTool({name:tool.name,arguments:{repositoryKey:'a'.repeat(20),number:191,url,expectedIdentity:'8',command:'shell'}})).isError,true);
});

function imageFixture() {
  const state={identity:8,fingerprint:'credential-one',offline:false,cached:false,reads:0,downloads:0,afterDownload:null,failDownload:false,denied:false,commentParent:'https://api.github.com/repos/team/one/issues/191'};
  const issues={
    async execute(action) { assert.equal(action,'read-summary');state.reads++;if(state.denied)throw new ProofError('PERMISSION_DENIED','当前仓库无权访问。');return{schemaVersion:1,identity:state.identity,offline:state.offline,cached:state.cached,networkChecked:true,data:{issue:{number:191,url:'https://github.com/team/one/issues/191',body:`截图\n\n<img width="1957" height="811" alt="图片" src="${url}" />`}}};},
    async context(){if(state.authDenied)throw new ProofError('AUTH_REQUIRED','登录已失效。');return{account:{id:state.identity},offline:state.offline};},
  };
  const github={fingerprint:async()=>state.fingerprint,async readImage(){state.downloads++;state.afterDownload?.();if(state.failDownload)throw new ProofError('IMAGE_UNAVAILABLE','图片暂不可用。');return{mimeType:'image/png',bytes:png};},async request(method,path){assert.equal(method,'GET');assert.equal(path,'/repos/team/one/issues/comments/7');return{data:{id:7,issue_url:state.commentParent,body:`![评论图](${url})`}};}};
  const service=createIssueImages({github,issues,now:()=> '2026-11-05T00:00:00.000Z'}),payload={repositoryKey:'a'.repeat(20),number:191,url,expectedIdentity:'8'};
  return{state,github,issues,service,payload};
}

test('媒体必须属于当前已联网Issue正文，字节和元信息分开返回',async()=>{
  const f=imageFixture(),result=await f.service.execute(f.payload);
  assert.equal(result.envelope.identity,8);assert.equal(result.envelope.data.mimeType,'image/png');assert.equal(result.image.base64,png.toString('base64'));assert.ok(!JSON.stringify(result.envelope).includes(result.image.base64));assert.equal(f.state.downloads,1);
  await assert.rejects(f.service.execute({...f.payload,url:'https://github.com/user-attachments/assets/22222222-2222-4222-8222-222222222222'}),{code:'IMAGE_SOURCE_REJECTED'});assert.equal(f.state.downloads,1);
});

test('媒体校验评论真实父Issue，不接受任意评论作为权限证明',async()=>{
  const f=imageFixture();assert.equal((await f.service.execute({...f.payload,commentId:7})).image.mimeType,'image/png');
  f.state.commentParent='https://api.github.com/repos/team/one/issues/192';
  await assert.rejects(f.service.execute({...f.payload,commentId:7}),{code:'IMAGE_SOURCE_REJECTED'});assert.equal(f.state.downloads,1);
});

test('评论API的登录失效仍以真实授权错误返回，不被图片降级吞掉',async()=>{
  const f=imageFixture();f.github.request=async()=>{throw new ProofError('AUTH_REQUIRED','登录已失效。');};
  await assert.rejects(f.service.execute({...f.payload,commentId:7}),{code:'AUTH_REQUIRED'});assert.equal(f.state.downloads,0);assert.equal(f.state.reads,2);
});

test('离线缓存或旧页面身份不能取得私有图片，未知字段拒绝',async()=>{
  const f=imageFixture();f.state.offline=true;
  await assert.rejects(f.service.execute(f.payload),{code:'IMAGE_UNAVAILABLE'});f.state.offline=false;f.state.cached=true;
  await assert.rejects(f.service.execute(f.payload),{code:'IMAGE_UNAVAILABLE'});f.state.cached=false;
  await assert.rejects(f.service.execute({...f.payload,expectedIdentity:'9'}),{code:'IDENTITY_CHANGED'});
  await assert.rejects(f.service.execute({...f.payload,apiPath:'/other'}),{code:'INVALID_ARGUMENT'});assert.equal(f.state.downloads,0);
});

test('下载中换凭据或账号拒绝旧字节，授权撤销不被图片降级掩盖',async()=>{
  for(const change of [state=>state.fingerprint='credential-two',state=>state.identity=9]){
    const f=imageFixture();f.state.afterDownload=()=>change(f.state);await assert.rejects(f.service.execute(f.payload),{code:'IDENTITY_CHANGED'});
  }
  const f=imageFixture();f.state.failDownload=true;f.state.afterDownload=()=>f.state.authDenied=true;
  await assert.rejects(f.service.execute(f.payload),{code:'AUTH_REQUIRED'});
  const revoked=imageFixture();revoked.state.failDownload=true;revoked.state.afterDownload=()=>revoked.state.denied=true;
  await assert.rejects(revoked.service.execute(revoked.payload),{code:'PERMISSION_DENIED'});
});

test('单个附件失败保持局部IMAGE错误，并重新核验当前Issue权限',async()=>{
  const f=imageFixture();f.state.failDownload=true;
  await assert.rejects(f.service.execute(f.payload),{code:'IMAGE_UNAVAILABLE'});assert.equal(f.state.reads,2);
  const coded=imageFixture();coded.issues.execute=async()=>({schemaVersion:1,identity:8,offline:false,cached:false,networkChecked:true,data:{issue:{number:191,url:'https://github.com/team/one/issues/191',body:`\`<img src="${url}" />\``}}});
  await assert.rejects(coded.service.execute(coded.payload),{code:'IMAGE_SOURCE_REJECTED'});assert.equal(coded.state.downloads,0);
});

test('媒体严格检查MIME魔数、大小与受控stdout上限，不泄露原始错误',async()=>{
  for(const [type,bytes]of [['image/jpeg',Buffer.from('ffd8ffe0','hex')],['image/gif',Buffer.from('GIF89a')],['image/webp',Buffer.from('RIFF0000WEBP')]]){
    const client=createGithubClient({run:async()=>({stdout:binary(bytes,type)})});assert.equal((await client.readImage(url)).mimeType,type);
  }
  for(const output of [binary(Buffer.from('<html>not a png</html>'),'image/png'),binary(png,'text/html'),Buffer.from('not-http')]){
    const client=createGithubClient({run:async()=>({stdout:output})});await assert.rejects(client.readImage(url),error=>error.code==='IMAGE_UNSUPPORTED'||error.code==='IMAGE_UNAVAILABLE');
  }
  const tooLarge=createGithubClient({imageMaxBytes:8,run:async()=>({stdout:binary(png)})});await assert.rejects(tooLarge.readImage(url),{code:'IMAGE_TOO_LARGE'});
  const bounded=createGithubClient({run:async()=>{throw Object.assign(new Error('private token must not leak'),{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'});}});await assert.rejects(bounded.readImage(url),error=>error.code==='IMAGE_TOO_LARGE'&&!error.message.includes('private token'));
});
