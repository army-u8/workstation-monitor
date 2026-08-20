import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWebSocketUrl,
  closeConfirmDialog,
  confirmModal,
  copyToClipboard,
  fetchOllamaStatusApi,
  openConfirmDialog,
  setToasts,
  toasts,
} from '../src/services/store';

test('WebSocket URL stays on the current origin so the Vite proxy can route it', () => {
  assert.equal(
    buildWebSocketUrl({ protocol: 'http:', host: '127.0.0.1:9529' }),
    'ws://127.0.0.1:9529/ws',
  );
  assert.equal(
    buildWebSocketUrl({ protocol: 'https:', host: 'desk.example.com' }),
    'wss://desk.example.com/ws',
  );
});

test('closing a confirmed dialog does not invoke its cancel callback', async () => {
  let cancelCount = 0;
  openConfirmDialog({
    title: 'title',
    message: 'message',
    onConfirm: () => undefined,
    onCancel: () => {
      cancelCount += 1;
    },
  });

  await confirmModal()?.onConfirm();
  closeConfirmDialog(false);

  assert.equal(cancelCount, 0);
  assert.equal(confirmModal(), null);
});

test('an Ollama status failure emits a single error toast', async () => {
  const originalFetch = globalThis.fetch;
  setToasts([]);
  globalThis.fetch = async () => new Response(null, { status: 503 });

  try {
    await fetchOllamaStatusApi();
    assert.equal(toasts().length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    setToasts([]);
  }
});

test('clipboard failures are reported instead of throwing synchronously', () => {
  setToasts([]);

  assert.doesNotThrow(() => copyToClipboard('example'));
  assert.equal(toasts().length, 1);

  setToasts([]);
});

test('clipboard success toast never exposes the copied secret value', async () => {
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: { writeText: async () => undefined },
  });
  setToasts([]);

  try {
    copyToClipboard('sk-sensitive-value', 'API key');
    await Promise.resolve();

    assert.equal(toasts().length, 1);
    assert.equal(toasts()[0].message.includes('sk-sensitive-value'), false);
  } finally {
    if (clipboardDescriptor) {
      Object.defineProperty(globalThis.navigator, 'clipboard', clipboardDescriptor);
    } else {
      Reflect.deleteProperty(globalThis.navigator, 'clipboard');
    }
    setToasts([]);
  }
});
