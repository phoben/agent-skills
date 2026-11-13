const task = await taskSpace(8);
const page = task.page('p1');
await page.click('[data-action="repository"][data-repo="phoben/agent-skills"]', { label: '查看当前项目仓库' });
await page.waitForFunction(() => {
  const doc = document.querySelector('iframe')?.contentDocument;
  return doc?.querySelector('#queue-title')?.textContent?.includes('agent-skills') && !doc.querySelector('.initial-load') && !doc.querySelector('.skeleton-row');
}, undefined, { timeout: 120000 });
console.log(await page.snapshot());
