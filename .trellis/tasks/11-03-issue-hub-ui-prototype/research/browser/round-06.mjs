const task = await taskSpace(7);
const github = task.page('p1');
console.log({ githubUrl: await github.url() });
console.log((await github.snapshot()).slice(0, 12500));
try {
  const image = await github.cdp('Page.captureScreenshot', { format: 'png', fromSurface: false, captureBeyondViewport: false });
  const fs = await import('node:fs/promises');
  const path = 'E:/Develop/agent-skills/.trellis/tasks/11-03-github-issue-plugin/ui/evidence/references/github-detail-viewport.png';
  await fs.writeFile(path, Buffer.from(image.data, 'base64'));
  console.log({ screenshot: path });
} catch (error) { console.log({ screenshotError: error.message, approach: 'viewport capture after two wrapper timeouts' }); }
const linear = task.page('p2');
await linear.click('loc=role:button[name="Issues and cycles"]');
console.log((await linear.snapshot()).slice(0, 14000));
