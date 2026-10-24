import type { Command, MinkConfiguration } from '../types/schema.js';
import type { RunResult } from '../runtime/process.js';
import {
  prepareEntry,
  resolveValues,
  type ParameterValue,
  type PreparedCommand,
} from './resolve.js';
export interface ExecutionPlan {
  id: string;
  key: string;
  entry?: Command;
  prepared?: PreparedCommand;
  dependencies: ExecutionPlan[];
  steps: Record<string, { plan: ExecutionPlan; needs: string[] }>;
  maxParallel: number;
  failFast?: boolean;
  timeoutMs?: number;
}
export function planExecution(
  config: MinkConfiguration,
  directory: string,
  id: string,
  supplied: Record<string, ParameterValue> = {},
): ExecutionPlan {
  const dependencies = new Map<string, ExecutionPlan>();
  function build(id: string, key: string, values: Record<string, ParameterValue>): ExecutionPlan {
    const entry = Object.hasOwn(config.commands, id) ? config.commands[id] : undefined;
    if (!entry) throw new Error(`Unknown command: ${id}`);
    const resolved = resolveValues(entry, values, id);
    const plan: ExecutionPlan = {
      id,
      key,
      dependencies: [],
      steps: Object.create(null),
      maxParallel: entry.kind === 'pipeline' ? (entry.max_parallel ?? Infinity) : Infinity,
      ...(entry.kind === 'pipeline'
        ? { failFast: entry.fail_fast, timeoutMs: entry.timeout_ms }
        : {}),
    };
    if (entry.kind === 'command') {
      plan.entry = structuredClone(entry);
      plan.prepared = prepareEntry(entry, resolved, directory);
      for (const dep of entry.depends_on ?? []) {
        if (!dependencies.has(dep)) dependencies.set(dep, build(dep, `dependency:${dep}`, {}));
        plan.dependencies.push(dependencies.get(dep)!);
      }
    } else
      for (const [stepId, step] of Object.entries(entry.steps)) {
        const params: Record<string, ParameterValue> = Object.create(null);
        for (const [name, value] of Object.entries(step.with ?? {})) {
          const ref = typeof value === 'string' && /^\$\{params\.([^}]+)\}$/.exec(value);
          if (ref && !Object.hasOwn(resolved, ref[1]))
            throw new Error(`${id}.${stepId}: parameter ${ref[1]} is inactive or missing`);
          params[name] = ref ? resolved[ref[1]] : value;
        }
        plan.steps[stepId] = {
          plan: build(step.uses, `${key}/${stepId}`, params),
          needs: step.needs ?? [],
        };
      }
    return plan;
  }
  return build(id, id, supplied);
}

/** Replan failed branches and their prerequisites; never assume an old service still exists. */
export function planFailedBranches(root: ExecutionPlan, previous: RunResult): ExecutionPlan {
  if (previous.state === 'succeeded' || previous.state === 'ready')
    throw new Error('The previous run has no failed branches');
  const successful = (result: RunResult | undefined) =>
    result?.state === 'succeeded' || result?.state === 'ready';
  const prune = (plan: ExecutionPlan, result?: RunResult, force = false): ExecutionPlan => {
    if (plan.entry) return structuredClone(plan);
    if (!result?.steps && result && ['cancelled', 'skipped'].includes(result.state)) force = true;
    const selected = new Map<string, boolean>();
    const include = (name: string, required: boolean) => {
      if (selected.has(name) && (selected.get(name) || !required)) return;
      selected.set(name, required);
      for (const need of plan.steps[name].needs) include(need, true);
    };
    for (const name of Object.keys(plan.steps)) {
      if (!force && !Object.hasOwn(result?.steps ?? {}, name))
        throw new Error('The previous result does not match the current execution graph');
      if (force || !successful(result?.steps?.[name])) include(name, force);
    }
    return {
      ...structuredClone(plan),
      steps: Object.fromEntries(
        [...selected].map(([name, required]) => [
          name,
          {
            needs: [...plan.steps[name].needs],
            plan: prune(plan.steps[name].plan, result?.steps?.[name], required),
          },
        ]),
      ),
    };
  };
  return prune(root, previous);
}

export function mergeRetryResult(previous: RunResult, current: RunResult): RunResult {
  if (!previous.steps || !current.steps) return current;
  return {
    ...current,
    steps: Object.fromEntries(
      Object.entries(previous.steps).map(([name, result]) => [
        name,
        Object.hasOwn(current.steps!, name)
          ? mergeRetryResult(result, current.steps![name])
          : { ...result, reused: true },
      ]),
    ),
  };
}
