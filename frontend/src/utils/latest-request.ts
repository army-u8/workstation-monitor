export interface LatestRequestGuard {
  next: () => number;
  invalidate: () => void;
  isLatest: (requestId: number) => boolean;
}

export const createLatestRequestGuard = (): LatestRequestGuard => {
  let latestRequestId = 0;

  return {
    next: () => ++latestRequestId,
    invalidate: () => {
      latestRequestId += 1;
    },
    isLatest: (requestId) => requestId === latestRequestId,
  };
};
