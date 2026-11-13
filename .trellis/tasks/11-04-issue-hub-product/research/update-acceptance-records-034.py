from pathlib import Path
import json

# 只同步本任务的当前验收状态，原需求与历史失败证据保留。
root = Path(__file__).resolve().parents[4]
parent = root / '.trellis/tasks/11-03-github-issue-plugin/prd.md'
text = parent.read_text(encoding='utf-8')
for number in (1, 2, 5, 6, 8, 9, 10, 11, 12, 13):
    text = text.replace(f'- [ ] A{number}（', f'- [x] A{number}（')
start = text.index('## 0.3.0 验收矩阵')
end = text.index('## 首版不包含', start)
matrix = '''## 当前验收矩阵（0.3.4，2026-11-04）

本机验收完成，A7由用户明确暂缓。完整证据与边界见 [本机结论](../11-04-issue-hub-product/research/local-acceptance-034.md)，第二机按 [交接清单](../11-04-issue-hub-product/windows-handoff.md)接手。以下通过项按各自的原生、API、浏览器和隔离测试证据判定，不将未测分支冒称原生通过。

| 验收项 | 当前结果 | 边界或后续 |
| --- | --- | --- |
| A1 单入口与导航 | 安装后1global，真实浏览器多仓库连续切换，用户实际桌面持续使用 | 本机通过；首版采用页面内导航 |
| A2 项目发现 | 用户核对含无聊天项目的当前清单暂未发现缺少，项目读取/变化/失效有回归 | 本机通过；保留partial及5层/1500目录界限，不宣称全盘无界发现 |
| A3 列表详情 | 真实非空列表、详情和返回，PR排除 | 通过 |
| A4 管理同步 | 本项目#5管理闭环、独立读回及真实下一轮60秒刷新 | 通过；验收Issue已关闭清理 |
| A5 完整信息 | 101评论真实分页；资料缺失状态/首批与后页PR更新修复；真实PR元数据、Ego空态与安全链接回归 | 通过；公开PR使用受控只读目录adapter，不冒充桌面项目 |
| A6 新聊天 | 用户确认正确工作区、预填及手动发送 | 原生核心通过 |
| A7 团队第二机 | 最新ZIP及本机隔离profile安装通过 | 用户明确暂缓另一台真实Windows，不标通过 |
| A8 故障并发 | 冲突/失权/限流/未知回执及SQLite并发回归，真实重放 | 通过；不宣称GitHub原子CAS或所有真实故障被人为触发 |
| A9 离线草稿 | 真实gh受控断连、缓存、两类草稿、离线重启及恢复不发布四阶段通过 | 数据/控制器通过；未关闭系统网络，不称原生系统断网实测 |
| A10 多工作区 | 真实Git/worktree、选择/去重/失效回归，浏览器改绑定及原生单路径通过 | 工程通过；真实原生多路径另建未单独实测 |
| A11 聊天返回 | 当前双身份完整唯一关联，用户实际返回同一聊天、原草稿保留；另建/误点/历史有回归 | 核心原生及工程边界通过，不要求重复新建 |
| A12 提示词 | 用户编辑并手动发送，最新Issue读取入口及授权边界保留 | 通过；验收没有执行默认开发任务 |
| A13 UI | A方向与完整原型已确认，既有两档尺寸/浅深/独立评审；本轮Ego来源抽查通过 | 通过；不重新请求方向确认 |

'''
text = text[:start] + matrix + text[end:]
text = text.replace('正式管理页已实现并安装0.3.0', '正式管理页已实现并安装0.3.4')
parent.write_text(text, encoding='utf-8')

task = root / '.trellis/tasks/11-04-issue-hub-product/task.json'
value = json.loads(task.read_text(encoding='utf-8'))
value['notes'] = '0.3.4本机验收与交接准备完成：用户确认工作区/手动发送/原草稿/返回同一聊天及当前清单无缺少；A5资料展示补齐，221测试/49语法、受控真实gh断连四阶段、Ego抽查、8文件哈希及最终包隔离安装通过。A7另一台Windows按用户明确要求暂缓，见research/local-acceptance-034.md和windows-handoff.md。无提交推送发布。'
value['meta'] = {**value.get('meta', {}), 'local_acceptance': 'passed', 'team_acceptance': 'deferred-by-user', 'delivery_version': '0.3.4'}
task.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

prd = root / '.trellis/tasks/11-04-issue-hub-product/prd.md'
product = prd.read_text(encoding='utf-8')
product = product.replace('- [ ] ', '- [x] ')
product += '\n2026-11-04本机验收与交接准备完成，0.3.4已安装。上述交付按原生、API、浏览器及隔离证据验收，详见 [当前结论](research/local-acceptance-034.md)。A7另一台Windows由用户明确暂缓，任务保留该后续验收，不将本机隔离安装写成第二机通过；团队按 [交接清单](windows-handoff.md)接手。\n'
prd.write_text(product, encoding='utf-8')
print(json.dumps({'version': '0.3.4', 'localAcceptance': 'passed', 'secondMachine': 'deferred-by-user', 'taskStatus': value['status']}, ensure_ascii=False))
