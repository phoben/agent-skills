// 图标内容由调用方读取实际插件资产，服务与主入口共享同一矢量源。
export function createIssueHubIcons(svg) {
  if (typeof svg !== 'string' || !/<svg(?:\s|>)/.test(svg)) throw new TypeError('Issue Hub 图标必须是有效的 SVG 源文本。');
  const src = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  return ['light', 'dark'].map(theme => ({ src, mimeType: 'image/svg+xml', sizes: ['any'], theme }));
}
