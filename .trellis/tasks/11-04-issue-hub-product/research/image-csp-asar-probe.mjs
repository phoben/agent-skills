import { readFile, writeFile } from 'node:fs/promises';
const path='C:/Program Files/WindowsApps/OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0/app/resources/app.asar';
const archive=await readFile(path), headerSize=archive.readUInt32LE(4), jsonSize=archive.readUInt32LE(12), header=JSON.parse(archive.subarray(16,16+jsonSize).toString('utf8')), base=8+headerSize;
const files=[];
function visit(node,prefix=''){for(const[name,item]of Object.entries(node.files||{})){const full=prefix?`${prefix}/${name}`:name;if(item.files)visit(item,full);else if(item.offset!==undefined)files.push({path:full,start:base+Number(item.offset),end:base+Number(item.offset)+Number(item.size)});}}
visit(header);
const matches=[];let at=0;
while(matches.length<20&&(at=archive.indexOf(Buffer.from('img-src'),at))>=0){const file=files.find(f=>at>=f.start&&at<f.end);matches.push({file:file?.path,offset:at-(file?.start||0),snippet:archive.subarray(Math.max(at-200,file?.start||0),Math.min(at+400,file?.end||archive.length)).toString('utf8')});at+=7;}
await writeFile(new URL('./image-csp-asar-probe.json',import.meta.url),JSON.stringify({version:'26.1027.3384.0',matches},null,2)+'\n');console.log(JSON.stringify({matches}));
