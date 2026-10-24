import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { LogBuffer } from '../packages/tui/src/model/log-buffer.js';
import { clipboardCommand, commandPreview } from '../packages/tui/src/model/commands.js';
import { directory } from './helpers.js';
function output(chunk: string, stream: 'stdout' | 'stderr' = 'stdout', instance = 'run:a') {
  return { type: stream, chunk, runId: 'run', instance, id: instance.slice(4), time: 0 } as const;
}
it('reassembles partial lines without mixing processes or stderr and strips terminal controls', () => {
  const logs = new LogBuffer();
  logs.append(output('\u001b[31mhel'));
  logs.append(output('problem\n', 'stderr'));
  logs.append(output('other\n', 'stdout', 'run:b'));
  logs.append(output('lo\u001b[0m\n\n'));
  expect(logs.lines({ runId: 'run' }).map((line) => [line.id, line.stream, line.text])).toEqual([
    ['a', 'stdout', 'hello'],
    ['a', 'stderr', 'problem'],
    ['b', 'stdout', 'other'],
    ['a', 'stdout', ''],
  ]);
  expect(logs.lines({ instance: 'run:b' }).map((line) => line.text)).toEqual(['other']);
});
it('keeps a bounded UTF-8 tail and marks discarded history', () => {
  const logs = new LogBuffer();
  logs.append(output('€'.repeat(100000)));
  expect(logs.byteLength).toBeLessThanOrEqual(262144);
  expect(logs.lines({ runId: 'run' })[0].text).not.toContain('\ufffd');
  expect(logs.lines({ runId: 'run' })[0].text.length).toBeGreaterThan(0);
  for (let i = 0; i < 1100; i++) logs.append(output(`${i}\n`));
  expect(logs.lines({ runId: 'run' })).toHaveLength(1000);
  expect(logs.truncated).toBe(true);
});
it('masks secret environment exports in previews', () => {
  const prepared = { command: 'echo ready', args: [], env: { TOKEN: 'private-token' } };
  expect(
    commandPreview(prepared, {
      kind: 'command',
      name: 'a',
      command: 'echo ready',
      params: { token: { type: 'secret', env: 'TOKEN' } },
    }),
  ).toBe("TOKEN='[hidden]' echo ready");
});
it.skipIf(process.platform === 'win32')(
  'copies a command with cwd and literal environment shared by the whole shell',
  async () => {
    const cwd = await directory(),
      value = "a ' $(echo unsafe)";
    const script = clipboardCommand({
      cwd,
      command: 'printf "%s\\n" "$NAME"; printf "%s\\n" "$NAME"; pwd',
      args: [],
      env: { NAME: value },
    });
    expect(execFileSync('/bin/sh', ['-c', script], { encoding: 'utf8' })).toBe(
      `${value}\n${value}\n${cwd}\n`,
    );
  },
);
