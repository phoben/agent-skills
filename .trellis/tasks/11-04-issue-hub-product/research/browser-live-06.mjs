const task = await taskSpace(8);
const page = task.page('p1');
// 使用已经观察到的实际仓库属性，避免前台同步替换元素后旧ref失效。
console.log(await page.evaluate(() => [...(document.querySelector('iframe')?.contentDocument?.querySelectorAll('[data-action="repository"]') || [])].map(node => ({repo:node.getAttribute('data-repo'),label:node.textContent.trim()}))));
console.log(await page.snapshot());
