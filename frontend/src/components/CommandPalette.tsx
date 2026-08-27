import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Component } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { ToastType } from '../constants';
import { t } from '../i18n';
import {
  confirmControlActionApi,
  confirmModal,
  controlActions,
  executeControlActionApi,
  fetchControlActionsApi,
  isCommandPaletteOpen,
  isLoadingControlActions,
  openConfirmDialog,
  setIsCommandPaletteOpen,
  showToast,
} from '../services/store';
import type { ActionDefinition, ActionParameterDefinition, ActionRequest } from '../types';
import {
  canRestorePaletteFocus,
  parseActionParameters,
  rankActions,
  shouldIgnorePaletteKeyDown,
  type RawActionParameterValues,
} from '../utils/command-palette';
import { trapDialogFocus } from '../utils/dialog-focus';
import { CloseIcon, CommandIcon, SearchIcon } from './Icons';
import { Badge, Button, Input } from './ui';

type PaletteError =
  | { code: 'load_failed' | 'execute_failed' | 'invalid_confirmation' }
  | {
      code: 'required' | 'invalid_integer' | 'invalid_boolean';
      parameter: string;
    };

const dictionaryValue = (key: string): string | undefined => {
  let value: unknown = t();
  for (const segment of key.split('.')) {
    if (!value || typeof value !== 'object') return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return typeof value === 'string' ? value : undefined;
};

const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const CommandPalette: Component = () => {
  const location = useLocation();
  const [query, setQuery] = createSignal('');
  const [selectedAction, setSelectedAction] = createSignal<ActionDefinition | null>(null);
  const [parameterValues, setParameterValues] = createSignal<RawActionParameterValues>({});
  const [isExecuting, setIsExecuting] = createSignal(false);
  const [error, setError] = createSignal<PaletteError | null>(null);
  let searchInput: HTMLInputElement | undefined;
  let previouslyFocused: HTMLElement | null = null;
  let pendingFocusRestore: HTMLElement | null = null;
  let wasOpen = false;
  let previousPath = location.pathname;

  const translate = (key: string) => dictionaryValue(key) ?? key;
  const rankedActions = createMemo(() => rankActions(controlActions(), query(), translate));

  const closePalette = () => {
    setIsCommandPaletteOpen(false);
    setSelectedAction(null);
    setParameterValues({});
    setError(null);
  };

  const restorePendingPaletteFocus = () => {
    const focusTarget = pendingFocusRestore;
    if (
      !focusTarget ||
      !canRestorePaletteFocus(isCommandPaletteOpen(), Boolean(confirmModal()))
    ) {
      return;
    }
    queueMicrotask(() => {
      if (
        pendingFocusRestore !== focusTarget ||
        !canRestorePaletteFocus(isCommandPaletteOpen(), Boolean(confirmModal()))
      ) {
        return;
      }
      pendingFocusRestore = null;
      if (focusTarget.isConnected) focusTarget.focus();
    });
  };

  const parameterLabel = (parameter: ActionParameterDefinition) =>
    dictionaryValue(parameter.label_key) ?? parameter.name;

  const errorMessage = () => {
    const current = error();
    if (!current) return '';
    if (current.code === 'load_failed') return t().control.errors.loadFailed;
    if (current.code === 'execute_failed') return t().control.errors.executeFailed;
    if (current.code === 'invalid_confirmation') {
      return t().control.errors.invalidConfirmation;
    }
    if (!('parameter' in current)) return t().control.errors.executeFailed;
    const action = selectedAction();
    const definition = action?.parameters.find((parameter) => parameter.name === current.parameter);
    const label = definition ? parameterLabel(definition) : current.parameter;
    return t().control.validation[current.code].replace('{parameter}', label);
  };

  const completeAction = (action: ActionDefinition) => {
    showToast(
      t().control.success.replace('{action}', translate(action.label_key)),
      ToastType.SUCCESS,
    );
    closePalette();
  };

  const executeAction = async (
    action: ActionDefinition,
    values: RawActionParameterValues,
  ) => {
    if (!action.available || isExecuting()) return;
    const parsed = parseActionParameters(action, values);
    if (!parsed.ok) {
      setError({ code: parsed.error, parameter: parsed.parameter });
      return;
    }

    setError(null);
    setIsExecuting(true);
    const request: ActionRequest = {
      request_id: newRequestId(),
      action_id: action.id,
      parameters: parsed.parameters,
      origin: 'command_palette',
      requested_by: 'local-user',
    };

    try {
      const response = await executeControlActionApi(request);
      if (response.status === 'confirmation_required') {
        const token = response.confirmation?.token;
        if (!token) {
          setError({ code: 'invalid_confirmation' });
          return;
        }
        openConfirmDialog({
          title: t().control.confirmationTitle,
          message: t().control.confirmationMessage.replace(
            '{action}',
            translate(action.label_key),
          ),
          confirmText: t().control.confirmationAction,
          isDestructive: action.risk !== 'safe',
          onConfirm: async () => {
            setIsExecuting(true);
            try {
              const confirmed = await confirmControlActionApi(request, token);
              if (confirmed.status === 'succeeded') {
                completeAction(action);
              } else {
                setError({ code: 'execute_failed' });
              }
            } catch {
              setError({ code: 'invalid_confirmation' });
            } finally {
              setIsExecuting(false);
            }
          },
        });
        return;
      }
      if (response.status === 'succeeded') {
        completeAction(action);
      } else {
        setError({ code: 'execute_failed' });
      }
    } catch {
      setError({ code: 'execute_failed' });
    } finally {
      setIsExecuting(false);
    }
  };

  const chooseAction = (action: ActionDefinition) => {
    if (!action.available) return;
    setError(null);
    setParameterValues({});
    if (action.parameters.length === 0) {
      void executeAction(action, {});
      return;
    }
    setSelectedAction(action);
  };

  onMount(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnorePaletteKeyDown(event.defaultPrevented, Boolean(confirmModal()))) return;
      if (event.metaKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(!isCommandPaletteOpen());
      } else if (event.key === 'Escape' && isCommandPaletteOpen()) {
        event.preventDefault();
        closePalette();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleGlobalKeyDown));
  });

  createEffect(() => {
    const open = isCommandPaletteOpen();
    const confirmationOpen = Boolean(confirmModal());
    if (open && !wasOpen) {
      previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery('');
      setSelectedAction(null);
      setParameterValues({});
      setError(null);
      queueMicrotask(() => searchInput?.focus());
      if (controlActions().length === 0) {
        void fetchControlActionsApi().catch(() => setError({ code: 'load_failed' }));
      }
    } else if (!open && wasOpen) {
      pendingFocusRestore = previouslyFocused;
      previouslyFocused = null;
    }
    wasOpen = open;
    if (canRestorePaletteFocus(open, confirmationOpen)) restorePendingPaletteFocus();
  });

  createEffect(() => {
    const nextPath = location.pathname;
    if (nextPath !== previousPath) closePalette();
    previousPath = nextPath;
  });

  return (
    <Show when={isCommandPaletteOpen()}>
      <div
        class="fixed inset-0 z-40 flex items-start justify-center bg-black/60 px-4 pt-[10vh] backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-hidden={confirmModal() ? 'true' : undefined}
        inert={Boolean(confirmModal())}
        aria-labelledby="command-palette-title"
        onKeyDown={(event) => {
          if (!confirmModal()) trapDialogFocus(event, event.currentTarget);
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closePalette();
        }}
      >
        <div class="w-full max-w-2xl overflow-hidden rounded-xl border border-border-strong bg-bg-modal shadow-2xl">
          <div class="flex items-start justify-between border-b border-border-subtle p-4">
            <div class="flex min-w-0 items-start gap-3">
              <CommandIcon class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <h2 id="command-palette-title" class="text-sm font-bold text-text-primary">
                  {t().control.title}
                </h2>
                <p class="mt-1 text-xs text-text-muted">{t().control.subtitle}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closePalette}
              aria-label={t().common.cancel}
            >
              <CloseIcon class="h-4 w-4" />
            </Button>
          </div>

          <Show
            when={selectedAction()}
            fallback={
              <>
                <div class="border-b border-border-subtle p-3">
                  <div class="relative">
                    <SearchIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      ref={(element) => {
                        searchInput = element;
                      }}
                      value={query()}
                      onInput={(event) => setQuery(event.currentTarget.value)}
                      placeholder={t().control.searchPlaceholder}
                      aria-label={t().control.searchPlaceholder}
                      class="h-10 pl-9 pr-12"
                    />
                    <kbd class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border-default bg-bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                      {t().control.shortcut}
                    </kbd>
                  </div>
                </div>

                <div class="max-h-[55vh] overflow-y-auto p-2">
                  <Show when={isLoadingControlActions()}>
                    <p class="p-5 text-center text-xs text-text-muted">{t().control.loading}</p>
                  </Show>
                  <Show when={!isLoadingControlActions() && rankedActions().length === 0}>
                    <p class="p-5 text-center text-xs text-text-muted">{t().control.empty}</p>
                  </Show>
                  <div class="space-y-1" role="list">
                    <For each={rankedActions()}>
                      {(item) => (
                        <button
                          type="button"
                          class="flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border-hover hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-55"
                          disabled={item.disabled}
                          aria-label={item.label}
                          onClick={() => chooseAction(item.action)}
                        >
                          <CommandIcon class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          <span class="min-w-0 flex-1">
                            <span class="flex flex-wrap items-center gap-2">
                              <span class="text-xs font-semibold text-text-primary">{item.label}</span>
                              <Badge
                                size="sm"
                                variant={item.action.risk === 'safe' ? 'success' : 'warning'}
                              >
                                {t().control.risk[item.action.risk]}
                              </Badge>
                            </span>
                            <span class="mt-1 block text-[11px] text-text-muted">
                              {item.description}
                            </span>
                            <Show when={item.disabled}>
                              <span class="mt-1 block text-[10px] text-status-warning">
                                {dictionaryValue(
                                  `control.unavailableReasons.${item.unavailableReason}`,
                                ) ?? t().control.unavailable}
                              </span>
                            </Show>
                          </span>
                          <span class="font-mono text-[10px] text-text-muted">{item.id}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </>
            }
          >
            {(action) => (
              <form
                class="space-y-4 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void executeAction(action(), parameterValues());
                }}
              >
                <button
                  type="button"
                  class="text-xs font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  onClick={() => {
                    setSelectedAction(null);
                    setError(null);
                    queueMicrotask(() => searchInput?.focus());
                  }}
                >
                  {t().control.back}
                </button>

                <div>
                  <h3 class="text-sm font-bold text-text-primary">{translate(action().label_key)}</h3>
                  <p class="mt-1 text-xs text-text-muted">
                    {translate(action().description_key)}
                  </p>
                  <p class="mt-2 text-[11px] text-text-secondary">
                    {t().control.riskLabel}: {t().control.risk[action().risk]}
                  </p>
                </div>

                <div class="space-y-3">
                  <For each={action().parameters}>
                    {(parameter) => (
                      <label class="block space-y-1.5 text-xs text-text-secondary">
                        <span>{parameterLabel(parameter)}</span>
                        <Show
                          when={parameter.value_type === 'boolean'}
                          fallback={
                            <Input
                              type={parameter.value_type === 'integer' ? 'number' : 'text'}
                              required={parameter.required}
                              value={String(parameterValues()[parameter.name] ?? '')}
                              onInput={(event) =>
                                setParameterValues((current) => ({
                                  ...current,
                                  [parameter.name]: event.currentTarget.value,
                                }))
                              }
                            />
                          }
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(parameterValues()[parameter.name])}
                            onChange={(event) =>
                              setParameterValues((current) => ({
                                ...current,
                                [parameter.name]: event.currentTarget.checked,
                              }))
                            }
                          />
                        </Show>
                      </label>
                    )}
                  </For>
                </div>

                <Show when={errorMessage()}>
                  <p class="rounded-lg border border-status-danger/30 bg-status-danger-bg p-2.5 text-xs text-status-danger">
                    {errorMessage()}
                  </p>
                </Show>

                <div class="flex justify-end">
                  <Button type="submit" loading={isExecuting()} disabled={!action().available}>
                    {isExecuting() ? t().control.executing : t().control.execute}
                  </Button>
                </div>
              </form>
            )}
          </Show>

          <Show when={!selectedAction() && errorMessage()}>
            <p class="border-t border-status-danger/30 bg-status-danger-bg px-4 py-2.5 text-xs text-status-danger">
              {errorMessage()}
            </p>
          </Show>
        </div>
      </div>
    </Show>
  );
};
