const task = await taskSpace(8), page = task.page('p1');
await page.click('#overlay-root .modal-header [data-action="close-overlay"]', { label: '关闭只读连接检查' });
console.log(await page.evaluate(() => {
  const d = document.querySelector('iframe').contentDocument;
  return { overlayClosed: !d.querySelector('#modal-title'), selected: d.querySelector('.issue-row.selected')?.dataset.number, unpublishedTestDraft: Boolean(d.querySelector('#comment-body')?.value) };
}));
await task.handOff();
