import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createLatestRequestGuard } from '../src/utils/latest-request';

test('only the newest asynchronous request may commit its result', () => {
  const requests = createLatestRequestGuard();
  const first = requests.next();
  const second = requests.next();

  assert.equal(requests.isLatest(first), false);
  assert.equal(requests.isLatest(second), true);
});

test('invalidating a request prevents a cleared search from being repopulated', () => {
  const requests = createLatestRequestGuard();
  const pending = requests.next();

  requests.invalidate();

  assert.equal(requests.isLatest(pending), false);
});

test('closing the Obsidian note reader invalidates any pending note load', () => {
  const source = readFileSync(
    new URL('../src/components/ObsidianHub.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /const closeNoteReader = \(\) => \{[\s\S]*?noteRequests\.invalidate\(\)/);
  assert.equal((source.match(/setActiveNoteDetail\(null\)/g) || []).length, 1);
});
