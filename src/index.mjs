import { libraries } from './libraries/catalog.mjs';
import { resolveAppearance, paintAppearance } from './libraries/appearance.mjs';
import { mountButton } from './components/button.mjs';
import { mountInput } from './components/input.mjs';
import { mountDetails } from './components/details.mjs';
import { mountTable } from './components/table.mjs';
import { formFactories } from './components/forms.mjs';
import { navigationFactories } from './components/navigation.mjs';
import { feedbackFactories } from './components/feedback.mjs';
export { libraries } from './libraries/catalog.mjs';

export function createSurface(container, options = {}) {
  if (!container?.ownerDocument || !container.append) throw new Error('需要有效的挂载容器');
  let appearance = resolveAppearance(options);
  const element = container.ownerDocument.createElement('div');
  element.className = 'dpc-root';
  paintAppearance(element, appearance);
  const components = new Set();
  let alive = true;
  function assertAlive() { if (!alive) throw new Error('组件区域已卸载'); }
  function attach(factory, props, target) {
    assertAlive();
    if (target !== element && !element.contains(target)) throw new Error('组件只能挂载到自己的区域');
    const component = factory(target, props, libraries[appearance.library]);
    const destroy = component.destroy;
    component.destroy = () => { destroy(); components.delete(component); };
    components.add(component);
    return component;
  }
  container.append(element);
  const surface = {
    element,
    get appearance() { return { library: appearance.library, color: appearance.color, mode: appearance.mode }; },
    setAppearance(patch = {}) {
      assertAlive();
      if (Object.hasOwn(patch, 'library')) throw new Error('组件区域固定当前库，换库请重新挂载');
      appearance = resolveAppearance({ ...appearance, ...patch });
      paintAppearance(element, appearance);
    },
    button(props, target = element) { return attach(mountButton, props, target); },
    input(props, target = element) { return attach(mountInput, props, target); },
    details(props, target = element) { return attach(mountDetails, props, target); },
    table(props, target = element) { return attach(mountTable, props, target); },
    destroy() {
      if (!alive) return;
      alive = false;
      for (const component of [...components]) component.destroy();
      element.remove();
    },
  };
  for (const [name, factory] of Object.entries({ ...formFactories, ...navigationFactories, ...feedbackFactories })) {
    surface[name] = (props, target = element) => attach(factory, props, target);
  }
  return surface;
}
