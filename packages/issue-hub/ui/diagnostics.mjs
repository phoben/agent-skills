import { esc } from './ui.mjs';

const text = (value, max = 1200) => typeof value === 'string' ? value.slice(0, max) : '';
const status = value => ['ok', 'warning', 'error'].includes(value) ? value : 'warning';

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
      discovery: { status: text(data.discovery?.status, 80), checking: data.discovery?.checking === true, warnings: Array.isArray(data.discovery?.warnings) ? data.discovery.warnings.filter(value => typeof value === 'string').slice(0, 30).map(value => text(value, 300)) : [] },
    };
  } catch { throw new Error('连接检查未完成。请重新打开插件后重试；无需先登录 GitHub 才能进入此检查。'); }
}

export function diagnosticsMarkup(data) {
  const name = { ok: '正常', warning: '需检查', error: '不可用' };
  const discovery = { 'not-scanned': '尚未执行完整发现', complete: '已完成', partial: '发现范围不完整', unavailable: '暂不可用，保留已有缓存', loading: '正在发现项目', checking: '正在检查项目' }[data.discovery.status] || '尚未取得完整发现结果';
  return `<p>仅检查环境和连接，不修改配置或自动安装工具。</p><ul class="diagnostics-checks">${data.checks.map(check => `<li data-check-status="${status(check.status)}"><div><strong>${esc(check.label)}</strong><span>${name[status(check.status)]}</span></div>${check.version ? `<p class="muted">版本 ${esc(check.version)}</p>` : ''}${check.message ? `<p>${esc(check.message)}</p>` : ''}${check.action ? `<p class="diagnostics-advice">${esc(check.action)}</p>` : ''}</li>`).join('')}</ul><h3>项目发现范围</h3><p>${discovery}</p>${data.discovery.checking ? '<p class="muted" role="status">正在后台检查项目，当前显示已有结果。</p>' : ''}${data.discovery.warnings.length ? `<ul>${data.discovery.warnings.map(warning => `<li>${esc(warning)}</li>`).join('')}</ul>` : ''}${data.sampledAt ? `<p class="muted">检查时间 ${esc(data.sampledAt)}</p>` : ''}`;
}
