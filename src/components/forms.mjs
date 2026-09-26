import { lifecycle } from './lifecycle.mjs';
import { node, uniqueId } from './dom.mjs';

// 表单共享标签、提示与销毁；业务值仅在明确传入 value 时才由更新覆盖。
function field(container, options, grouped = false) {
  const document = container.ownerDocument;
  const element = node(document, grouped ? 'fieldset' : 'div', grouped ? 'dpc-option-field' : 'dpc-field dpc-form-field');
  const label = node(document, grouped ? 'legend' : 'label');
  const body = node(document, 'div', 'dpc-form-body');
  const message = node(document, 'p', 'dpc-field-hint');
  message.id = uniqueId(document, 'form-message');
  element.append(label, body, message);
  const life = lifecycle(element);
  let props = { label: '', hint: '', error: '', disabled: false, ...options };
  function update(patch) {
    life.assertAlive();
    const next = { ...props, ...patch };
    if (!String(next.label).trim()) throw new Error('表单组件必须有标签');
    props = next;
    label.textContent = props.label;
    if (grouped) element.disabled = Boolean(props.disabled);
  }
  function describe(controls, validation = '') {
    const error = props.error || validation;
    message.textContent = error || props.hint;
    message.classList.toggle('dpc-error', Boolean(error));
    if (error) message.setAttribute('role', 'alert');
    else message.removeAttribute('role');
    for (const control of controls) {
      control.setAttribute('aria-invalid', String(Boolean(error)));
      if (message.textContent) control.setAttribute('aria-describedby', message.id);
      else control.removeAttribute('aria-describedby');
    }
  }
  update({});
  return { document, element, label, body, message, life, update, describe, get props() { return props; }, mount() { container.append(element); } };
}

function connectLabel(f, control) {
  control.id = uniqueId(f.document, 'form-control');
  f.label.htmlFor = control.id;
}
function result(f, update, controls, value, extras = {}) {
  f.mount();
  return { element: f.element, ...extras, get controls() { return controls(); }, get value() { return value(); }, update, destroy() { f.life.destroy(); } };
}
function nativeAttributes(control, props, names) {
  for (const name of names) {
    if (props[name] === undefined || props[name] === null || props[name] === '') control.removeAttribute(name);
    else control.setAttribute(name, String(props[name]));
  }
}
function choices(options) {
  if (!Array.isArray(options)) throw new Error('选项必须是数组');
  const seen = new Set();
  return options.map(option => {
    if (typeof option.value !== 'string' || seen.has(option.value)) throw new Error('选项值必须是唯一字符串');
    seen.add(option.value);
    return { ...option, label: String(option.label ?? option.value) };
  });
}

function mountToggle(container, options = {}) {
  const f = field(container, options);
  const control = node(f.document, 'input', 'dpc-switch');
  control.type = 'checkbox';
  control.setAttribute('role', 'switch');
  connectLabel(f, control);
  f.body.append(control);
  f.element.classList.add('dpc-toggle-field');
  function update(patch = {}) {
    f.update(patch);
    if (Object.hasOwn(patch, 'value')) control.checked = Boolean(patch.value);
    control.disabled = Boolean(f.props.disabled);
    f.describe([control]);
  }
  control.addEventListener('change', event => {
    if (f.props.disabled) return;
    f.props.onChange?.(control.checked, event);
  }, { signal: f.life.signal });
  update(options);
  return result(f, update, () => [control], () => control.checked, { control });
}

function mountChoices(container, options = {}, kind) {
  const grouped = kind !== 'select';
  const f = field(container, { options: [], ...options }, grouped);
  const list = kind === 'select' ? node(f.document, 'select', 'dpc-input') : node(f.document, 'div', kind === 'segmented' ? 'dpc-choice-group' : 'dpc-form-options');
  const tags = node(f.document, 'div', 'dpc-selected-tags');
  if (kind === 'select') connectLabel(f, list);
  if (kind === 'segmented') list.setAttribute('role', 'group');
  f.body.append(list);
  if (kind === 'checkboxGroup') f.body.append(tags);
  const name = uniqueId(f.document, 'radio');
  let items = [], controls = [], value = kind === 'checkboxGroup' ? [] : '';
  function paint() {
    controls.forEach((control, index) => {
      const selected = kind === 'checkboxGroup' ? value.includes(items[index].value) : value === items[index].value;
      control.disabled = Boolean(f.props.disabled || items[index].disabled);
      if (kind === 'segmented') control.setAttribute('aria-pressed', String(selected));
      else if (kind === 'select') control.selected = selected;
      else control.checked = selected;
    });
    if (kind === 'select') { list.disabled = Boolean(f.props.disabled); list.value = value; }
    if (kind === 'checkboxGroup') tags.replaceChildren(...items.filter(item => value.includes(item.value)).map(item => node(f.document, 'span', 'dpc-form-tag', item.label)));
    f.describe(kind === 'select' ? [list] : controls);
  }
  function update(patch = {}) {
    const nextItems = Object.hasOwn(patch, 'options') ? choices(patch.options) : items;
    f.update(patch);
    if (Object.hasOwn(patch, 'value')) value = kind === 'checkboxGroup' ? [...patch.value] : String(patch.value ?? '');
    if (nextItems !== items) {
      const focusedIndex = controls.indexOf(f.document.activeElement);
      const focusedValue = focusedIndex < 0 ? undefined : items[focusedIndex]?.value;
      items = nextItems;
      controls = items.map((item, index) => {
        const control = node(f.document, kind === 'select' ? 'option' : kind === 'segmented' ? 'button' : 'input');
        control.value = item.value;
        control.dataset.index = String(index);
        if (kind === 'select' || kind === 'segmented') control.textContent = item.label;
        if (kind === 'segmented') control.type = 'button';
        if (kind === 'checkboxGroup' || kind === 'radioGroup') { control.type = kind === 'checkboxGroup' ? 'checkbox' : 'radio'; control.name = name; }
        return control;
      });
      list.replaceChildren(...controls.map((control, index) => {
        if (kind === 'select' || kind === 'segmented') return control;
        const label = node(f.document, 'label');
        label.append(control, f.document.createTextNode(items[index].label));
        return label;
      }));
      paint();
      if (focusedValue !== undefined) controls.find(control => control.value === focusedValue && !control.disabled)?.focus();
    } else paint();
  }
  list.addEventListener(kind === 'segmented' ? 'click' : 'change', event => {
    const control = kind === 'select' ? list.selectedOptions[0] : event.target.closest(kind === 'segmented' ? 'button' : 'input');
    const index = controls.indexOf(control);
    if (f.props.disabled || index < 0 || items[index].disabled) { paint(); return; }
    if (kind === 'checkboxGroup') value = control.checked ? [...new Set([...value, items[index].value])] : value.filter(item => item !== items[index].value);
    else value = items[index].value;
    paint();
    f.props.onChange?.(kind === 'checkboxGroup' ? [...value] : value, event);
  }, { signal: f.life.signal });
  if (kind === 'segmented') list.addEventListener('keydown', event => {
    const enabled = controls.filter(control => !control.disabled);
    const index = enabled.indexOf(event.target);
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const target = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1) : enabled[(index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    target.focus();
    target.click();
  }, { signal: f.life.signal });
  update({ ...f.props });
  return result(f, update, () => kind === 'select' ? [list] : [...controls], () => kind === 'checkboxGroup' ? [...value] : value, kind === 'select' ? { control: list } : {});
}

function mountEntry(container, options = {}, kind) {
  const f = field(container, options);
  const control = node(f.document, kind === 'textarea' ? 'textarea' : 'input', kind === 'slider' ? 'dpc-range' : 'dpc-input');
  if (kind !== 'textarea') control.type = kind === 'slider' ? 'range' : 'number';
  connectLabel(f, control);
  const output = node(f.document, 'output', 'dpc-form-output');
  output.htmlFor = control.id;
  f.body.append(control, output);
  function value() { return kind === 'textarea' ? control.value : control.value === '' ? null : control.valueAsNumber; }
  function describe() {
    control.setCustomValidity('');
    const validity = control.validity;
    const error = validity.valueMissing ? '请填写此项' : validity.rangeUnderflow ? `不能小于 ${control.min}` : validity.rangeOverflow ? `不能大于 ${control.max}` : validity.stepMismatch ? `请按 ${control.step || 1} 的步长填写` : validity.badInput ? '请输入有效数字' : '';
    f.describe([control], error);
    output.textContent = kind === 'textarea' ? `${control.value.length}${control.maxLength >= 0 ? ` / ${control.maxLength}` : ''}` : kind === 'slider' ? `${control.value}${f.props.unit ?? ''}` : '';
    output.hidden = kind === 'number';
  }
  function update(patch = {}) {
    f.update(patch);
    nativeAttributes(control, f.props, kind === 'textarea' ? ['maxlength', 'rows'] : ['min', 'max', 'step']);
    if (kind === 'textarea' && !control.hasAttribute('rows')) control.rows = 3;
    if (Object.hasOwn(patch, 'value')) control.value = patch.value == null ? '' : String(patch.value);
    control.disabled = Boolean(f.props.disabled);
    control.readOnly = Boolean(f.props.readOnly);
    control.required = Boolean(f.props.required);
    control.placeholder = String(f.props.placeholder ?? '');
    describe();
  }
  for (const type of ['input', 'change']) control.addEventListener(type, event => {
    if (f.props.disabled || f.props.readOnly) return;
    describe();
    f.props[type === 'input' ? 'onInput' : 'onChange']?.(value(), event);
  }, { signal: f.life.signal });
  update(options);
  return result(f, update, () => [control], value, { control });
}

function mountDateRange(container, options = {}) {
  const f = field(container, options, true);
  const start = node(f.document, 'input', 'dpc-input');
  const end = node(f.document, 'input', 'dpc-input');
  f.body.classList.add('dpc-date-inputs');
  f.body.append(start, node(f.document, 'span', '', '至'), end);
  function value() { return { start: start.value, end: end.value }; }
  function describe() {
    const reversed = start.value && end.value && start.value > end.value;
    const error = reversed ? '结束日期不能早于开始日期' : [start, end].some(control => control.validity.valueMissing) ? '请填写开始和结束日期' : [start, end].some(control => control.validity.rangeUnderflow || control.validity.rangeOverflow) ? '日期超出允许范围' : '';
    start.setCustomValidity(reversed ? error : '');
    end.setCustomValidity(reversed ? error : '');
    f.describe([start, end], error);
  }
  function update(patch = {}) {
    f.update(patch);
    [start, end].forEach((control, index) => {
      control.type = 'date';
      control.setAttribute('aria-label', String(index ? f.props.endLabel ?? '结束日期' : f.props.startLabel ?? '开始日期'));
      control.disabled = Boolean(f.props.disabled);
      control.readOnly = Boolean(f.props.readOnly);
      control.required = Boolean(f.props.required);
      nativeAttributes(control, f.props, ['min', 'max']);
    });
    if (Object.hasOwn(patch, 'value')) { start.value = patch.value?.start ?? ''; end.value = patch.value?.end ?? ''; }
    describe();
  }
  for (const type of ['input', 'change']) f.body.addEventListener(type, event => {
    if (f.props.disabled || f.props.readOnly || ![start, end].includes(event.target)) return;
    describe();
    f.props[type === 'input' ? 'onInput' : 'onChange']?.(value(), event);
  }, { signal: f.life.signal });
  update(options);
  return result(f, update, () => [start, end], value, { start, end });
}

function mountFilePicker(container, options = {}) {
  const f = field(container, options);
  const box = node(f.document, 'div', 'dpc-upload-box');
  const title = node(f.document, 'strong');
  const notice = node(f.document, 'small', '', '仅展示文件名，不读取内容、不上传');
  const control = node(f.document, 'input');
  control.type = 'file';
  connectLabel(f, control);
  const names = node(f.document, 'div', 'dpc-field-hint');
  const remove = node(f.document, 'button', 'dpc-btn dpc-ghost');
  remove.type = 'button';
  box.append(title, notice, control);
  f.body.append(box, names, remove);
  function value() { return [...control.files].map(file => file.name); }
  function paint() {
    names.textContent = value().join('、') || '尚未选择文件';
    remove.disabled = Boolean(f.props.disabled || !control.files.length);
    f.describe([control]);
  }
  function clear() { f.life.assertAlive(); control.value = ''; paint(); }
  function update(patch = {}) {
    if (Object.hasOwn(patch, 'value')) throw new Error('文件选择只能由用户操作，清空请使用 clear()');
    f.update(patch);
    control.disabled = Boolean(f.props.disabled);
    control.multiple = Boolean(f.props.multiple);
    control.accept = String(f.props.accept ?? '');
    title.textContent = f.props.chooseLabel ?? '选择本地文件';
    remove.textContent = f.props.removeLabel ?? '移除文件选择';
    box.classList.toggle('dpc-disabled', control.disabled);
    paint();
  }
  control.addEventListener('change', event => {
    if (f.props.disabled) return;
    paint();
    f.props.onChange?.(value(), event);
  }, { signal: f.life.signal });
  remove.addEventListener('click', event => {
    if (remove.disabled || f.props.disabled) return;
    clear();
    f.props.onChange?.([], event);
  }, { signal: f.life.signal });
  update(options);
  return result(f, update, () => [control], value, { control, clear });
}

export const formFactories = {
  toggle: mountToggle,
  segmented: (container, options) => mountChoices(container, options, 'segmented'),
  select: (container, options) => mountChoices(container, options, 'select'),
  checkboxGroup: (container, options) => mountChoices(container, options, 'checkboxGroup'),
  radioGroup: (container, options) => mountChoices(container, options, 'radioGroup'),
  number: (container, options) => mountEntry(container, options, 'number'),
  slider: (container, options) => mountEntry(container, options, 'slider'),
  dateRange: mountDateRange,
  textarea: (container, options) => mountEntry(container, options, 'textarea'),
  filePicker: mountFilePicker,
};
