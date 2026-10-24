import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { createRunLog } from '../packages/core/src/index.js';
import { StreamingRedactor } from '../packages/core/src/runtime/log.js';
import { filterLogLines } from '../packages/tui/src/model/log-buffer.js';
import { project, command } from './helpers.js';

it('redacts secrets across every chunk boundary including embedded newlines', () => {
  const secret = 'private\nvalue';
  const text = `before ${secret} after ${secret}`;
  for (let split = 0; split <= text.length; split++) {
    const redactor = new StreamingRedactor([secret]);
    expect(
      redactor.push(text.slice(0, split)) +
        redactor.push(text.slice(split)) +
        redactor.push('', true),
    ).toBe('before [hidden] after [hidden]');
  }
});

it('exports redacted streams without mixing process output or replacing existing files', async () => {
  const m = await project({
    upload: command('', { params: { token: { type: 'secret', env: 'TOKEN' } } }),
  });
  const file = join(m.directory, 'output.jsonl');
  const plan = m.plan('upload', { token: 'private-token' });
  const log = createRunLog(file, plan);
  const event = { runId: 'run', id: 'upload', time: 0 };
  log.write({ ...event, instance: 'run:a', type: 'stdout', chunk: 'before private-' });
  log.write({ ...event, instance: 'run:b', type: 'stderr', chunk: 'separate output' });
  log.write({ ...event, instance: 'run:a', type: 'stdout', chunk: 'token after' });
  log.close();
  const text = await readFile(file, 'utf8');
  expect(text).not.toContain('private-token');
  const entries = text
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(
    entries
      .filter((entry) => entry.instance === 'run:a')
      .map((entry) => entry.text)
      .join(''),
  ).toBe('before [hidden] after');
  expect(
    entries
      .filter((entry) => entry.instance === 'run:b')
      .map((entry) => entry.text)
      .join(''),
  ).toBe('separate output');
  expect(() => createRunLog(file, plan)).toThrow();
});

it('combines literal case-insensitive log search with stream and owner filters', () => {
  const lines = [
    { key: '1', id: 'api', stream: 'stderr' as const, text: 'Request ERROR [x]' },
    { key: '2', id: 'web', stream: 'stdout' as const, text: 'error' },
  ];
  expect(filterLogLines(lines, 'error', 'stderr', 'api')).toEqual([lines[0]]);
  expect(filterLogLines(lines, '[x]')).toEqual([lines[0]]);
  expect(filterLogLines(lines, 'missing')).toEqual([]);
});
