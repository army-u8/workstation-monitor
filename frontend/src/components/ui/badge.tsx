import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export interface BadgeProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
  size?: 'default' | 'sm' | 'lg';
  dot?: boolean;
}

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'size', 'dot', 'class', 'children']);

  const variantClass = () => {
    switch (local.variant) {
      case 'secondary':
        return 'bg-bg-subtle text-text-muted border-border-subtle';
      case 'destructive':
        return 'bg-status-danger/15 text-status-danger border-status-danger/30';
      case 'success':
        return 'bg-status-success/15 text-status-success border-status-success/30';
      case 'warning':
        return 'bg-status-warning/15 text-status-warning border-status-warning/30';
      case 'info':
        return 'bg-status-info/15 text-status-info border-status-info/30';
      case 'outline':
        return 'border-border-default text-text-primary bg-transparent';
      default:
        return 'bg-accent/15 text-accent border-accent/30';
    }
  };

  const sizeClass = () => {
    switch (local.size) {
      case 'sm':
        return 'px-1.5 py-0.2 text-[9.5px]';
      case 'lg':
        return 'px-2.5 py-1 text-xs';
      default:
        return 'px-2 py-0.5 text-[10px]';
    }
  };

  return (
    <div
      class={cn(
        'inline-flex items-center gap-1 rounded-md border font-semibold transition-colors select-none font-mono shrink-0',
        variantClass(),
        sizeClass(),
        local.class,
      )}
      {...rest}
    >
      {local.dot && <span class="h-1.5 w-1.5 rounded-full bg-current shrink-0" />}
      {local.children}
    </div>
  );
};
