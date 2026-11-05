import { esc, icon } from './ui.mjs';

export function discoveryStatus(catalog) {
  if (catalog?.status === 'unavailable') return { text: '项目暂时无法读取', warning: true, symbol: 'issue' };
  if (catalog?.checking || catalog?.status === 'loading' || !catalog) return { text: '项目发现尚未完成', warning: true, symbol: 'issue' };
  if (catalog?.status === 'complete') return { text: '项目已读取', warning: false, symbol: 'check' };
  return { text: '项目发现范围不完整', warning: true, symbol: 'issue' };
}

export function accountTriggerMarkup(account, catalog, { compact = false } = {}) {
  const login = account?.id != null ? String(account.login || '').trim() : '';
  const name = login || '本机用户';
  const initials = login ? [...login].slice(0, 2).join('').toUpperCase() : '';
  const discovery = discoveryStatus(catalog);
  return `<button type="button" id="${compact ? 'status-account-menu' : 'account-menu-trigger'}" class="account-trigger${compact ? ' compact-account' : ''}" data-action="account-menu" aria-haspopup="menu" aria-controls="account-menu" aria-expanded="false" aria-label="${esc(name)}，用户菜单${discovery.warning ? `，${discovery.text}` : ''}" title="${esc(name)} · ${discovery.text}"><span class="account-avatar" aria-hidden="true">${initials ? esc(initials) : icon('user')}${discovery.warning ? '<span class="account-notice"></span>' : ''}</span><span class="account-copy"><span class="account-name">${esc(name)}</span><span class="account-caption">${login ? 'GitHub 账号' : 'GitHub 账号未读取'}</span></span>${icon('down')}</button>`;
}

export function accountMenuHeader(catalog) {
  const status = discoveryStatus(catalog);
  return `<div class="account-menu-heading">项目与布局</div><div class="account-discovery${status.warning ? ' discovery-warning' : ''}" id="account-discovery-status">${icon(status.symbol)}<span>${esc(status.text)}</span></div>`;
}
