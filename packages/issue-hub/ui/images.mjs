import { normalizeImageUrl, canPreviewImageUrl, IMAGE_MIME_TYPES, IMAGE_MAX_BYTES } from '../src/image-policy.mjs';

const rasterTypes = new Set(IMAGE_MIME_TYPES);
const scopeKey = value => value && value.identity != null && value.repositoryKey && value.number ? JSON.stringify([String(value.identity), value.repositoryKey, Number(value.number), value.generation]) : null;

export function rasterDataUrl(value) {
  if (!value || !rasterTypes.has(value.mimeType) || !Number.isInteger(value.byteLength) || value.byteLength <= 0 || value.byteLength > IMAGE_MAX_BYTES || typeof value.base64 !== 'string' || value.base64.length > 4 * Math.ceil(IMAGE_MAX_BYTES / 3) || value.base64.length % 4 || !/^[a-z0-9+/]+={0,2}$/i.test(value.base64)) throw new Error('图片预览数据不可用。');
  const decodedLength = value.base64.length * 3 / 4 - (value.base64.endsWith('==') ? 2 : value.base64.endsWith('=') ? 1 : 0);
  if (decodedLength !== value.byteLength) throw new Error('图片预览大小不匹配。');
  return `data:${value.mimeType};base64,${value.base64}`;
}

export function createImageController({ getContext, loadImage, Observer = globalThis.IntersectionObserver, maxConcurrent = 2, maxEntries = 12, maxCacheChars = 16 * 1024 * 1024 } = {}) {
  let generation = 0, scope = null, closed = false, active = 0, seen = new WeakSet(), queue = [], cacheChars = 0;
  const nodes = new Set(), pending = new Map(), cache = new Map();
  const observer = Observer ? new Observer(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); enqueue(entry.target); }
  }, { rootMargin: '300px' }) : null;
  function context() { try { return getContext(); } catch { return null; } }
  function valid(info) { return !closed && info.generation === generation && scopeKey(context()) === info.scope && info.node.isConnected !== false && info.node.dataset.imageSource === info.url; }
  function status(node, state, text) {
    node.dataset.imageState = state;
    const label = node.querySelector('.image-status'), retry = node.querySelector('.image-retry');
    if (label) { label.textContent = text; label.hidden = state === 'loaded'; }
    if (retry) retry.hidden = state !== 'error';
  }
  function removeCache(key) { const old = cache.get(key); if (old) { cacheChars -= old.length; cache.delete(key); } }
  function remember(key, value) {
    removeCache(key); if (value.length > maxCacheChars) return;
    cache.set(key, value); cacheChars += value.length;
    while (cache.size > maxEntries || cacheChars > maxCacheChars) removeCache(cache.keys().next().value);
  }
  function show(info, value) {
    if (!valid(info)) return;
    const image = info.node.querySelector('img'); if (!image) return;
    image.onload = () => { if (valid(info)) { status(info.node, 'loaded', ''); remember(info.key, value); } };
    image.onerror = () => { if (valid(info)) { image.hidden = true; image.removeAttribute('src'); removeCache(info.key); status(info.node, 'error', '图片加载失败，可重试或查看原图。'); } };
    image.src = value; image.hidden = false;
  }
  function enqueue(node, force = false) {
    const current = context(), keyScope = scopeKey(current), url = normalizeImageUrl(node.dataset.imageSource);
    if (!keyScope || keyScope !== scope || !canPreviewImageUrl(url) || node.isConnected === false || !force && node.dataset.imageState !== 'waiting') return;
    const rawComment = node.closest?.('[data-comment-id]')?.dataset.commentId;
    const commentId = /^\d+$/.test(rawComment || '') && Number.isSafeInteger(Number(rawComment)) && Number(rawComment) > 0 ? Number(rawComment) : undefined;
    const key = JSON.stringify([keyScope, url, commentId || null]), info = { node, url, commentId, key, scope: keyScope, generation };
    if (force) removeCache(key);
    status(node, 'loading', '正在读取图片…');
    if (!force && cache.has(key)) { show(info, cache.get(key)); return; }
    const existing = pending.get(key);
    if (existing) { existing.infos.add(info); return; }
    const entry = { key, infos: new Set([info]), context: { ...current }, url, commentId, generation };
    pending.set(key, entry); queue.push(entry); pump();
  }
  function pump() {
    while (!closed && active < maxConcurrent && queue.length) {
      const entry = queue.shift();
      if (entry.generation !== generation || ![...entry.infos].some(valid)) { if (pending.get(entry.key) === entry) pending.delete(entry.key); continue; }
      active++;
      Promise.resolve().then(() => {
        // 排队和实际派发之间也可能切换账号或详情，不能借新身份读取旧范围。
        if (entry.generation !== generation || ![...entry.infos].some(valid)) return null;
        return loadImage(entry.context, { url: entry.url, ...(entry.commentId ? { commentId: entry.commentId } : {}) });
      }).then(result => {
        if (entry.generation !== generation || ![...entry.infos].some(valid)) return;
        const value = rasterDataUrl(result.image);
        for (const info of entry.infos) show(info, value);
      }).catch(error => {
        for (const info of entry.infos) if (valid(info)) status(info.node, 'error', error?.code === 'IMAGE_TOO_LARGE' ? '图片超过预览大小，请查看原图。' : '图片读取未完成，可重试或查看原图。');
      }).finally(() => { active--; if (pending.get(entry.key) === entry) pending.delete(entry.key); pump(); });
    }
  }
  function clear() {
    generation++; scope = null; observer?.disconnect(); queue = []; pending.clear(); cache.clear(); cacheChars = 0; seen = new WeakSet();
    for (const node of nodes) { const image = node.querySelector('img'); if (image) { image.onload = null; image.onerror = null; image.hidden = true; image.removeAttribute('src'); } status(node, 'waiting', '正在读取图片…'); }
    nodes.clear();
  }
  function scan(root) {
    if (closed) return;
    const next = scopeKey(context());
    if (next !== scope) { clear(); scope = next; }
    if (!scope || !root) return;
    for (const node of [...nodes]) if (node.isConnected === false) { nodes.delete(node); observer?.unobserve(node); }
    for (const node of root.querySelectorAll('[data-image-source]')) {
      if (seen.has(node)) continue;
      seen.add(node); nodes.add(node);
      const image = node.querySelector('img'), width = Number(image?.getAttribute?.('width')), height = Number(image?.getAttribute?.('height'));
      if (width > 0 && height > 0 && width / height >= 0.1 && width / height <= 10) node.style?.setProperty('--image-ratio', `${width}/${height}`);
      observer ? observer.observe(node) : enqueue(node);
    }
  }
  return { scan, clear, retry(node) { if (node && nodes.has(node)) enqueue(node, true); }, close() { clear(); closed = true; } };
}
