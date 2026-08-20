import assert from 'node:assert/strict';
import test from 'node:test';

import { getDialogFocusTarget } from '../src/utils/dialog-focus';

const element = (name: string) => ({ name }) as unknown as HTMLElement;

test('focus trap redirects from an initially focused panel into its focus cycle', () => {
  const first = element('first');
  const last = element('last');
  const panel = element('panel');

  assert.equal(getDialogFocusTarget([first, last], panel, false), first);
  assert.equal(getDialogFocusTarget([first, last], panel, true), last);
});

test('focus trap wraps at both ends and leaves middle items alone', () => {
  const first = element('first');
  const middle = element('middle');
  const last = element('last');

  assert.equal(getDialogFocusTarget([first, middle, last], first, true), last);
  assert.equal(getDialogFocusTarget([first, middle, last], last, false), first);
  assert.equal(getDialogFocusTarget([first, middle, last], middle, false), null);
});
