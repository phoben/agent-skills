const task = await taskSpace(8);
const page = task.page('p1');
await page.click('@484', { label: '重新读取仓库列表' });
await page.waitForFunction(() => {
  const doc = document.querySelector('iframe')?.contentDocument;
  return doc?.querySelector('[data-action="repository"]') && !doc.querySelector('.initial-load') && !doc.querySelector('.skeleton-row');
}, undefined, { timeout: 120000 });
console.log(await page.snapshot());
