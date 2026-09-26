export function node(document, tag, className = '', text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}

export function putContent(target, content) {
  target.replaceChildren(content?.nodeType ? content : target.ownerDocument.createTextNode(String(content ?? '')));
}

export function uniqueId(document, kind) {
  return `design-pal-codex-${kind}-${document.defaultView.crypto.randomUUID()}`;
}
