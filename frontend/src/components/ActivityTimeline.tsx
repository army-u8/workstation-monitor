import { For, Match, Show, Switch, createMemo, createSignal, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { t } from '../i18n';
import {
  fetchWorkstationEventsApi,
  isControlStorageDegraded,
  isLoadingEvents,
  workstationEvents,
  workstationEventsCursor,
} from '../services/store';
import type { EventSeverity, WorkstationEvent } from '../types';
import { filterActivityEvents, groupActivityEvents } from '../utils/activity';
import { FailureIcon, RefreshIcon, SuccessIcon, TimelineIcon, WarningIcon } from './Icons';
import { Badge, Button } from './ui';

const severityVariant = (severity: EventSeverity) => {
  if (severity === 'critical' || severity === 'error') return 'destructive' as const;
  if (severity === 'warning') return 'warning' as const;
  return 'secondary' as const;
};

const EventStatusIcon: Component<{ event: WorkstationEvent }> = (props) => (
  <Switch fallback={<TimelineIcon class="h-4 w-4 text-accent" />}>
    <Match when={props.event.event_type === 'action_succeeded'}>
      <SuccessIcon class="h-4 w-4 text-status-success" />
    </Match>
    <Match when={props.event.event_type === 'action_failed'}>
      <FailureIcon class="h-4 w-4 text-status-danger" />
    </Match>
    <Match when={props.event.severity === 'warning' || props.event.severity === 'critical'}>
      <WarningIcon class="h-4 w-4 text-status-warning" />
    </Match>
  </Switch>
);

export const ActivityTimeline: Component = () => {
  const [severity, setSeverity] = createSignal<EventSeverity | ''>('');
  const [source, setSource] = createSignal('');
  const [deviceId, setDeviceId] = createSignal('');
  const [loadError, setLoadError] = createSignal(false);

  const sources = createMemo(() => [...new Set(workstationEvents().map((event) => event.source))]);
  const devices = createMemo(() => [
    ...new Set(workstationEvents().map((event) => event.device_id)),
  ]);
  const groups = createMemo(() =>
    groupActivityEvents(
      filterActivityEvents(workstationEvents(), {
        severity: severity(),
        source: source(),
        deviceId: deviceId(),
      }),
    ),
  );

  const load = async (before?: string) => {
    setLoadError(false);
    try {
      await fetchWorkstationEventsApi({
        severity: severity() || undefined,
        source: source() || undefined,
        device_id: deviceId() || undefined,
        before,
        limit: 50,
      });
    } catch {
      setLoadError(true);
    }
  };

  onMount(() => void load());

  const eventLabel = (event: WorkstationEvent) => t().activity.eventTypes[event.event_type];
  const severityLabel = (value: EventSeverity) => t().activity.severities[value];
  const detail = (event: WorkstationEvent) => {
    const actionId = event.payload.action_id;
    const status = event.payload.status;
    if (typeof actionId === 'string') return actionId;
    if (typeof status === 'string') return status;
    return event.source;
  };

  return (
    <section class="space-y-3" aria-label={t().activity.title}>
      <div class="hud-box flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div class="flex items-center gap-2">
            <TimelineIcon class="h-5 w-5 text-accent" />
            <h2 class="text-base font-bold text-text-primary">{t().activity.title}</h2>
          </div>
          <p class="mt-1 text-xs text-text-muted">{t().activity.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoadingEvents()}>
          <RefreshIcon class="h-4 w-4" />
          {isLoadingEvents() ? t().activity.loading : t().common.refresh}
        </Button>
      </div>

      <Show when={isControlStorageDegraded()}>
        <div class="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-status-warning">
          {t().activity.storageDegraded}
        </div>
      </Show>

      <div class="glass-card grid gap-2 p-3 sm:grid-cols-3">
        <label class="space-y-1 text-[11px] text-text-muted">
          <span>{t().activity.filterSeverity}</span>
          <select
            class="w-full rounded-md border border-border-default bg-bg-subtle px-2 py-1.5 text-xs text-text-primary"
            value={severity()}
            onChange={(event) => setSeverity(event.currentTarget.value as EventSeverity | '')}
          >
            <option value="">{t().common.all}</option>
            <option value="info">{t().activity.severities.info}</option>
            <option value="warning">{t().activity.severities.warning}</option>
            <option value="error">{t().activity.severities.error}</option>
            <option value="critical">{t().activity.severities.critical}</option>
          </select>
        </label>
        <label class="space-y-1 text-[11px] text-text-muted">
          <span>{t().activity.filterSource}</span>
          <select
            class="w-full rounded-md border border-border-default bg-bg-subtle px-2 py-1.5 text-xs text-text-primary"
            value={source()}
            onChange={(event) => setSource(event.currentTarget.value)}
          >
            <option value="">{t().common.all}</option>
            <For each={sources()}>{(value) => <option value={value}>{value}</option>}</For>
          </select>
        </label>
        <label class="space-y-1 text-[11px] text-text-muted">
          <span>{t().activity.filterDevice}</span>
          <select
            class="w-full rounded-md border border-border-default bg-bg-subtle px-2 py-1.5 text-xs text-text-primary"
            value={deviceId()}
            onChange={(event) => setDeviceId(event.currentTarget.value)}
          >
            <option value="">{t().common.all}</option>
            <For each={devices()}>{(value) => <option value={value}>{value}</option>}</For>
          </select>
        </label>
      </div>

      <Show when={loadError()}>
        <div class="glass-card p-6 text-center text-sm text-status-danger">
          {t().activity.loadFailed}
        </div>
      </Show>

      <Show when={!loadError() && !isLoadingEvents() && groups().length === 0}>
        <div class="glass-card p-10 text-center">
          <TimelineIcon class="mx-auto h-8 w-8 text-text-muted" />
          <p class="mt-3 text-sm text-text-secondary">{t().activity.empty}</p>
        </div>
      </Show>

      <div class="space-y-2">
        <For each={groups()}>
          {(group) => (
            <article class="glass-card overflow-hidden">
              <div class="flex items-center justify-between border-b border-border-subtle px-3 py-2">
                <div class="flex min-w-0 items-center gap-2">
                  <TimelineIcon class="h-4 w-4 shrink-0 text-accent" />
                  <span class="truncate font-mono text-[11px] text-text-secondary">
                    {group.correlationId}
                  </span>
                </div>
                <Badge variant={severityVariant(group.severity)}>
                  {severityLabel(group.severity)}
                </Badge>
              </div>
              <div class="divide-y divide-border-subtle">
                <For each={group.events}>
                  {(event) => (
                    <div class="grid gap-2 px-3 py-2.5 sm:grid-cols-[20px_1fr_auto] sm:items-center">
                      <EventStatusIcon event={event} />
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-xs font-semibold text-text-primary">
                            {eventLabel(event)}
                          </span>
                          <span class="font-mono text-[10px] text-text-muted">{detail(event)}</span>
                        </div>
                        <div class="mt-1 flex flex-wrap gap-2 font-mono text-[10px] text-text-muted">
                          <span>{event.device_id}</span>
                          <span>{event.source}</span>
                        </div>
                      </div>
                      <time class="font-mono text-[10px] text-text-muted">
                        {new Date(event.occurred_at).toLocaleString()}
                      </time>
                    </div>
                  )}
                </For>
              </div>
            </article>
          )}
        </For>
      </div>

      <Show when={workstationEventsCursor()}>
        <div class="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={isLoadingEvents()}
            onClick={() => void load(workstationEventsCursor() || undefined)}
          >
            {t().activity.loadMore}
          </Button>
        </div>
      </Show>
    </section>
  );
};
