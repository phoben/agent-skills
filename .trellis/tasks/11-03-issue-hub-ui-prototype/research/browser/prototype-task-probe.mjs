const task = await taskSpace(8);
const page = task.page('p1');
await page.goto(`http://127.0.0.1:18286/?run=task-probe-${Date.now()}&theme=light`);
await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
await page.click('[data-action="open-issue"][data-number="184"]');
await page.click('#task-primary');
console.log((await page.snapshot()).slice(-12500));
