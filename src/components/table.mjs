import { lifecycle } from './lifecycle.mjs';
import { node } from './dom.mjs';
import { createIcon } from './icon.mjs';

export function mountTable(container, options = {}, library) {
  const document = container.ownerDocument;
  const element = node(document, 'section', 'dpc-table-component');
  const life = lifecycle(element);
  let props = { label: '数据表', rows: [], columns: [], rowKey: 'id', filters: [], pageSizes: [2, 3, 6], batchActions: [] };
  let state = { query: '', filterValues: {}, sort: null, page: 1, pageSize: 3, selected: new Set(), visibleColumns: new Set(), marked: new Set() };
  const tools = node(document, 'div', 'dpc-table-tools');
  const searchLabel = node(document, 'label', 'dpc-table-search');
  const search = node(document, 'input', 'dpc-input');
  search.type = 'search'; search.setAttribute('aria-label', '搜索数据表'); search.placeholder = '搜索内容';
  searchLabel.append(createIcon(document, 'magnifying-glass', library.icon), search);
  const filters = node(document, 'div', 'dpc-table-filters');
  const reset = node(document, 'button', 'dpc-btn dpc-secondary', '重置筛选'); reset.type = 'button'; reset.dataset.action = 'reset';
  const picker = node(document, 'details', 'dpc-column-picker');
  picker.append(node(document, 'summary', '', '显示列'));
  const columnChoices = node(document, 'div'); picker.append(columnChoices);
  tools.append(searchLabel, filters, reset, picker);
  const batch = node(document, 'div', 'dpc-batch-bar');
  const selectionCount = node(document, 'span'); selectionCount.setAttribute('role', 'status');
  const batchButtons = node(document, 'div', 'dpc-batch-actions');
  const clear = node(document, 'button', 'dpc-btn dpc-ghost', '清除选择'); clear.type = 'button'; clear.dataset.action = 'clear';
  batch.append(selectionCount, batchButtons, clear);
  const scroller = node(document, 'div', 'dpc-table-wrap');
  const table = node(document, 'table', 'dpc-data-table');
  const head = document.createElement('thead'); const body = document.createElement('tbody');
  table.append(head, body); scroller.append(table);
  const footer = node(document, 'div', 'dpc-pagination');
  const count = node(document, 'span');
  const sizeLabel = node(document, 'label', '', '每页');
  const size = document.createElement('select'); size.setAttribute('aria-label', '每页条数'); sizeLabel.append(size);
  const pages = node(document, 'div'); pages.setAttribute('role', 'group'); pages.setAttribute('aria-label', '数据分页');
  footer.append(count, sizeLabel, pages);
  element.append(tools, batch, scroller, footer);
  const key = row => String(row[props.rowKey]);

  function snapshot() {
    return {
      query: state.query, filterValues: { ...state.filterValues }, sort: state.sort ? { ...state.sort } : null,
      page: state.page, pageSize: state.pageSize,
      selected: props.rows.filter(row => state.selected.has(key(row))).map(row => row[props.rowKey]),
      visibleColumns: [...state.visibleColumns], marked: [...state.marked],
    };
  }

  function visibleRows() {
    const searchKeys = props.searchKeys ?? props.columns.map(column => column.key);
    const query = state.query.trim().toLocaleLowerCase();
    const rows = props.rows.filter(row => searchKeys.some(name => String(row[name] ?? '').toLocaleLowerCase().includes(query))
      && props.filters.every(filter => !state.filterValues[filter.key] || String(row[filter.key] ?? '') === state.filterValues[filter.key]));
    if (state.sort) {
      const { key: sortKey, direction } = state.sort;
      rows.sort((left, right) => {
        const a = left[sortKey]; const b = right[sortKey];
        return (typeof a === 'number' && typeof b === 'number' ? a - b : String(a ?? '').localeCompare(String(b ?? ''), 'zh-CN')) * (direction === 'desc' ? -1 : 1);
      });
    }
    return rows;
  }

  function rebuildTools() {
    filters.replaceChildren();
    for (const filter of props.filters) {
      const select = node(document, 'select', 'dpc-input'); select.dataset.filter = filter.key;
      select.setAttribute('aria-label', filter.label); select.append(new document.defaultView.Option(filter.allLabel ?? '全部', ''));
      for (const option of filter.options) select.append(new document.defaultView.Option(option.label, String(option.value)));
      filters.append(select);
    }
    columnChoices.replaceChildren();
    for (const column of props.columns.filter(column => column.hideable !== false)) {
      const label = node(document, 'label'); const input = document.createElement('input'); input.type = 'checkbox';
      input.dataset.column = column.key; input.dataset.focus = `column:${column.key}`;
      label.append(input, document.createTextNode(column.label)); columnChoices.append(label);
    }
    picker.hidden = !columnChoices.childElementCount;
    batchButtons.replaceChildren();
    for (const action of props.batchActions) {
      const button = node(document, 'button', 'dpc-btn dpc-ghost', action.label); button.type = 'button'; button.dataset.batch = action.id;
      batchButtons.append(button);
    }
    size.replaceChildren();
    for (const value of [...new Set([...props.pageSizes, state.pageSize])].sort((a, b) => a - b)) size.append(new document.defaultView.Option(`${value} 条`, String(value)));
  }

  function render() {
    const focusKey = element.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
    const rows = visibleRows(); const pageCount = Math.max(1, Math.ceil(rows.length / state.pageSize));
    state.page = Math.max(1, Math.min(pageCount, state.page));
    const pageRows = rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
    table.setAttribute('aria-label', props.label);
    if (search.value !== state.query) search.value = state.query;
    filters.querySelectorAll('select').forEach(select => { select.value = state.filterValues[select.dataset.filter] ?? ''; });
    columnChoices.querySelectorAll('input').forEach(input => { input.checked = state.visibleColumns.has(input.dataset.column); });
    size.value = String(state.pageSize);
    selectionCount.textContent = `已选择 ${state.selected.size} 项`;
    clear.disabled = state.selected.size === 0;
    batchButtons.querySelectorAll('button').forEach(button => { button.disabled = !state.selected.size || Boolean(props.batchActions.find(action => action.id === button.dataset.batch)?.disabled); });
    const header = document.createElement('tr');
    const allCell = document.createElement('th');
    const all = document.createElement('input'); all.type = 'checkbox'; all.setAttribute('aria-label', '选择本页全部'); all.dataset.action = 'select-page'; all.dataset.focus = 'select-page';
    all.checked = pageRows.length > 0 && pageRows.every(row => state.selected.has(key(row)));
    all.indeterminate = !all.checked && pageRows.some(row => state.selected.has(key(row)));
    all.disabled = pageRows.length === 0; allCell.append(all); header.append(allCell);
    for (const column of props.columns) {
      const cell = document.createElement('th'); cell.scope = 'col'; cell.hidden = !state.visibleColumns.has(column.key);
      if (column.sortable) {
        const sorted = state.sort?.key === column.key;
        cell.setAttribute('aria-sort', sorted ? (state.sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
        const button = node(document, 'button', '', `${column.label} ${sorted ? (state.sort.direction === 'asc' ? '↑' : '↓') : '↕'}`);
        button.type = 'button'; button.dataset.sort = column.key; button.dataset.focus = `sort:${column.key}`; cell.append(button);
      } else cell.textContent = column.label;
      header.append(cell);
    }
    head.replaceChildren(header); body.replaceChildren();
    for (const row of pageRows) {
      const tr = document.createElement('tr'); const selectCell = document.createElement('td');
      const select = document.createElement('input'); select.type = 'checkbox'; select.dataset.row = key(row); select.dataset.focus = `row:${key(row)}`;
      select.setAttribute('aria-label', `选择${row[props.columns[0].key] ?? key(row)}`); select.checked = state.selected.has(key(row));
      selectCell.append(select); tr.append(selectCell);
      for (const [index, column] of props.columns.entries()) {
        const cell = node(document, 'td'); cell.hidden = !state.visibleColumns.has(column.key);
        if (column.tag) cell.append(node(document, 'span', 'dpc-table-tag', row[column.key] ?? ''));
        else cell.textContent = String(row[column.key] ?? '');
        if (index === 0 && state.marked.has(key(row))) cell.append(node(document, 'span', 'dpc-table-mark', '已标记'));
        tr.append(cell);
      }
      body.append(tr);
    }
    if (!pageRows.length) {
      const row = document.createElement('tr'); const cell = node(document, 'td', 'dpc-table-empty', props.emptyText ?? '没有符合条件的记录，请调整筛选。');
      cell.colSpan = 1 + state.visibleColumns.size; row.append(cell); body.append(row);
    }
    count.textContent = `共 ${rows.length} 条`; pages.replaceChildren();
    for (const entry of [{ page: state.page - 1, label: '上一页', disabled: state.page === 1, focus: 'previous' },
      ...Array.from({ length: pageCount }, (_, index) => ({ page: index + 1, label: String(index + 1), current: state.page === index + 1, focus: `page:${index + 1}` })),
      { page: state.page + 1, label: '下一页', disabled: state.page === pageCount, focus: 'next' }]) {
      const button = node(document, 'button', `dpc-btn${entry.current ? '' : ' dpc-secondary'}`, entry.label);
      button.type = 'button'; button.dataset.page = String(entry.page); button.dataset.focus = entry.focus; button.disabled = Boolean(entry.disabled);
      if (entry.current) button.setAttribute('aria-current', 'page');
      if (/^\d+$/.test(entry.label)) button.setAttribute('aria-label', `第 ${entry.label} 页`);
      pages.append(button);
    }
    if (focusKey) [...element.querySelectorAll('[data-focus]')].find(control => control.dataset.focus === focusKey)?.focus({ preventScroll: true });
  }

  function update(patch = {}) {
    life.assertAlive();
    const next = { ...props, ...patch };
    if (!next.columns.length || new Set(next.columns.map(column => column.key)).size !== next.columns.length) throw new Error('表格需要不重复的列');
    const ids = next.rows.map(row => row[next.rowKey]);
    if (ids.some(id => id === null || id === undefined) || new Set(ids.map(String)).size !== ids.length) throw new Error('表格行需要唯一标识');
    const pageSize = patch.pageSize ?? state.pageSize;
    if (!Number.isInteger(pageSize) || pageSize < 1 || next.pageSizes.some(value => !Number.isInteger(value) || value < 1)) throw new Error('每页条数必须为正整数');
    if (patch.page !== undefined && (!Number.isInteger(patch.page) || patch.page < 1)) throw new Error('页码必须为正整数');
    const nextSort = Object.hasOwn(patch, 'sort') ? patch.sort : state.sort;
    if (nextSort && (!next.columns.some(column => column.key === nextSort.key && column.sortable) || !['asc', 'desc'].includes(nextSort.direction))) throw new Error('无效的排序方式');
    const columnKeys = next.columns.map(column => column.key);
    const first = !props.columns.length;
    const visible = new Set(patch.visibleColumns ?? (first ? columnKeys : [...state.visibleColumns].filter(key => columnKeys.includes(key))));
    next.columns.filter(column => column.hideable === false).forEach(column => visible.add(column.key));
    if ([...visible].some(key => !columnKeys.includes(key))) throw new Error('未知显示列');
    props = next;
    state = { ...state, pageSize, sort: nextSort ? { ...nextSort } : null, visibleColumns: visible,
      selected: new Set((patch.selected ?? [...state.selected]).map(String).filter(id => ids.map(String).includes(id))),
      marked: new Set((patch.marked ?? [...state.marked]).map(String)),
    };
    for (const name of ['query', 'page']) if (Object.hasOwn(patch, name)) state[name] = name === 'query' ? String(patch[name]) : patch[name];
    if (patch.filterValues) state.filterValues = { ...patch.filterValues };
    if (first || ['columns', 'filters', 'batchActions', 'pageSizes', 'pageSize'].some(key => Object.hasOwn(patch, key))) rebuildTools();
    render();
  }

  function changed(selection = false) {
    render();
    if (selection) props.onSelectionChange?.(snapshot().selected);
    props.onChange?.(snapshot());
  }
  search.addEventListener('input', () => { state.query = search.value; state.page = 1; changed(); }, { signal: life.signal });
  element.addEventListener('change', event => {
    const control = event.target;
    if (control.dataset.filter !== undefined) { state.filterValues[control.dataset.filter] = control.value; state.page = 1; changed(); }
    else if (control === size) { state.pageSize = Number(size.value); state.page = 1; changed(); }
    else if (control.dataset.column !== undefined) { control.checked ? state.visibleColumns.add(control.dataset.column) : state.visibleColumns.delete(control.dataset.column); changed(); }
    else if (control.dataset.row !== undefined) { control.checked ? state.selected.add(control.dataset.row) : state.selected.delete(control.dataset.row); changed(true); }
    else if (control.dataset.action === 'select-page') {
      visibleRows().slice((state.page - 1) * state.pageSize, state.page * state.pageSize).forEach(row => control.checked ? state.selected.add(key(row)) : state.selected.delete(key(row)));
      changed(true);
    }
  }, { signal: life.signal });
  element.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button || !element.contains(button) || button.disabled) return;
    if (button.dataset.sort) { state.sort = { key: button.dataset.sort, direction: state.sort?.key === button.dataset.sort && state.sort.direction === 'asc' ? 'desc' : 'asc' }; state.page = 1; changed(); }
    else if (button.dataset.page) { state.page = Number(button.dataset.page); changed(); }
    else if (button.dataset.action === 'reset') { state.query = ''; state.filterValues = {}; state.page = 1; changed(); }
    else if (button.dataset.action === 'clear') { state.selected.clear(); changed(true); }
    else if (button.dataset.batch) props.onBatch?.(button.dataset.batch, snapshot().selected);
  }, { signal: life.signal });
  update(options); container.append(element);
  return { element, update, get state() { return snapshot(); }, destroy() { life.destroy(); } };
}
