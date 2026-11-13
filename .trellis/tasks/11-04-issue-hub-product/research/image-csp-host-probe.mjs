import { readFile, writeFile } from 'node:fs/promises';
const archive=await readFile('C:/Program Files/WindowsApps/OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0/app/resources/app.asar'),hs=archive.readUInt32LE(4),js=archive.readUInt32LE(12),header=JSON.parse(archive.subarray(16,16+js)),base=8+hs,files=[];
function visit(node,p=''){for(const[n,x]of Object.entries(node.files||{})){const f=p?`${p}/${n}`:n;if(x.files)visit(x,f);else if(x.offset!==undefined)files.push({path:f,start:base+Number(x.offset),end:base+Number(x.offset)+Number(x.size)});}}visit(header);
const matches=[];
for(const needle of ['resourceDomains','resource_domains','sandbox-resource-ready','Content-Security-Policy']){let at=0,count=0;while(count<20&&(at=archive.indexOf(Buffer.from(needle),at))>=0){const f=files.find(f=>at>=f.start&&at<f.end);if(f&&/\.(?:js|html)$/.test(f.path))matches.push({needle,file:f.path,offset:at-f.start,snippet:archive.subarray(Math.max(at-250,f.start),Math.min(at+600,f.end)).toString('utf8')});at+=needle.length;count++;}}
await writeFile(new URL('./image-csp-host-probe.json',import.meta.url),JSON.stringify(matches,null,2)+'\n');console.log(JSON.stringify(matches));
