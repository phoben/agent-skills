// 继续用户已确认的同一浏览器任务空间，只读检查正式页面与MCP桥接。
const task = await takeOverTaskSpace(8);
const page = task.page('p1');
await page.goto('http://127.0.0.1:18287/');
await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#issue-search'), undefined, { timeout: 120000 });
console.log({ spaceId: task.spaceId, page: page.label });
console.log(await page.snapshot());
