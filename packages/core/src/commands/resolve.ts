import { resolve } from 'node:path';
import type { Command, MinkConfiguration, Parameter, Pipeline } from '../types/schema.js';
export type ParameterValue = string | number | boolean;
export interface PreparedCommand {
  command: string;
  env: Record<string, string>;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}
export function parameterFields(
  entry: Command | Pipeline,
  values: Record<string, ParameterValue> = {},
): [string, Parameter][] {
  const params = entry.params ?? {},
    fields: [string, Parameter][] = [],
    done = new Map<string, boolean>(),
    active = new Set<string>();
  function visit(name: string): boolean {
    if (done.has(name)) return done.get(name)!;
    if (active.has(name)) throw new Error(`Conditional parameter cycle at ${name}`);
    const p = params[name];
    if (!p) throw new Error(`Unknown condition parameter ${name}`);
    active.add(name);
    const visible =
      !p.when ||
      (visit(p.when.param) &&
        (values[p.when.param] ?? params[p.when.param].default) === p.when.equals);
    active.delete(name);
    done.set(name, visible);
    if (visible) fields.push([name, p]);
    return visible;
  }
  for (const name of Object.keys(params)) visit(name);
  return fields;
}
export function assertParameterValue(
  label: string,
  p: Parameter,
  value: unknown,
): asserts value is ParameterValue {
  const valid =
    p.type === 'select'
      ? typeof value === 'string' && p.options?.includes(value)
      : p.type === 'number' || p.type === 'port'
        ? typeof value === 'number' &&
          Number.isFinite(value) &&
          (p.type !== 'port' || (Number.isInteger(value) && value >= 1 && value <= 65535))
        : p.type === 'boolean'
          ? typeof value === 'boolean'
          : typeof value === 'string' && !value.includes('\0');
  if (!valid)
    throw new Error(
      `${label}: expected ${p.type}${p.type === 'select' ? ` (${p.options?.join(', ')})` : ''}`,
    );
}
export function resolveValues(
  entry: Command | Pipeline,
  supplied: Record<string, ParameterValue> = {},
  label = entry.name,
): Record<string, ParameterValue> {
  const params = entry.params ?? {};
  for (const key of Object.keys(supplied))
    if (!Object.hasOwn(params, key)) throw new Error(`${label}: unknown parameter ${key}`);
  const result: Record<string, ParameterValue> = Object.create(null);
  const done = new Set<string>(),
    active = new Set<string>();
  function visit(name: string): void {
    if (done.has(name)) return;
    if (active.has(name)) throw new Error(`${label}: conditional parameter cycle at ${name}`);
    active.add(name);
    const p = params[name];
    if (p.when) {
      if (!Object.hasOwn(params, p.when.param))
        throw new Error(`${label}.${name}: unknown condition parameter ${p.when.param}`);
      visit(p.when.param);
      if (result[p.when.param] !== p.when.equals) {
        if (Object.hasOwn(supplied, name))
          throw new Error(`${label}.${name}: parameter is inactive`);
        active.delete(name);
        done.add(name);
        return;
      }
    }
    const value = supplied[name] ?? p.default;
    if (value === undefined) throw new Error(`${label}: missing parameter ${name}`);
    assertParameterValue(`${label}.${name}`, p, value);
    result[name] = value;
    active.delete(name);
    done.add(name);
  }
  for (const name of Object.keys(params)) visit(name);
  return result;
}
export function prepareEntry(
  entry: Command,
  values: Record<string, ParameterValue>,
  directory?: string,
): PreparedCommand {
  const env: Record<string, string> = Object.create(null),
    args: string[] = [];
  const cwd = directory && resolve(directory, entry.cwd ?? '.');
  for (const [name, value] of Object.entries(values)) {
    const p = entry.params![name];
    if (p.env) env[p.env] = p.type === 'path' && cwd ? resolve(cwd, String(value)) : String(value);
    if (p.flag && (p.type !== 'boolean' || value)) {
      args.push(p.flag);
      if (p.type !== 'boolean') args.push(String(value));
    }
  }
  return { command: entry.command, env, args, cwd, timeoutMs: entry.run?.timeout_ms };
}
export function resolveCommand(
  config: MinkConfiguration,
  id: string,
  values: Record<string, ParameterValue> = {},
): PreparedCommand {
  const entry = Object.hasOwn(config.commands, id) ? config.commands[id] : undefined;
  if (!entry) throw new Error(`Unknown command: ${id}`);
  if (entry.kind !== 'command') throw new Error(`${id} is a pipeline; use plan() to inspect it`);
  return prepareEntry(entry, resolveValues(entry, values, id));
}
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
export function commandLine(prepared: PreparedCommand): string {
  return [prepared.command, ...prepared.args.map(shellQuote)].join(' ');
}
export function parseParameter(p: Parameter, value: string): ParameterValue {
  if (p.type === 'boolean') {
    if (value !== 'true' && value !== 'false') throw new Error('Expected true or false');
    return value === 'true';
  }
  if (p.type === 'number' || p.type === 'port') {
    if (!value.trim()) throw new Error('Expected a number');
    const n = Number(value);
    assertParameterValue('Value', p, n);
    return n;
  }
  assertParameterValue('Value', p, value);
  return value;
}
