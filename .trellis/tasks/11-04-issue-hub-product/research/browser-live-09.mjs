const task = await taskSpace(8);
const page = task.page('p1');
await page.goto('http://127.0.0.1:18288/?theme=light&repo=phoben%2Fagent-skills&issue=3');
await page.waitForFunction(() => document.querySelector('iframe')?.contentDocument?.querySelector('#detail-title'), undefined, { timeout: 120000 });
console.log(await page.evaluate(() => {
  const doc = document.querySelector('iframe').contentDocument;
  return { repository:doc.querySelector('#queue-title').textContent, title:doc.querySelector('#detail-title').textContent, bodyCharacters:doc.querySelector('.doc')?.textContent.length, status:doc.querySelector('#statusbar')?.textContent.trim(), horizontalOverflow:doc.documentElement.scrollWidth>doc.documentElement.clientWidth };
}));
console.log(await page.snapshot());
