import type { Command, MinkConfiguration } from '../types/schema.js';
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
