import { applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

// 只接收SDK语义变量，避免宿主扩展字段覆盖页面自己的中性主色或布局变量。
const hostVariable = /^--(?:color-(?:background|text|border|ring)-[a-z-]+|font-[a-z0-9-]+|border-(?:radius|width)-[a-z-]+|shadow-[a-z-]+)$/;
const validTheme = value => value === 'light' || value === 'dark';

export function createThemeController({ root = document.documentElement, mediaQuery = window.matchMedia('(prefers-color-scheme: dark)') } = {}) {
  let hostTheme = null, renderedTheme = null;
  const applied = new Set();
  function clearHostVariables() {
    for (const key of applied) root.style.removeProperty(key);
    applied.clear();
  }
  function render() {
    const theme = hostTheme || (mediaQuery.matches ? 'dark' : 'light');
    // 宿主未指定主题时，系统变化也不能留下上一亮暗模式的宿主颜色。
    if (!hostTheme && renderedTheme && theme !== renderedTheme) clearHostVariables();
    root.dataset.theme = theme; root.style.setProperty('color-scheme', theme); renderedTheme = theme;
  }
  function apply(context = {}) {
    if (validTheme(context.theme)) {
      if (context.theme !== hostTheme) clearHostVariables();
      hostTheme = context.theme;
    }
    const variables = context.styles?.variables;
    if (variables && typeof variables === 'object' && !Array.isArray(variables)) {
      if (Object.keys(variables).length === 0) clearHostVariables();
      const safe = {};
      for (const [key, value] of Object.entries(variables)) {
        if (!hostVariable.test(key)) continue;
        if (value == null) { root.style.removeProperty(key); applied.delete(key); }
        else if (typeof value === 'string' && value.length <= 2000) { safe[key] = value; applied.add(key); }
      }
      applyHostStyleVariables(safe, root);
    }
    render();
  }
  mediaQuery.addEventListener('change', render);
  render();
  return {
    apply,
    reset() { hostTheme = null; clearHostVariables(); render(); },
    dispose() { mediaQuery.removeEventListener('change', render); },
  };
}
