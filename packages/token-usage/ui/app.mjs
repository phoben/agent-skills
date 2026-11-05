import {App} from '@modelcontextprotocol/ext-apps';
import './components.css';
import './styles.css';
import './details.css';
import './app.css';
import {count, escapeHtml as esc, formatTokens as fmt, formatPercent as percent, coverageWarnings, dateToday, dateRange, validDate, presetRange, decodeToolResult, chooseQuotaWindow, isIdentityError, trendSegments, projectPresentation} from './model.mjs';
import {createThemeController} from './theme.mjs';

const $ = selector => document.querySelector(selector);
const all = selector => [...document.querySelectorAll(selector)];
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const state = { ...presetRange('近7天', dateToday(timeZone)), preset:'近7天', data:null, mode:'loading', error:'', selection:null, page:1, pageSize:10, search:'', sort:'tokens', sessions:null, sessionsMode:'loading', showAll:false };
const themeController = createThemeController();
let app, connected = false, connecting = null, dashboardSequence = 0, sessionSequence = 0, opener, searchTimer, resizing, identityKey;
const previewToken = typeof window.__TOKEN_PREVIEW_TOKEN__ === 'string' && window.__TOKEN_PREVIEW_TOKEN__ ? window.__TOKEN_PREVIEW_TOKEN__ : null;
const dateText = date => `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
const rangeArgs = () => ({startDate:state.startDate, endDate:state.endDate, timeZone});
const presentation = () => projectPresentation(state.data?.local?.projects, state.data?.local?.totals?.totalTokens, state.showAll);
const displayProjects = () => presentation().rows;
const projectById = id => displayProjects().find(project => project.id === id);
const totalOf = (object, key) => count(object?.[key]);

function clearIdentity() {
  dashboardSequence++; sessionSequence++;
  state.data = null; state.sessions = null; state.selection = null;
  state.showAll = false;
  identityKey = undefined;
  $('#session-dialog').close();
}
function failDashboard(error, connection = false) {
  clearIdentity();
  state.mode = 'error';
  state.error = isIdentityError(error) ? '当前账号已变化或暂时无法确认。重新读取后查看当前账号的用量。' : connection ? '无法连接用量服务。请从 Codex 的 YG Toolkit 侧栏打开页面，然后重试。' : '暂时无法读取用量。请检查 Codex 登录状态后重试。';
  render();
}
async function connect() {
  if (previewToken || connected) return;
  if (connecting) return connecting;
  connecting = (async () => {
    if (window.parent === window) throw new Error('缺少宿主连接');
    app = new App({name:'YG Toolkit Usage', version:typeof __YG_VERSION__ === 'string' ? __YG_VERSION__ : '0.2.1'});
    app.onhostcontextchanged = context => themeController.apply(context);
    app.onerror = () => { if (connected) failDashboard(new Error('连接异常'), true); };
    app.onclose = () => { connected = false; failDashboard(new Error('连接已关闭'), true); };
    app.ontoolcancelled = () => { dashboardSequence++; state.mode = 'error'; state.error = '用量读取已取消，可以重新读取。'; state.data = null; render(); };
    app.onteardown = async () => { dashboardSequence++; sessionSequence++; connected = false; return {}; };
    await app.connect(undefined, {timeout:12000});
    themeController.apply(app.getHostContext());
    connected = true;
  })();
  try { await connecting; } finally { connecting = null; }
}
async function request(name, args) {
  if (previewToken) {
    const response = await fetch(name === 'token_usage_dashboard' ? '/api/dashboard' : '/api/sessions', {method:'POST', headers:{'content-type':'application/json', 'x-yg-preview-token':previewToken}, body:JSON.stringify(args)});
    const data = await response.json();
    if (!response.ok || data.error || data.code) { const error = new Error('用量读取失败'); error.code = data.error?.code ?? data.code; throw error; }
    if (data.schemaVersion !== 1) throw new Error('无法识别的用量数据');
    return data;
  }
  await connect();
  return decodeToolResult(await app.callServerTool({name, arguments:args}));
}
async function loadDashboard(refresh = false) {
  const sequence = ++dashboardSequence;
  sessionSequence++; state.selection = null; state.sessions = null; $('#session-dialog').close();
  state.mode = 'loading'; state.data = null; render();
  try {
    await connect();
    const data = await request('token_usage_dashboard', {...rangeArgs(), refresh});
    if (sequence !== dashboardSequence) return;
    if (!data.account || !data.local || !Array.isArray(data.local.projects)) throw new Error('缺少统计数据');
    if (identityKey && data.identityKey !== identityKey) { sessionSequence++; state.sessions = null; state.selection = null; $('#session-dialog').close(); }
    identityKey = data.identityKey;
    state.data = data; state.mode = 'ready'; render();
  } catch (error) { if (sequence === dashboardSequence) failDashboard(error, !previewToken && !connected); }
}
function panel(title, message, retry = false, loading = false) {
  $('#panel-state').innerHTML = `<div class="state-heading">${loading ? '<span class="loading-spinner" aria-hidden="true"></span>' : '<span class="state-symbol" aria-hidden="true">—</span>'}<h2>${esc(title)}</h2><p>${esc(message)}</p>${retry ? '<button class="state-action" data-retry>重新读取</button>' : ''}</div>`;
}
function render() {
  const data = state.data, local = data?.local, totals = local?.totals;
  const localUsable = state.mode === 'ready' && ['ok','partial'].includes(local?.status);
  const sessionCount = localUsable && local.projects.every(project => count(project.sessionCount) !== null) ? local.projects.reduce((total, project) => total + project.sessionCount, 0) : null;
  const values = {account:fmt(data?.account?.rangeTokens), local:localUsable ? fmt(totals?.totalTokens) : '—', projects:localUsable ? local.projects.length : '—', sessions:fmt(sessionCount), cached:localUsable ? fmt(totals?.cachedInputTokens) : '—', uncached:localUsable ? fmt(totals?.uncachedInputTokens) : '—', output:localUsable ? fmt(totals?.outputTokens) : '—', reasoning:localUsable ? fmt(totals?.reasoningOutputTokens) : '—', 'cache-share':localUsable ? percent(totals?.cachedInputTokens, totals?.inputTokens) : '—'};
  all('[data-stat]').forEach(element => element.textContent = values[element.dataset.stat]);
  $('[data-date-label]').textContent = state.preset;
  $('[data-date-range]').textContent = `${dateText(state.startDate)} – ${dateText(state.endDate)}`;
  $('#refresh').disabled = state.mode === 'loading';
  $('#plan-type').textContent = data?.account?.planType ?? '';
  $('#account-lifetime').textContent = count(data?.account?.lifetimeTokens) !== null ? `官方累计 ${fmt(data.account.lifetimeTokens)} Tokens` : '';
  $('#connection-notice').hidden = state.mode !== 'error';
  $('#connection-notice').textContent = state.mode === 'error' ? state.error : '';
  renderTrend(); renderQuota(); renderTokenDonut(); renderCoverage();
  const visible=presentation(),toggle=$('#project-toggle');
  toggle.hidden=!localUsable||!visible.hiddenCount;
  toggle.textContent=state.showAll?'收起小额项目':`显示全部（${visible.totalCount}）`;
  toggle.setAttribute('aria-expanded',String(state.showAll));
  $('#project-visibility-note').textContent=localUsable&&visible.hiddenCount?state.showAll?`已显示全部 ${visible.totalCount} 个项目`:`仅独立显示占比超过 1% 的项目，其余 ${visible.hiddenCount} 个合并展示`:'';
  const hasProjects = localUsable && local.projects.length > 0;
  $('.comparison-canvas').hidden = !hasProjects;
  $('#panel-state').hidden = hasProjects;
  if (state.mode === 'loading') panel('正在读取当前账号用量', '项目记录较多时，首次读取可能需要一些时间。', false, true);
  else if (state.mode === 'error') panel('暂时无法读取用量', state.error, true);
  else if (!localUsable) panel('暂时无法读取本机项目记录', '官方账号统计单独展示。可以重新读取本机记录。', true);
  else if (!hasProjects) panel('这个日期范围没有可归属的本机项目记录', '可调整日期。未确认账号归属的历史不会混入当前统计。');
  if (hasProjects) { renderMatrix(); renderFlow(); }
  else { $('#project-matrix').replaceChildren(); $('#flow-chart').replaceChildren(); $('#matrix-scale').textContent = '日柱采用统一刻度'; }
  hideTooltip();
}
function renderTrend() {
  const account = state.data?.account;
  const segments = trendSegments(account?.daily,state.startDate,state.endDate), daily = segments.flat();
  if (!daily.length) { $('#account-trend').innerHTML = '<div class="trend-empty">暂无官方每日统计</div>'; return; }
  const max = Math.max(1, ...daily.map(row => row.tokens));
  const start = Date.parse(`${state.startDate}T00:00:00Z`), span = Math.max(86400000, Date.parse(`${state.endDate}T00:00:00Z`) - start);
  const point = row => [10 + (Date.parse(`${row.date}T00:00:00Z`) - start) / span * 280,48 - row.tokens / max * 36];
  const lines = segments.map(segment => segment.length === 1 ? `<circle cx="${point(segment[0])[0]}" cy="${point(segment[0])[1]}" r="2" fill="var(--accent)"><title>${esc(segment[0].date)} · ${segment[0].tokens.toLocaleString('zh-CN')} Tokens</title></circle>` : `<polyline points="${segment.map(row => point(row).join(',')).join(' ')}" class="trend-line"><title>${esc(segment[0].date)} 至 ${esc(segment.at(-1).date)} · 每日用量</title></polyline>`).join('');
  $('#account-trend').innerHTML = `<svg viewBox="0 0 300 68" role="img" aria-label="官方已提供日期的每日用量折线，缺失日期处断开"><path d="M10 49H290" class="trend-grid"/>${lines}<text x="10" y="65" class="trend-caption">${dateText(state.startDate)}</text><text x="290" y="65" text-anchor="end" class="trend-caption">${dateText(state.endDate)}</text></svg>`;
}
function renderQuota() {
  const quota = state.data?.quota, window = chooseQuotaWindow(quota?.windows);
  $('#quota-title').textContent = window?.windowMinutes >= 10080 ? '当前周额度 · 已用' : '当前官方窗口 · 已用';
  $('#quota-value').textContent = window ? `${window.usedPercent.toFixed(0)}%` : '—';
  const meter = $('#quota-meter');
  const circumference=2*Math.PI*44,used=window?Math.min(100,window.usedPercent)/100*circumference:0;
  $('#quota-progress').style.strokeDasharray=`${used} ${circumference}`;
  if (window) meter.setAttribute('aria-valuenow', String(Math.min(100, window.usedPercent))); else meter.removeAttribute('aria-valuenow');
  let reset = '';
  if (Number.isFinite(window?.resetsAt) && Number.isFinite(new Date(window.resetsAt * 1000).getTime())) reset = `${new Intl.DateTimeFormat('zh-CN', {timeZone, month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(new Date(window.resetsAt * 1000))} 重置`;
  $('#quota-message').textContent = window ? reset || '官方未提供重置时间' : quota?.message || '当前官方额度暂不可用';
}
const coverageMetrics = [
  {key:'attributedThreads', label:'当前账号记录', icon:'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21v-2a7 7 0 0 1 14 0v2', help:'本机索引中可确认属于当前登录账号的会话记录数。项目用量仍按所选日期统计。'},
  {key:'unassignedAccountThreads', label:'未知归属 · 已排除', icon:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01', help:'本机索引中缺少账号归属的会话记录数，已排除在当前账号的用量之外。'},
  {key:'excludedAccountThreads', label:'其他账号 · 已排除', icon:'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20v-2a6 6 0 0 1 12 0v2m3-9a3.5 3.5 0 0 0 0-7m3 16v-2a6 6 0 0 0-3-5.2', help:'本机索引中明确属于其他账号的会话记录数，已排除在当前账号的用量之外。'},
  {key:'failedThreads', label:'读取失败', icon:'M10.3 4.8 3 18a1 1 0 0 0 .9 1.5h16.2A1 1 0 0 0 21 18L13.7 4.8a2 2 0 0 0-3.4 0ZM12 9v4m0 3h.01', help:'当前账号下暂时无法读取的本机会话记录数，这些记录未计入用量。'},
  {key:'partialRollouts', label:'部分覆盖', icon:'M12 3v9l6.4 6.4M12 3a9 9 0 1 0 6.4 15.4M16 3.9a9 9 0 0 1 4.1 4.2M21 12a9 9 0 0 1-.8 3.6', help:'日志不完整或读取期间仍在变化的本机会话记录数，只计入可确认的新增用量。'},
];

function coverageCard({key, label, icon, value, unit, detail, help}) {
  return `<li class="coverage-card" tabindex="0" aria-labelledby="coverage-label-${key} coverage-value-${key}" aria-describedby="coverage-tip-${key}">
    <span class="coverage-label" id="coverage-label-${key}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icon}"/></svg>${label}</span>
    <span class="coverage-value" id="coverage-value-${key}"><strong>${esc(value)}</strong>${unit ? `<span>${unit}</span>` : ''}</span>
    ${detail ? `<small class="coverage-detail">${esc(detail)}</small>` : ''}
    <span class="coverage-tooltip" id="coverage-tip-${key}" role="tooltip">${help}</span>
  </li>`;
}

function renderCoverage() {
  const {local, account: official, sampledAt: sampled} = state.data ?? {};
  $('#coverage').hidden = !state.data;
  const localCoverage = ['ok', 'partial'].includes(local?.status) ? local.coverage : null;
  const cards = coverageMetrics.map(metric => {
    const value = count(localCoverage?.[metric.key]);
    return coverageCard({...metric, value: value?.toLocaleString('zh-CN') ?? '—', unit: value === null ? '' : '条'});
  });
  const officialCoverage = official?.coverage;
  const start = officialCoverage?.startDate ?? officialCoverage?.firstDate;
  const end = officialCoverage?.endDate ?? officialCoverage?.lastDate;
  const available = count(officialCoverage?.availableDays), requested = count(officialCoverage?.requestedDays);
  const officialUsable = ['ok', 'partial'].includes(official?.status);
  const hasDayCounts = officialUsable && available !== null && requested > 0 && available <= requested;
  const officialStatus = official?.status === 'ok' ? '区间完整覆盖' : official?.status === 'partial' ? '区间未完整覆盖' : '暂不可用';
  const officialRange = officialUsable && validDate(start) && validDate(end) && start <= end ? `${start} 至 ${end}` : '';
  cards.push(coverageCard({
    key:'official', label:'官方日期覆盖',
    icon:'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 10h2m4 0h2',
    value: hasDayCounts ? `${available} / ${requested}` : '—',
    unit: hasDayCounts ? '天' : '',
    detail: officialRange || officialStatus,
    help: `所选区间内官方已提供的统计天数与区间总天数。${officialStatus}。${officialRange ? '卡片下方日期是官方已提供统计的起止日期，期间可能有缺日。' : ''}`,
  }));
  $('#coverage-grid').innerHTML = state.data ? cards.join('') : '';
  const notices = coverageWarnings(local);
  if (official && !officialUsable && official.message) notices.push(official.message);
  $('#coverage-notices').innerHTML = [...new Set(notices)].map(note => `<p>${esc(note)}</p>`).join('');
  $('#sampled-at').textContent = sampled && Number.isFinite(Date.parse(sampled)) ? `更新于 ${new Intl.DateTimeFormat('zh-CN', {timeZone, hour:'2-digit', minute:'2-digit'}).format(new Date(sampled))} · ${timeZone}` : '';
}
function renderTokenDonut() {
  const local=state.data?.local,totals=local?.totals;
  const types=[{key:'cachedInputTokens',name:'缓存输入',color:'var(--cache)'},{key:'uncachedInputTokens',name:'非缓存输入',color:'var(--uncached)'},{key:'outputTokens',name:'输出',color:'var(--output)'}];
  const usable=state.mode==='ready'&&['ok','partial'].includes(local?.status)&&types.every(type=>count(totals?.[type.key])!==null)&&count(totals?.totalTokens)!==null;
  all('[data-type-share]').forEach(element=>element.textContent=usable?percent(totals[element.dataset.typeShare],totals.totalTokens):'—');
  if(!usable){$('#token-donut').innerHTML='<div class="donut-empty">暂无构成统计</div>';return;}
  const total=totals.totalTokens,circumference=2*Math.PI*44;let offset=0;
  const arcs=types.map(type=>{
    const size=total?totals[type.key]/total*circumference:0;
    const circle=`<circle cx="60" cy="60" r="44" fill="none" stroke="${type.color}" stroke-width="12" stroke-dasharray="${size} ${circumference-size}" stroke-dashoffset="${-offset}" transform="rotate(-90 60 60)"><title>${type.name} ${fmt(totals[type.key])} Tokens</title></circle>`;
    offset+=size;return circle;
  }).join('');
  $('#token-donut').innerHTML=`<svg viewBox="0 0 120 120" role="img" aria-label="本机Tokens构成，缓存加非缓存加输出等于本机合计"><circle cx="60" cy="60" r="44" fill="none" stroke="var(--track)" stroke-width="12"/>${arcs}<text x="60" y="58" text-anchor="middle" class="donut-total">${esc(fmt(total))}</text><text x="60" y="75" text-anchor="middle" class="donut-label">本机合计</text></svg>`;
}
function renderMatrix() {
  const local = state.data.local, projects = displayProjects(), dates = dateRange(state.startDate, state.endDate), element = $('#project-matrix');
  const maximum = Math.max(1, ...projects.flatMap(project => (project.daily ?? []).map(day => count(day.totalTokens) ?? 0)));
  const projectWidth = innerWidth <= 550 ? 92 : 155, totalWidth = innerWidth <= 550 ? 62 : 83;
  const width = Math.max(element.clientWidth, projectWidth + totalWidth + dates.length * 28), step = dates.length > 31 ? Math.ceil(dates.length / 12) : dates.length > 10 ? Math.ceil(dates.length / 10) : 1;
  element.innerHTML = `<div class="matrix-scroll"><div class="matrix-table" role="table" aria-label="项目每日 Tokens 用量" style="width:${width}px;--matrix-cols:${projectWidth}px repeat(${dates.length}, minmax(28px,1fr)) ${totalWidth}px"><div class="matrix-head" role="row"><span role="columnheader">项目</span>${dates.map((date,index) => `<span title="${date}" role="columnheader">${index % step === 0 || index === dates.length - 1 ? date.slice(5).replace('-','/') : ''}</span>`).join('')}<span role="columnheader">范围内合计</span></div>${projects.map(project => {
    const daily = new Map((project.daily ?? []).map(day => [day.date,day]));
    return `<div class="matrix-row" role="row" tabindex="0" data-project="${esc(project.id)}" aria-label="查看${esc(project.name)}在所选范围的会话"><div class="matrix-project" role="rowheader"><strong title="${esc(project.name)}">${esc(project.name)}</strong><small>${count(project.sessionCount) === null ? '会话数未知' : `${project.sessionCount} 个会话`}</small></div>${dates.map((date,dayIndex) => { const value = totalOf(daily.get(date),'totalTokens'); return `<div class="day-cell" role="cell"><button class="day-hit${value === null ? ' is-unknown' : ''}" tabindex="${dayIndex === 0 ? 0 : -1}" style="--value:${value === null ? 0 : value / maximum}" data-project="${esc(project.id)}" data-day="${date}" aria-label="查看${esc(project.name)}${dateText(date)}会话，用量${value === null ? '未知' : `${value.toLocaleString('zh-CN')} Tokens`}"><span class="day-bar"${value === 0 ? ' style="min-height:0;height:0"' : ''}></span>${value === null ? '<span class="unknown-day">·</span>' : ''}</button></div>`; }).join('')}<div class="matrix-total" role="cell">${fmt(project.totalTokens)}<small>${esc(percent(project.totalTokens,local.totals?.totalTokens))}</small></div></div>`;
  }).join('')}</div></div>`;
  $('#matrix-scale').textContent = `统一刻度 0–${fmt(maximum)} · 按日${dates.length > 10 ? ' · 横向滚动查看' : ''}`;
}
function renderFlow() {
  if (!state.data || $('.comparison-canvas').hidden) return;
  const element = $('#flow-chart'), projects = displayProjects(), total = count(state.data.local.totals?.totalTokens);
  const rows = all('.matrix-row'), width = element.clientWidth, rect = element.getBoundingClientRect();
  const table = $('#project-matrix .matrix-table');
  if (!table || !rows.length || !width) return;
  // 表格自身不含水平滚动条，源节点与行中心使用同一个屏幕坐标系。
  const height = Math.max(132,table.getBoundingClientRect().bottom - rect.top);
  const rowRects = rows.map(row => row.getBoundingClientRect());
  element.style.height = `${height}px`;
  if (!total) { element.innerHTML = '<div class="flow-empty">暂无可绘制的 Tokens 流向</div>'; return; }
  const types = [{key:'cachedInputTokens', name:'缓存输入', color:'var(--cache)'}, {key:'uncachedInputTokens', name:'非缓存输入', color:'var(--uncached)'}, {key:'outputTokens', name:'输出', color:'var(--output)'}];
  if (projects.some(project => count(project.totalTokens) === null || types.some(type => count(project[type.key]) === null)) || types.some(type => count(state.data.local.totals[type.key]) === null)) { element.innerHTML = '<div class="flow-empty">分项统计不完整，暂不绘制流向</div>'; return; }
  const centers = rowRects.map(row => row.top + row.height / 2 - rect.top);
  const maximumBandHeight = Math.max(1,Math.min(...rowRects.map(row => row.height)) - 13);
  const sourceX = 7, targetX = width - 105, gap = 44;
  const scale = Math.min(Math.max(1,height - gap * 2 - 40) / total,maximumBandHeight / Math.max(1,...projects.map(project => count(project.totalTokens) ?? 0)));
  let targetTop = Math.max(20, (height - total * scale - gap * 2) / 2), paths = '', nodes = '';
  const targets = types.map(type => { const top = targetTop; targetTop += state.data.local.totals[type.key] * scale + gap; return {top, cursor:top}; });
  projects.forEach((project,index) => {
    const thickness = project.totalTokens * scale;
    let cursor = centers[index] - thickness / 2;
    types.forEach((type,typeIndex) => {
      const size = project[type.key] * scale, to = targets[typeIndex].cursor; targets[typeIndex].cursor += size;
      if (size > 0) paths += `<path class="flow-link" data-flow-project="${esc(project.id)}" fill="${type.color}" opacity=".58" d="M${sourceX} ${cursor} C${sourceX+(targetX-sourceX)*.45} ${cursor},${sourceX+(targetX-sourceX)*.55} ${to},${targetX} ${to} L${targetX} ${to+size} C${sourceX+(targetX-sourceX)*.55} ${to+size},${sourceX+(targetX-sourceX)*.45} ${cursor+size},${sourceX} ${cursor+size}Z"><title>${esc(project.name)} → ${type.name} ${fmt(project[type.key])}</title></path>`;
      cursor += size;
    });
    nodes += `<g class="flow-node" data-project="${esc(project.id)}"><rect x="${sourceX-4}" y="${centers[index]-thickness/2}" width="4" height="${thickness}" rx="1" fill="var(--accent)"/></g>`;
  });
  types.forEach((type,index) => { const size = state.data.local.totals[type.key] * scale, mid = targets[index].top + size / 2; nodes += `<rect x="${targetX}" y="${targets[index].top}" width="4" height="${size}" rx="1" fill="${type.color}"/><text x="${targetX+12}" y="${mid-4}" class="flow-label">${type.name}</text><text x="${targetX+12}" y="${mid+13}" class="flow-note">${fmt(state.data.local.totals[type.key])} · ${esc(percent(state.data.local.totals[type.key],total))}</text>`; });
  element.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="本机项目至缓存输入、非缓存输入与输出，流带宽度与用量成比例">${paths}${nodes}</svg>`;
}
async function openSessions(projectId, date, target) {
  const project = projectById(projectId); if (!project) return;
  opener = target; hideTooltip();
  state.selection = {projectId, date, memberIds:project.memberIds}; state.page = 1; state.search = ''; state.sort = 'tokens';
  $('#session-search').value = ''; $('#session-sort').value = 'tokens';
  $('#dialog-title').textContent = `${project.name} · 会话用量`;
  $('#dialog-scope').textContent = date ? `${dateText(date)} · 单日项目会话` : `${dateText(state.startDate)} – ${dateText(state.endDate)} · 范围内项目会话`;
  $('#session-dialog').showModal();
  await loadSessions();
}
async function loadSessions() {
  if (!state.selection) return;
  const sequence = ++sessionSequence;
  state.sessionsMode = 'loading'; state.sessions = null; renderSessions();
  try {
    const selector=state.selection.memberIds?{projectIds:state.selection.memberIds}:{projectId:state.selection.projectId};
    const data = await request('token_usage_sessions', {...rangeArgs(), ...selector, ...(state.selection.date ? {date:state.selection.date} : {}), search:state.search, sort:state.sort, page:state.page, pageSize:state.pageSize});
    if (sequence !== sessionSequence || !state.selection) return;
    if (identityKey && data.identityKey !== identityKey) { const error = new Error('账号已变化'); error.code = 'ACCOUNT_CHANGED'; throw error; }
    if (!Array.isArray(data.sessions)) throw new Error('缺少会话数据');
    state.sessions = data; state.sessionsMode = 'ready'; renderSessions();
  } catch (error) {
    if (sequence !== sessionSequence) return;
    if (isIdentityError(error)) { failDashboard(error); return; }
    state.sessionsMode = 'error'; renderSessions();
  }
}
function renderSessions() {
  const content = $('#dialog-content'), foot = $('#dialog-foot'), data = state.sessions;
  content.setAttribute('aria-busy', String(state.sessionsMode === 'loading'));
  if (state.sessionsMode === 'loading') { content.innerHTML = '<div class="dialog-empty"><span class="loading-spinner" aria-hidden="true"></span><p>正在读取所选范围的会话</p></div>'; foot.replaceChildren(); return; }
  if (state.sessionsMode === 'error') { content.innerHTML = '<div class="dialog-empty"><strong>暂时无法读取会话</strong><p>请稍后重试，或关闭明细后刷新用量。</p><button class="state-action" data-session-retry>重新读取</button></div>'; foot.replaceChildren(); return; }
  const rows = data.sessions;
  content.innerHTML = `<div class="dialog-summary"><strong>${fmt(data.totals?.totalTokens)} <span>Tokens</span></strong><span>范围内共 ${count(data.totalCount) ?? '—'} 个会话${state.search ? ` · 搜索匹配 ${count(data.filteredCount) ?? '—'} 个` : ''}</span></div>${rows.length ? `<div class="session-table-scroll"><table class="session-table"><thead><tr><th scope="col">会话</th><th scope="col">模型</th><th scope="col">缓存输入</th><th scope="col">非缓存输入</th><th scope="col">输出</th><th scope="col">合计</th></tr></thead><tbody>${rows.map(session => `<tr><td><span title="${esc(session.title)}">${esc(session.title || '未命名会话')}</span><small>${formatActivity(session.lastActivityAt)}${count(session.subagentCount) ? ` · 含 ${session.subagentCount} 个子代理` : ''}</small></td><td><span title="${esc(session.model)}">${esc(session.model || '未记录')}</span></td><td title="${esc(session.cachedInputTokens)}">${fmt(session.cachedInputTokens)}</td><td title="${esc(session.uncachedInputTokens)}">${fmt(session.uncachedInputTokens)}<small>缓存写入 ${fmt(session.cacheWriteInputTokens)}</small></td><td>${fmt(session.outputTokens)}<small>推理 ${fmt(session.reasoningOutputTokens)}</small></td><td>${fmt(session.totalTokens)}<small>输入 ${fmt(session.inputTokens)}</small></td></tr>`).join('')}</tbody></table></div>` : `<div class="dialog-empty"><strong>${state.search ? '没有匹配的会话' : '所选范围没有可归属会话'}</strong><p>${state.search ? '可以换个关键词，或清空搜索。' : '试试其他日期范围。'}</p>${state.search ? '<button class="state-action" data-clear-search>清空搜索</button>' : ''}</div>`}`;
  foot.innerHTML = `<span>缓存属于输入，推理属于输出 · 范围合计不受搜索影响</span><div class="dialog-pagination"><button data-page="previous" ${data.page <= 1 ? 'disabled' : ''} aria-label="上一页">上一页</button><span>${Math.max(1,data.page)} / ${Math.max(1,data.totalPages)}</span><button data-page="next" ${data.page >= data.totalPages ? 'disabled' : ''} aria-label="下一页">下一页</button></div>`;
}
function formatActivity(value) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', {timeZone, month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(new Date(value)) : '活动时间未记录';
}
function hideTooltip() { $('#chart-tooltip').hidden = true; }
function highlightProject(projectId, date) {
  all('.matrix-row').forEach(row => row.classList.toggle('is-highlighted',row.dataset.project === projectId));
  all('[data-day]').forEach(cell => cell.classList.toggle('same-day',!!date && cell.dataset.day === date));
  all('.flow-link').forEach(path => path.style.opacity = !projectId ? '.58' : path.dataset.flowProject === projectId ? '.9' : '.12');
}
function showTooltip(projectId, date, event) {
  const project = projectById(projectId); if (!project) return;
  const item = date ? project.daily?.find(day => day.date === date) : project;
  const tooltip = $('#chart-tooltip'), target = event.target.closest('[data-day],.flow-link'), rect = target?.getBoundingClientRect();
  tooltip.innerHTML = `<strong>${esc(project.name)}</strong><span>${date ? `${dateText(date)} · 单日用量` : '所选范围合计'}</span><b>${fmt(item?.totalTokens)}<small>Tokens</small></b><div><span>缓存 ${fmt(item?.cachedInputTokens)}</span><span>非缓存 ${fmt(item?.uncachedInputTokens)}</span><span>输出 ${fmt(item?.outputTokens)}</span></div>`;
  const x = event.clientX || (rect?.left ?? 10), y = event.clientY || (rect?.top ?? 180);
  tooltip.style.left = `${Math.max(8,Math.min(innerWidth-282,x+14))}px`; tooltip.style.top = `${Math.max(8,Math.min(innerHeight-160,y-145))}px`; tooltip.hidden = false;
}
function applyRange(startDate, endDate, preset) {
  state.startDate = startDate; state.endDate = endDate; state.preset = preset;
  state.showAll = false;
  $('#period-popover').hidePopover(); loadDashboard();
}
$('#timezone').textContent = `统计时区：${timeZone} · 最多366天`;
$('.date-trigger').addEventListener('click', () => {
  $('#date-start').value = state.startDate; $('#date-end').value = state.endDate;
  $('#date-start').max = $('#date-end').max = dateToday(timeZone);
  $('#period-error').textContent = '';
  all('[data-preset]').forEach(button => button.classList.toggle('current',button.dataset.preset === state.preset));
  $('#period-popover').togglePopover();
});
$('#period-popover').addEventListener('toggle', event => $('.date-trigger').setAttribute('aria-expanded',String(event.newState === 'open')));
all('[data-preset]').forEach(button => button.addEventListener('click', () => { const range = presetRange(button.dataset.preset,dateToday(timeZone)); applyRange(range.startDate,range.endDate,button.dataset.preset); }));
$('[data-custom]').addEventListener('click', () => $('#date-start').focus());
$('#period-form').addEventListener('submit', event => { event.preventDefault(); const start = $('#date-start').value, end = $('#date-end').value; if (!dateRange(start,end).length || end > dateToday(timeZone)) { $('#period-error').textContent = '请选择有效日期，开始日期不能晚于结束日期，范围最多366天。'; return; } applyRange(start,end,'自定义'); });
$('#refresh').addEventListener('click', () => loadDashboard(true));
$('#project-toggle').addEventListener('click',()=>{state.showAll=!state.showAll;render();});
$('.dialog-close').addEventListener('click', () => $('#session-dialog').close());
$('#session-dialog').addEventListener('close', () => { sessionSequence++; state.selection = null; clearTimeout(searchTimer); opener?.isConnected && opener.focus(); });
$('#session-dialog').addEventListener('click', event => { if (event.target !== $('#session-dialog')) return; const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close(); });
$('#session-search').addEventListener('input', event => { state.search = event.target.value; state.page = 1; sessionSequence++; clearTimeout(searchTimer); searchTimer = setTimeout(() => loadSessions(),250); });
$('#session-sort').addEventListener('change', event => { state.sort = event.target.value; state.page = 1; clearTimeout(searchTimer); loadSessions(); });
document.addEventListener('click', event => {
  if (event.target.closest('[data-retry]')) { loadDashboard(true); return; }
  if (event.target.closest('[data-session-retry]')) { loadSessions(); return; }
  if (event.target.closest('[data-clear-search]')) { state.search = ''; state.page = 1; $('#session-search').value = ''; loadSessions(); $('#session-search').focus(); return; }
  const page = event.target.closest('[data-page]'); if (page && !page.disabled) { state.page += page.dataset.page === 'next' ? 1 : -1; loadSessions(); return; }
  const day = event.target.closest('[data-day]'); if (day) { openSessions(day.dataset.project,day.dataset.day,day); return; }
  const row = event.target.closest('.matrix-row'); if (row) { openSessions(row.dataset.project,null,row); return; }
  const node = event.target.closest('.flow-node,.flow-link'); if (node) { const id = node.dataset.project || node.dataset.flowProject; openSessions(id,null,all('.matrix-row').find(row => row.dataset.project === id)); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') $('.coverage-card[data-tip-open]')?.removeAttribute('data-tip-open');
  if (event.target.classList?.contains('matrix-row') && ['Enter',' '].includes(event.key)) { event.preventDefault(); openSessions(event.target.dataset.project,null,event.target); return; }
  const cell = event.target.closest?.('[data-day]'); if (!cell) return;
  const projects = displayProjects(), dates = dateRange(state.startDate,state.endDate);
  let project = projects.findIndex(item => item.id === cell.dataset.project), day = dates.indexOf(cell.dataset.day);
  if (event.key === 'ArrowRight') day = Math.min(day+1,dates.length-1); else if (event.key === 'ArrowLeft') day = Math.max(day-1,0); else if (event.key === 'ArrowDown') project = Math.min(project+1,projects.length-1); else if (event.key === 'ArrowUp') project = Math.max(project-1,0); else if (event.key === 'Home') day = 0; else if (event.key === 'End') day = dates.length-1; else return;
  event.preventDefault(); const next = all('[data-day]').find(item => item.dataset.project === projects[project].id && item.dataset.day === dates[day]); cell.tabIndex = -1; next.tabIndex = 0; next.focus(); next.scrollIntoView({block:'nearest',inline:'nearest'});
});
const coverageGrid = $('#coverage-grid');
function showCoverageTip(event) {
  const card = event.target.closest('.coverage-card');
  if (!card || card.contains(event.relatedTarget)) return;
  $('.coverage-card[data-tip-open]')?.removeAttribute('data-tip-open');
  card.setAttribute('data-tip-open', '');
}
function hideCoverageTip(event) {
  const card = event.target.closest('.coverage-card');
  if (card && !card.contains(event.relatedTarget)) card.removeAttribute('data-tip-open');
}
coverageGrid.addEventListener('pointerover', showCoverageTip);
coverageGrid.addEventListener('focusin', showCoverageTip);
coverageGrid.addEventListener('pointerout', hideCoverageTip);
coverageGrid.addEventListener('focusout', hideCoverageTip);
const matrix = $('#project-matrix');
matrix.addEventListener('pointerover', event => { const row = event.target.closest('.matrix-row'), cell = event.target.closest('[data-day]'); highlightProject(row?.dataset.project,cell?.dataset.day); if (cell) showTooltip(cell.dataset.project,cell.dataset.day,event); else hideTooltip(); });
matrix.addEventListener('pointermove', event => { const cell = event.target.closest('[data-day]'); if (cell) showTooltip(cell.dataset.project,cell.dataset.day,event); });
matrix.addEventListener('pointerleave', () => { highlightProject(null); hideTooltip(); });
matrix.addEventListener('focusin', event => { const cell = event.target.closest('[data-day]'); if (cell) { highlightProject(cell.dataset.project,cell.dataset.day); showTooltip(cell.dataset.project,cell.dataset.day,event); } });
matrix.addEventListener('focusout', () => { highlightProject(null); hideTooltip(); });
matrix.addEventListener('scroll', hideTooltip, true);
$('#flow-chart').addEventListener('pointerover', event => { const path = event.target.closest('.flow-link'); if (path) { highlightProject(path.dataset.flowProject); showTooltip(path.dataset.flowProject,null,event); } });
$('#flow-chart').addEventListener('pointerleave', () => { highlightProject(null); hideTooltip(); });
window.addEventListener('resize', () => { cancelAnimationFrame(resizing); resizing = requestAnimationFrame(() => { if (state.mode === 'ready' && !$('.comparison-canvas').hidden) { renderMatrix(); renderFlow(); } hideTooltip(); }); });
loadDashboard();
