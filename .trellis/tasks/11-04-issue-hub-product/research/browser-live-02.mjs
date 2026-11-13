const task = await taskSpace(8);
const page = task.page('p1');
await page.waitForFunction(() => {
  const doc = document.querySelector('iframe')?.contentDocument;
  return doc && !doc.querySelector('.initial-load') && !doc.querySelector('.skeleton-row');
}, undefined, { timeout: 120000 });
console.log(await page.snapshot());
