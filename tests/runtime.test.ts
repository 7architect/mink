import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { project, command } from './helpers.js';

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  return address.port;
}

it.each(['http', 'tcp'] as const)(
  'waits for real %s readiness before a dependent step and restarts without prerequisites',
  async (type) => {
    const port = await freePort();
    const url = `http://127.0.0.1:${port}/health`;
    const m = await project({
      setup: command('require("fs").appendFileSync("setup", "x")'),
      server: command(
        `setTimeout(()=>require("http").createServer((q,r)=>r.end("healthy")).listen(${port},"127.0.0.1"),150)`,
        {
          depends_on: ['setup'],
          run: {
            mode: 'service',
            startup_timeout_ms: 3000,
            ready: type === 'tcp' ? { type, port } : { type, url },
          },
        },
      ),
      probe: command(`fetch("${url}").then(r=>{if(!r.ok)process.exit(2)})`),
      p: {
        kind: 'pipeline',
        name: 'p',
        max_parallel: 1,
        steps: { server: { uses: 'server' }, probe: { uses: 'probe', needs: ['server'] } },
      },
    });
    expect((await m.run('p')).state).toBe('succeeded');
    const service = m.services()[0];
    expect(service).not.toHaveProperty('plan');
    expect((await m.restartService(service.instance)).state).toBe('ready');
    expect(await readFile(join(m.directory, 'setup'), 'utf8')).toBe('x');
    await m.stopService(m.services()[0].instance, true);
    await expect(fetch(url)).rejects.toThrow();
  },
);

it('reserves services before waiting for prerequisites in concurrent invocations', async () => {
  const m = await project({
    setup: command('setTimeout(()=>{},150)'),
    server: command('setInterval(()=>{},100)', { depends_on: ['setup'], run: { mode: 'service' } }),
  });
  const first = m.run('server');
  await expect(m.run('server')).rejects.toThrow(/already scheduled/);
  expect((await first).state).toBe('ready');
  await expect(m.run('server')).rejects.toThrow(/already scheduled/);
  await m.stopService(m.services()[0].instance);
  expect((await m.run('server')).state).toBe('ready');
  expect(m.services()).toHaveLength(1);
});

it('bounds concurrent processes across independent nested graphs', async () => {
  const m = await project({
    wait: command('setTimeout(()=>{},120)'),
    inner: { kind: 'pipeline', name: 'inner', steps: { a: { uses: 'wait' }, b: { uses: 'wait' } } },
    root: {
      kind: 'pipeline',
      name: 'root',
      max_parallel: 2,
      steps: { a: { uses: 'inner' }, b: { uses: 'inner' } },
    },
  });
  let active = 0,
    peak = 0;
  const result = await m.run(
    'root',
    {},
    {
      onEvent: (e) => {
        if (e.type === 'start') {
          active++;
          peak = Math.max(peak, active);
        }
        if (e.type === 'finish') active--;
      },
    },
  );
  expect(result.state).toBe('succeeded');
  expect(peak).toBe(2);
  expect(active).toBe(0);
});

it('kills a background descendant when its parent exits naturally', async () => {
  const m = await project({
    background: command(
      'const child=require("child_process").spawn(process.execPath,["-e","setInterval(()=>{},100)"],{stdio:"ignore"});require("fs").writeFileSync("child.pid",String(child.pid));child.unref()',
    ),
  });
  expect((await m.run('background')).state).toBe('succeeded');
  const pid = Number(await readFile(join(m.directory, 'child.pid'), 'utf8'));
  await expect
    .poll(async () => {
      try {
        process.kill(pid, 0);
        // Linux can retain a dead orphan briefly as a zombie.
        if (process.platform === 'linux')
          return (await readFile(`/proc/${pid}/stat`, 'utf8')).split(' ')[2] === 'Z';
        return false;
      } catch {
        return true;
      }
    })
    .toBe(true);
});

it('keeps public execution plans detached from internal configuration', async () => {
  const m = await project({ a: command('process.stdout.write("original")') });
  m.plan('a').entry!.command = 'false';
  expect((await m.run('a')).state).toBe('succeeded');
});

it('atomically preserves the first preset from concurrent writes', async () => {
  const m = await project({
    a: command('', { params: { x: { type: 'string', default: 'default' } } }),
  });
  const results = await Promise.allSettled([
    m.savePreset('a', 'name', { x: 'one' }),
    m.savePreset('a', 'name', { x: 'two' }),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(['one', 'two']).toContain((await m.preset('a', 'name')).x);
});

it('forwards pipeline secrets only through secret inputs', async () => {
  const m = await project({
    a: command('process.exit(process.env.TOKEN==="hidden"?0:2)', {
      params: { token: { type: 'secret', env: 'TOKEN' } },
    }),
    p: {
      kind: 'pipeline',
      name: 'p',
      params: { token: { type: 'secret' } },
      steps: { a: { uses: 'a', with: { token: '${params.token}' } } },
    },
  });
  expect((await m.run('p', { token: 'hidden' })).state).toBe('succeeded');
});
