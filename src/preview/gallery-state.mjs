import { libraries } from '../libraries/catalog.mjs';

export const galleryStorageKey = 'design-pal-codex:gallery';
export const productTypes = [...new Set(Object.values(libraries).flatMap(library => library.fit))];

export class GalleryState {
  constructor(saved, search = '', reducedMotion = false) {
    this.positions = Object.fromEntries(Object.keys(libraries).map(key => [key, 0]));
    this.filter = 'all';
    this.paused = new Set(reducedMotion ? Object.keys(libraries) : []);
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const key of Object.keys(libraries)) this.choose(key, saved.positions?.[key]);
      this.setFilter(saved.filter);
      if (Array.isArray(saved.paused)) {
        for (const key of saved.paused) if (Object.hasOwn(libraries, key)) this.paused.add(key);
      }
    }
    const params = new URLSearchParams(search);
    const key = params.get('library');
    if (Object.hasOwn(libraries, key)) {
      const index = libraries[key].colors.findIndex(color => color.id === params.get('color'));
      if (index >= 0) {
        this.choose(key, index);
        if (this.filter !== 'all' && !libraries[key].fit.includes(this.filter)) this.filter = 'all';
      }
    }
  }
  setFilter(filter) {
    if (filter === 'all' || productTypes.includes(filter)) this.filter = filter;
  }
  visibleLibraries() {
    return Object.entries(libraries).filter(([, library]) => this.filter === 'all' || library.fit.includes(this.filter));
  }
  choose(key, index) {
    if (Object.hasOwn(libraries, key) && Number.isInteger(index) && index >= 0 && index < libraries[key].colors.length) this.positions[key] = index;
  }
  move(key, direction) {
    if (Object.hasOwn(libraries, key) && [1, -1].includes(direction)) {
      const count = libraries[key].colors.length;
      this.choose(key, (this.positions[key] + direction + count) % count);
    }
  }
  color(key) { return libraries[key].colors[this.positions[key]]; }
  toggleRotation(key) {
    if (!Object.hasOwn(libraries, key)) return;
    if (this.paused.has(key)) this.paused.delete(key);
    else this.paused.add(key);
  }
  snapshot() { return { positions: { ...this.positions }, filter: this.filter, paused: [...this.paused] }; }
}
