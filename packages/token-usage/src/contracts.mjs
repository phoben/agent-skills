import { z } from 'zod';

export class UsageError extends Error {
  constructor(code, message) { super(message); this.name = 'UsageError'; this.code = code; }
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, '日期无效');
const zone = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, '时区无效');
const fields = { startDate: day, endDate: day, timeZone: zone, refresh: z.boolean().optional().default(false) };
function validRange(value) {
  return value.startDate <= value.endDate && (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86400000 < 366;
}
export const dashboardShape = z.object(fields).strict();
export const dashboardSchema = dashboardShape.refine(validRange, '统计区间最多366天，开始日不能晚于结束日');
const projectId = z.string().min(1).max(200).refine(value => value.trim().length > 0, '项目标识不能为空');
export const sessionsShape = z.object({
  ...fields,
  projectId: projectId.optional(),
  projectIds: z.array(projectId).min(1).max(1000).refine(value => new Set(value).size === value.length, '项目标识不能重复').optional(),
  date: day.optional(), search: z.string().max(200).optional().default(''),
  sort: z.enum(['tokens', 'recent', 'output']).optional().default('tokens'),
  page: z.number().int().min(1).max(100000).optional().default(1), pageSize: z.number().int().min(1).max(100).optional().default(10),
}).strict().refine(value => (value.projectId !== undefined) !== (value.projectIds !== undefined), '必须且只能提供一种项目选择方式');
export const sessionsSchema = sessionsShape.refine(value => validRange(value) && (!value.date || value.date >= value.startDate && value.date <= value.endDate), '日期或统计区间无效');
export function parseArguments(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new UsageError('INVALID_ARGUMENT', '查询条件无效，请检查日期、时区和分页。');
  return result.data;
}
export function safeFailure(error) {
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,60}$/.test(error.code) ? error.code : 'USAGE_READ_FAILED';
  const messages = {
    INVALID_ARGUMENT: '查询条件无效，请检查日期、时区和分页。',
    ACCOUNT_CHANGED: '当前账号已变化，请刷新页面后重新查询。',
    IDENTITY_UNAVAILABLE: '暂时无法确认当前Codex账号，项目统计尚未读取。',
    CODEX_UNAVAILABLE: '未找到可用的Codex命令，请检查本机安装。',
    CODEX_TIMEOUT: '读取Codex账号信息超时，请稍后重试。',
    LOCAL_SOURCE_UNAVAILABLE: '暂时无法读取本机Codex会话索引。',
    PROJECT_NOT_FOUND: '所选项目当前不可用，请刷新项目列表。',
  };
  return { code, message: messages[code] || '暂时无法读取用量数据，请稍后重试。' };
}
