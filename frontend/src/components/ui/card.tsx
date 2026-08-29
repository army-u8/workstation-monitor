import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'hud' | 'glass';
  interactive?: boolean;
}

export const Card: Component<CardProps> = (props) => {
  const [local, rest] = splitProps(props, ['variant', 'interactive', 'class', 'children']);

  const variantClass = () => {
    switch (local.variant) {
      case 'subtle':
        return 'glass-card-subtle p-4';
      case 'hud':
        return 'hud-box p-4 bg-bg-surface/90';
      case 'glass':
        return 'glass-card p-5 bg-bg-surface/80 backdrop-blur-md';
      default:
        return 'glass-card p-5';
    }
  };

  return (
    <div
      class={cn(
        variantClass(),
        local.interactive &&
          'hover:border-border-hover hover:shadow-lg transition-all duration-200 cursor-pointer',
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export const CardHeader: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div
      class={cn('flex flex-col space-y-1.5 border-b border-border-subtle pb-3 mb-3.5', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export const CardTitle: Component<JSX.HTMLAttributes<HTMLHeadingElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <h3
      class={cn('text-sm font-bold text-text-primary tracking-tight m-0 flex items-center gap-2', local.class)}
      {...rest}
    >
      {local.children}
    </h3>
  );
};

export const CardDescription: Component<JSX.HTMLAttributes<HTMLParagraphElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <p class={cn('text-xs text-text-muted mt-0.5 m-0 leading-normal', local.class)} {...rest}>
      {local.children}
    </p>
  );
};

export const CardContent: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div class={cn('p-0', local.class)} {...rest}>
      {local.children}
    </div>
  );
};

export const CardFooter: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div
      class={cn('flex items-center pt-3.5 border-t border-border-subtle mt-3.5 text-xs text-text-muted', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

