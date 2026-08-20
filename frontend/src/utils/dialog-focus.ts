const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getDialogFocusTarget(
  focusable: HTMLElement[],
  active: Element | null,
  shiftKey: boolean,
): HTMLElement | null {
  if (focusable.length === 0) return null;

  const activeIndex = focusable.indexOf(active as HTMLElement);
  if (activeIndex === -1) {
    return shiftKey ? focusable.at(-1)! : focusable[0];
  }
  if (shiftKey && activeIndex === 0) return focusable.at(-1)!;
  if (!shiftKey && activeIndex === focusable.length - 1) return focusable[0];
  return null;
}

export function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement) {
  if (event.key !== 'Tab') return;

  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getAttribute('aria-hidden') !== 'true',
  );
  const first = focusable[0];
  const active = document.activeElement;

  if (!first) {
    event.preventDefault();
    (dialog.querySelector<HTMLElement>('[tabindex="-1"]') || dialog).focus();
    return;
  }

  const target = getDialogFocusTarget(focusable, active, event.shiftKey);
  if (target) {
    event.preventDefault();
    target.focus();
  }
}
