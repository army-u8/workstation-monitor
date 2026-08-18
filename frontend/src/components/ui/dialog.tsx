import { Dialog as ArkDialog } from '@ark-ui/solid/dialog';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { Portal } from 'solid-js/web';
import { cn } from './utils';

export const Dialog = ArkDialog.Root;
export const DialogTrigger = ArkDialog.Trigger;
export const DialogClose = ArkDialog.CloseTrigger;

export const DialogContent: Component<ArkDialog.ContentProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <Portal>
      <ArkDialog.Backdrop class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in" />
      <ArkDialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <ArkDialog.Content
          class={cn(
            'relative w-full max-w-lg rounded-xl border border-border-default bg-bg-surface/95 p-6 shadow-2xl backdrop-blur-md outline-none transition-all',
            local.class,
          )}
          {...rest}
        >
          {local.children}
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  );
};

export const DialogHeader: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div class={cn('flex flex-col space-y-1.5 text-left mb-4', local.class)} {...rest}>
      {local.children}
    </div>
  );
};

export const DialogFooter: Component<JSX.HTMLAttributes<HTMLDivElement>> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <div
      class={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6',
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </div>
  );
};

export const DialogTitle: Component<ArkDialog.TitleProps & { children?: JSX.Element }> = (
  props,
) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkDialog.Title
      class={cn('text-base font-bold text-text-primary tracking-tight m-0', local.class)}
      {...rest}
    >
      {local.children}
    </ArkDialog.Title>
  );
};

export const DialogDescription: Component<
  ArkDialog.DescriptionProps & { children?: JSX.Element }
> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkDialog.Description
      class={cn('text-xs text-text-muted mt-1 m-0 leading-relaxed', local.class)}
      {...rest}
    >
      {local.children}
    </ArkDialog.Description>
  );
};
