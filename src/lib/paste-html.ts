import type { ClipboardEvent } from 'react';

/**
 * Converts a clipboard HTML fragment to plain text while preserving line
 * breaks at block-element boundaries (<p>, <div>, <li>, <br>, headings…).
 *
 * `element.textContent` alone discards those boundaries — pasting a
 * multi-paragraph web page into a plain <textarea> then lands as one run-on
 * line, because the browser's own HTML→text/plain clipboard conversion
 * doesn't reliably insert a newline between adjacent block elements either.
 */
function htmlToPlainText(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));

  const blockSelector = 'p, div, li, tr, h1, h2, h3, h4, h5, h6, blockquote';
  container.querySelectorAll(blockSelector).forEach((el) => {
    el.append('\n');
  });

  return (container.textContent ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Paste handler for plain <textarea>/<input> elements that reconstructs
 * paragraph breaks from the clipboard's HTML flavor when present, instead of
 * relying on the browser's (often lossy) text/plain conversion. Falls back
 * to the default paste when there's no HTML flavor to recover structure from.
 */
export function handleStructuredPaste(
  e: ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  onInsert: (nextValue: string, selectionStart: number, selectionEnd: number) => void,
): void {
  const html = e.clipboardData.getData('text/html');
  if (!html) return; // no HTML flavor — let the browser's default plain-text paste happen

  const text = htmlToPlainText(html);
  if (!text) return;

  e.preventDefault();
  const target = e.currentTarget;
  const start = target.selectionStart ?? target.value.length;
  const end = target.selectionEnd ?? target.value.length;
  const nextValue = target.value.slice(0, start) + text + target.value.slice(end);
  onInsert(nextValue, start, start + text.length);
}
