import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../11-03-github-issue-plugin/ui/explore/round-01');
const titles = [
  '切换仓库后，评论仍保留上一次的筛选结果',
  '多个工作区时，已选路径没有被记住',
  '断网后重新打开页面，评论草稿丢失',
  '正文中的长代码块撑开了详情区域',
  '负责人列表加载失败时没有重试入口',
  '新建 Issue 后列表没有立即更新',
  '关联会话已归档，返回按钮仍然可用',
  '切换账号后需要清理旧仓库的筛选条件',
  '窗口较小时，标签名称被按钮遮挡',
  '评论超过一页时显示已加载的数量',
  '保存失败后应保留当前编辑内容',
  '在 Issue 列表中增加键盘焦点提示',
  '里程碑为空时不应显示加载失败',
  '重复点击创建任务时只处理一次请求',
  '在详情中保留关联 PR 的来源链接',
  '仓库目录失效后应允许重新选择',
  '从详情返回时保持列表阅读位置',
  '手动刷新时保留未提交的评论',
  '关闭 Issue 后正确更新当前状态',
  '为无评论的 Issue 保留回复入口',
  '标签修改后重新读取远端状态',
  '修正中文多行标题的行距',
  '合并重复的项目目录记录',
  '补充权限失效后的恢复提示',
];
const issues = titles.map((title, index) => ({
  number: 184 - index, title,
  state: index < 18 ? 'open' : 'closed',
  labels: index % 3 === 0 ? ['bug', '同步'] : index % 3 === 1 ? ['enhancement'] : ['bug'],
  assignee: ['林舟', '陈雨', '未分配'][index % 3],
  updated: index === 0 ? '8 分钟前' : index < 5 ? `${index * 12} 分钟前` : index < 12 ? '今天' : '昨天',
  comments: index === 0 ? 8 : [3, 0, 6, 2, 1][index % 5],
  relation: index === 0 ? 'linked' : index === 1 ? 'draft' : index === 2 ? 'pending' : 'none',
}));
const fixture = {
  version: 'issue-hub-firstscreens-01',
  scenario: '打开同一仓库并选中同一条已有确认会话的 Issue，准备继续处理',
  appName: 'Issue Hub',
  account: { login: 'team-member', name: '林舟', initials: '林' },
  repository: { fullName: 'team/issue-hub', name: 'issue-hub', owner: 'team', description: '桌面端 Issue 工作区' },
  repositories: [
    { fullName: 'team/issue-hub', name: 'issue-hub', open: 18, selected: true },
    { fullName: 'team/platform-api', name: 'platform-api', open: 12 },
    { fullName: 'team/docs-site', name: 'docs-site', open: 7 },
    { fullName: 'team/client-web', name: 'client-web', open: 9 },
    { fullName: 'team/automation', name: 'automation', open: 4 },
  ],
  counts: { all: 24, open: 18, closed: 6 },
  sync: { text: '已同步', time: '21:18', cadence: '每 60 秒检查', ago: '刚刚' },
  workspace: { name: '主工作区', branch: 'main' },
  selectedNumber: 184,
  issues,
  detail: {
    ...issues[0],
    author: '陈雨', created: '11 月 3 日',
    milestone: '桌面协作 v0.2',
    task: { title: '修复仓库切换后的评论筛选', status: '已确认关联', action: '返回会话' },
    bodyLead: '在仓库之间切换后，Issue 详情中的评论列表仍沿用上一个仓库的筛选条件，导致部分讨论没有显示。',
    steps: ['打开 issue-hub，进入一条有评论的 Issue。', '切换到 platform-api，再返回当前 Issue。', '评论列表仍保留之前的筛选，而标题与属性已更新。'],
    expectation: '仓库切换应重置评论查询范围，同时保留尚未发布的输入。',
    acceptance: ['评论只来自当前仓库与 Issue。', '切换期间迟到的响应不覆盖新页面。', '本机草稿与当前账号保持隔离。'],
    commentsLabel: '讨论 · 8',
    previewComments: [
      { author: '林舟', initials: '林', time: '18 分钟前', text: '已复现。会补上切换时的请求失效处理，并验证返回列表后的位置保留。' },
      { author: '陈雨', initials: '陈', time: '8 分钟前', text: '也请覆盖切换前已经输入评论的情况，失败时不要清空内容。' },
    ],
    relatedPr: '#176 · 统一仓库上下文切换',
  },
};
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, 'fixture.json'), `${JSON.stringify(fixture, null, 2)}\n`);
console.log(JSON.stringify({ fixture: resolve(directory, 'fixture.json'), issues: issues.length, selected: fixture.selectedNumber }));
