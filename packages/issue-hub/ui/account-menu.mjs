import { esc, icon } from './ui.mjs';

export function accountTriggerMarkup(account, { compact = false } = {}) {
  const login = account?.id != null ? String(account.login || '').trim() : '';
  const name = login || '本机用户';
  const initials = login ? [...login].slice(0, 2).join('').toUpperCase() : '';
  return `<button type="button" id="${compact ? 'status-account-menu' : 'account-menu-trigger'}" class="account-trigger${compact ? ' compact-account' : ''}" data-action="account-menu" aria-haspopup="menu" aria-controls="account-menu" aria-expanded="false" aria-label="${esc(name)}，用户菜单" title="${esc(name)}"><span class="account-avatar" aria-hidden="true">${initials ? esc(initials) : icon('user')}</span><span class="account-copy"><span class="account-name">${esc(name)}</span><span class="account-caption">${login ? 'GitHub 账号' : 'GitHub 账号未读取'}</span></span>${icon('down')}</button>`;
}

export const accountMenuHeader = () => '<div class="account-menu-heading">项目与布局</div>';
