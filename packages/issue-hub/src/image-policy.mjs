// 正文图片只解析受限语法；下载域与UI使用同一份白名单。
const uuid = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const assetPath = new RegExp(`^/user-attachments/assets/${uuid}$`, 'i');
const imageHosts = new Set(['user-images.githubusercontent.com', 'private-user-images.githubusercontent.com']);
export const IMAGE_MIME_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TAG_SOURCE = '<img\\b(?:[^>"\\\']|"[^"\\n]*"|\\\'[^\\\'\\n]*\\\')*>';

export function normalizeImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) return null;
    if (url.hostname === 'github.com' ? !assetPath.test(url.pathname) : !imageHosts.has(url.hostname) || !/^\/[^/]+\/.+/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

// 认证预览只走 github.com；旧图片域保留链接，避免跨主机复用凭据。
export function canPreviewImageUrl(value) {
  const normalized = normalizeImageUrl(value);
  return normalized !== null && new URL(normalized).hostname === 'github.com';
}

function entityText(value) {
  return String(value).replace(/&(?:amp|quot|apos|lt|gt|#(?:x[0-9a-f]+|\d+));/gi, token => {
    const name = token.slice(1, -1).toLowerCase();
    const known = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
    if (known[name]) return known[name];
    const number = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isInteger(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : token;
  });
}

export function parseImageTag(token) {
  if (!new RegExp(`^${IMAGE_TAG_SOURCE}$`, 'i').test(token)) return null;
  const attributes = new Map();
  for (const match of token.slice(4, -1).matchAll(/(?:^|\s+)([a-z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi)) {
    const name = match[1].toLowerCase();
    if (!['src', 'alt', 'width', 'height'].includes(name) || match[2] === undefined && match[3] === undefined && match[4] === undefined) continue;
    if (attributes.has(name)) return null;
    attributes.set(name, entityText(match[2] ?? match[3] ?? match[4]));
  }
  const url = normalizeImageUrl(attributes.get('src'));
  if (!url) return null;
  const result = { url, alt: (attributes.get('alt') || 'Issue 图片').replace(/\s+/g, ' ').slice(0, 300) };
  for (const name of ['width', 'height']) {
    const value = attributes.get(name);
    if (/^\d{1,5}$/.test(value || '') && Number(value) > 0 && Number(value) <= 10000) result[name] = Number(value);
  }
  return result;
}

export function parseMarkdownImage(token) {
  const match = /^!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)$/i.exec(token);
  const url = match && normalizeImageUrl(match[2]);
  return url ? { url, alt: entityText(match[1] || 'Issue 图片').replace(/\s+/g, ' ').slice(0, 300) } : null;
}

export function imageReferences(text) {
  const references = new Map();
  const pattern = new RegExp('`[^`\\n]*`|' + IMAGE_TAG_SOURCE + '|!\\[[^\\]\\n]*\\]\\(https?:\\/\\/[^\\s)]+\\)', 'gi');
  for (const [index, part] of String(text || '').split('```').entries()) {
    if (index % 2) continue;
    for (const match of part.matchAll(pattern)) {
      if (match[0].startsWith('`')) continue;
      const image = match[0][0] === '<' ? parseImageTag(match[0]) : parseMarkdownImage(match[0]);
      if (image && !references.has(image.url)) references.set(image.url, image);
    }
  }
  return [...references.values()];
}
