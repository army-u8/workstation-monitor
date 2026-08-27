import type { EventSeverity, WorkstationEvent } from '../types';

export interface ActivityFilters {
  severity?: EventSeverity | '';
  source?: string;
  deviceId?: string;
}

export interface ActivityGroup {
  correlationId: string;
  latestAt: number;
  severity: EventSeverity;
  events: WorkstationEvent[];
}

const severityRank: Record<EventSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

export const filterActivityEvents = (
  events: readonly WorkstationEvent[],
  filters: ActivityFilters,
): WorkstationEvent[] =>
  events.filter(
    (event) =>
      (!filters.severity || event.severity === filters.severity) &&
      (!filters.source || event.source === filters.source) &&
      (!filters.deviceId || event.device_id === filters.deviceId),
  );

export const groupActivityEvents = (
  events: readonly WorkstationEvent[],
): ActivityGroup[] => {
  const grouped = new Map<string, WorkstationEvent[]>();
  for (const event of events) {
    const key = event.correlation_id || event.event_id;
    grouped.set(key, [...(grouped.get(key) || []), event]);
  }

  return [...grouped.entries()]
    .map(([correlationId, correlatedEvents]) => {
      const sorted = [...correlatedEvents].sort((a, b) => b.occurred_at - a.occurred_at);
      return {
        correlationId,
        latestAt: sorted[0]?.occurred_at || 0,
        severity: sorted.reduce<EventSeverity>(
          (highest, event) =>
            severityRank[event.severity] > severityRank[highest] ? event.severity : highest,
          'info',
        ),
        events: sorted,
      };
    })
    .sort((a, b) => b.latestAt - a.latestAt);
};
