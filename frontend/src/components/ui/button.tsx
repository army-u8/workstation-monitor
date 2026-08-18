import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button: Component<ButtonProps> = (props) => {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'class',
    'children',
    'loading',
    'disabled',
  ]);

  const variantClass = () => {
    switch (local.variant) {
      case 'secondary':
        return 'bg-bg-surface text-text-primary border border-border-default hover:bg-bg-hover hover:border-border-hover';
      case 'destructive':
        return 'bg-status-danger/15 text-status-danger border border-status-danger/30 hover:bg-status-danger hover:text-white';
      case 'outline':
        return 'border border-border-default bg-transparent text-text-primary hover:bg-bg-hover hover:border-border-hover';
      case 'ghost':
        return 'bg-transparent text-text-primary hover:bg-bg-hover';
      case 'link':
        return 'text-accent underline-offset-4 hover:underline p-0 h-auto';
      default:
        return 'bg-accent text-white font-bold hover:bg-accent/90 shadow-2xs';
    }
  };

  const sizeClass = () => {
    switch (local.size) {
      case 'sm':
        return 'h-7 px-2.5 py-1 text-[11px]';
      case 'lg':
        return 'h-10 px-5 py-2 text-sm';
      case 'icon':
        return 'h-7 w-7 p-0 justify-center shrink-0';
      default:
        return 'h-8 px-3.5 py-1.5 text-xs';
    }
  };

  return (
    <button
      class={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
        variantClass(),
        sizeClass(),
        local.class,
      )}
      disabled={local.disabled || local.loading}
      {...rest}
    >
      {local.children}
    </button>
  );
};
