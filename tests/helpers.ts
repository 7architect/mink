import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { createMink, type MinkConfiguration, type Mink } from '../packages/core/src/index.js';
const paths: string[] = [],
  sessions: Mink[] = [];
export async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'mink-test-'));
  paths.push(path);
  return path;
}
export async function project(commands: MinkConfiguration['commands']): Promise<Mink> {
  const dir = await directory();
  await writeFile(join(dir, 'mink.yml'), JSON.stringify({ version: 1, commands }));
  const mink = await createMink({ cwd: dir, discover: false, stateDirectory: join(dir, 'state') });
  sessions.push(mink);
  return mink;
}
export function command(code: string, extra: object = {}) {
  return {
    kind: 'command' as const,
    name: 'Test command',
    command: `${JSON.stringify(process.execPath)} -e '${code.replaceAll("'", "'\\''")}' --`,
    ...extra,
  };
}
afterEach(async () => {
  await Promise.all(sessions.splice(0).map((m) => m.dispose()));
  await Promise.all(paths.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
