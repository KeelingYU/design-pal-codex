import { libraries } from '../libraries/catalog.mjs';
import { GalleryState, galleryStorageKey, productTypes } from './gallery-state.mjs';

let saved;
try { saved = JSON.parse(sessionStorage.getItem(galleryStorageKey)); } catch { /* 浏览器禁用存储时仍可浏览。 */ }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const model = new GalleryState(saved, location.search, reducedMotion.matches);
const grid = document.getElementById('library-grid');
const filters = document.getElementById('product-filters');
const cards = new Map();

function persist() {
  try { sessionStorage.setItem(galleryStorageKey, JSON.stringify(model.snapshot())); } catch { /* 存储不可用不影响当前页面操作。 */ }
}
function entryUrl(key) {
  return `./preview.html?${new URLSearchParams({ library: key, color: model.color(key).id })}`;
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(label, text, className) {
  const node = element('button', className, text);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  return node;
}
function filterButton(key, label, inCard = false) {
  const control = button(inCard ? `筛选${label}` : label, label);
  control.dataset.productFilter = key;
  control.addEventListener('click', () => {
    model.setFilter(key);
    updateFilter();
    persist();
    [...filters.children].find(node => node.dataset.productFilter === key)?.focus();
  });
  return control;
}
function updateFilter() {
  const visible = new Set(model.visibleLibraries().map(([key]) => key));
  for (const [key, card] of cards) card.hidden = !visible.has(key);
  for (const control of filters.children) control.setAttribute('aria-pressed', control.dataset.productFilter === model.filter);
  document.getElementById('library-count').textContent = `${visible.size} 个组件库 · 每库 2 种配色`;
}
function updateCard(key) {
  const card = cards.get(key);
  const color = model.color(key);
  card.dataset.activeColor = color.id;
  card.querySelector('.slide-track').style.transform = `translateX(-${model.positions[key] * 100}%)`;
  card.querySelectorAll('.color-slide').forEach((slide, index) => slide.setAttribute('aria-hidden', model.positions[key] !== index));
  card.querySelectorAll('[data-color-index]').forEach(dot => dot.setAttribute('aria-pressed', Number(dot.dataset.colorIndex) === model.positions[key]));
  card.querySelectorAll('[data-entry]').forEach(link => link.setAttribute('href', entryUrl(key)));
  card.querySelector('.color-caption strong').textContent = color.name;
  card.querySelector('.color-caption p').textContent = color.description;
  const toggle = card.querySelector('[data-rotation]');
  const action = model.paused.has(key) ? '播放' : '暂停';
  toggle.textContent = action;
  toggle.setAttribute('aria-label', `${action}${libraries[key].name}自动轮播`);
  persist();
}
function createCard(key, library) {
  const card = element('article', 'library-card');
  card.dataset.library = key;
  const entry = label => {
    const link = element('a');
    link.dataset.entry = '';
    link.setAttribute('aria-label', label);
    return link;
  };
  const heading = element('div', 'card-heading');
  const title = element('h2');
  const titleLink = entry(`查看${library.name}组件库`);
  titleLink.textContent = library.name;
  title.append(titleLink);
  const icon = element('span', '', '↗');
  icon.setAttribute('aria-hidden', 'true');
  heading.append(title, icon);
  const tags = element('div', 'library-tags');
  tags.setAttribute('aria-label', '适用产品类型');
  for (const tag of library.fit) tags.append(filterButton(tag, tag, true));
  const carousel = element('div', 'carousel');
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-roledescription', '轮播');
  carousel.setAttribute('aria-label', `${library.name}配色预览`);
  const imageFrame = element('div', 'preview-image');
  const imageLink = entry(`打开${library.name}当前配色`);
  const track = element('div', 'slide-track');
  for (const color of library.colors.slice(0, 2)) {
    const slide = element('div', 'color-slide');
    const image = element('img');
    image.src = `./previews/${encodeURIComponent(key)}-${encodeURIComponent(color.id)}.jpg`;
    image.alt = `${library.name}的${color.name}配色实际预览`;
    image.width = 931;
    image.height = 792;
    slide.append(image);
    track.append(slide);
  }
  imageLink.append(track);
  imageFrame.append(imageLink);
  for (const [direction, label, glyph, className] of [[-1, '上一配色', '‹', 'previous'], [1, '下一配色', '›', 'next']]) {
    const arrow = button(`${library.name}${label}`, glyph, `carousel-arrow ${className}`);
    arrow.dataset.direction = direction;
    arrow.addEventListener('click', () => { model.move(key, direction); updateCard(key); });
    imageFrame.append(arrow);
  }
  const tools = element('div', 'carousel-tools');
  const dots = element('div', 'color-dots');
  dots.setAttribute('role', 'group');
  dots.setAttribute('aria-label', `${library.name}颜色选择`);
  library.colors.forEach((color, index) => {
    const dot = button(`查看${color.name}配色`);
    dot.dataset.colorIndex = index;
    dot.title = color.name;
    dot.style.setProperty('--dot', color.light.accent);
    dot.addEventListener('click', () => { model.choose(key, index); updateCard(key); });
    dots.append(dot);
  });
  const toggle = button('', '', 'rotation-toggle');
  toggle.dataset.rotation = '';
  toggle.addEventListener('click', () => { model.toggleRotation(key); updateCard(key); });
  tools.append(dots, toggle);
  const caption = element('div', 'color-caption');
  caption.append(element('strong'), element('p'));
  carousel.append(imageFrame, tools, caption);
  card.append(heading, element('p', 'library-description', library.description), tags, carousel);
  card.addEventListener('click', event => {
    if (!event.target.closest('a,button')) location.href = entryUrl(key);
  });
  card.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    model.move(key, event.key === 'ArrowLeft' ? -1 : 1);
    updateCard(key);
    dots.children[model.positions[key]].focus();
  });
  cards.set(key, card);
  updateCard(key);
  return card;
}

filters.append(filterButton('all', '全部'), ...productTypes.map(type => filterButton(type, type)));
for (const [key, library] of Object.entries(libraries)) grid.append(createCard(key, library));
updateFilter();
persist();
// 返回参数应用一次，刷新时恢复此后用户在卡片上的新选择。
const locationUrl = new URL(location.href);
if (locationUrl.searchParams.has('library') || locationUrl.searchParams.has('color')) {
  locationUrl.searchParams.delete('library');
  locationUrl.searchParams.delete('color');
  history.replaceState(history.state, '', locationUrl);
}
reducedMotion.addEventListener('change', event => {
  if (event.matches) for (const key of cards.keys()) { model.paused.add(key); updateCard(key); }
});
setInterval(() => {
  if (document.hidden) return;
  for (const [key, card] of cards) {
    if (card.hidden || model.paused.has(key) || card.matches(':hover') || card.contains(document.activeElement)) continue;
    model.move(key, 1);
    updateCard(key);
  }
}, 5000);
