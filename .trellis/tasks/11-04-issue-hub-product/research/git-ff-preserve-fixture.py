from pathlib import Path
import json
import subprocess
import tempfile
import sys

# 在自有临时仓库验证：已在上游提交、但当前仍为脏/未跟踪的同内容文件能否安全快进。
with tempfile.TemporaryDirectory(prefix='yg-ff-preserve-') as temporary:
    root = Path(temporary)
    def git(*args):
        return subprocess.run(['git', '-C', str(root), *args], capture_output=True, text=True, encoding='utf-8')
    assert git('init', '-b', 'main').returncode == 0
    assert git('config', 'user.name', '隔离验证').returncode == 0
    assert git('config', 'user.email', 'fixture@example.invalid').returncode == 0
    (root / 'skill.md').write_text('before\n', encoding='utf-8')
    git('add', 'skill.md'); assert git('commit', '-m', 'chore: 初始化').returncode == 0
    assert git('switch', '-c', 'upstream').returncode == 0
    (root / 'skill.md').write_text('after\n', encoding='utf-8')
    (root / 'reference.md').write_text('new\n', encoding='utf-8')
    git('add', 'skill.md', 'reference.md'); assert git('commit', '-m', 'docs: 上游更新').returncode == 0
    assert git('switch', 'main').returncode == 0
    (root / 'skill.md').write_text('after\n', encoding='utf-8')
    (root / 'reference.md').write_text('new\n', encoding='utf-8')
    if '--stage-published' in sys.argv:
        assert git('add', 'skill.md', 'reference.md').returncode == 0
    result = git('merge', '--ff-only', 'upstream')
    print(json.dumps({'fastForwardExit': result.returncode, 'trackedContentPreserved': (root / 'skill.md').read_text(encoding='utf-8') == 'after\n', 'untrackedContentPreserved': (root / 'reference.md').read_text(encoding='utf-8') == 'new\n', 'safeRefusal': result.returncode != 0}, ensure_ascii=False))
