// MCP入口使用内联矢量图标，避免侧栏依赖远程图片。
const svg = (background, stroke) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><rect x="3" y="3" width="26" height="26" rx="7" fill="${background}"/><path d="M9 22v-6m7 6V10m7 12v-9" stroke="${stroke}" stroke-width="2.8" stroke-linecap="round"/></svg>`;
export const usageIcons = [
  {theme:'light',src:'data:image/svg+xml;base64,'+Buffer.from(svg('#f2f4f5','#344451')).toString('base64'),mimeType:'image/svg+xml',sizes:['any']},
  {theme:'dark',src:'data:image/svg+xml;base64,'+Buffer.from(svg('#29323b','#e2e9ee')).toString('base64'),mimeType:'image/svg+xml',sizes:['any']},
];
