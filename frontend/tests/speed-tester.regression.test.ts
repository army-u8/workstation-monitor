import assert from 'node:assert/strict';
import test from 'node:test';

import { getSpeedStatusClass } from '../src/utils/status';

test('very slow speed test results use the danger status', () => {
  assert.equal(getSpeedStatusClass(9.9), 'text-status-danger');
});

test('moderate and fast speed test results retain warning and success statuses', () => {
  assert.equal(getSpeedStatusClass(10), 'text-status-warning');
  assert.equal(getSpeedStatusClass(29.9), 'text-status-warning');
  assert.equal(getSpeedStatusClass(30), 'text-status-success');
});
