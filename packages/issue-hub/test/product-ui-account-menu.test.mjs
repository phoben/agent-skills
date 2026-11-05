import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, Script } from 'node:vm';
import { accountTriggerMarkup, accountMenuHeader } from '../ui/account-menu.mjs';
import { esc, icon, button, brandMark } from '../ui/ui.mjs';

const source = await readFile(new URL('../ui/app.mjs', import.meta.url), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test('账号未读取使用中性占位，真实账号转义后展示且不外联头像', () => {
  const unknown = accountTriggerMarkup({ id: null, login: '旧账号' });
  assert.match(unknown, /本机用户/); assert.doesNotMatch(unknown, /旧账号/); assert.match(unknown, /GitHub 账号未读取/);
  const verified = accountTriggerMarkup({ id: 8, login: '<member>' });
  assert.match(verified, /&lt;member&gt;/); assert.doesNotMatch(verified, /<member>|https?:|<img/);
  assert.match(verified, /aria-haspopup="menu"/); assert.doesNotMatch(verified, /account-notice/);
  assert.match(accountTriggerMarkup({ id: 8, login: 'member' }, { compact: true }), /id="status-account-menu"/);
});

test('项目扫描的加载、部分、旧警告与不可用状态都不生成账号覆盖提示', () => {
  for (const catalog of [null, { status: 'partial' }, { status: 'unavailable' }, { status: 'loading' }, { status: 'complete', checking: true }, { status: 'partial', warnings: ['DIRECTORY_DEPTH_LIMIT', 'DIRECTORY_LIMIT', 'CATALOG_CACHE_CHECKING'] }]) {
    const p = page(); p.store.catalog = catalog; p.api.renderNav(); p.api.status();
    const trigger = p.node('account-menu-trigger'); trigger.getBoundingClientRect = () => ({ left: 8, right: 160, top: 620, bottom: 666 }); p.api.showAccountMenu(trigger);
    const html = p.nodes.get('navigation').innerHTML + p.nodes.get('statusbar').innerHTML + p.overlay.innerHTML;
    assert.doesNotMatch(html, /account-notice|account-discovery|不完整|项目已读取|项目发现尚未完成/);
    assert.match(html, /项目与布局/); assert.match(html, /data-action="discover"/); assert.match(html, /data-action="reset-layout"/);
  }
});

test('后台列表滚动不关闭固定底部的账号菜单，普通菜单滚动与视口关闭保持', () => {
  const handlers = new Map(), overlay = {}, menu = { contains: target => target === 'inside-menu' };
  let accountOpen = true, closed = 0;
  const context = createContext({
    window: { addEventListener: (name, callback) => handlers.set(name, callback) }, overlay,
    $: selector => selector === '.menu' || selector === '.account-menu' && accountOpen ? menu : null,
    closeOverlay() { closed++; }, syncRepositoryHeader() {},
  });
  new Script(section("window.addEventListener('resize'", 'setInterval(')).runInContext(context);
  handlers.get('scroll')({ target: { id: 'issue-list' } }); assert.equal(closed, 0);
  handlers.get('scroll')({ target: 'inside-menu' }); assert.equal(closed, 0);
  accountOpen = false; handlers.get('scroll')({ target: { id: 'issue-list' } }); assert.equal(closed, 1);
  accountOpen = true; handlers.get('resize')(); assert.equal(closed, 2);
});

// 执行正式控制器函数，用可观察节点验证锚点、焦点和定位，不重写菜单行为。
function page() {
  const nodes = new Map(), document = { activeElement: null, getElementById: id => nodes.get(id) || null };
  const node = id => {
    const value = { id, attrs: {}, style: {}, isConnected: true, focus() { document.activeElement = this; }, setAttribute(k, v) { this.attrs[k] = v; }, closest(selector) { return selector === '#statusbar button' && ['connection-check', 'status-refresh', 'status-account-menu'].includes(id) ? this : null; } };
    nodes.set(id, value); return value;
  };
  function root(id) {
    const value = node(id); let html = '';
    Object.defineProperty(value, 'innerHTML', { get: () => html, set(next) {
      html = next;
      for (const match of next.matchAll(/\bid="([^" ]+)"/g)) {
        if (nodes.has(match[1])) nodes.get(match[1]).isConnected = false;
        node(match[1]);
      }
    } }); return value;
  }
  root('statusbar'); root('navigation'); node('mobile-repository');
  const menu = { style: {}, offsetHeight: 144, offsetWidth: 236 }, header = { innerHTML: '' }, menuItems = [node('discover-item'), node('reset-item')];
  const overlay = { innerHTML: '' };
  const $ = (selector, within) => {
    if (selector === '.account-menu' || selector === '.menu') return overlay.innerHTML.includes('role="menu"') ? menu : null;
    if (selector === '.account-menu-header') return header;
    if (selector === 'button' && within === menu) return menuItems[0];
    return nodes.get(selector.slice(1)) || null;
  };
  const store = { online: true, account: { id: 8, login: 'member' }, catalog: { status: 'partial' }, data: { lastSuccess: '12:00', repositories: [] } };
  const context = createContext({ document, nodes, store, state: { refreshing: false, repo: '', repoQuery: '' }, overlay, overlayReturn: null, menu, header, innerWidth: 960, innerHeight: 680, esc, icon, button, brandMark, accountTriggerMarkup, accountMenuHeader, action: (name, text, className, extra) => button(name, text, { className, extra }),
    $, setTimeout: () => 1, clearTimeout() {}, statusTimer: null,
    closeOverlay(restore = true) { overlay.innerHTML = ''; const target = context.overlayReturn; target?.setAttribute('aria-expanded', 'false'); context.overlayReturn = null; if (restore) target?.focus(); },
  });
  new Script(`${section('function status(', 'function syncRepositoryHeader(')}\n${section('function openMenu(', 'function showTask(')}\nglobalThis.api={status,renderNav,restoreAccountMenuAnchor,showAccountMenu,openMenu};`).runInContext(context);
  return { context, nodes, node, document, store, menu, header, menuItems, overlay, api: context.api };
}

test('用户菜单在按钮上方且不越过右边界，再点同按钮关闭并返回焦点', () => {
  const p = page(), trigger = p.node('account-menu-trigger');
  trigger.getBoundingClientRect = () => ({ left: 870, right: 950, top: 620, bottom: 666 });
  p.api.showAccountMenu(trigger);
  assert.equal(trigger.attrs['aria-expanded'], 'true');
  assert.ok(Number.parseFloat(p.menu.style.top) + p.menu.offsetHeight < 620);
  assert.ok(Number.parseFloat(p.menu.style.left) + p.menu.offsetWidth <= 950);
  assert.match(p.overlay.innerHTML, /data-action="discover"/); assert.match(p.overlay.innerHTML, /data-action="reset-layout"/); assert.doesNotMatch(p.overlay.innerHTML, /data-action="diagnostics"/);
  assert.equal(p.document.activeElement, p.menuItems[0]);
  p.api.showAccountMenu(trigger); assert.equal(p.overlay.innerHTML, ''); assert.equal(p.document.activeElement, trigger); assert.equal(trigger.attrs['aria-expanded'], 'false');
});

test('后台重画项目栏保留已打开菜单与菜单项焦点，关闭返回新锚点', () => {
  const p = page(), old = p.node('account-menu-trigger');
  old.getBoundingClientRect = () => ({ left: 8, right: 160, top: 620, bottom: 666 });
  p.api.showAccountMenu(old); const focused = p.document.activeElement;
  p.store.catalog = { status: 'complete' }; p.api.renderNav();
  const replacement = p.nodes.get('account-menu-trigger');
  assert.notEqual(replacement, old); assert.equal(p.context.overlayReturn, replacement); assert.equal(replacement.attrs['aria-expanded'], 'true');
  assert.equal(p.document.activeElement, focused); assert.doesNotMatch(p.overlay.innerHTML, /account-discovery|不完整/);
  p.context.closeOverlay(); assert.equal(p.document.activeElement, replacement);
});

test('状态更新保留诊断按钮焦点且诊断入口不依赖成功加载账号', () => {
  const p = page(), old = p.node('connection-check'); old.focus();
  p.store.account = { id: null, login: '' }; p.api.status();
  assert.equal(p.document.activeElement, p.nodes.get('connection-check')); assert.notEqual(p.document.activeElement, old);
  assert.match(p.nodes.get('statusbar').innerHTML, /data-action="diagnostics"[^>]*aria-label="连接检查"/);
  assert.match(p.nodes.get('statusbar').innerHTML, /本机用户/);
});

test('状态更新保留窄窗菜单当前项，返回新的紧凑账号入口', () => {
  const p = page(), trigger = p.node('status-account-menu'); trigger.getBoundingClientRect = () => ({ left: 650, right: 830, top: 650, bottom: 678 });
  p.api.showAccountMenu(trigger); const focused = p.document.activeElement;
  p.api.status(); assert.equal(p.document.activeElement, focused);
  assert.equal(p.context.overlayReturn, p.nodes.get('status-account-menu'));
  p.context.closeOverlay(); assert.equal(p.document.activeElement.id, 'status-account-menu');
});
