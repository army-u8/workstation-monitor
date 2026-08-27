import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  parseActionParameters,
  rankActions,
  toCommandItem,
} from '../src/utils/command-palette';
import type { ActionDefinition } from '../src/types';

const action = (
  id: string,
  options: Partial<ActionDefinition> = {},
): ActionDefinition => ({
  id,
  label_key: `control.actions.${id.replace('.', '_')}.label`,
  description_key: `control.actions.${id.replace('.', '_')}.description`,
  risk: 'safe',
  parameters: [],
  keywords: [],
  available: true,
  ...options,
});

const translations: Record<string, string> = {
  'control.actions.port_kill.label': 'Release port',
  'control.actions.port_kill.description': 'Stop the process listening on a port',
  'control.actions.snapshot_create.label': 'Create snapshot',
  'control.actions.snapshot_create.description': 'Save the current Git workspace',
};

const translate = (key: string) => translations[key] ?? key;

test('exact action id and label matches rank ahead of description matches', () => {
  const actions = [
    action('snapshot.create', { keywords: ['port', 'history'] }),
    action('port.kill', { keywords: ['release', 'listener'] }),
  ];

  const ranked = rankActions(actions, 'port kill', translate);

  assert.equal(ranked[0].id, 'port.kill');
});

test('unavailable actions remain visible but cannot execute', () => {
  const item = toCommandItem(
    action('network.flush_dns', {
      available: false,
      unavailable_reason: 'permission_required',
    }),
    translate,
  );

  assert.equal(item.disabled, true);
  assert.equal(item.unavailableReason, 'permission_required');
});

test('typed action parameters reject missing and invalid required values', () => {
  const definition = action('process.kill', {
    parameters: [
      {
        name: 'pid',
        value_type: 'integer',
        required: true,
        label_key: 'control.parameters.pid',
      },
    ],
  });

  assert.deepEqual(parseActionParameters(definition, {}), {
    ok: false,
    error: 'required',
    parameter: 'pid',
  });
  assert.deepEqual(parseActionParameters(definition, { pid: 'abc' }), {
    ok: false,
    error: 'invalid_integer',
    parameter: 'pid',
  });
  assert.deepEqual(parseActionParameters(definition, { pid: '42' }), {
    ok: true,
    parameters: { pid: 42 },
  });
});

test('command palette source wires Meta+K and Escape without leaking listeners', () => {
  const source = readFileSync(
    new URL('../src/components/CommandPalette.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /event\.metaKey/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'k'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /onCleanup/);
  assert.match(source, /removeEventListener/);
  assert.match(source, /ref=\{\(element\) => \{\s*searchInput = element/);
});

test('palette is globally mounted and header exposes the command trigger', () => {
  const layout = readFileSync(new URL('../src/components/AppLayout.tsx', import.meta.url), 'utf8');
  const header = readFileSync(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<CommandPalette \/>/);
  assert.match(header, /setIsCommandPaletteOpen\(true\)/);
});
