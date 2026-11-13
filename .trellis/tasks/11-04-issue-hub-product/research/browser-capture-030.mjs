const task = await taskSpace(8), page = task.page('p1');
await page.click('#navigation [data-action="diagnostics"]', { label: '查看最终连接检查结果' });
await page.waitForFunction(() => {
  const d = document.querySelector('iframe')?.contentDocument;
  return d?.querySelector('#modal-title')?.textContent === '连接检查' && d.querySelectorAll('[data-check-status]').length === 9;
}, undefined, { timeout: 60000 });
console.log(await page.snapshot());
try {
  console.log({ screenshot: await page.screenshot({ path: 'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/diagnostics-030.png' }) });
} catch (error) {
  console.log({ screenshotUnavailable: error.message });
}
