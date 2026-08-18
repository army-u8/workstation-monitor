import { Avatar as ArkAvatar } from '@ark-ui/solid/avatar';
import type { Component } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export interface AvatarProps extends ArkAvatar.RootProps {
  src?: string;
  name?: string;
  fallback?: string;
}

export const Avatar: Component<AvatarProps> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'src', 'name', 'fallback']);
  return (
    <ArkAvatar.Root
      class={cn(
        'relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-border-subtle bg-bg-surface',
        local.class,
      )}
      {...rest}
    >
      <ArkAvatar.Image
        src={local.src}
        alt={local.name || 'Avatar'}
        class="aspect-square h-full w-full object-cover"
      />
      <ArkAvatar.Fallback class="flex h-full w-full items-center justify-center rounded-full bg-bg-subtle text-[11px] font-bold text-text-primary">
        {local.fallback || (local.name ? local.name.slice(0, 2).toUpperCase() : 'U')}
      </ArkAvatar.Fallback>
    </ArkAvatar.Root>
  );
};
