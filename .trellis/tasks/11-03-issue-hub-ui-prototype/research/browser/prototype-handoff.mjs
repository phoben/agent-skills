// 将已检查的本机原型交给用户体验，继续复用现有任务空间。
const task = await taskSpace(8);
const page = task.page('p1');
await page.goto('http://127.0.0.1:18286/?theme=light&issue=184');
await page.waitForSelector('#detail-title', { state: 'visible' });
console.log({ spaceId: task.spaceId, page: page.label, url: await page.url() });
await task.handOff();
