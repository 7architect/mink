import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, link, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dump } from 'js-yaml';
import { discover } from './discover.js';
import { validateConfig } from './load.js';
export async function initConfig(file = 'mink.yml', cwd = process.cwd()): Promise<string> {
  const target = resolve(cwd, file),
    directory = dirname(target);
  await mkdir(directory, { recursive: true });
  const config = { version: 1, commands: await discover(directory) };
  validateConfig(config);
  await mkdir(directory, { recursive: true });
  const temporary = target + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, dump(config, { noRefs: true, lineWidth: 100 }), {
      flag: 'wx',
      mode: 0o600,
    });
    await link(temporary, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error(`${target} already exists; it was not changed`);
    throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
  return target;
}
