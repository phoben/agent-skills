import {open} from 'node:fs/promises';
const handle=await open('C:/Program Files/WindowsApps/OpenAI.Codex_26.1027.3384.0_x64__2p2nqsd0c76g0/app/resources/app.asar','r');
try{
  const prefix=Buffer.alloc(16);await handle.read(prefix,0,16,0);
  const headerBytes=prefix.readUInt32LE(4),jsonBytes=prefix.readUInt32LE(12),header=Buffer.alloc(jsonBytes);await handle.read(header,0,jsonBytes,16);const tree=JSON.parse(header.toString('utf8'));
  for(const file of ['webview/assets/app-primary-998934e837fc.js','webview/assets/app-initial-4267e52fe5b0.js']){
    let entry=tree;for(const part of file.split('/'))entry=entry.files[part];if(!entry?.size)continue;
    const buffer=Buffer.alloc(entry.size);await handle.read(buffer,0,entry.size,8+headerBytes+Number(entry.offset));const source=buffer.toString('utf8');
    const signals=[...source.matchAll(/function CA\(|function _1r\(|function h1r\(/g)].slice(0,6);
    console.log({file,matches:signals.map(match=>source.slice(Math.max(0,match.index-170),match.index+match[0].length+230))});
  }
}finally{await handle.close();}
