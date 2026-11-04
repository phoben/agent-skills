// 首次提交同步执行；只有真正未保存的输入需要等待，过期选择不会稍后跳回来。
export function createLatestSelection() {
  let version = 0, pendingKey = null, pending = null, preparing = false;
  function invalidate() { version++; pendingKey = null; pending = null; preparing = false; }
  function select(key, { prepare = () => undefined, commit, pendingFeedback = () => {} }) {
    if (key === pendingKey && pending) return pending;
    const generation = ++version;
    pendingKey = key; preparing = false;
    const current = () => generation === version;
    let preparation;
    try { preparation = prepare(current); } catch (error) { pendingKey = null; throw error; }
    let result;
    if (preparation?.then) {
      preparing = true;
      pendingFeedback();
      result = Promise.resolve(preparation).then(ready => { if (current()) { preparing = false; if (ready !== false) return commit(current); } });
    } else if (preparation !== false) result = commit(current);
    pending = Promise.resolve(result).finally(() => { if (current()) { pendingKey = null; pending = null; preparing = false; } });
    return pending;
  }
  return { select, invalidate, isPreparing: () => preparing };
}
