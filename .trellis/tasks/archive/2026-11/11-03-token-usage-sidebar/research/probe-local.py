import collections
import json
import pathlib
import queue
import sqlite3
import subprocess
import threading
import time

home = pathlib.Path.home() / '.codex'
db = sqlite3.connect((home / 'state_5.sqlite').as_uri() + '?mode=ro', uri=True)
db.execute('PRAGMA query_only=ON')
print('columns', {name: [r[1] for r in db.execute('PRAGMA table_info(' + name + ')')] for name in ['threads', 'projects', 'project_roots']})
print('providers', db.execute('SELECT model_provider,count(*) FROM threads GROUP BY model_provider').fetchall())
print('project_coverage', db.execute('SELECT count(*),sum(project_id IS NOT NULL),sum(creator_account_id IS NOT NULL) FROM threads').fetchone())
recent = db.execute('SELECT id,rollout_path FROM threads WHERE rollout_path IS NOT NULL ORDER BY updated_at DESC LIMIT 12').fetchall()
for target_id, raw in recent:
    path = pathlib.Path(raw)
    if not path.is_file():
        continue
    own = None
    boundary = None
    usage = []
    metas = []
    with path.open(encoding='utf-8') as source:
        for ordinal, line in enumerate(source):
            try:
                record = json.loads(line)
            except ValueError:
                continue
            payload = record.get('payload') or {}
            if record.get('type') == 'session_meta':
                matching = payload.get('id') == target_id
                metas.append({'ordinal': ordinal, 'own': matching, 'keys': list(payload)})
                if matching:
                    own = payload
                    boundary = payload.get('subagent_history_start_ordinal')
            if record.get('type') == 'event_msg' and payload.get('type') == 'token_count' and payload.get('info'):
                info = payload['info']
                total = info.get('total_token_usage') or {}
                last = info.get('last_token_usage') or {}
                usage.append({'ordinal': ordinal, 'record_keys': list(record), 'total': total.get('total_tokens'), 'last': last.get('total_tokens')})
    print('rollout', json.dumps({'metas': metas, 'boundary': boundary, 'usage_count': len(usage), 'first': usage[:2], 'last': usage[-1:], 'before_boundary': sum(row['ordinal'] < boundary for row in usage) if isinstance(boundary, int) else None}, ensure_ascii=False))

exe = pathlib.Path.home() / 'AppData/Roaming/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'
process = subprocess.Popen([str(exe), 'app-server', '--stdio'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, encoding='utf-8', creationflags=subprocess.CREATE_NO_WINDOW)
responses = queue.Queue()
def reader():
    for line in process.stdout:
        try:
            responses.put(json.loads(line))
        except ValueError:
            pass
threading.Thread(target=reader, daemon=True).start()
def call(identifier, method, params=None):
    request = {'id': identifier, 'method': method}
    if params is not None:
        request['params'] = params
    process.stdin.write(json.dumps(request) + '\n')
    process.stdin.flush()
    deadline = time.monotonic() + 18
    while time.monotonic() < deadline:
        try:
            response = responses.get(timeout=max(.01, deadline-time.monotonic()))
        except queue.Empty:
            break
        if response.get('id') == identifier:
            return response
    return {}
try:
    initialized = call(1, 'initialize', {'clientInfo': {'name': 'yg_usage_probe', 'version': '0.0.0'}, 'capabilities': {'experimentalApi': True}})
    process.stdin.write(json.dumps({'method': 'initialized'}) + '\n')
    process.stdin.flush()
    response = call(2, 'account/rateLimits/read')
    account_id = (response.get('result') or {}).get('accountId')
    print('identity', {'available': bool(account_id), 'matched_threads': db.execute('SELECT count(*) FROM threads WHERE creator_account_id=?', (account_id,)).fetchone()[0] if account_id else None})
    result = call(3, 'account/usage/read').get('result') or {}
    print('usage_schema', {'keys': list(result), 'summary_keys': list(result.get('summary') or {}), 'daily_count': len(result.get('dailyUsageBuckets') or []), 'bucket_keys': list((result.get('dailyUsageBuckets') or [{}])[0])})
finally:
    process.stdin.close()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.terminate()
    db.close()
