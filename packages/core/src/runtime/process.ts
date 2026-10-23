import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import type { ExecutionPlan } from '../commands/plan.js';
import { commandLine } from '../commands/resolve.js';

export type RunState = 'succeeded' | 'failed' | 'cancelled' | 'skipped' | 'ready';
export interface RunResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  timedOut: boolean;
  state: RunState;
  error?: string;
  steps?: Record<string, RunResult>;
}
export interface RunEvent {
  type: 'start' | 'stdout' | 'stderr' | 'ready' | 'finish';
  runId: string;
  instance: string;
  id: string;
  time: number;
  chunk?: string;
  result?: RunResult;
}
export interface RunOptions {
  signal?: AbortSignal;
  onEvent?: (event: RunEvent) => void;
  stdin?: 'inherit' | 'ignore';
}
export interface ProcessHandle {
  instance: string;
  id: string;
  state: 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed';
  started: number;
  url?: string;
  ready: Promise<RunResult>;
  completion: Promise<RunResult>;
  stop: (force?: boolean) => void;
  plan: ExecutionPlan;
  options: RunOptions;
}

export type ServiceInfo = Readonly<
  Pick<ProcessHandle, 'instance' | 'id' | 'state' | 'started' | 'url' | 'completion'>
>;

export function startProcess(
  plan: ExecutionPlan,
  runId: string,
  instance: string,
  options: RunOptions,
  notify: (event: RunEvent) => void,
): ProcessHandle {
  const started = Date.now(),
    entry = plan.entry!,
    prepared = plan.prepared!,
    service = entry.run?.mode === 'service';
  const probeAbort = new AbortController();
  let timedOut = false,
    cancelled = false,
    finished = false,
    isReady = false;
  let timer: ReturnType<typeof setTimeout> | undefined,
    escalation: ReturnType<typeof setTimeout> | undefined;
  let complete!: (result: RunResult) => void, ready!: (result: RunResult) => void;
  const completion = new Promise<RunResult>((r) => {
      complete = r;
    }),
    readiness = new Promise<RunResult>((r) => {
      ready = r;
    });
  const child = spawn(commandLine(prepared), {
    cwd: prepared.cwd,
    env: { ...process.env, ...prepared.env },
    shell: true,
    detached: true,
    stdio: [options.stdin ?? 'ignore', 'pipe', 'pipe'],
  });
  const emit = (type: RunEvent['type'], extra: Partial<RunEvent> = {}) =>
    notify({ type, runId, instance, id: plan.id, time: Date.now(), ...extra });
  const handle: ProcessHandle = {
    instance,
    id: plan.id,
    state: 'starting',
    started,
    url: entry.run?.ready?.url,
    ready: service ? readiness : completion,
    completion,
    stop,
    plan,
    options,
  };
  function kill(signal: NodeJS.Signals): void {
    if (child.pid) {
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(signal);
      }
    }
  }
  function stop(force = false): void {
    if (finished) return;
    cancelled = !timedOut;
    handle.state = 'stopping';
    kill(force ? 'SIGKILL' : 'SIGTERM');
    if (!force && !escalation) escalation = setTimeout(() => kill('SIGKILL'), 800);
  }
  const abort = () => stop();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) stop();
  child.stdout?.setEncoding('utf8').on('data', (chunk: string) => emit('stdout', { chunk }));
  child.stderr?.setEncoding('utf8').on('data', (chunk: string) => emit('stderr', { chunk }));
  function finish(exitCode: number | null, signal: NodeJS.Signals | null, error?: string): void {
    if (finished) return;
    finished = true;
    probeAbort.abort();
    if (timer) clearTimeout(timer);
    if (escalation) clearTimeout(escalation);
    options.signal?.removeEventListener('abort', abort);
    // Every descendant belongs to this invocation, including backgrounded children.
    kill('SIGKILL');
    const state: RunState = cancelled
      ? 'cancelled'
      : !timedOut && !error && exitCode === 0 && (!service || isReady)
        ? 'succeeded'
        : 'failed';
    const result: RunResult = {
      exitCode,
      signal,
      durationMs: Date.now() - started,
      timedOut,
      state,
      ...(error ? { error } : {}),
    };
    handle.state = state === 'failed' ? 'failed' : 'stopped';
    ready(result);
    complete(result);
    emit('finish', { result });
  }
  child.once('error', (error) => finish(null, null, error.message));
  child.once('exit', () => kill('SIGKILL'));
  child.once('close', (code, signal) => finish(code, signal));
  child.once('spawn', () => {
    emit('start');
    if (options.signal?.aborted) {
      stop();
      return;
    }
    const timeout = service ? (entry.run?.startup_timeout_ms ?? 30000) : prepared.timeoutMs;
    if (timeout)
      timer = setTimeout(() => {
        timedOut = true;
        stop();
      }, timeout);
    if (service) void waitUntilReady();
  });
  async function waitUntilReady(): Promise<void> {
    const check = entry.run?.ready;
    try {
      while (!finished && !probeAbort.signal.aborted) {
        let ok = !check || check.type === 'process';
        if (check?.type === 'tcp')
          ok = await tcpReady(check.host ?? '127.0.0.1', check.port!, probeAbort.signal);
        if (check?.type === 'http') {
          try {
            const response = await fetch(check.url!, {
              signal: AbortSignal.any([probeAbort.signal, AbortSignal.timeout(500)]),
              redirect: 'error',
            });
            ok = response.ok;
            await response.body?.cancel();
          } catch {
            ok = false;
          }
        }
        if (finished || handle.state === 'stopping') return;
        if (ok) {
          isReady = true;
          handle.state = 'ready';
          if (timer) clearTimeout(timer);
          const result: RunResult = {
            exitCode: 0,
            signal: null,
            durationMs: Date.now() - started,
            timedOut: false,
            state: 'ready',
          };
          ready(result);
          emit('ready', { result });
          return;
        }
        await delay(check?.interval_ms ?? 100, undefined, { signal: probeAbort.signal });
      }
    } catch (error) {
      if (!probeAbort.signal.aborted) {
        emit('stderr', { chunk: `Readiness failed: ${String(error)}\n` });
        stop();
      }
    }
  }
  return handle;
}
async function tcpReady(host: string, port: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      socket.destroy();
      resolve(ok);
    };
    const abort = () => finish(false);
    signal.addEventListener('abort', abort, { once: true });
    socket.setTimeout(500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    if (signal.aborted) finish(false);
  });
}
