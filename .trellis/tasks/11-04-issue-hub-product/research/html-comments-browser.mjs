import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const task = await taskSpace('issue-hub-html-comments-1105');
const page = task.page('p1');
await page.goto('http://127.0.0.1:18302/?theme=dark&repo=phoben%2Faoy-erp&issue=191');
await page.waitForFunction(() => {
  const doc = document.querySelector('iframe')?.contentDocument;
  return doc?.querySelector('[data-action="open-issue"][data-number="191"]')?.getAttribute('aria-current') === 'true'
    && doc.querySelector('#discussion-content .comment-body')?.textContent.trim();
}, undefined, { timeout: 60000 });
const result = await page.evaluate(() => {
  const doc = document.querySelector('iframe').contentDocument;
  const comments = [...doc.querySelectorAll('#discussion-content .comment-body')];
  return {
    visibleComments: comments.length,
    hasVisibleProse: comments.some(node => node.textContent.trim().length > 0),
    markersVisible: comments.some(node => /issue-ai-status|issue-ai:v2/.test(node.textContent)),
    markersInMarkup: comments.some(node => /issue-ai-status|issue-ai:v2/.test(node.innerHTML)),
  };
});
assert.ok(result.hasVisibleProse);
assert.equal(result.markersVisible, false);
assert.equal(result.markersInMarkup, false);
await writeFile(new URL('./html-comments-browser.json', import.meta.url), JSON.stringify({ spaceId: task.spaceId, issue: 191, ...result, readOnly: true }, null, 2) + '\n');
console.log({ spaceId: task.spaceId, ...result });
await task.finish({ keep: [] });
