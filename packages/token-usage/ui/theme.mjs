import { applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';

export function createThemeController({ root = document.documentElement, mediaQuery = window.matchMedia('(prefers-color-scheme: dark)') } = {}) {
  let hostTheme = null;
  let applied = [];
  const validTheme = value => value === 'light' || value === 'dark';
  function render() {
    const theme = hostTheme || (mediaQuery.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    root.style.setProperty('color-scheme', theme);
  }
  function clearHostVariables() { for (const key of applied) root.style.removeProperty(key); applied = []; }
  function apply(context = {}) {
    const changed = validTheme(context?.theme) && hostTheme !== context.theme;
    if (validTheme(context?.theme)) hostTheme = context.theme;
    const variables = context?.styles?.variables;
    if (changed) clearHostVariables();
    if (variables && typeof variables === 'object') {
      const safe = Object.fromEntries(Object.entries(variables).filter(([key,value]) => /^--[a-z][a-z0-9-]+$/.test(key) && typeof value === 'string' && value.length <= 2000));
      applyHostStyleVariables(safe, root);
      applied = [...new Set([...applied, ...Object.keys(safe)])];
    }
    render();
  }
  mediaQuery.addEventListener('change', render);
  render();
  return { apply, dispose() { mediaQuery.removeEventListener('change', render); } };
}
