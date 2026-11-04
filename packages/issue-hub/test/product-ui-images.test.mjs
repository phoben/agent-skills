import test from 'node:test';
import assert from 'node:assert/strict';
import { bodyMarkup } from '../ui/ui.mjs';
import { normalizeImageUrl, parseImageTag, imageReferences } from '../src/image-policy.mjs';
import { createImageController, rasterDataUrl } from '../ui/images.mjs';
import { LiveStore, StoreError } from '../ui/store.mjs';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';

const url = 'https://github.com/user-attachments/assets/11111111-1111-4111-8111-111111111111';

test('GitHub HTML截图生成受限图片容器，不把img标签显示为正文', () => {
  const output = bodyMarkup(`<img width="1957" height="811" alt="Image" src="${url}" />`);
  assert.match(output, /<img\b/);
  assert.match(output, /data-image-source=/);
  assert.doesNotMatch(output, /&lt;img/);
  assert.doesNotMatch(output, /<img[^>]+src="https:/);
});

test('Markdown图片含空alt也生成图片容器，代码中的示例保持文字', () => {
  assert.match(bodyMarkup(`![](${url})`), /data-image-source=/);
  const literal = bodyMarkup(`\`<img src="${url}">\`\n\n\`\`\`html\n<img src="${url}">\n\`\`\``);
  assert.doesNotMatch(literal, /data-image-source=/);
});

test('图片策略只接受固定Github HTTPS图片路径，拒绝任意域及附带凭据参数', () => {
  assert.equal(normalizeImageUrl(url), url);
  assert.ok(normalizeImageUrl('https://user-images.githubusercontent.com/7/example.png'));
  for (const source of ['javascript:alert(1)', 'data:image/png;base64,AA==', 'https://github.com.evil.test/user-attachments/assets/11111111-1111-4111-8111-111111111111', url + '?token=secret', url + '#fragment', url.replace('github.com', 'user:pass@github.com'), url.replace('github.com', 'github.com:444'), 'https://github.com/login']) assert.equal(normalizeImageUrl(source), null);
});

test('HTML图片固定属性重建，事件和任意style不透传，alt安全转义', () => {
  const markup = bodyMarkup(`<IMG SRC='${url}' alt='&quot;&gt;&lt;script&gt;' width='1957' height='811' onerror='alert(1)' style='position:fixed' srcset='https://evil.test/a'>`);
  assert.match(markup, /width="1957" height="811"/); assert.match(markup, /&quot;&gt;&lt;script&gt;/);
  assert.doesNotMatch(markup, /onerror=|position:fixed|srcset=|<script>/);
  assert.equal(parseImageTag(`<img data-src="${url}">`), null);
  assert.equal(parseImageTag(`<img title=' src="${url}"'>`), null);
  assert.equal(parseImageTag(`<img src="${url}" src="${url}">`), null);
  assert.equal(parseImageTag(`<img src="${url}" width="999999999" height="-1">`).width, undefined);
});

test('成员图片提取和显示一致，代码示例不算图片，多行HTML可显示', () => {
  const body = `说明\n<img\n src="${url}"\n alt="截图">\n\n![重复](${url})\n\n\`![代码](${url.replace('11111111', '22222222')})\`\n\n\`\`\`\n<img src="${url.replace('11111111', '33333333')}">\n\`\`\``;
  assert.deepEqual(imageReferences(body).map(item => item.url), [url]);
  assert.match(bodyMarkup(body), /data-image-source=/);
  assert.doesNotMatch(bodyMarkup('![外部](https://example.test/p.png)'), /<img/);
  assert.match(bodyMarkup('![外部](https://example.test/p.png)'), /data-action="open-link"/);
});

test('旧GitHub图片域保留原图链接，不自动发送认证预览请求', async () => {
  const legacy = 'https://user-images.githubusercontent.com/7/example.png';
  for (const body of [`![截图](${legacy})`, `<img alt="截图" src="${legacy}">`]) {
    const output = bodyMarkup(body); assert.match(output, /data-action="open-link"/); assert.doesNotMatch(output, /data-image-source=|<img\b/);
  }
  let calls = 0;
  const controller = createImageController({ Observer: null, getContext: () => ({ identity: 42, repositoryKey: 'a', number: 191 }), loadImage() { calls++; } });
  controller.scan({ querySelectorAll: () => [imageNode(legacy)] }); await tick(); assert.equal(calls, 0); controller.close();
});

test('组件媒体桥只在前端合并私有_meta，原structuredContent保持无像素', async () => {
  const source = await readFile(new URL('../ui/app.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('async function call(group, action, payload)'), end = source.indexOf('const store =', start);
  const response = { structuredContent: { schemaVersion: 1, identity: 42, data: { mimeType: 'image/png', byteLength: 1 } }, content: [{ type: 'text', text: '图片已读取' }], _meta: { 'issue-hub/image': { mimeType: 'image/png', byteLength: 1, base64: 'AA==' } } };
  let request;
  const context = createContext({ StoreError, app: { async callServerTool(value) { request = value; return response; } } });
  new Script(source.slice(start, end) + '\nglobalThis.run = call;').runInContext(context);
  const result = await context.run('image', 'read', { url });
  assert.equal(request.name, 'issue-hub-image'); assert.equal(request.arguments.url, url); assert.equal(request.arguments.action, undefined);
  assert.equal(result.data.image.base64, 'AA=='); assert.equal(response.structuredContent.data.image, undefined);
});

const repo = { key: 'a'.repeat(20), fullName: 'team/repo', permissions: { read: true } };
const envelope = data => ({ schemaVersion: 1, identity: 42, networkChecked: true, sampledAt: '2026-11-05T01:00:00Z', data });
test('媒体成功失败均不改变全局联网或成功时间，也不持久化图片', async () => {
  let failure = false, payload;
  const store = new LiveStore(async (group, action, value) => { payload = value; if (action === 'bootstrap') return envelope({ account: { id: 42 }, repositories: [repo] }); if (failure) throw new StoreError('NETWORK_UNAVAILABLE', '媒体无法读'); return { ...envelope({ image: { base64: 'AA==' } }), offline: true }; });
  await store.load(); store.online = true; store.data.lastSuccess = '已有时间';
  await store.loadImage(repo.fullName, 191, url, 7); assert.equal(payload.expectedIdentity, '42'); assert.equal(payload.commentId, 7);
  assert.equal(store.online, true); assert.equal(store.data.lastSuccess, '已有时间'); assert.doesNotMatch(JSON.stringify(store.data), /AA==/);
  failure = true; await assert.rejects(store.loadImage(repo.fullName, 191, url), { code: 'NETWORK_UNAVAILABLE' }); assert.equal(store.online, true);
});

test('媒体发现账号或仓库失权仍撤销旧私有视图', async () => {
  for (const code of ['AUTH_REQUIRED', 'PERMISSION_DENIED']) {
    let lost = 0;
    const store = new LiveStore(async (_group, action) => { if (action === 'bootstrap') return envelope({ account: { id: 42 }, repositories: [repo] }); throw new StoreError(code, '权限已变化'); }, { onIdentityChange() { lost++; }, onRepositoryAccessLost() { lost++; } });
    await store.load(); store.installIssue(repo.fullName, { number: 191, body: '私有正文' });
    await assert.rejects(store.loadImage(repo.fullName, 191, url), { code }); assert.equal(lost, 1); assert.equal(store.issue(repo.fullName, 191), undefined);
  }
});

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function imageNode(source = url, commentId) {
  const image = { hidden: true, removeAttribute(name) { delete this[name]; }, getAttribute() { return null; } }, label = { textContent: '', hidden: false }, retry = { hidden: true };
  return { dataset: { imageSource: source, imageState: 'waiting' }, isConnected: true, image, label, retry, querySelector(selector) { return selector === 'img' ? image : selector === '.image-status' ? label : retry; }, closest() { return commentId ? { dataset: { commentId: String(commentId) } } : null; } };
}
const pixels = { image: { mimeType: 'image/png', byteLength: 1, base64: 'AA==' } };
test('图片懒加载且最多两个请求，失败局部回退可重试', async () => {
  let observer;
  class Observer { constructor(callback) { this.callback = callback; observer = this; } observe() {} unobserve() {} disconnect() {} }
  const nodes = [imageNode(url), imageNode(url.replace('11111111', '22222222')), imageNode(url.replace('11111111', '33333333'))], requests = [];
  const controller = createImageController({ Observer, getContext: () => ({ identity: 42, repositoryKey: repo.key, number: 191 }), loadImage() { const value = deferred(); requests.push(value); return value.promise; } });
  controller.scan({ querySelectorAll: () => nodes }); await tick(); assert.equal(requests.length, 0);
  observer.callback(nodes.map(target => ({ target, isIntersecting: true }))); await tick(); assert.equal(requests.length, 2);
  requests[0].reject(new StoreError('IMAGE_UNAVAILABLE', '拒绝')); await tick(); assert.equal(requests.length, 3); assert.equal(nodes[0].dataset.imageState, 'error'); assert.equal(nodes[0].retry.hidden, false);
  requests[1].resolve(pixels); requests[2].resolve(pixels); await tick(); nodes[1].image.onload(); assert.equal(nodes[1].dataset.imageState, 'loaded');
  controller.retry(nodes[0]); await tick(); assert.equal(requests.length, 4); requests[3].resolve(pixels); await tick(); assert.match(nodes[0].image.src, /^data:image\/png;base64,/); controller.close();
});

test('同一图片去重，评论归属分开；切账号清像素且旧结果不能回填', async () => {
  let context = { identity: 42, repositoryKey: repo.key, number: 191, generation: 0 }, requests = [];
  const a = imageNode(), b = imageNode(), comment = imageNode(url, 8);
  const controller = createImageController({ Observer: null, getContext: () => context, loadImage(_scope, payload) { const value = deferred(); requests.push({ ...value, payload }); return value.promise; } });
  controller.scan({ querySelectorAll: () => [a, b, comment] }); await tick(); assert.equal(requests.length, 2); assert.equal(requests[1].payload.commentId, 8);
  requests[0].resolve(pixels); await tick(); a.image.onload(); b.image.onload(); assert.equal(a.image.src, b.image.src);
  context = { ...context, identity: 84, generation: 1 }; controller.scan({ querySelectorAll: () => [] }); assert.equal(a.image.src, undefined); assert.equal(a.image.hidden, true);
  requests[1].resolve(pixels); await tick(); assert.equal(comment.image.src, undefined); controller.close();
});

test('图片排队后微任务尚未发出时切账号，不以新身份继续旧图片请求', async () => {
  let controller; const calls = [];
  const data = id => ({ account: { id }, repositories: [repo] });
  const store = new LiveStore(async (group, action, payload) => {
    if (action === 'bootstrap') return envelope(data(42));
    calls.push({ group, payload }); return { ...envelope(pixels), identity: 84 };
  }, { onIdentityChange() { controller?.clear(); } });
  await store.load();
  controller = createImageController({ Observer: null, getContext: () => ({ identity: store.identity, repositoryKey: repo.key, repo: repo.fullName, number: 191, generation: store.generation }), loadImage: (scope, payload) => store.loadImage(scope.repo, scope.number, payload.url) });
  const node = imageNode(); controller.scan({ querySelectorAll: () => [node] });
  store.clearIdentity(84); store.applyBootstrap(data(84));
  await tick();
  try { assert.equal(calls.length, 0); assert.equal(node.image.src, undefined); }
  finally { controller.close(); }
});

test('切换范围后旧在途请求仍占并发槽，合计不超过两个且不回填旧图', async () => {
  let context = { identity: 42, repositoryKey: repo.key, number: 191, generation: 0 }, active = 0, peak = 0;
  const requests = [], oldNodes = [imageNode(), imageNode(url.replace('11111111', '22222222'))], newNodes = [imageNode(), imageNode(url.replace('11111111', '22222222'))];
  const controller = createImageController({ Observer: null, getContext: () => context, loadImage(scope) {
    const pending = deferred(); active++; peak = Math.max(peak, active); requests.push({ ...pending, scope });
    return pending.promise.finally(() => { active--; });
  } });
  controller.scan({ querySelectorAll: () => oldNodes }); await tick(); assert.equal(requests.length, 2);
  context = { ...context, identity: 84, generation: 1 }; controller.scan({ querySelectorAll: () => newNodes }); await tick(); assert.equal(requests.length, 2);
  requests[0].resolve(pixels); await tick(); assert.equal(requests.length, 3); assert.equal(requests[2].scope.identity, 84);
  requests[1].resolve(pixels); await tick(); assert.equal(requests.length, 4); assert.equal(peak, 2);
  assert.ok(oldNodes.every(node => node.image.src === undefined));
  requests[2].resolve(pixels); requests[3].resolve(pixels); await tick(); assert.ok(newNodes.every(node => node.image.src?.startsWith('data:'))); controller.close();
});

test('媒体dataURL只由有界raster数据构造，拒绝SVG和大小不符', () => {
  assert.equal(rasterDataUrl(pixels.image), 'data:image/png;base64,AA==');
  for (const image of [{ ...pixels.image, mimeType: 'image/svg+xml' }, { ...pixels.image, base64: '<script>' }, { ...pixels.image, byteLength: 99 }]) assert.throws(() => rasterDataUrl(image));
});

test('同范围重绘复用已解码缓存；范围归一后原节点重新读取而不是留下空图', async () => {
  let context = { identity: 42, repositoryKey: repo.key, number: 191, generation: 0 }, calls = 0;
  const controller = createImageController({ Observer: null, getContext: () => context, async loadImage() { calls++; return pixels; } });
  const first = imageNode(); controller.scan({ querySelectorAll: () => [first] }); await tick(); first.image.onload();
  first.isConnected = false;
  const next = imageNode(); controller.scan({ querySelectorAll: () => [next] }); await tick(); next.image.onload(); assert.equal(calls, 1);
  context = { ...context, repositoryKey: 'b'.repeat(20) }; controller.scan({ querySelectorAll: () => [next] }); await tick(); assert.equal(calls, 2); assert.match(next.image.src, /^data:/); controller.close();
});

test('切Issue或节点已脱离时，迟到图片不能渲染或进入下个范围缓存', async () => {
  let context = { identity: 42, repositoryKey: repo.key, number: 191 }, call = deferred();
  const node = imageNode();
  const controller = createImageController({ Observer: null, getContext: () => context, loadImage: () => call.promise });
  controller.scan({ querySelectorAll: () => [node] }); await tick(); context = { ...context, number: 192 }; node.isConnected = false; call.resolve(pixels); await tick(); assert.equal(node.image.src, undefined); controller.close();
});

test('已拒绝仓库的在途媒体即使成功也不能重新注入私有像素', async () => {
  const pending = deferred();
  const store = new LiveStore(async (_group, action) => action === 'bootstrap' ? envelope({ account: { id: 42 }, repositories: [repo] }) : pending.promise);
  await store.load(); const reading = store.loadImage(repo.fullName, 191, url); await tick(); store.invalidateRepository(repo.fullName);
  pending.resolve(envelope({ image: pixels.image })); await assert.rejects(reading, { code: 'stale' });
});
