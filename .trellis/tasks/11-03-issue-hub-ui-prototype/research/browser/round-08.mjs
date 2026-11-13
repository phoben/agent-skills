const task = await taskSpace(7);
const page = task.page('p1');
await page.goto('http://127.0.0.1:18284/style-explorer.html');
console.log({ spaceId: task.spaceId, page: page.label, url: await page.url(), title: await page.title() });
console.log((await page.snapshot()).slice(0, 3000));
await task.handOff();
console.log({ handedOff: true, purpose: '由用户比较三个首屏并选择方向' });
