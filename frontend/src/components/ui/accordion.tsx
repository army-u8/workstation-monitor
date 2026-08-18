import { Accordion as ArkAccordion } from '@ark-ui/solid/accordion';
import type { Component, JSX } from 'solid-js';
import { splitProps } from 'solid-js';
import { ChevronDownIcon } from '../Icons';
import { cn } from './utils';

export const Accordion = ArkAccordion.Root;
export const AccordionItem = ArkAccordion.Item;

export const AccordionTrigger: Component<
  ArkAccordion.ItemTriggerProps & { children?: JSX.Element }
> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkAccordion.ItemTrigger
      class={cn(
        'flex flex-1 items-center justify-between py-3 text-xs font-bold text-text-primary transition-all hover:text-accent group cursor-pointer select-none',
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <ChevronDownIcon class="h-3.5 w-3.5 text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </ArkAccordion.ItemTrigger>
  );
};

export const AccordionContent: Component<
  ArkAccordion.ItemContentProps & { children?: JSX.Element }
> = (props) => {
  const [local, rest] = splitProps(props, ['class', 'children']);
  return (
    <ArkAccordion.ItemContent
      class={cn('overflow-hidden text-xs text-text-muted pb-3 leading-relaxed', local.class)}
      {...rest}
    >
      {local.children}
    </ArkAccordion.ItemContent>
  );
};
