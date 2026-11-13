const task = await taskSpace(8);
const page = task.page('p1');
console.log(await page.evaluate(() => ({ active: { id: document.activeElement?.id, tag: document.activeElement?.tagName, text: document.activeElement?.textContent.slice(0, 100) }, rowExists: Boolean(document.querySelector('#issue-row-183')), detailHidden: document.querySelector('#detail').hidden })));
