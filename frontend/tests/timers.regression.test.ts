import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

test('copy feedback replaces and cleans up its pending reset timer', () => {
  const source = readSource('components/AiRadarView.tsx');

  assert.match(source, /let copiedRuleTimer: ReturnType<typeof setTimeout> \| undefined/);
  assert.match(source, /if \(copiedRuleTimer\) clearTimeout\(copiedRuleTimer\)/);
  assert.match(source, /onCleanup\(\(\) => \{[\s\S]*clearTimeout\(copiedRuleTimer\)/);
});

test('the delayed update check is cancelled when the app is disposed', () => {
  const source = readSource('App.tsx');

  assert.match(source, /const updateCheckTimer = setTimeout/);
  assert.match(source, /onCleanup\(\(\) => clearTimeout\(updateCheckTimer\)\)/);
});
