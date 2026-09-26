export function lifecycle(element) {
  const events = new element.ownerDocument.defaultView.AbortController();
  let alive = true;
  return {
    signal: events.signal,
    assertAlive() { if (!alive) throw new Error('组件已卸载'); },
    destroy(cleanup = () => {}) {
      if (!alive) return;
      alive = false;
      events.abort();
      cleanup();
      element.remove();
    },
  };
}
