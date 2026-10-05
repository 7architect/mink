import type { MinkConfiguration, Parameter } from '../types/schema.js';

export function validateReferences(config: MinkConfiguration): void {
  const commands = config.commands;
  for (const [id, entry] of Object.entries(commands)) {
    for (const [name, parameter] of Object.entries(entry.params ?? {})) {
      validateDefault(`${id}.params.${name}`, parameter);
    }
    if (entry.kind === 'command') {
      for (const dependency of entry.depends_on ?? []) {
        if (commands[dependency]?.kind !== 'command') {
          throw new Error(`${id}: unknown command dependency ${dependency}`);
        }
      }
    } else {
      for (const [stepId, step] of Object.entries(entry.steps)) {
        if (!commands[step.uses]) throw new Error(`${id}.${stepId}: unknown command ${step.uses}`);
        for (const need of step.needs ?? []) {
          if (!entry.steps[need]) throw new Error(`${id}.${stepId}: unknown step ${need}`);
        }
      }
      checkCycles(Object.keys(entry.steps), step => entry.steps[step].needs ?? [], `${id}.steps`);
    }
  }
  checkCycles(Object.keys(commands), id => {
    const entry = commands[id];
    return entry.kind === 'command'
      ? entry.depends_on ?? []
      : Object.values(entry.steps).map(step => step.uses);
  }, 'commands');
}

function validateDefault(path: string, parameter: Parameter): void {
  if (parameter.type === 'select' && parameter.default !== undefined &&
      !parameter.options?.includes(parameter.default as string)) {
    throw new Error(`${path}: default must be one of options`);
  }
}

function checkCycles(nodes: string[], edges: (node: string) => string[], path: string): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(node: string): void {
    if (visiting.has(node)) throw new Error(`${path}: cycle at ${node}`);
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of edges(node)) visit(next);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of nodes) visit(node);
}
