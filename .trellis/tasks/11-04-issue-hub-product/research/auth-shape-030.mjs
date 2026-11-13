import {readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
// 只记录身份字段是否存在及结构，不输出任何账户ID、令牌或密钥。
const value=JSON.parse(await readFile(join(resolve(process.env.CODEX_HOME||join(homedir(),'.codex')),'auth.json'),'utf8'));
const result={rootKeys:Object.keys(value),mode:['chatgpt','apikey','chatgptAuthTokens'].includes(value.auth_mode)?value.auth_mode:'other',tokenKeys:Object.keys(value.tokens||{}),accountIdPresent:typeof value.tokens?.account_id==='string'&&value.tokens.account_id.length>0,apiKeyPresent:typeof value.OPENAI_API_KEY==='string'&&value.OPENAI_API_KEY.length>0};
await writeFile(new URL('./auth-shape-030.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
