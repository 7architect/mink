import { spawn } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { directory, command } from './helpers.js';
const cli = fileURLToPath(new URL('../packages/cli/dist/index.js', import.meta.url));
const children: { child: ReturnType<typeof spawn>; done: Promise<unknown> }[] = [];
afterEach(async () => {
  for (const run of children) if (run.child.exitCode === null) run.child.kill('SIGTERM');
  await Promise.all(children.splice(0).map((run) => run.done));
});
async function fixture() {
  const dir = await directory();
  await writeFile(
    join(dir, 'mink.yml'),
    JSON.stringify({
      version: 1,
      commands: {
        greet: command(
          'process.stdout.write(process.env.NAME+":"+process.env.COUNT);process.stderr.write("raw-error\\n")',
          {
            params: {
              name: { type: 'string', env: 'NAME', default: 'team' },
              count: { type: 'number', env: 'COUNT', default: 1 },
            },
          },
        ),
        fail: command('process.exit(7)'),
        fast: {
          kind: 'command',
          name: 'Fast service failure',
          command: 'exit 7',
          run: { mode: 'service' },
        },
        workflow: {
          kind: 'pipeline',
          name: 'Failed workflow',
          steps: { service: { uses: 'service' }, fail: { uses: 'fail', needs: ['service'] } },
        },
        timeout: command('setInterval(()=>{},100)', { run: { timeout_ms: 100 } }),
        secret: command('process.stdout.write(process.env.TOKEN==="private"?"ok":"bad")', {
          params: { token: { type: 'secret', env: 'TOKEN' } },
        }),
        service: command('process.stdout.write("started");setInterval(()=>{},100)', {
          run: { mode: 'service' },
        }),
      },
    }),
  );
  return dir;
}
function start(dir: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  const child = spawn(process.execPath, [cli, ...args], {
    cwd: dir,
    env: { ...process.env, XDG_STATE_HOME: join(dir, 'state'), ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (c) => {
    stdout += c;
  });
  child.stderr.on('data', (c) => {
    stderr += c;
  });
  const done = new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, stdout, stderr }));
    },
  );
  const run = { child, done, output: () => stdout + stderr };
  children.push(run);
  return run;
}
it('lists JSON without opening TUI and runs repeated typed parameters', async () => {
  const dir = await fixture();
  const list = await start(dir, ['list', '--json', '--no-discovery']).done;
  expect(list.code).toBe(0);
  expect(JSON.parse(list.stdout)).toHaveLength(7);
  const run = await start(dir, [
    'run',
    'greet',
    '--param',
    'name=Ada',
    '--param',
    'count=3',
    '--no-discovery',
  ]).done;
  expect(run.code).toBe(0);
  expect(run.stdout).toBe('Ada:3');
  expect(run.stderr).toContain('raw-error\n');
});
it('propagates exit codes, timeouts, preflight failures and unknown arguments', async () => {
  const dir = await fixture();
  expect((await start(dir, ['run', 'fail']).done).code).toBe(7);
  expect((await start(dir, ['run', 'timeout']).done).code).toBe(124);
  expect((await start(dir, ['run', 'greet', '--param', 'count=no']).done).code).toBe(1);
  expect((await start(dir, ['list', '--nonsense']).done).code).toBe(1);
  const root = await start(dir, []).done;
  expect(root.code).toBe(1);
  expect(root.stderr).toContain('TTY');
});
it('uses secret env indirection and local presets', async () => {
  const dir = await fixture();
  expect(
    (
      await start(dir, ['run', 'secret', '--secret-env', 'token=TEST_TOKEN'], {
        TEST_TOKEN: 'private',
      }).done
    ).stdout,
  ).toBe('ok');
  expect((await start(dir, ['run', 'secret', '--param', 'token=private']).done).code).toBe(1);
  expect((await start(dir, ['preset', 'greet', 'morning', '--param', 'name=Ada']).done).code).toBe(
    0,
  );
  expect((await start(dir, ['preset', 'greet', 'morning']).done).code).toBe(1);
  expect(
    (await start(dir, ['run', 'greet', '--preset', 'morning', '--param', 'count=2']).done).stdout,
  ).toBe('Ada:2');
});
it('initializes once without changing an existing configuration', async () => {
  const dir = await directory();
  await writeFile(join(dir, 'package.json'), JSON.stringify({ scripts: { test: 'echo test' } }));
  expect((await start(dir, ['init']).done).code).toBe(0);
  const original = await readFile(join(dir, 'mink.yml'), 'utf8');
  expect((await start(dir, ['init']).done).code).toBe(1);
  expect(await readFile(join(dir, 'mink.yml'), 'utf8')).toBe(original);
});
it('handles SIGTERM while owning a foreground service', async () => {
  const dir = await fixture(),
    run = start(dir, ['run', 'service']);
  await expect.poll(run.output).toContain('Services ready');
  run.child.kill('SIGTERM');
  expect((await run.done).code).toBe(143);
});

it('reports a fast service failure and disposes services when a workflow fails', async () => {
  const dir = await fixture();
  expect((await start(dir, ['run', 'fast']).done).code).toBe(1);
  expect((await start(dir, ['run', 'workflow']).done).code).toBe(1);
});
