import { it, expect } from 'vitest';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { doctor, describePlan, formatPlan } from '../packages/core/src/index.js';
import { directory, project, command } from './helpers.js';
import { loadConfig } from '../packages/core/src/config/load.js';

it('plans a nested workflow without side effects and masks secrets in every projection', async () => {
  const mink = await project({
    upload: command('require("fs").writeFileSync("executed",process.env.TOKEN)', {
      params: { token: { type: 'secret', env: 'TOKEN' } },
    }),
    pipeline: {
      kind: 'pipeline',
      name: 'Pipeline',
      params: { token: { type: 'secret' } },
      steps: { upload: { uses: 'upload', with: { token: '${params.token}' } } },
    },
  });
  const plan = describePlan(mink.plan('pipeline', { token: 'secret-unique-value' }));
  expect(plan.steps.upload.plan.env?.TOKEN).toBe('[hidden]');
  expect(JSON.stringify(plan)).not.toContain('secret-unique-value');
  expect(formatPlan(plan)).not.toContain('secret-unique-value');
  await expect(access(join(mink.directory, 'executed'))).rejects.toThrow();
  expect((await mink.state()).history).toHaveLength(0);
});

it('diagnoses a missing executable without executing configured shell code or creating state', async () => {
  const dir = await directory();
  await writeFile(
    join(dir, 'mink.yml'),
    JSON.stringify({
      version: 1,
      commands: {
        missing: { kind: 'command', name: 'Missing', exec: 'mink-deliberately-missing-tool-84219' },
        shell: { kind: 'command', name: 'Shell', command: 'echo bad > executed' },
      },
    }),
  );
  const report = await doctor({ cwd: dir, discover: false, stateDirectory: join(dir, 'state') });
  expect(report.ok).toBe(false);
  expect(
    report.checks.some(
      (check) => check.id.includes('deliberately-missing') && check.status === 'fail',
    ),
  ).toBe(true);
  await expect(access(join(dir, 'executed'))).rejects.toThrow();
  await expect(access(join(dir, 'state'))).rejects.toThrow();
});

it('warns about an occupied service port without stopping it', async () => {
  const server = createServer((socket) => socket.end());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No listening port');
    const m = await project({
      server: command('', { run: { mode: 'service', ready: { type: 'tcp', port: address.port } } }),
    });
    const report = await doctor({
      cwd: m.directory,
      discover: false,
      stateDirectory: join(m.directory, 'state'),
    });
    expect(report.ok).toBe(true);
    expect(report.checks).toContainEqual(
      expect.objectContaining({ id: 'port:server', status: 'warn' }),
    );
    expect(server.listening).toBe(true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it('discovers Make, Taskfile and Compose statically from a nested directory', async () => {
  const dir = await directory();
  await mkdir(join(dir, 'nested'));
  await writeFile(
    join(dir, 'Makefile'),
    'SIDE_EFFECT := $(shell touch executed)\n.PHONY: build\nbuild test: dep\n\t@echo ok\n%.o: %.c\n',
  );
  await writeFile(
    join(dir, 'Taskfile.yml'),
    'version: 3\ntasks:\n  lint:\n    desc: Check source\n    cmds: [echo lint]\n  hidden:\n    internal: true\n    cmds: [echo hidden]\n',
  );
  await writeFile(join(dir, 'compose.yml'), 'services:\n  api:\n    image: nginx\n');
  const loaded = await loadConfig(undefined, join(dir, 'nested'));
  expect(loaded.directory).toBe(dir);
  expect(Object.keys(loaded.config.commands)).toEqual(
    expect.arrayContaining([
      'make:build',
      'make:test',
      'task:lint',
      'compose:up',
      'compose:up:api',
    ]),
  );
  expect(loaded.config.commands).not.toHaveProperty('task:hidden');
  expect(loaded.config.commands).not.toHaveProperty('make:.PHONY');
  await expect(readFile(join(dir, 'executed'))).rejects.toThrow();
});

it('passes empty arguments, quotes and shell metacharacters literally through exec', async () => {
  const payloads = ['', 'with spaces', 'a\'" & | %PATH% !PATH! $(echo bad)\nЮникод', 'trailing\\'];
  const m = await project({
    echo: {
      kind: 'command',
      name: 'Arguments',
      exec: process.execPath,
      args: [
        '-e',
        'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
        '--',
        ...payloads,
      ],
    },
  });
  let output = '';
  expect(
    (
      await m.run(
        'echo',
        {},
        {
          onEvent: (event) => {
            if (event.type === 'stdout') output += event.chunk;
          },
        },
      )
    ).state,
  ).toBe('succeeded');
  expect(JSON.parse(output)).toEqual(payloads);
});
