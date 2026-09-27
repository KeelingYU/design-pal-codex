import { createTasks } from './model.mjs';
const tasks = createTasks();
const root = document.createElement('section'); root.className = 'baseline'; document.querySelector('#app').append(root);
// 标记均为固定样例模板；业务文字只用 textContent 设置。
root.innerHTML = `<div class="sample-controls"><label>搜索<input type="search" aria-label="搜索数据表"></label><label>状态<select aria-label="按状态筛选"><option value="">全部</option>${['待开始', '进行中', '已完成', '已取消'].map(value => `<option>${value}</option>`).join('')}</select></label><button type="button" id="reset">重置筛选</button></div><table aria-label="模拟任务"><thead><tr><th>选择</th><th>任务</th><th>状态</th></tr></thead><tbody></tbody></table><div class="sample-actions"><button id="previous">上一页</button><span id="count"></span><button id="next">下一页</button></div><section class="sample-editor"><h2>任务操作</h2><label>任务名称<input id="name"></label><p role="status" data-testid="message"></p><p data-testid="task-status"></p><div class="sample-actions"><button id="save">保存任务</button><button id="start">模拟开始</button><button id="complete">模拟完成</button><button id="cancel">模拟取消</button><button id="details">查看任务详情</button></div><p id="detail" hidden></p></section>`;
let selected = '1', page = 1;
const query = root.querySelector('input[type=search]'), filter = root.querySelector('select'), name = root.querySelector('#name');
name.value = tasks.get(selected).name;
function refresh() {
  const rows = tasks.list().filter(task => task.name.includes(query.value.trim()) && (!filter.value || task.status === filter.value));
  page = Math.min(page, Math.max(1, Math.ceil(rows.length / 2)));
  const body = root.querySelector('tbody'); body.replaceChildren();
  for (const task of rows.slice((page - 1) * 2, page * 2)) {
    const row = document.createElement('tr'), choose = document.createElement('input'); choose.type = 'checkbox'; choose.setAttribute('aria-label', `选择${task.name}`);
    choose.checked = task.id === selected;
    choose.addEventListener('change', () => { selected = task.id; name.value = task.name; refresh(); });
    const cell = document.createElement('td'); cell.append(choose); row.append(cell);
    for (const value of [task.name, task.status]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    body.append(row);
  }
  root.querySelector('#count').textContent = `共 ${rows.length} 条 · 第 ${page} 页`;
  root.querySelector('#previous').disabled = page <= 1; root.querySelector('#next').disabled = page * 2 >= rows.length;
  const task = tasks.get(selected); root.querySelector('[data-testid=task-status]').textContent = `当前任务：${task.name} · ${task.status}`;
  root.querySelector('#start').disabled = task.status !== '待开始'; root.querySelector('#complete').disabled = task.status !== '进行中'; root.querySelector('#cancel').disabled = !['待开始', '进行中'].includes(task.status);
  root.querySelector('#detail').textContent = `${task.name} · ${task.status} · ${task.result}`;
}
for (const control of [query, filter]) control.addEventListener(control === query ? 'input' : 'change', () => { page = 1; refresh(); });
root.querySelector('#reset').onclick = () => { query.value = ''; filter.value = ''; page = 1; refresh(); };
root.querySelector('#previous').onclick = () => { page--; refresh(); }; root.querySelector('#next').onclick = () => { page++; refresh(); };
root.querySelector('#details').onclick = () => { root.querySelector('#detail').hidden = !root.querySelector('#detail').hidden; };
function run(operation) { try { operation(); refresh(); root.querySelector('[data-testid=message]').textContent = '模拟操作已保存（仅当前页面）'; } catch (error) { root.querySelector('[data-testid=message]').textContent = error.message; } }
root.querySelector('#save').onclick = () => run(() => tasks.save(selected, name.value));
for (const action of ['start', 'complete', 'cancel']) root.querySelector(`#${action}`).onclick = () => run(() => tasks.transition(selected, action));
refresh();
