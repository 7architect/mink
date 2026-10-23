import { expect, it } from 'vitest';
import { defaultSettings, detectLanguage, type ThemeName } from '../packages/core/src/index.js';
import { project } from './helpers.js';

it('detects the supported language from a locale string', () => {
  expect(detectLanguage('ru_RU.UTF-8')).toBe('ru');
  expect(detectLanguage('zh_CN.UTF-8')).toBe('zh');
  expect(detectLanguage('de_DE')).toBe('de');
  expect(detectLanguage('fr-CA')).toBe('fr');
  expect(detectLanguage('C')).toBe('en');
  expect(detectLanguage('')).toBe('en');
});

it('persists theme and language independently of project state', async () => {
  const mink = await project({});
  expect(await mink.settings()).toEqual(defaultSettings);
  expect(await mink.updateSettings({ theme: 'violet', language: 'ru' })).toEqual({
    theme: 'violet',
    language: 'ru',
  });
  expect(await mink.settings()).toEqual({ theme: 'violet', language: 'ru' });
  await expect(mink.updateSettings({ theme: 'nope' as ThemeName })).rejects.toThrow(
    /Unknown theme/,
  );
  expect((await mink.state()).favorites).toEqual([]);
});
