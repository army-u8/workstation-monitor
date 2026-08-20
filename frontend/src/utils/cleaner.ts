export const getTotalReclaimableBytes = (
  items: ReadonlyArray<{ size_bytes: number; is_cleanable: boolean }>,
): number =>
  items.reduce((total, item) => total + (item.is_cleanable ? item.size_bytes : 0), 0);
