import type { ActionDefinition } from '../types';

export type TranslateActionKey = (key: string) => string;

export interface CommandItem {
  action: ActionDefinition;
  id: string;
  label: string;
  description: string;
  disabled: boolean;
  unavailableReason: string | null;
}

export type RawActionParameterValues = Record<string, string | boolean>;

export type ParsedActionParameters =
  | { ok: true; parameters: Record<string, unknown> }
  | {
      ok: false;
      error: 'required' | 'invalid_integer' | 'invalid_boolean';
      parameter: string;
    };

export const shouldIgnorePaletteKeyDown = (
  defaultPrevented: boolean,
  confirmationOpen: boolean,
) => defaultPrevented || confirmationOpen;

export const canRestorePaletteFocus = (paletteOpen: boolean, confirmationOpen: boolean) =>
  !paletteOpen && !confirmationOpen;

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const toCommandItem = (
  action: ActionDefinition,
  translate: TranslateActionKey = (key) => key,
): CommandItem => ({
  action,
  id: action.id,
  label: translate(action.label_key),
  description: translate(action.description_key),
  disabled: !action.available,
  unavailableReason: action.unavailable_reason ?? null,
});

const scoreItem = (item: CommandItem, query: string) => {
  const id = normalize(item.id);
  const label = normalize(item.label);
  const description = normalize(item.description);
  const keywords = item.action.keywords.map(normalize);
  const tokens = query.split(' ').filter(Boolean);

  if (id === query) return 1_000;
  if (label === query) return 900;
  if (id.startsWith(query)) return 800;
  if (label.startsWith(query)) return 700;
  if (tokens.every((token) => id.includes(token) || label.includes(token))) return 600;
  if (tokens.every((token) => keywords.some((keyword) => keyword.includes(token)))) return 400;
  if (tokens.every((token) => description.includes(token))) return 200;
  if ([id, label, description, ...keywords].some((value) => value.includes(query))) return 100;
  return 0;
};

export const rankActions = (
  actions: readonly ActionDefinition[],
  search: string,
  translate: TranslateActionKey = (key) => key,
): CommandItem[] => {
  const query = normalize(search);
  const items = actions.map((action) => toCommandItem(action, translate));
  if (!query) return items;

  return items
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .map(({ item }) => item);
};

export const parseActionParameters = (
  action: ActionDefinition,
  rawValues: RawActionParameterValues,
): ParsedActionParameters => {
  const parameters: Record<string, unknown> = {};

  for (const definition of action.parameters) {
    const raw = rawValues[definition.name];
    const isEmpty = raw === undefined || (typeof raw === 'string' && raw.trim() === '');
    if (isEmpty) {
      if (definition.required) {
        return { ok: false, error: 'required', parameter: definition.name };
      }
      continue;
    }

    if (definition.value_type === 'integer') {
      const value = Number(raw);
      if (!Number.isInteger(value)) {
        return { ok: false, error: 'invalid_integer', parameter: definition.name };
      }
      parameters[definition.name] = value;
      continue;
    }

    if (definition.value_type === 'boolean') {
      if (typeof raw === 'boolean') {
        parameters[definition.name] = raw;
      } else if (raw === 'true' || raw === 'false') {
        parameters[definition.name] = raw === 'true';
      } else {
        return { ok: false, error: 'invalid_boolean', parameter: definition.name };
      }
      continue;
    }

    if (definition.value_type === 'string_list') {
      parameters[definition.name] = String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      continue;
    }

    parameters[definition.name] = String(raw).trim();
  }

  return { ok: true, parameters };
};
