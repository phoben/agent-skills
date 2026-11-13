const task = await taskSpace(8);
const page = task.page('p1');
const assert = await import('node:assert/strict');
const fs = await import('node:fs/promises');
const results = [];
let failure = null;
try {
  await page.goto(`http://127.0.0.1:18286/?run=keyboard-${Date.now()}&theme=light`);
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  await page.focus('[data-action="open-issue"][data-number="184"]');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.number), '183');
  assert.equal(await page.evaluate(() => document.querySelector('#detail').hidden), true);
  await page.keyboard.press('Enter');
  await page.waitForSelector('#task-primary', { state: 'visible' });
  assert.equal(await page.evaluate(() => document.querySelector('#detail-title').textContent), '多个工作区时，已选路径没有被记住');
  await page.click('#close-detail');
  await page.waitForFunction(() => document.activeElement?.id === 'issue-row-183', undefined, { timeout: 10000 });
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'issue-row-183');
  results.push({ name: '方向键移焦、Enter打开、返回原行', passed: true });

  await page.cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.goto(`http://127.0.0.1:18286/?run=reduced-${Date.now()}&theme=light`);
  await page.waitForSelector('[data-action="open-issue"][data-number="184"]', { state: 'visible' });
  const reduced = await page.evaluate(() => ({
    preference: matchMedia('(prefers-reduced-motion: reduce)').matches,
    queueAnimation: getComputedStyle(document.querySelector('#queue')).animationName,
    navigationAnimation: getComputedStyle(document.querySelector('#navigation')).animationName,
    opacity: getComputedStyle(document.querySelector('#queue')).opacity,
  }));
  assert.equal(reduced.preference, true);
  assert.equal(reduced.queueAnimation, 'none');
  assert.equal(reduced.navigationAnimation, 'none');
  assert.equal(reduced.opacity, '1');
  results.push({ name: '减少动态效果立即可读', passed: true, measured: reduced });
  console.log(results);
} catch (error) { failure = { message: error.message, url: await page.url() }; console.log({ failure }); throw error; }
finally {
  await page.cdp('Emulation.setEmulatedMedia', { features: [] });
  await fs.writeFile('E:/Develop/agent-skills/.trellis/tasks/11-03-issue-hub-ui-prototype/research/keyboard-browser-report.json', JSON.stringify({ checkedAt: new Date().toISOString(), prototypeOnly: true, browserSpaceId: task.spaceId, results, failure }, null, 2));
}
