import {
  commandLine,
  shellQuote,
  type Command,
  type CommandSearchResult,
  type ExecutionPlan,
  type LocalState,
  type Parameter,
  type ParameterValue,
  type Pipeline,
  type PreparedCommand,
  type RunResult,
} from '@yaroslavlky/mink-core';
export type Values = Record<string, ParameterValue>;
export type CommandEntry = Command | Pipeline;
export type CommandKind = 'task' | 'pipeline' | 'service';
export function commandKind(entry: CommandEntry): CommandKind {
  return entry.kind === 'pipeline'
    ? 'pipeline'
    : entry.run?.mode === 'service'
      ? 'service'
      : 'task';
}
export function rankCommands(
  matches: CommandSearchResult[],
  query: string,
  state: LocalState,
): CommandSearchResult[] {
  const rank = (id: string) => {
    if (query.trim()) return id.toLowerCase() === query.trim().toLowerCase() ? -1 : 0;
    if (state.favorites.includes(id)) return -100;
    const recent = state.history.findIndex((h) => h.id === id);
    return recent < 0 ? 1000 : recent;
  };
  return [...matches].sort((a, b) => rank(a.id) - rank(b.id));
}
export function parameterOptions(parameter: Parameter): readonly string[] {
  return parameter.type === 'boolean' ? ['false', 'true'] : (parameter.options ?? []);
}
export function commandPreview(prepared: PreparedCommand, entry: CommandEntry): string {
  const secrets = new Set(
    Object.values(entry.params ?? {})
      .filter((p) => p.type === 'secret')
      .map((p) => p.env),
  );
  return [
    ...Object.entries(prepared.env).map(
      ([key, value]) => `${key}=${shellQuote(secrets.has(key) ? '[hidden]' : value)}`,
    ),
    commandLine(prepared),
  ].join(' ');
}
export function clipboardCommand(prepared: PreparedCommand): string {
  if (
    prepared.shell === 'powershell' ||
    prepared.shell === 'pwsh' ||
    ((!prepared.shell || prepared.shell === 'auto') && process.platform === 'win32')
  ) {
    const quote = (value: string) => shellQuote(value, 'powershell');
    return [
      '& {',
      '$minkLocation = Get-Location',
      '$minkEnvironment = @{}',
      ...Object.keys(prepared.env).map(
        (key) =>
          `$minkEnvironment[${quote(key)}] = [Environment]::GetEnvironmentVariable(${quote(key)})`,
      ),
      'try {',
      `Set-Location -LiteralPath ${quote(prepared.cwd ?? '.')}`,
      ...Object.entries(prepared.env).map(([key, value]) => `$env:${key} = ${quote(value)}`),
      commandLine(prepared, 'powershell'),
      '} finally {',
      'Set-Location -LiteralPath $minkLocation',
      ...Object.keys(prepared.env).map(
        (key) =>
          `[Environment]::SetEnvironmentVariable(${quote(key)}, $minkEnvironment[${quote(key)}])`,
      ),
      '}',
      '}',
    ].join('\n');
  }
  return [
    '(',
    `cd ${shellQuote(prepared.cwd ?? '.')} || exit`,
    ...Object.entries(prepared.env).map(([key, value]) => `export ${key}=${shellQuote(value)}`),
    commandLine(prepared),
    ')',
  ].join('\n');
}
export interface PlanRow {
  key: string;
  id: string;
  label: string;
  depth: number;
  kind: CommandKind;
  needs: string[];
}
export function planRows(plan: ExecutionPlan): PlanRow[] {
  const rows: PlanRow[] = [],
    seen = new Set<string>();
  function visit(node: ExecutionPlan, depth: number, label: string, needs: string[] = []) {
    if (seen.has(node.key)) return;
    seen.add(node.key);
    rows.push({
      key: node.key,
      id: node.id,
      label,
      depth,
      kind: node.entry ? commandKind(node.entry) : 'pipeline',
      needs,
    });
    for (const dependency of node.dependencies) visit(dependency, depth + 1, dependency.id);
    for (const [name, step] of Object.entries(node.steps))
      visit(step.plan, depth + 1, name, step.needs);
  }
  visit(plan, 0, plan.id);
  return rows;
}
export function resultStates(result: RunResult, key: string): Record<string, string> {
  const states: Record<string, string> = { [key]: result.state };
  for (const [name, child] of Object.entries(result.steps ?? {}))
    Object.assign(states, resultStates(child, `${key}/${name}`));
  return states;
}
