import type { Command, CommandParameter, MinkConfiguration } from '../types/schema.js';

export type ParameterValue = string | number | boolean;

export interface PreparedCommand {
  command: string;
  env: Record<string, string>;
  args: string[];
  timeoutMs?: number;
}

export function resolveCommand(
  config: MinkConfiguration,
  id: string,
  values: Record<string, ParameterValue> = {},
): PreparedCommand {
  const entry = config.commands[id];
  if (!entry) throw new Error(`Unknown command: ${id}`);
  if (entry.kind !== 'command') throw new Error(`${id} is a pipeline`);
  if (entry.run?.mode === 'service') throw new Error(`${id} is a service; service execution is not implemented`);
  for (const name of Object.keys(values)) {
    if (!entry.params?.[name]) throw new Error(`${id}: unknown parameter ${name}`);
  }
  const env: Record<string, string> = {};
  const args: string[] = [];
  for (const [name, parameter] of Object.entries(entry.params ?? {})) {
    const value = values[name] ?? parameter.default;
    if (value === undefined) throw new Error(`${id}: missing parameter ${name}`);
    assertParameterValue(id, name, parameter, value);
    if (parameter.env) env[parameter.env] = String(value);
    if (parameter.flag && (parameter.type !== 'boolean' || value)) {
      if (!/^--?[A-Za-z0-9][A-Za-z0-9-]*$/.test(parameter.flag)) {
        throw new Error(`${id}: invalid flag for parameter ${name}`);
      }
      args.push(parameter.flag);
      if (parameter.type !== 'boolean') args.push(String(value));
    }
  }
  return { command: entry.command, env, args, timeoutMs: entry.run?.timeout_ms };
}

function assertParameterValue(id: string, name: string, parameter: CommandParameter, value: unknown): asserts value is ParameterValue {
  const valid = parameter.type === 'select'
    ? typeof value === 'string' && parameter.options?.includes(value)
    : typeof value === parameter.type && (parameter.type !== 'number' || Number.isFinite(value));
  if (!valid) throw new Error(`${id}: invalid value for parameter ${name}`);
}
