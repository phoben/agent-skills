const task = await taskSpace(8);
const page = task.page('p1');
await page.click('loc=role:menuitem[name="编辑标题、正文与属性"]');
await page.waitForSelector('#issue-title', { state: 'visible' });
console.log((await page.snapshot()).slice(-12500));
console.log(await page.evaluate(() => ({
  assignees: [...document.querySelectorAll('#issue-assignee option')].map(option => ({ value: option.value, text: option.textContent })),
  milestones: [...document.querySelectorAll('#issue-milestone option')].map(option => ({ value: option.value, text: option.textContent })),
  labels: [...document.querySelectorAll('input[name="labels"]')].map(input => input.value),
})));
