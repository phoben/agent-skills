export const DEFAULT_WIDTHS = Object.freeze({ navigationWidth: 164, queueWidth: 316 });
const limit = (value, min, max) => Math.max(min, Math.min(max, value));

// 记住用户偏好，窗口缩小时只收紧实际宽度，不覆盖其较大窗口偏好。
export function constrainWidths(preferred, width, { detail = true } = {}) {
  const drawer = width <= 1050, single = width < 900;
  const navigationMax = Math.min(420, Math.max(164, width - (detail ? 280 + 360 : 280)));
  const navigationWidth = drawer ? 0 : limit(Number(preferred.navigationWidth) || 164, 164, navigationMax);
  const queueMax = Math.min(640, Math.max(280, width - navigationWidth - 360));
  const queueWidth = limit(Number(preferred.queueWidth) || 316, 280, queueMax);
  return { navigationWidth, queueWidth, navigationMax, queueMax, drawer, single };
}

export function createColumnLayout({ root, view = globalThis.window, onCommit = () => {} }) {
  let preferred = { ...DEFAULT_WIDTHS }, dragging = null, detail = false;
  const separators = [...root.querySelectorAll('[data-column]')];
  function snapshot() { return constrainWidths(preferred, root.clientWidth || view.innerWidth, { detail }); }
  function apply() {
    const actual = snapshot();
    root.style.setProperty('--navigation-width', `${actual.navigationWidth}px`);
    root.style.setProperty('--queue-width', `${actual.queueWidth}px`);
    for (const node of separators) {
      const navigation = node.dataset.column === 'navigation';
      const value = navigation ? actual.navigationWidth : actual.queueWidth;
      const max = navigation ? actual.navigationMax : actual.queueMax;
      node.hidden = navigation ? actual.drawer : !detail || actual.single;
      node.setAttribute('aria-valuenow', String(Math.round(value)));
      node.setAttribute('aria-valuemax', String(Math.round(max)));
      node.setAttribute('aria-valuetext', `${Math.round(value)} 像素`);
    }
    return actual;
  }
  function commit() { onCommit({ ...preferred }); }
  function setColumn(column, value, { persist = true } = {}) {
    const actual = snapshot();
    const property = column === 'navigation' ? 'navigationWidth' : 'queueWidth';
    preferred[property] = limit(value, column === 'navigation' ? 164 : 280, column === 'navigation' ? actual.navigationMax : actual.queueMax);
    apply(); if (persist) commit();
  }
  function finish(event, cancelled = false) {
    if (!dragging || event.pointerId !== dragging.pointerId) return;
    const prior = dragging; dragging = null;
    if (cancelled) preferred = prior.before;
    if (prior.node.hasPointerCapture?.(event.pointerId)) prior.node.releasePointerCapture(event.pointerId);
    delete root.dataset.resizing; apply(); if (!cancelled) commit();
  }
  for (const node of separators) {
    node.addEventListener('pointerdown', event => {
      if (event.button !== 0 || node.hidden) return;
      event.preventDefault(); event.stopPropagation();
      const actual = snapshot(), column = node.dataset.column;
      dragging = { pointerId: event.pointerId, node, column, start: event.clientX, initial: column === 'navigation' ? actual.navigationWidth : actual.queueWidth, before: { ...preferred } };
      node.setPointerCapture(event.pointerId); node.focus({ preventScroll: true }); root.dataset.resizing = column;
    });
    node.addEventListener('pointermove', event => {
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      event.preventDefault(); setColumn(dragging.column, dragging.initial + event.clientX - dragging.start, { persist: false });
    });
    node.addEventListener('pointerup', event => finish(event));
    node.addEventListener('pointercancel', event => finish(event, true));
    node.addEventListener('lostpointercapture', event => finish(event, true));
    node.addEventListener('dblclick', event => { event.preventDefault(); reset(node.dataset.column); });
    node.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const column = node.dataset.column, actual = snapshot();
      const value = column === 'navigation' ? actual.navigationWidth : actual.queueWidth;
      if (event.key === 'Enter') return reset(column);
      const next = event.key === 'Home' ? column === 'navigation' ? 164 : 280 : event.key === 'End' ? column === 'navigation' ? actual.navigationMax : actual.queueMax : value + (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 48 : 16);
      setColumn(column, next);
    });
  }
  function reset(column) {
    if (column) preferred[column === 'navigation' ? 'navigationWidth' : 'queueWidth'] = DEFAULT_WIDTHS[column === 'navigation' ? 'navigationWidth' : 'queueWidth'];
    else preferred = { ...DEFAULT_WIDTHS };
    apply(); commit();
  }
  view.addEventListener('resize', apply);
  apply();
  return {
    sync(opened) { detail = opened; return apply(); },
    restore(value = {}) { preferred = { navigationWidth: limit(Number(value.navigationWidth) || 164, 164, 420), queueWidth: limit(Number(value.queueWidth) || 316, 280, 640) }; return apply(); },
    reset, snapshot,
    preferences() { return { ...preferred }; },
  };
}
