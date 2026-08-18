import { Tooltip as ArkTooltip } from '@ark-ui/solid/tooltip';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from './utils';

export const Tooltip = ArkTooltip.Root;
export const TooltipTrigger = ArkTooltip.Trigger;
export const TooltipPositioner = ArkTooltip.Positioner;

export const TooltipContent: Component<ArkTooltip.ContentProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <Portal>
      <ArkTooltip.Positioner>
        <ArkTooltip.Content
          class={cn(
            'z-50 overflow-hidden rounded-md border border-border-default bg-bg-surface/95 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-text-primary shadow-xl pointer-events-none select-none transition-all',
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

export interface SimpleTooltipProps {
  content: JSX.Element | string;
  children: JSX.Element;
  openDelay?: number;
  closeDelay?: number;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  class?: string;
}

export const SimpleTooltip: Component<SimpleTooltipProps> = (props) => {
  return (
    <ArkTooltip.Root
      openDelay={props.openDelay ?? 100}
      closeDelay={props.closeDelay ?? 50}
      positioning={{ placement: props.placement ?? 'top', gutter: 6 }}
    >
      <ArkTooltip.Trigger class="inline-flex">{props.children}</ArkTooltip.Trigger>
      <Portal>
        <ArkTooltip.Positioner>
          <ArkTooltip.Content
            class={cn(
              'z-50 overflow-hidden rounded-md border border-border-default bg-bg-surface/95 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-text-primary shadow-2xl pointer-events-none select-none animate-in fade-in zoom-in-95',
              props.class,
            )}
          >
            {props.content}
          </ArkTooltip.Content>
        </ArkTooltip.Positioner>
      </Portal>
    </ArkTooltip.Root>
  );
};
