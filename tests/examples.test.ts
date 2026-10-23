import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { it, expect } from 'vitest';
import { loadConfig } from '../packages/core/src/config/load.js';
import { StateStore } from '../packages/core/src/storage.js';
import { directory, project, command } from './helpers.js';
it.each(['demo/mink.yml', 'clothing-store.mink.yml'])(
  'validates the documented %s configuration',
  async (name) => {
    const file = fileURLToPath(new URL(`../examples/${name}`, import.meta.url));
    expect(
      Object.keys((await loadConfig(file, undefined, false)).config.commands).length,
    ).toBeGreaterThan(1);
  },
);
it('saves a partial local preset and resolves the remaining input at invocation', async () => {
  const m = await project({
    a: command('', { params: { x: { type: 'string' }, y: { type: 'number' } } }),
  });
  await m.savePreset('a', 'partial', { x: 'saved' });
  const values = await m.preset('a', 'partial');
  await expect(m.run('a', values)).rejects.toThrow(/missing parameter y/);
  expect((await m.run('a', { ...values, y: 2 })).state).toBe('succeeded');
});
it('recovers malformed preset records while preserving valid local data', async () => {
  const dir = await directory(),
    store = new StateStore(dir, join(dir, 'state'));
  await store.update((state) => {
    state.favorites.push('a');
  });
  await writeFile(
    store.file,
    JSON.stringify({
      favorites: ['a'],
      presets: { a: { good: { x: 1 }, bad: null, nested: { x: {} } }, b: null },
    }),
  );
  expect((await store.read()).presets).toEqual({ a: { good: { x: 1 } } });
  expect((await store.read()).favorites).toEqual(['a']);
});
