import {JSDOM} from 'jsdom'
/** Installs jsdom globals (document, MutationObserver, ...) for node tests; returns the document. */
export function dom() {
  const w = new JSDOM('<!doctype html><div id="app"></div>').window
  Object.assign(globalThis, {window: w, document: w.document, MutationObserver: w.MutationObserver, Element: w.Element})
  return w.document
}
export const settle = () => new Promise(r => setTimeout(r))
