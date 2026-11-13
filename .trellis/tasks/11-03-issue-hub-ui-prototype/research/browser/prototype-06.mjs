const task = await taskSpace(8);
const page = task.page('p1');
await page.click('#issue-more');
await page.waitForSelector('[data-action="edit-issue"]', { state: 'visible' });
console.log({ stage: '管理菜单' });
console.log((await page.snapshot()).slice(-7000));
await page.click('[data-action="edit-issue"]');
await page.waitForSelector('#issue-title', { state: 'visible' });
console.log({ stage: '实际编辑表单' });
console.log((await page.snapshot()).slice(-10000));
console.log(await page.evaluate(() => ({
  assignees: [...document.querySelectorAll('#issue-assignee option')].map(option => ({ value: option.value, text: option.textContent })),
  milestones: [...document.querySelectorAll('#issue-milestone option')].map(option => ({ value: option.value, text: option.textContent })),
  labels: [...document.querySelectorAll('input[name="labels"]')].map(input => input.value),
})));
