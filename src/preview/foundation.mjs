import { createSurface, libraries } from '../index.mjs';

const list = document.getElementById('libraries');
for (const [libraryId, library] of Object.entries(libraries)) {
  const section = document.createElement('section');
  section.className = 'library-section';
  const heading = document.createElement('h2');
  heading.textContent = library.name;
  const description = document.createElement('p');
  description.textContent = `${library.description} ${library.shape}。`;
  const catalogLink = document.createElement('a');
  catalogLink.className = 'catalog-link';
  catalogLink.href = `./components.html?library=${libraryId}`;
  catalogLink.textContent = `检查${library.name}的全部组件`;
  const grid = document.createElement('div');
  grid.className = 'instance-grid';
  section.append(heading, description, catalogLink, grid);
  list.append(section);
  for (let index = 0; index < 2; index++) {
    const host = document.createElement('article');
    host.className = 'instance';
    const tools = document.createElement('div');
    tools.className = 'instance-tools';
    const name = document.createElement('span');
    name.textContent = `独立示例 ${index + 1}`;
    tools.append(name);
    host.append(tools);
    grid.append(host);
    const surface = createSurface(host, { library: libraryId, color: library.colors[index].id });
    function refreshControls() {
      tools.querySelectorAll('[data-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === surface.appearance.color)));
      mode.textContent = surface.appearance.mode === 'light' ? '切换暗色' : '切换亮色';
    }
    for (const theme of library.colors) {
      const button = document.createElement('button');
      button.textContent = theme.name;
      button.dataset.color = theme.id;
      button.addEventListener('click', () => { surface.setAppearance({ color: theme.id }); refreshControls(); });
      tools.append(button);
    }
    const mode = document.createElement('button');
    mode.addEventListener('click', () => { surface.setAppearance({ mode: surface.appearance.mode === 'light' ? 'dark' : 'light' }); refreshControls(); });
    tools.append(mode);
    refreshControls();
    const input = surface.input({ label: '项目名称', value: `设计示例 ${index + 1}`, hint: '这里填写的内容只保留在当前示例中。' });
    const actions = document.createElement('div');
    actions.className = 'sample-actions';
    surface.element.append(actions);
    const feedback = document.createElement('p');
    feedback.className = 'sample-feedback';
    feedback.setAttribute('role', 'status');
    feedback.textContent = '模拟操作，不会写入真实项目。';
    let count = 0;
    surface.button({ label: '保存示例', icon: 'check-circle', onPress() {
      if (!input.control.value.trim()) { input.update({ error: '请填写项目名称。' }); input.control.focus(); return; }
      input.update({ error: '' });
      feedback.textContent = `已保存“${input.control.value}”的演示状态，操作 ${++count} 次。`;
    } }, actions);
    surface.button({ label: '更新说明', variant: 'secondary', onPress() { input.update({ hint: '说明已更新，当前输入保持。' }); } }, actions);
    surface.element.append(feedback);
    surface.details({ title: '项目详情', description: library.interaction, content: '这里可以放置目标项目自己的内容。切换配色不会重新创建详情里的内容。', triggerLabel: '查看详情' });
    const states = document.createElement('div');
    states.className = 'sample-states';
    const stateLabel = document.createElement('span');
    stateLabel.textContent = '状态对照';
    states.append(stateLabel);
    surface.element.append(states);
    surface.button({ label: '暂不可用', disabled: true }, states);
    surface.button({ label: '处理中', loading: true }, states);
  }
}
