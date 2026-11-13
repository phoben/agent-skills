const task = await taskSpace(8);
const page = task.page('p1');
console.log({ url: await page.url(), info: await page.info() });
console.log(await page.evaluate(() => {
  const element = document.querySelector('#comment-body');
  const rect = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, top: r.top, bottom: r.bottom }; };
  const ancestors = [];
  for (let node = element; node && ancestors.length < 7; node = node.parentElement) ancestors.push({ tag: node.tagName, id: node.id, className: node.className, overflowY: getComputedStyle(node).overflowY, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, scrollTop: node.scrollTop, rect: rect(node) });
  return { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, ancestors, focused: document.activeElement?.id };
}));
console.log((await page.snapshot()).slice(-12000));
