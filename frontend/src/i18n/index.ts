import { createSignal } from 'solid-js';
import { zh, type Dict } from './dict/zh';
import { en } from './dict/en';
import { Locale, StorageKey } from '../constants';

const dictionaries: Record<Locale, Dict> = {
  [Locale.ZH]: zh,
  [Locale.EN]: en,
};

const getInitialLocale = (): Locale => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(StorageKey.LOCALE);
    if (saved === Locale.EN || saved === Locale.ZH) return saved as Locale;
    if (navigator.language && navigator.language.toLowerCase().startsWith('en')) {
      return Locale.EN;
    }
  }
  return Locale.ZH;
};

export const [locale, setLocaleState] = createSignal<Locale>(getInitialLocale());

export function setLocale(next: Locale) {
  setLocaleState(next);
  if (typeof window !== 'undefined') {
    localStorage.setItem(StorageKey.LOCALE, next);
  }
}

export function toggleLocale() {
  setLocale(locale() === Locale.ZH ? Locale.EN : Locale.ZH);
}

export const t = () => dictionaries[locale()];
export type { Dict };
export { Locale };
