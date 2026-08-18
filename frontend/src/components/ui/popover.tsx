import { Popover as ArkPopover } from '@ark-ui/solid/popover';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from './utils';

export const Popover = ArkPopover.Root;
export const PopoverTrigger = ArkPopover.Trigger;
export const PopoverClose = ArkPopover.CloseTrigger;

export const PopoverContent: Component<ArkPopover.ContentProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <Portal>
      <ArkPopover.Positioner>
        <ArkPopover.Content
          class={cn(
            'z-50 w-72 rounded-xl border border-border-default bg-bg-surface p-4 shadow-xl outline-none backdrop-blur-md animate-in fade-in zoom-in-95',
            local.class,
          )}
          {...rest}
        >
          {local.children}
        </ArkPopover.Content>
      </ArkPopover.Positioner>
    </Portal>
  );
};
