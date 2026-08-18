import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export interface BadgeProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  dot?: boolean;
}

export const Badge: Component<BadgeProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'dot', 'class', 'children']);

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
      case 'outline':
        return 'border-border-default text-text-primary bg-transparent';
      default:
        return 'bg-accent/15 text-accent border-accent/30';
    }
  };

  return (
    <div
      class={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold transition-colors select-none',
        variantClass(),
        local.class,
      )}
      {...rest}
    >
      {local.dot && <span class="h-1.5 w-1.5 rounded-full bg-current" />}
      {local.children}
    </div>
  );
};
