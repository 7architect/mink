import type { Language } from '@mink/core';
import { en, type MessageKey } from './i18n/en.js';
import { ru } from './i18n/ru.js';
import { de } from './i18n/de.js';
import { fr } from './i18n/fr.js';
import { zh } from './i18n/zh.js';

export type { MessageKey };

const dictionaries: Record<Language, Record<string, string>> = { en, ru, de, fr, zh };
let language: Language = 'en';

export function setLanguage(next: Language): void {
  language = next;
}

export function getLanguage(): Language {
  return language;
}

export function stateLabel(state: string): string {
  return dictionaries[language][`state.${state}`] ?? state;
}

export function t(
  key: MessageKey | (string & {}),
  values?: Record<string, string | number>,
): string {
  const template = dictionaries[language][key] ?? en[key as MessageKey] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}
