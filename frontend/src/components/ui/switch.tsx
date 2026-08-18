import { Switch as ArkSwitch } from '@ark-ui/solid/switch';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export const Switch: Component<ArkSwitch.RootProps & { label?: JSX.Element }> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'label', 'children']);
  return (
    <ArkSwitch.Root
      class={cn(
        'inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-text-primary',
        local.class,
      )}
      {...rest}
    >
      <ArkSwitch.Control class="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors bg-bg-surface data-[state=checked]:bg-accent shadow-2xs">
        <ArkSwitch.Thumb class="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform translate-x-0.5 data-[state=checked]:translate-x-4.5" />
      </ArkSwitch.Control>
      {local.label && <ArkSwitch.Label class="text-xs">{local.label}</ArkSwitch.Label>}
      <ArkSwitch.HiddenInput />
    </ArkSwitch.Root>
  );
};
