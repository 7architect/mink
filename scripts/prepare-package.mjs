import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'packages', process.argv[2]);
await copyFile(resolve(root, 'LICENSE'), resolve(directory, 'LICENSE'));
if (process.argv[2] === 'core') {
  await mkdir(resolve(directory, 'dist'), { recursive: true });
  for (const name of ['windows-supervisor.ps1', 'windows-entry.mjs']) {
    await copyFile(resolve(directory, 'src/runtime', name), resolve(directory, 'dist', name));
  }
}
