#!/usr/bin/env node
import { defineCommand, defineCittyPlugin, runMain, type ArgsDef } from 'citty';
import { parseArgs } from 'node:util';
import {
  createMink,
  initConfig,
  parseParameter,
  type Mink,
  type ParameterValue,
  type RunResult,
} from '@mink/core';
const strictArguments = defineCittyPlugin({
  name: 'strict-arguments',
  async setup({ cmd, rawArgs }) {
    const definitions: ArgsDef =
      (await (typeof cmd.args === 'function' ? cmd.args() : cmd.args)) ?? {};
    const options = Object.fromEntries(
      Object.entries(definitions)
        .filter(([, def]) => def.type !== 'positional')
        .map(([name, def]) => [
          name,
          {
            type: def.type === 'boolean' ? ('boolean' as const) : ('string' as const),
            multiple: name === 'param' || name === 'secret-env',
          },
        ]),
    );
    const parsed = parseArgs({
      args: rawArgs,
      options,
      allowPositionals: true,
      allowNegative: true,
      strict: true,
    });
    const count = Object.values(definitions).filter((def) => def.type === 'positional').length;
    if (parsed.positionals.length > count) throw new Error('Unexpected positional arguments');
  },
});
const common = {
  config: { type: 'string' as const, description: 'Path to mink.yml' },
  discovery: {
    type: 'boolean' as const,
    default: true,
    description: 'Import scripts (disable with --no-discovery)',
  },
};
const task = {
  type: 'positional' as const,
  required: true as const,
  description: 'Command or pipeline ID',
};
const param = {
  type: 'string' as const,
  description: 'Repeat --param name=value for task parameters',
};
async function session<T>(
  args: { config?: string; discovery?: boolean },
  action: (m: Mink) => Promise<T>,
): Promise<T> {
  const mink = await createMink({ configFile: args.config, discover: args.discovery });
  try {
    return await action(mink);
  } finally {
    await mink.dispose();
  }
}
function parameters(m: Mink, id: string, rawArgs: string[]): Record<string, ParameterValue> {
  const values: Record<string, ParameterValue> = Object.create(null),
    entry = m.getConfig().commands[id];
  if (!entry) throw new Error(`Unknown command: ${id}`);
  for (let i = 0; i < rawArgs.length; i++) {
    let raw: string | undefined;
    if (rawArgs[i] === '--param') raw = rawArgs[++i];
    else if (rawArgs[i].startsWith('--param=')) raw = rawArgs[i].slice(8);
    else continue;
    if (!raw || !raw.includes('=')) throw new Error('Use --param name=value');
    const at = raw.indexOf('='),
      name = raw.slice(0, at),
      p = entry.params?.[name];
    if (!p) throw new Error(`${id}: unknown parameter ${name}`);
    if (Object.hasOwn(values, name)) throw new Error(`Duplicate parameter: ${name}`);
    if (p.type === 'secret')
      throw new Error(`Use --secret-env ${name}=ENV_NAME to avoid a secret in shell history`);
    values[name] = parseParameter(p, raw.slice(at + 1));
  }
  for (let i = 0; i < rawArgs.length; i++) {
    let raw: string | undefined;
    if (rawArgs[i] === '--secret-env') raw = rawArgs[++i];
    else if (rawArgs[i].startsWith('--secret-env=')) raw = rawArgs[i].slice(13);
    else continue;
    if (!raw?.includes('=')) throw new Error('Use --secret-env name=ENV_NAME');
    const at = raw.indexOf('='),
      name = raw.slice(0, at),
      env = raw.slice(at + 1),
      p = entry.params?.[name];
    if (p?.type !== 'secret' || Object.hasOwn(values, name))
      throw new Error(`Invalid or duplicate secret parameter: ${name}`);
    if (process.env[env] === undefined) throw new Error(`Environment variable ${env} is not set`);
    values[name] = process.env[env]!;
  }
  return values;
}
export function exitCode(result: RunResult): number {
  return result.timedOut
    ? 124
    : result.state === 'cancelled'
      ? result.signal === 'SIGTERM'
        ? 143
        : 130
      : (result.exitCode ?? 1);
}
const commands = {
  run: defineCommand({
    plugins: [strictArguments],
    meta: { description: 'Run a command or pipeline' },
    args: {
      ...common,
      task,
      param,
      preset: { type: 'string', description: 'Saved preset name' },
      'secret-env': {
        type: 'string',
        description: 'Read secret parameter from an environment variable',
      },
    },
    async run({ args, rawArgs }) {
      await session(args, async (m) => {
        const values = {
            ...(args.preset ? await m.preset(args.task, args.preset) : {}),
            ...parameters(m, args.task, rawArgs),
          },
          controller = new AbortController();
        let interrupted: NodeJS.Signals | undefined;
        const sigint = () => {
            interrupted = 'SIGINT';
            controller.abort();
          },
          sigterm = () => {
            interrupted = 'SIGTERM';
            controller.abort();
          };
        process.on('SIGINT', sigint);
        process.on('SIGTERM', sigterm);
        try {
          const r = await m.run(args.task, values, {
            signal: controller.signal,
            stdin: 'inherit',
            onEvent: (e) => {
              if (e.chunk) (e.type === 'stderr' ? process.stderr : process.stdout).write(e.chunk);
            },
          });
          const services = m.services();
          let serviceFailed = false;
          if (services.length && (r.state === 'ready' || r.state === 'succeeded')) {
            if (services.some((s) => s.state === 'ready' || s.state === 'starting'))
              process.stderr.write('Services ready; Ctrl+C stops this session.\n');
            const lifetime = await Promise.all(services.map((s) => s.completion));
            serviceFailed = lifetime.some((result) => result.state === 'failed');
          }
          process.exitCode =
            interrupted === 'SIGTERM' ? 143 : interrupted ? 130 : serviceFailed ? 1 : exitCode(r);
          process.stderr.write(
            `${args.task}: ${interrupted ? 'cancelled' : serviceFailed ? 'failed' : r.state} (${r.durationMs} ms)${r.error ? `: ${r.error}` : ''}\n`,
          );
        } finally {
          process.off('SIGINT', sigint);
          process.off('SIGTERM', sigterm);
        }
      });
    },
  }),
  list: defineCommand({
    plugins: [strictArguments],
    meta: { description: 'List discovered and configured commands' },
    args: { ...common, json: { type: 'boolean', description: 'JSON output' } },
    async run({ args }) {
      await session(args, async (m) => {
        const entries = m.searchCommands('');
        console.log(
          args.json
            ? JSON.stringify(
                entries.map(({ id, entry }) => ({ id, ...entry })),
                null,
                2,
              )
            : entries
                .map(
                  ({ id, entry }) =>
                    `${id}\t${entry.name}\t${entry.kind === 'pipeline' ? 'pipeline' : (entry.run?.mode ?? 'task')}`,
                )
                .join('\n'),
        );
      });
    },
  }),
  check: defineCommand({
    plugins: [strictArguments],
    meta: { description: 'Validate configuration and references without execution' },
    args: common,
    async run({ args }) {
      await session(args, async (m) => {
        console.log(
          `Valid: ${Object.keys(m.getConfig().commands).length} commands (${m.directory})`,
        );
      });
    },
  }),
  init: defineCommand({
    plugins: [strictArguments],
    meta: { description: 'Create mink.yml without overwriting an existing file' },
    args: { config: common.config },
    async run({ args }) {
      console.log(`Created ${await initConfig(args.config)}`);
    },
  }),
  preset: defineCommand({
    plugins: [strictArguments],
    meta: { description: 'Save a local preset (secret values are forbidden)' },
    args: {
      ...common,
      task,
      name: { type: 'positional', required: true, description: 'New preset name' },
      param,
    },
    async run({ args, rawArgs }) {
      await session(args, async (m) => {
        await m.savePreset(args.task, args.name, parameters(m, args.task, rawArgs));
        console.log(`Saved ${args.task}@${args.name}`);
      });
    },
  }),
  favorite: defineCommand({
    plugins: [strictArguments],
    meta: { description: 'Toggle a command in local favorites' },
    args: { ...common, task },
    async run({ args }) {
      await session(args, async (m) => {
        await m.favorite(args.task);
        console.log(`Favorite toggled: ${args.task}`);
      });
    },
  }),
};
const ui = defineCommand({
  plugins: [strictArguments],
  meta: { description: 'Open the interactive command palette' },
  args: common,
  async run({ args }) {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw new Error('The palette needs a TTY. Use mink list, mink run <task>, or mink --help.');
    await session(args, async (m) => {
      const { openTui } = await import('@mink/tui');
      await openTui(m);
    });
  },
});
const main = defineCommand({
  meta: { name: 'mink', version: '0.1.0', description: 'Your repository control center' },
  args: common,
  subCommands: { ...commands, ui },
  default: 'ui',
});
await runMain(main);
