from pathlib import Path
import hashlib
import json
import os
import sqlite3
import sys

# 只保存本机持久状态的数量与摘要，不输出作用域、正文、令牌或聊天标识。
database = Path(os.environ['LOCALAPPDATA']) / 'IssueHub/data/issue-hub.sqlite'
connection = sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)
try:
    schema = connection.execute('PRAGMA user_version').fetchone()[0]
    counts = dict(connection.execute('SELECT kind,COUNT(*) FROM entries GROUP BY kind').fetchall())
    protected = ('draft', 'preference', 'view', 'view-state', 'operation', 'issue-task-request', 'issue-task-index', 'issue-workspace-binding')
    rows = connection.execute('SELECT scope,kind,entry_key,value FROM entries WHERE kind IN (' + ','.join('?' for _ in protected) + ') ORDER BY scope,kind,entry_key', protected).fetchall()
    digest = hashlib.sha256(json.dumps(rows, ensure_ascii=False, separators=(',', ':')).encode('utf-8')).hexdigest()
    result = {'schema': schema, 'kindCounts': counts, 'protectedRows': len(rows), 'protectedDigest': digest, 'readOnly': True, 'contentPrinted': False}
finally:
    connection.close()
variant = sys.argv[1] if len(sys.argv) > 1 else 'before'
assert variant in ('before', 'after')
prefix = 'task-return-data' if '--task-return' in sys.argv else 'html-comments-data' if '--html-comments' in sys.argv else 'app-only-tools-data' if '--app-only' in sys.argv else 'discovery-policy-data' if '--discovery-policy' in sys.argv else 'account-menu-data' if '--account-menu' in sys.argv else 'image-preview-data' if '--image-preview' in sys.argv else 'issue-recovery-data' if '--issue-recovery' in sys.argv else 'toolkit-data'
directory = Path(__file__).parent
if variant == 'after':
    before = json.loads((directory / f'{prefix}-before.json').read_text(encoding='utf-8'))
    result['protectedStateUnchanged'] = before['schema'] == result['schema'] and before['protectedRows'] == result['protectedRows'] and before['protectedDigest'] == result['protectedDigest']
(directory / f'{prefix}-{variant}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
