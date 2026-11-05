import { esc } from './ui.mjs';

const text = (value, max = 1200) => typeof value === 'string' ? value.slice(0, max) : '';
const status = value => ['ok', 'warning', 'error'].includes(value) ? value : 'warning';
const ordinaryDiscoveryNotes = new Set(['DIRECTORY_DEPTH_LIMIT', 'DIRECTORY_LIMIT', 'DEEP_SCAN_PENDING', 'CATALOG_DEEP_SCAN_PENDING', 'CATALOG_CACHE_CHECKING', 'LINK_SKIPPED', 'PROJECT_PAGE_LIMIT', 'ROOT_NOT_REPOSITORY', '子目录扫描达到深度上限', '子目录扫描达到数量上限', '完整子目录扫描尚未完成', '当前显示项目缓存，正在核对', '子仓库发现达到本次范围上限']);

// 诊断入口不依赖仓库或GitHub身份；只读取契约内的安全字段，不显示原始异常对象。
export async function readDiagnostics(callServerTool) {
  try {
    const result = await callServerTool({ name: 'issue-hub-diagnostics', arguments: {} });
    const envelope = result?.structuredContent;
    if (result?.isError || envelope?.schemaVersion !== 1 || !Array.isArray(envelope.data?.checks)) throw new Error();
    const data = envelope.data;
    return {
      status: status(data.status), sampledAt: text(data.sampledAt, 80),
      checks: data.checks.slice(0, 30).map(check => ({ id: text(check?.id, 80), label: text(check?.label, 120), status: status(check?.status), version: text(check?.version, 120), message: text(check?.message), action: text(check?.action, 800) })),
      discovery: { status: text(data.discovery?.status, 80), checking: data.discovery?.checking === true, warnings: Array.isArray(data.discovery?.warnings) ? data.discovery.warnings.filter(value => typeof value === 'string' && !ordinaryDiscoveryNotes.has(value)).slice(0, 30).map(value => text(value, 300)) : [] },
    };
  } catch { throw new Error('连接检查未完成。请重新打开插件后重试；无需先登录 GitHub 才能进入此检查。'); }
}

export function diagnosticsMarkup(data) {
  const name = { ok: '正常', warning: '需检查', error: '不可用' };
  const discovery = { 'not-scanned': '尚未读取项目', complete: '已检查既定项目范围', partial: '已检查既定项目范围', unavailable: '暂不可用，保留已有缓存', loading: '正在读取项目', checking: '正在检查项目' }[data.discovery.status] || '尚未取得项目读取结果';
  const warnings = data.discovery.warnings.filter(value => !ordinaryDiscoveryNotes.has(value));
  return `<p>仅检查环境和连接，不修改配置或自动安装工具。</p><ul class="diagnostics-checks">${data.checks.map(check => `<li data-check-status="${status(check.status)}"><div><strong>${esc(check.label)}</strong><span>${name[status(check.status)]}</span></div>${check.version ? `<p class="muted">版本 ${esc(check.version)}</p>` : ''}${check.message ? `<p>${esc(check.message)}</p>` : ''}${check.action ? `<p class="diagnostics-advice">${esc(check.action)}</p>` : ''}</li>`).join('')}</ul><h3>项目读取</h3><p>${discovery}</p>${data.discovery.checking ? '<p class="muted" role="status">正在后台检查项目，当前显示已有结果。</p>' : ''}${warnings.length ? `<ul>${warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul>` : ''}${data.sampledAt ? `<p class="muted">检查时间 ${esc(data.sampledAt)}</p>` : ''}`;
}
