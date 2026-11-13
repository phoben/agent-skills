const task = await taskSpace(8);
const page = task.page('p2');
console.log((await task.tabs()).map(tab => ({ label: tab.label, active: tab.active, openedBy: tab.openedBy })));
console.log({ before: await page.info(), targetId: page.targetId });
await task.cdp('Target.activateTarget', { targetId: page.targetId });
console.log({ after: await page.info(), viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })) });
