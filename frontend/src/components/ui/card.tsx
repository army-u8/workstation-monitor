import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { cn } from './utils';

export const Card: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div class={cn('glass-card p-5 transition-all', local.class)} {...rest}>
      {local.children}
    </div>
  );
};

export const CardHeader: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div
      class={cn('flex flex-col space-y-1.5 border-b border-border-subtle pb-3 mb-4', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export const CardTitle: Component<JSX.HTMLAttributes<HTMLHeadingElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <h3 class={cn('text-sm font-bold text-text-primary tracking-tight m-0', local.class)} {...rest}>
      {local.children}
    </h3>
  );
};

export const CardDescription: Component<JSX.HTMLAttributes<HTMLParagraphElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <p class={cn('text-xs text-text-muted mt-0.5 m-0', local.class)} {...rest}>
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
      class={cn('flex items-center pt-4 border-t border-border-subtle mt-4', local.class)}
      {...rest}
    >
      {local.children}
    </div>
  );
};
