import assert from 'node:assert/strict';
import test from 'node:test';

import {
  executeControlActionApi,
  fetchWorkstationEventsApi,
  setWorkstationEvents,
  workstationEvents,
} from '../src/services/store';
import type { ActionRequest, WorkstationEvent } from '../src/types';

const eventFixture: WorkstationEvent = {
  event_id: 'event-1',
  device_id: 'local',
  event_type: 'service_started',
  severity: 'warning',
  source: 'server',
  occurred_at: 1,
  correlation_id: 'correlation-1',
  schema_version: 1,
  payload: { port: 9527 },
};

test('control event fetch encodes filters and replaces the initial page', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  setWorkstationEvents([]);
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    return Response.json({ items: [eventFixture], next_cursor: null, storage_degraded: false });
  };

  try {
    await fetchWorkstationEventsApi({ severity: 'warning', limit: 25 });

    assert.match(requests[0], /\/api\/control\/events/);
    assert.match(requests[0], /severity=warning/);
    assert.equal(workstationEvents()[0].event_id, eventFixture.event_id);
  } finally {
    globalThis.fetch = originalFetch;
    setWorkstationEvents([]);
  }
});

test('confirmation-required actions are not reported as failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      {
        status: 'confirmation_required',
        confirmation: {
          token: 'one-time-token',
          expires_at: 1,
          risk: 'confirmation_required',
        },
      },
      { status: 202 },
    );
  const request: ActionRequest = {
    request_id: 'request-1',
    action_id: 'process.kill',
    parameters: { pid: 42 },
    origin: 'command_palette',
    requested_by: 'local-user',
  };

  try {
    const response = await executeControlActionApi(request);
    assert.equal(response.status, 'confirmation_required');
    assert.equal(response.confirmation?.token, 'one-time-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
