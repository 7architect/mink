import { spawn } from 'node:child_process';
import type { ConsolaInstance } from 'consola';
import type { LoadedConfig } from '../config/load.js';
import { resolveCommand, type ParameterValue } from './resolve.js';

export interface RunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  timedOut: boolean;
}

export async function runCommand(
  loaded: LoadedConfig,
  id: string,
  logger: ConsolaInstance,
  values: Record<string, ParameterValue> = {},
): Promise<RunResult> {
  const visited = new Set<string>();
  async function run(nextId: string, params: Record<string, ParameterValue>): Promise<RunResult> {
    const entry = loaded.config.commands[nextId];
    if (!entry || entry.kind !== 'command') throw new Error(`Unknown command: ${nextId}`);
    for (const dependency of entry.depends_on ?? []) {
      if (!visited.has(dependency)) {
        const dependencyResult = await run(dependency, {});
        if (dependencyResult.exitCode !== 0) return dependencyResult;
        visited.add(dependency);
      }
    }
    const prepared = resolveCommand(loaded.config, nextId, params);
    logger.info(`Running ${nextId}`);
    const started = Date.now();
    const commandLine = prepared.command + prepared.args.map(shellQuote).join('');
    const child = spawn(commandLine, {
      cwd: loaded.directory,
      env: { ...process.env, ...prepared.env },
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => logger.log(chunk.trimEnd()));
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => logger.warn(chunk.trimEnd()));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    if (prepared.timeoutMs) timer = setTimeout(() => {
      timedOut = true;
      if (process.platform !== 'win32' && child.pid) {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Process already exited. */ }
      } else {
        child.kill();
      }
    }, prepared.timeoutMs);
    try {
      const result = await new Promise<RunResult>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (exitCode, signal) => resolve({ exitCode, signal, durationMs: Date.now() - started, timedOut }));
      });
      if (result.timedOut) logger.error(`${nextId} timed out after ${result.durationMs} ms`);
      else if (result.exitCode === 0) logger.success(`${nextId} finished in ${result.durationMs} ms`);
      else logger.error(`${nextId} exited with code ${result.exitCode ?? result.signal}`);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return run(id, values);
}

function shellQuote(value: string): string {
  return ` '${value.replaceAll("'", "'\\''")}'`;
}
