import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../src/${relativePath}`, import.meta.url), 'utf8');

test('Obsidian note cards use native keyboard-accessible buttons', () => {
  const source = readSource('components/ObsidianHub.tsx');

  assert.equal((source.match(/onClick=\{\(\) => handleOpenNote\(/g) || []).length, 2);
  assert.equal((source.match(/<button[\s\S]*?onClick=\{\(\) => handleOpenNote\(/g) || []).length, 2);
});

test('toast notifications announce asynchronous updates', () => {
  const source = readSource('components/ToastShelf.tsx');

  assert.match(source, /aria-live="polite"/);
  assert.match(source, /role="status"/);
});

test('touched feature views keep user-facing status text in the i18n dictionaries', () => {
  const speedTester = readSource('components/SpeedTester.tsx');
  const cleaner = readSource('components/SystemCleaner.tsx');
  const sidebar = readSource('components/Sidebar.tsx');

  assert.doesNotMatch(speedTester, /HTTP\/2 CDN Global Edge Verified/);
  assert.doesNotMatch(cleaner, /copyToClipboard\([^\n]+, 'Path'\)/);
  assert.doesNotMatch(sidebar, /`\$\{dirty\} dirty`/);
  assert.doesNotMatch(sidebar, /`\$\{summary\.git_uncommitted_count\} dirty`/);
});

test('a confirmation dialog cannot be dismissed while its action is running', () => {
  const source = readSource('components/ConfirmModal.tsx');

  assert.match(source, /if \(!confirmModal\(\) \|\| isProcessing\(\)\) return/);
  assert.match(source, /if \(!isProcessing\(\) && e\.target === e\.currentTarget\)/);
});

test('the confirmation dialog owns its keyboard handling and focus lifecycle', () => {
  const source = readSource('components/ConfirmModal.tsx');

  assert.doesNotMatch(source, /window\.addEventListener\('keydown'/);
  assert.match(source, /handleKeyDown\(e\)/);
  assert.match(source, /ref=\{\(element\) => queueMicrotask\(\(\) => element\.focus\(\)\)\}/);
  assert.match(source, /const previouslyFocused = document\.activeElement/);
  assert.match(source, /if \(previouslyFocused\?\.isConnected\) previouslyFocused\.focus\(\)/);
});

test('the Obsidian reader owns its keyboard handling and focus lifecycle', () => {
  const source = readSource('components/ObsidianHub.tsx');

  assert.doesNotMatch(source, /window\.addEventListener\('keydown'/);
  assert.match(source, /handleReaderKeyDown\(e\)/);
  assert.match(source, /ref=\{\(element\) => queueMicrotask\(\(\) => element\.focus\(\)\)\}/);
  assert.match(source, /const previouslyFocused = document\.activeElement/);
  assert.match(source, /if \(previouslyFocused\?\.isConnected\) previouslyFocused\.focus\(\)/);
});

test('the update dialog supports keyboard dismissal and receives initial focus', () => {
  const source = readSource('components/UpdateModal.tsx');

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="update-modal-title"/);
  assert.match(source, /if \(e\.key === 'Escape'\) handleClose\(\)/);
  assert.match(source, /ref=\{\(element\) => queueMicrotask\(\(\) => element\.focus\(\)\)\}/);
  assert.match(source, /tabIndex=\{-1\}/);
});

test('the update history tab switches immediately while avoiding duplicate fetches', () => {
  const source = readSource('components/UpdateModal.tsx');

  const handler = source.match(/const handleOpenHistory = \(\) => \{([\s\S]*?)\n {2}\};/)?.[1] || '';
  assert.ok(handler.indexOf("setActiveTab('history')") >= 0);
  assert.ok(handler.indexOf('if (isLoadingBackups()) return') >= 0);
  assert.ok(
    handler.indexOf("setActiveTab('history')") < handler.indexOf('if (isLoadingBackups()) return'),
  );
  assert.match(source, /onClick=\{handleOpenHistory\}/);
});

test('the save-point drawer cannot be dismissed during a create or rollback action', () => {
  const source = readSource('components/SavePointDrawer.tsx');

  assert.match(
    source,
    /if \(isCreatingSnapshot\(\) \|\| isRollingBackSnapshot\(\)\) return/,
  );
  assert.match(source, /onClick=\{handleClose\}/);
  assert.match(source, /if \(e\.key === 'Escape'\) handleClose\(\)/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="snapshot-drawer-title"/);
  assert.match(source, /ref=\{\(element\) => queueMicrotask\(\(\) => element\.focus\(\)\)\}/);
  assert.match(source, /tabIndex=\{-1\}/);
});

test('all custom dialogs keep Tab focus inside the active surface', () => {
  for (const component of [
    'components/ConfirmModal.tsx',
    'components/ObsidianHub.tsx',
    'components/SavePointDrawer.tsx',
    'components/UpdateModal.tsx',
  ]) {
    const source = readSource(component);
    assert.match(source, /trapDialogFocus\(e, e\.currentTarget\)/, component);
  }
});

test('Activity navigation is exposed through the bilingual navigation label', () => {
  const source = readSource('components/Sidebar.tsx');

  assert.match(source, /label: \(\) => t\(\)\.sidebar\.navActivity/);
  assert.match(source, /aria-label=\{t\(\)\.sidebar\.navigationLabel\}/);
});

test('the command palette has dialog semantics and keyboard lifecycle ownership', () => {
  const source = readSource('components/CommandPalette.tsx');

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="command-palette-title"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /removeEventListener/);
  assert.match(source, /trapDialogFocus\(event, event\.currentTarget\)/);
});

test('command results are focusable controls with explicit accessible names', () => {
  const source = readSource('components/CommandPalette.tsx');

  assert.match(source, /<button[\s\S]*?onClick=\{\(\) => chooseAction\(item\.action\)\}/);
  assert.match(source, /aria-label=\{item\.label\}/);
});
