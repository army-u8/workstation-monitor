import assert from 'node:assert/strict';
import test from 'node:test';

import { getTotalReclaimableBytes } from '../src/utils/cleaner';

test('reclaimable total excludes informational items that cannot be cleaned', () => {
  assert.equal(
    getTotalReclaimableBytes([
      { size_bytes: 128, is_cleanable: true },
      { size_bytes: 2048, is_cleanable: false },
    ]),
    128,
  );
});
