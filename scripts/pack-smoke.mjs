import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import assert from 'node:assert/strict';
const temporary = await mkdtemp(join(tmpdir(), 'mink-pack-'));
const root = resolve(import.meta.dirname, '..');
const run = (args, cwd = root) =>
  execFileSync('pnpm', args, {
    cwd,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...process.env, XDG_STATE_HOME: join(temporary, 'state') },
  });
try {
  for (const pkg of ['core', 'tui', 'cli'])
    run(['pack', '--pack-destination', temporary], join(root, 'packages', pkg));
  const files = await readdir(temporary);
  const tarball = (prefix) =>
    join(
      temporary,
      files.find((file) => file.startsWith(prefix) && file.endsWith('.tgz')) ?? 'missing',
    );
  const core = tarball('mink-core-'),
    tui = tarball('mink-tui-'),
    cli = tarball('mink-0.');
  await writeFile(
    join(temporary, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: { mink: `file:${cli}` },
    }),
  );
  await writeFile(
    join(temporary, 'pnpm-workspace.yaml'),
    JSON.stringify({
      packages: [],
      overrides: { '@mink/core': `file:${core}`, '@mink/tui': `file:${tui}` },
    }),
  );
  const store = dirname(run(['store', 'path']).trim());
  run(['install', '--ignore-scripts', '--prefer-offline', '--store-dir', store], temporary);
  await writeFile(
    join(temporary, 'mink.yml'),
    'version: 1\ncommands:\n  hello:\n    kind: command\n    name: Hello\n    command: echo packed-mink\n',
  );
  const executable = join(temporary, 'node_modules', '.bin', 'mink');
  const invoke = (args) =>
    execFileSync(executable, args, {
      cwd: temporary,
      encoding: 'utf8',
      env: { ...process.env, XDG_STATE_HOME: join(temporary, 'state') },
    });
  assert.match(invoke(['--help']), /repository control center/);
  assert.match(invoke(['run', 'hello', '--no-discovery']), /packed-mink/);
  const declaration = await readFile(
    join(temporary, 'node_modules', 'mink', 'dist', 'index.d.ts'),
    'utf8',
  );
  assert.ok(declaration.length);
  console.log('Packed core, TUI and CLI installed and executed successfully.');
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
