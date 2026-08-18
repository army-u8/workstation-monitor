import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export const Input: Component<JSX.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <input
      class={cn(
        'flex h-8 w-full rounded-lg border border-border-default bg-bg-surface px-3 py-1 text-xs text-text-primary transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs',
        local.class,
      )}
      {...rest}
    />
  );
};

export const Textarea: Component<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class']);
  return (
    <textarea
      class={cn(
        'flex min-h-16 w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-xs text-text-primary transition-colors placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50 resize-y shadow-2xs leading-relaxed',
        local.class,
      )}
      {...rest}
    />
  );
};
