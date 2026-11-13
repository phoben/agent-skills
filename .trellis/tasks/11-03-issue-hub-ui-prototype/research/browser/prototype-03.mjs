const task = await taskSpace(8);
const page = task.page('p1');
console.log({ url: await page.url() });
console.log((await page.snapshot()).slice(0, 11000));
console.log(await page.evaluate(() => ({ readyState: document.readyState, text: document.body.innerText.slice(0, 5000), scripts: [...document.scripts].map(script => script.src) })));
