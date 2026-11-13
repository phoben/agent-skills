const task = await taskSpace(7);
const page = task.page('p1');
help('page.screenshot');
console.log(await page.info());
console.log((await page.snapshot()).slice(0, 3500));
