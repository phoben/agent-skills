import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeController } from '../ui/theme.mjs';

function fixture(dark = false) {
  const values = new Map(), listeners = new Set();
  const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) } };
  const mediaQuery = { matches: dark, addEventListener: (_name, handler) => listeners.add(handler), removeEventListener: (_name, handler) => listeners.delete(handler) };
  return { root, mediaQuery, values, listeners, system(dark) { mediaQuery.matches = dark; for (const handler of listeners) handler(); } };
}

test('宿主明暗优先于相反系统主题，缺少宿主时系统变化仍生效', () => {
  const f = fixture(true), theme = createThemeController(f);
  assert.equal(f.root.dataset.theme, 'dark');
  f.system(false); assert.equal(f.root.dataset.theme, 'light');
  theme.apply({ theme: 'dark' }); assert.equal(f.root.dataset.theme, 'dark'); assert.equal(f.values.get('color-scheme'), 'dark');
  f.system(false); assert.equal(f.root.dataset.theme, 'dark');
  theme.apply({ theme: 'light' }); f.system(true); assert.equal(f.root.dataset.theme, 'light');
  theme.dispose(); assert.equal(f.listeners.size, 0);
});

test('主题切换清旧宿主变量，无新变量时回到当前主题的CSS回退', () => {
  const f = fixture(), theme = createThemeController(f);
  theme.apply({ theme: 'light', styles: { variables: { '--color-background-primary': '#fafafa', '--color-text-primary': '#111', '--shadow-md': '0 2px 4px #0002' } } });
  assert.equal(f.values.get('--color-background-primary'), '#fafafa');
  theme.apply({ theme: 'dark' });
  assert.equal(f.root.dataset.theme, 'dark'); assert.equal(f.values.has('--color-background-primary'), false); assert.equal(f.values.has('--color-text-primary'), false); assert.equal(f.values.has('--shadow-md'), false);
  theme.apply({ styles: { variables: { '--color-text-primary': '#ededed' } } });
  assert.equal(f.root.dataset.theme, 'dark'); assert.equal(f.values.get('--color-text-primary'), '#ededed');
  theme.dispose();
});

test('同主题样式增量保留其他变量，可显式清除并阻止覆盖页面主色和列宽', () => {
  const f = fixture(), theme = createThemeController(f);
  theme.apply({ theme: 'dark', styles: { variables: { '--color-background-primary': '#202020', '--color-text-primary': '#eee', '--accent': 'green', '--surface': 'green', '--navigation-width': '900px', 'bad-key': 'ignored' } } });
  theme.apply({ styles: { variables: { '--color-text-primary': '#ddd', '--color-background-secondary': '#181818' } } });
  assert.equal(f.values.get('--color-background-primary'), '#202020'); assert.equal(f.values.get('--color-text-primary'), '#ddd');
  assert.equal(f.values.has('--accent'), false); assert.equal(f.values.has('--surface'), false); assert.equal(f.values.has('--navigation-width'), false); assert.equal(f.values.has('bad-key'), false);
  theme.apply({ styles: { variables: { '--color-text-primary': undefined } } }); assert.equal(f.values.has('--color-text-primary'), false);
  theme.apply({ styles: { variables: {} } }); assert.equal(f.values.has('--color-background-primary'), false); assert.equal(f.root.dataset.theme, 'dark');
  theme.dispose();
});

test('系统回退模式切换或重置时不遗留上一模式的宿主颜色', () => {
  const f = fixture(), theme = createThemeController(f);
  theme.apply({ styles: { variables: { '--color-background-primary': '#fdfdfd' } } });
  f.system(true); assert.equal(f.root.dataset.theme, 'dark'); assert.equal(f.values.has('--color-background-primary'), false);
  theme.apply({ theme: 'light', styles: { variables: { '--color-background-primary': '#fafafa' } } });
  theme.reset(); assert.equal(f.root.dataset.theme, 'dark'); assert.equal(f.values.has('--color-background-primary'), false);
  theme.dispose(); f.system(false); assert.equal(f.root.dataset.theme, 'dark');
});
