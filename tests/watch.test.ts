import { it, expect } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { watchTasks } from '../packages/core/src/index.js';
import { directory } from './helpers.js';

it('debounces changes and awaits cancellation before restarting a watched task', async () => {
  const dir = await directory();
  await writeFile(join(dir, 'input.txt'), 'initial');
  const controller = new AbortController();
  let runs = 0,
    active = 0,
    peak = 0,
    cancellations = 0;
  const watching = watchTasks({
    directory: dir,
    signal: controller.signal,
    debounceMs: 30,
    run: async (signal) => {
      runs++;
      active++;
      peak = Math.max(peak, active);
      try {
        await delay(10000, undefined, { signal });
      } catch {
        cancellations++;
        await delay(30);
      } finally {
        active--;
      }
    },
  });
  try {
    await expect.poll(() => runs).toBe(1);
    await writeFile(join(dir, 'input.txt'), 'changed');
    await expect.poll(() => runs).toBe(2);
    expect(peak).toBe(1);
    expect(cancellations).toBe(1);
  } finally {
    controller.abort();
    await watching;
  }
  expect(active).toBe(0);
});

it('queues one replacement and ignores excluded files', async () => {
  const dir = await directory();
  await writeFile(join(dir, 'input.txt'), 'initial');
  await writeFile(join(dir, 'ignored.txt'), 'initial');
  const controller = new AbortController();
  let release!: () => void;
  const first = new Promise<void>((resolve) => {
    release = resolve;
  });
  let runs = 0;
  const watching = watchTasks({
    directory: dir,
    ignore: ['ignored.txt'],
    signal: controller.signal,
    mode: 'queue',
    debounceMs: 30,
    run: async () => {
      if (++runs === 1) await first;
    },
  });
  try {
    await expect.poll(() => runs).toBe(1);
    await writeFile(join(dir, 'ignored.txt'), 'ignore');
    await delay(100);
    expect(runs).toBe(1);
    await writeFile(join(dir, 'input.txt'), 'changed');
    await delay(100);
    expect(runs).toBe(1);
    release();
    await expect.poll(() => runs).toBe(2);
  } finally {
    release();
    controller.abort();
    await watching;
  }
});
