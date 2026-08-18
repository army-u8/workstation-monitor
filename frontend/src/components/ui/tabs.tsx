import { Tabs as ArkTabs } from '@ark-ui/solid/tabs';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export const Tabs = ArkTabs.Root;

export const TabsList: Component<ArkTabs.ListProps & { children?: JSX.Element }> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkTabs.List
      class={cn(
        'inline-flex items-center rounded-lg bg-bg-base/80 p-1 border border-border-subtle text-text-muted text-[11px] shadow-2xs relative max-w-full overflow-x-auto scrollbar-none',
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <ArkTabs.Indicator class="absolute bg-bg-active shadow-2xs rounded-md transition-all -z-1" />
    </ArkTabs.List>
  );
};

export const TabsTrigger: Component<ArkTabs.TriggerProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkTabs.Trigger
      class={cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 rounded-md px-3.5 py-1.5 text-xs font-bold transition-all outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-bg-active data-[selected]:text-text-primary data-[selected]:shadow-2xs text-text-muted hover:text-text-primary cursor-pointer select-none',
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </ArkTabs.Trigger>
  );
};

export const TabsContent: Component<ArkTabs.ContentProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkTabs.Content
      class={cn('mt-3 outline-none focus-visible:ring-1 focus-visible:ring-accent', local.class)}
      {...rest}
    >
      {local.children}
    </ArkTabs.Content>
  );
};
