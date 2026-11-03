import test from 'node:test';
import assert from 'node:assert/strict';
import { createThemeController } from '../ui/theme.mjs';

function fixture(dark=false){const values=new Map(),listeners=new Set();return {root:{dataset:{},style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}},mediaQuery:{matches:dark,addEventListener:(name,f)=>listeners.add(f),removeEventListener:(name,f)=>listeners.delete(f)},values,listeners};}
test('浏览器跟随系统变化，宿主明确主题优先于系统', () => {
  const f=fixture(),theme=createThemeController(f);
  assert.equal(f.root.dataset.theme,'light');f.mediaQuery.matches=true;for(const run of f.listeners)run();assert.equal(f.root.dataset.theme,'dark');
  theme.apply({theme:'light'});assert.equal(f.root.dataset.theme,'light');for(const run of f.listeners)run();assert.equal(f.root.dataset.theme,'light');
  theme.dispose();assert.equal(f.listeners.size,0);
});
test('宿主变量生效，切换主题时清除旧主题残留，增量上下文保留主题', () => {
  const f=fixture(),theme=createThemeController(f);
  theme.apply({theme:'light',styles:{variables:{'--color-background-primary':'#fff','bad-key':'ignored'}}});
  assert.equal(f.values.get('--color-background-primary'),'#fff');assert.equal(f.values.has('bad-key'),false);
  theme.apply({theme:'dark'});assert.equal(f.values.has('--color-background-primary'),false);assert.equal(f.root.dataset.theme,'dark');
  theme.apply({styles:{variables:{'--color-text-primary':'#eee'}}});assert.equal(f.root.dataset.theme,'dark');assert.equal(f.values.get('--color-text-primary'),'#eee');
  theme.dispose();
});

test('同主题局部变量更新保留其余宿主变量', () => {
  const f=fixture(),theme=createThemeController(f);
  theme.apply({theme:'dark',styles:{variables:{'--color-background-primary':'#101010','--color-text-primary':'#eee'}}});
  theme.apply({styles:{variables:{'--color-text-primary':'#ddd'}}});
  assert.equal(f.root.dataset.theme,'dark');assert.equal(f.values.get('--color-background-primary'),'#101010');assert.equal(f.values.get('--color-text-primary'),'#ddd');
  theme.apply({theme:'light'});assert.equal(f.values.has('--color-background-primary'),false);assert.equal(f.values.has('--color-text-primary'),false);
  theme.dispose();
});
