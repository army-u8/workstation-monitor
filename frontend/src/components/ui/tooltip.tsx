import { Tooltip as ArkTooltip } from '@ark-ui/solid/tooltip';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from './utils';

export const Tooltip = ArkTooltip.Root;
export const TooltipTrigger = ArkTooltip.Trigger;

export const TooltipContent: Component<ArkTooltip.ContentProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <Portal>
      <ArkTooltip.Positioner>
        <ArkTooltip.Content
          class={cn(
            'z-50 overflow-hidden rounded-md border border-border-default bg-bg-surface px-2.5 py-1 text-[11px] font-mono text-text-primary shadow-md animate-in fade-in zoom-in-95',
            local.class,
          )}
          {...rest}
        >
          {local.children}
        </ArkTooltip.Content>
      </ArkTooltip.Positioner>
    </Portal>
  );
};
