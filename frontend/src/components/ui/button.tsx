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
        return 'bg-bg-subtle/80 text-text-primary border border-border-default hover:bg-bg-hover hover:border-border-hover hover:text-white';
      case 'destructive':
        return 'bg-status-danger/15 text-status-danger border border-status-danger/35 hover:bg-status-danger hover:text-white hover:shadow-[0_0_12px_rgba(255,42,85,0.45)]';
      case 'outline':
        return 'border border-border-default bg-transparent text-text-primary hover:bg-bg-hover hover:border-border-hover';
      case 'ghost':
        return 'bg-transparent text-text-primary hover:bg-bg-hover hover:text-accent';
      case 'link':
        return 'text-accent underline-offset-4 hover:underline p-0 h-auto';
      default:
        return 'bg-accent/20 text-accent font-bold border border-accent/50 hover:bg-accent hover:text-bg-base hover:shadow-[0_0_14px_rgba(0,240,255,0.5)] transition-all';
    }
  };

  const sizeClass = () => {
    switch (local.size) {
      case 'sm':
        return 'h-6.5 px-2.5 py-0.5 text-[10.5px]';
      case 'lg':
        return 'h-9 px-4.5 py-1.5 text-xs';
      case 'icon':
        return 'h-6.5 w-6.5 p-0 justify-center shrink-0';
      default:
        return 'h-7.5 px-3 py-1 text-[11.5px]';
    }
  };

  return (
    <button
      class={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold transition-all outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer whitespace-nowrap shrink-0 font-mono tracking-tight',
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
