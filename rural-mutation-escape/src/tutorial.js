const TUTORIALS = Object.freeze([
  { id: 'move', text: 'WASD 移动' },
  { id: 'sprint', text: 'Shift 奔跑' },
  { id: 'look', text: '鼠标环顾' },
  { id: 'camera', text: 'C 切换视角' },
  { id: 'interact', text: 'E 互动' },
]);

export function createTutorialTracker({ onChange = () => {} } = {}) {
  const completed = new Set();
  let current = TUTORIALS[0];

  function publish() {
    current = TUTORIALS.find(({ id }) => !completed.has(id)) ?? null;
    onChange(current);
  }

  const tracker = {
    get current() { return current; },
    complete(action) {
      if (!TUTORIALS.some(({ id }) => id === action) || completed.has(action)) return false;
      completed.add(action);
      publish();
      return true;
    },
    reset() {
      completed.clear();
      publish();
    },
  };
  onChange(current);
  return tracker;
}
