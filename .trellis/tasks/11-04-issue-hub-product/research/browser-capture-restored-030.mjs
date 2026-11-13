const task = await taskSpace(8), page = task.page('p1');
const windowInfo = await task.cdp('Browser.getWindowForTarget', { targetId: page.targetId });
if (windowInfo.bounds?.windowState === 'minimized') {
  await task.cdp('Browser.setWindowBounds', { windowId: windowInfo.windowId, bounds: { windowState: 'normal' } });
}
console.log(await page.evaluate(() => {
  const d = document.querySelector('iframe').contentDocument;
  return { title: d.querySelector('#modal-title')?.textContent, checks: [...d.querySelectorAll('[data-check-status]')].map(el => el.dataset.checkStatus), viewport: { width: innerWidth, height: innerHeight } };
}));
console.log({ screenshot: await page.screenshot({ path: 'E:/Develop/agent-skills/.trellis/tasks/11-04-issue-hub-product/research/diagnostics-030.png' }) });
