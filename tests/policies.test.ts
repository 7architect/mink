import { createServer } from 'node:net';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { it, expect } from 'vitest';
import { project, command } from './helpers.js';

async function freePort(): Promise<number> {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return address.port;
}

it('retries failed tasks without repeating shared prerequisites', async () => {
  const m = await project({
    setup: command('require("fs").appendFileSync("setup","x")'),
    flaky: command(
      'const fs=require("fs");let n=0;try{n=Number(fs.readFileSync("attempt","utf8"))}catch{};fs.writeFileSync("attempt",String(n+1));process.exit(n<1?7:0)',
      {
        depends_on: ['setup'],
        run: { retry: { attempts: 3, delay_ms: 10 } },
      },
    ),
  });
  const result = await m.run('flaky');
  expect(result.state).toBe('succeeded');
  expect(result.attempts).toBe(2);
  expect(await readFile(join(m.directory, 'setup'), 'utf8')).toBe('x');
});

it('cancels sibling tasks on fail-fast while reporting the pipeline as failed', async () => {
  const m = await project({
    fail: command('process.exit(7)'),
    wait: command('setInterval(()=>{},100)'),
    pipeline: {
      kind: 'pipeline',
      name: 'Fail fast',
      fail_fast: true,
      steps: { fail: { uses: 'fail' }, wait: { uses: 'wait' } },
    },
  });
  const result = await m.run('pipeline');
  expect(result.state).toBe('failed');
  expect(result.steps?.fail.state).toBe('failed');
  expect(result.steps?.wait.state).toBe('cancelled');
});

it('applies a pipeline deadline to prerequisites and queued tasks', async () => {
  const m = await project({
    setup: command('setInterval(()=>{},100)'),
    task: command('', { depends_on: ['setup'] }),
    pipeline: {
      kind: 'pipeline',
      name: 'Deadline',
      max_parallel: 1,
      timeout_ms: 100,
      steps: { first: { uses: 'task' }, second: { uses: 'task' } },
    },
  });
  const result = await m.run('pipeline');
  expect(result.timedOut).toBe(true);
  expect(result.state).toBe('failed');
});

it('bounds a nested pipeline deadline and cleans up a no-longer-needed prerequisite', async () => {
  const m = await project({
    setup: command('setInterval(()=>{},100)'),
    task: command('', { depends_on: ['setup'] }),
    nested: {
      kind: 'pipeline',
      name: 'Nested deadline',
      timeout_ms: 50,
      steps: { task: { uses: 'task' } },
    },
    root: { kind: 'pipeline', name: 'Root', steps: { nested: { uses: 'nested' } } },
  });
  const result = await m.run('root');
  expect(result.state).toBe('failed');
  expect(result.steps?.nested.timedOut).toBe(true);
});

it('detects and recovers from unhealthy services without restarting unless configured', async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const m = await project({
    server: command(
      `require("http").createServer((q,r)=>{r.statusCode=require("fs").existsSync("unhealthy")?503:200;r.end()}).listen(${port},"127.0.0.1")`,
      {
        run: {
          mode: 'service',
          ready: { type: 'http', url },
          health: { type: 'http', url, interval_ms: 20, failure_threshold: 1 },
        },
      },
    ),
  });
  expect((await m.run('server')).state).toBe('ready');
  await writeFile(join(m.directory, 'unhealthy'), 'yes');
  await expect.poll(() => m.services()[0].state).toBe('unhealthy');
  const { unlink } = await import('node:fs/promises');
  await unlink(join(m.directory, 'unhealthy'));
  await expect.poll(() => m.services()[0].state).toBe('ready');
  await m.stopService(m.services()[0].instance);
  expect(m.services()[0].state).toBe('stopped');
});

it('bounds automatic service restarts and keeps a single owned lifetime', async () => {
  const m = await project({
    server: command(
      'require("fs").appendFileSync("starts","x");setTimeout(()=>process.exit(7),150)',
      {
        run: { mode: 'service', restart: { max_attempts: 1, delay_ms: 10 } },
      },
    ),
  });
  expect((await m.run('server')).state).toBe('ready');
  const service = m.services()[0];
  const result = await service.completion;
  expect(result.state).toBe('failed');
  expect(result.attempts).toBe(2);
  expect(await readFile(join(m.directory, 'starts'), 'utf8')).toBe('xx');
  expect(m.services()).toHaveLength(1);
});

it('restarts a service after health failures and fails after its replacement budget is exhausted', async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const m = await project({
    server: command(
      `require("fs").appendFileSync("starts","x");const begin=Date.now();require("http").createServer((q,r)=>{r.statusCode=Date.now()-begin<200?200:503;r.end()}).listen(${port},"127.0.0.1")`,
      {
        run: {
          mode: 'service',
          ready: { type: 'http', url, interval_ms: 10 },
          health: { type: 'http', url, interval_ms: 20, failure_threshold: 1 },
          restart: { max_attempts: 1, delay_ms: 10 },
        },
      },
    ),
  });
  expect((await m.run('server')).state).toBe('ready');
  const result = await m.services()[0].completion;
  expect(result.state).toBe('failed');
  expect(result.error).toMatch(/health/);
  expect(result.attempts).toBe(2);
  expect(await readFile(join(m.directory, 'starts'), 'utf8')).toBe('xx');
});

it('reruns failed branches with their prerequisites while preserving unrelated successful work', async () => {
  const m = await project({
    setup: command('require("fs").appendFileSync("setup","x")'),
    unrelated: command('require("fs").appendFileSync("unrelated","x")'),
    flaky: command(
      'const fs=require("fs");const before=fs.existsSync("attempt");fs.writeFileSync("attempt","yes");process.exit(before?0:7)',
    ),
    pipeline: {
      kind: 'pipeline',
      name: 'Retry branches',
      steps: {
        setup: { uses: 'setup' },
        flaky: { uses: 'flaky', needs: ['setup'] },
        unrelated: { uses: 'unrelated' },
      },
    },
  });
  const first = await m.run('pipeline');
  expect(first.state).toBe('failed');
  const retried = await m.run('pipeline', {}, { retryFailed: first });
  expect(retried.state).toBe('succeeded');
  expect(retried.steps?.unrelated.reused).toBe(true);
  expect(await readFile(join(m.directory, 'setup'), 'utf8')).toBe('xx');
  expect(await readFile(join(m.directory, 'unrelated'), 'utf8')).toBe('x');
});
