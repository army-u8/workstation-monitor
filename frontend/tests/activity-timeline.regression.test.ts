import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  activityEventDetails,
  filterActivityEvents,
  groupActivityEvents,
} from '../src/utils/activity';
import type { WorkstationEvent } from '../src/types';

const event = (
  eventId: string,
  correlationId: string,
  severity: WorkstationEvent['severity'],
  source: string,
  occurredAt: number,
): WorkstationEvent => ({
  event_id: eventId,
  device_id: 'local',
  event_type: 'action_requested',
  severity,
  source,
  occurred_at: occurredAt,
  correlation_id: correlationId,
  schema_version: 1,
  payload: {},
});

test('timeline groups correlated action events together without mutating input', () => {
  const input = [
    event('failed', 'corr-1', 'error', 'actions', 3),
    event('requested', 'corr-1', 'info', 'actions', 2),
    event('unrelated', 'corr-2', 'info', 'server', 1),
  ];
  const snapshot = structuredClone(input);
  const groups = groupActivityEvents(input);

  assert.equal(groups.find((group) => group.correlationId === 'corr-1')?.events.length, 2);
  assert.deepEqual(input, snapshot);
});

test('severity and source filters compose', () => {
  const events = [
    event('matching-event', '1', 'warning', 'actions', 3),
    event('wrong-source', '2', 'warning', 'server', 2),
    event('wrong-severity', '3', 'info', 'actions', 1),
  ];

  assert.deepEqual(
    filterActivityEvents(events, { severity: 'warning', source: 'actions' }).map(
      (item) => item.event_id,
    ),
    ['matching-event'],
  );
});

test('activity timeline uses the shared icon barrel and i18n rendering', () => {
  const source = readFileSync(new URL('../src/components/ActivityTimeline.tsx', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/Icons'/);
  assert.match(source, /t\(\)\.activity/);
  assert.doesNotMatch(source, /from '@tabler\/icons-solidjs'/);
  assert.doesNotMatch(source, /return 'danger' as const/);
  assert.match(source, /return 'destructive' as const/);
  assert.doesNotMatch(source, /if \(props\.event\.[^)]+\)[\s\S]{0,120}return </);
});

test('activity timeline reads action result details and renders localized duration', () => {
  const source = readFileSync(
    new URL('../src/components/ActivityTimeline.tsx', import.meta.url),
    'utf8',
  );

  assert.match(source, /activityEventDetails/);
  assert.match(source, /details\(\)\.actionId/);
  assert.match(source, /details\(\)\.status/);
  assert.match(source, /t\(\)\.activity\.actionStatuses/);
  assert.match(source, /details\(\)\.durationMs/);
  assert.match(source, /t\(\)\.activity\.duration/);
  assert.match(source, /t\(\)\.activity\.millisecondsShort/);
  assert.doesNotMatch(source, /event\.payload\.status/);
});

test('activity details keep action id, status, and duration independently visible', () => {
  const result = event('result', 'corr', 'info', 'actions', 1);
  result.payload = {
    action_id: 'snapshot.create',
    details: { status: 'succeeded', duration_ms: 42 },
  };

  assert.deepEqual(activityEventDetails(result), {
    actionId: 'snapshot.create',
    status: 'succeeded',
    durationMs: 42,
  });
});
