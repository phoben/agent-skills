import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Client } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { StdioClientTransport } from '../../../../packages/issue-hub/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

// 从候选真实MCP只读核验四图，保留元数据，不保存像素/base64/header或签名URL。
const codeRoot=resolve(process.argv[2]);
const installed=process.argv.includes('--installed');
const report={realGithub:true,remoteWrites:false,chatOpened:false,contentPrinted:false,images:[],failure:null};let client;
try{
  const transport=new StdioClientTransport({command:process.execPath,args:[resolve(codeRoot,installed?'dist/issue-hub.cjs':'plugins/yg-toolkit/dist/issue-hub.cjs')],stderr:'pipe',env:{...process.env}});transport.stderr?.on('data',()=>{});
  client=new Client({name:'issue_image_service_live',version:'1'});await client.connect(transport,{timeout:120000});report.version=client.getServerVersion().version;
  const call=async(name,args)=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:120000});if(r.isError)throw Object.assign(new Error(r.structuredContent.error.message),r.structuredContent.error);return r;};
  const boot=await call('issue-hub-query',{action:'bootstrap',payload:{}});
  const summary=await call('issue-hub-query',{action:'read-summary',payload:{repositoryKey:'09cb7093f29bd89a2b4c',number:191}});
  const sources=[...summary.structuredContent.data.issue.body.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);assert.equal(sources.length,4);
  const resource=await client.readResource({uri:'ui://issue-hub/app-v2.html'});report.csp=resource.contents[0]._meta?.ui?.csp;assert.deepEqual(report.csp.resourceDomains,['data:']);assert.deepEqual(report.csp.connectDomains,[]);
  for(const url of sources){
    const r=await call('issue-hub-image',{repositoryKey:'09cb7093f29bd89a2b4c',number:191,url,expectedIdentity:String(boot.structuredContent.identity)});
    const image=r._meta?.['issue-hub/image'];assert.equal(image.mimeType,'image/png');const bytes=Buffer.from(image.base64,'base64');assert.equal(bytes.length,image.byteLength);assert.ok(bytes.length>0);
    assert.ok(!JSON.stringify(r.structuredContent).includes(image.base64));assert.ok(!JSON.stringify(r.content).includes(image.base64));
    report.images.push({mimeType:image.mimeType,bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:createHash('sha256').update(bytes).digest('hex'),privateMetaOnly:true});
  }
  report.passed=true;
}catch(error){report.failure={code:error.code||'IMAGE_VERIFY_FAILED',message:error.message};report.passed=false;process.exitCode=1;}
finally{await client?.close();await writeFile(new URL(installed?'./image-installed-live.json':'./image-service-live.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
