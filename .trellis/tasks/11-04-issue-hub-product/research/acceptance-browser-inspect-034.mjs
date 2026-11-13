const task = await taskSpace(21), page = task.page('p1');
console.log(await page.evaluate(() => {
  const d = document.querySelector('iframe')?.contentDocument;
  return { iframe: Boolean(d), title: d?.title, queue: d?.querySelector('#queue-title')?.textContent, initial: [...(d?.querySelectorAll('.initial-load') || [])].map(e => e.textContent), errors: [...(d?.querySelectorAll('[role="alert"],.load-error,.global-message') || [])].map(e => e.textContent), selected: d?.querySelector('.issue-row.selected')?.dataset.number, sourceText: d?.querySelector('.related-links')?.textContent, repositoryCount: d?.querySelectorAll('[data-action="select-repo"]').length, parentText: document.body.innerText.slice(0, 300) };
}));
