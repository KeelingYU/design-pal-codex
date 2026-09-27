import { createSurface, libraries } from '../../src/index.mjs';
import { createTasks } from './model.mjs';
const tasks = createTasks();
const library = new URL(location.href).searchParams.get('library') || 'order';
const firstColor = libraries[library]?.colors[0]?.id;
const surface = createSurface(document.querySelector('#app'), { library, ...(firstColor ? { color: firstColor } : {}) });
const section = className => { const node = document.createElement('section'); node.className = className; surface.element.append(node); return node; };
const controls = section('sample-controls');
surface.toggle({ label: '暗色模式', value: false, onChange(value) { surface.setAppearance({ mode: value ? 'dark' : 'light' }); } }, controls);
let selected = '1';
const table = surface.table({
  label: '模拟任务', rows: tasks.list(), pageSize: 2,
  columns: [{ key: 'name', label: '任务', hideable: false }, { key: 'status', label: '状态', tag: true }],
  filters: [{ key: 'status', label: '按状态筛选', options: ['待开始', '进行中', '已完成', '已取消'].map(value => ({ value, label: value })) }],
  onSelectionChange(ids) { if (ids.length) selectTask(ids.at(-1)); },
});
const editor = section('sample-editor');
const heading = document.createElement('h2'); heading.textContent = '任务操作'; editor.append(heading);
const name = surface.input({ label: '任务名称', value: tasks.get(selected).name }, editor);
const message = document.createElement('p'); message.setAttribute('role', 'status'); message.dataset.testid = 'message'; editor.append(message);
const status = document.createElement('p'); status.dataset.testid = 'task-status'; editor.append(status);
const actions = document.createElement('div'); actions.className = 'sample-actions'; editor.append(actions);
function run(operation) { try { operation(); refresh(); message.textContent = '模拟操作已保存（仅当前页面）'; } catch (error) { message.textContent = error.message; } }
surface.button({ label: '保存任务', onPress: () => run(() => tasks.save(selected, name.control.value)) }, actions);
const start = surface.button({ label: '模拟开始', onPress: () => run(() => tasks.transition(selected, 'start')) }, actions);
const complete = surface.button({ label: '模拟完成', onPress: () => run(() => tasks.transition(selected, 'complete')) }, actions);
const cancel = surface.button({ label: '模拟取消', onPress: () => run(() => tasks.transition(selected, 'cancel')) }, actions);
const details = surface.details({ title: '模拟任务详情', triggerLabel: '查看任务详情', content: '' }, editor);
function refresh() {
  const task = tasks.get(selected); table.update({ rows: tasks.list() });
  status.textContent = `当前任务：${task.name} · ${task.status}`;
  start.update({ disabled: task.status !== '待开始' }); complete.update({ disabled: task.status !== '进行中' }); cancel.update({ disabled: !['待开始', '进行中'].includes(task.status) });
  details.update({ content: `${task.name}\n${task.status}\n${task.result}` });
}
function selectTask(id) { selected = id; name.update({ value: tasks.get(id).name }); message.textContent = ''; refresh(); }
refresh();
window.addEventListener('pagehide', () => surface.destroy(), { once: true });
