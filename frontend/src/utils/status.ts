export const getSpeedStatusClass = (mbps: number): string => {
  if (mbps < 10) return 'text-status-danger';
  if (mbps < 30) return 'text-status-warning';
  return 'text-status-success';
};
