import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { run } from './process.mjs';

const root = resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(join(tmpdir(), 'mink-schema-'));
try {
  const generated = join(temporary, 'schema.d.ts');
  run('pnpm', ['exec', 'json2ts', 'schema/mink.schema.json', '-o', generated], {
    cwd: join(root, 'packages/core'),
  });
  assert.equal(
    await readFile(generated, 'utf8'),
    await readFile(join(root, 'packages/core/src/types/schema.d.ts'), 'utf8'),
    'Generated schema types are stale. Run pnpm schema:generate.',
  );
  console.log('Schema types are up to date.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
