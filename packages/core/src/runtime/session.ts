import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { ExecutionPlan } from '../commands/plan.js';
import {
  startProcess,
  type ProcessHandle,
  type RunEvent,
  type RunOptions,
  type RunResult,
} from './process.js';

const outcome = (state: 'skipped' | 'cancelled'): RunResult => ({
  exitCode: null,
  signal: null,
  durationMs: 0,
  timedOut: false,
  state,
});
const successful = (r: RunResult) => r.state === 'succeeded' || r.state === 'ready';
export class Session {
  private processes = new Map<string, ProcessHandle>();
  private listeners = new Set<(event: RunEvent) => void>();
  private controllers = new Set<AbortController>();
  private reservedServices = new Set<string>();
  private disposed = false;
  subscribe(listener: (event: RunEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  services(): ProcessHandle[] {
    return [...this.processes.values()].filter((p) => p.plan.entry?.run?.mode === 'service');
  }
  private emit = (event: RunEvent): void => {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* Observers cannot corrupt process ownership. */
      }
    }
  };
  async run(root: ExecutionPlan, options: RunOptions = {}): Promise<RunResult> {
    if (this.disposed) throw new Error('Mink session is disposed');
    const serviceIds = new Set(
      this.services()
        .filter((p) => ['ready', 'unhealthy', 'starting', 'stopping'].includes(p.state))
        .map((p) => p.id),
    );
    for (const id of this.reservedServices) serviceIds.add(id);
    const reservations: string[] = [];
    const inspect = (plan: ExecutionPlan): void => {
      if (plan.entry?.run?.mode === 'service') {
        if (serviceIds.has(plan.id))
          throw new Error(`Service ${plan.id} is already scheduled or running; use restart`);
        serviceIds.add(plan.id);
        reservations.push(plan.id);
      }
      for (const p of plan.dependencies) inspect(p);
      for (const s of Object.values(plan.steps)) inspect(s.plan);
    };
    inspect(root);
    for (const id of reservations) this.reservedServices.add(id);
    const started = Date.now(),
      runId = randomUUID(),
      controller = new AbortController();
    this.controllers.add(controller);
    const signal = options.signal
      ? AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    const pool = new Slots(root.maxParallel),
      dependencyRuns = new Map<string, Promise<RunResult>>();
    const dependencyController = new AbortController();
    let dependencySignal = AbortSignal.any([signal, dependencyController.signal]);
    const notify = (event: RunEvent) => {
      this.emit(event);
      try {
        options.onEvent?.(event);
      } catch {
        /* Isolate observer errors. */
      }
    };
    const execute = async (plan: ExecutionPlan, scope = signal): Promise<RunResult> => {
      if (scope.aborted) return outcome('cancelled');
      if (!plan.entry) {
        const branch = new AbortController();
        const branchSignal = AbortSignal.any([scope, branch.signal]);
        if (plan === root)
          dependencySignal = AbortSignal.any([branchSignal, dependencyController.signal]);
        let failed = false,
          timedOut = false;
        const deadline = plan.timeoutMs
          ? setTimeout(() => {
              timedOut = true;
              branch.abort();
            }, plan.timeoutMs)
          : undefined;
        const runs = new Map<string, Promise<RunResult>>();
        const step = (id: string): Promise<RunResult> => {
          if (!runs.has(id))
            runs.set(
              id,
              (async () => {
                const needs = await Promise.all(plan.steps[id].needs.map(step));
                if (branchSignal.aborted) return outcome('cancelled');
                if (needs.some((r) => !successful(r))) return outcome('skipped');
                const result = await execute(plan.steps[id].plan, branchSignal);
                if (result.state === 'failed' && plan.failFast) {
                  failed = true;
                  branch.abort();
                }
                return result;
              })(),
            );
          return runs.get(id)!;
        };
        const begin = Date.now(),
          names = Object.keys(plan.steps),
          results = await Promise.all(names.map(step)).finally(() => {
            if (deadline) clearTimeout(deadline);
          });
        const success = results.every(successful);
        return {
          exitCode: success ? 0 : 1,
          signal: null,
          durationMs: Date.now() - begin,
          timedOut: timedOut || results.some((r) => r.timedOut),
          state: scope.aborted
            ? 'cancelled'
            : !failed && !timedOut && success
              ? 'succeeded'
              : 'failed',
          steps: Object.fromEntries(names.map((name, i) => [name, results[i]])),
        };
      }
      for (const dep of plan.dependencies) {
        if (!dependencyRuns.has(dep.key))
          dependencyRuns.set(dep.key, execute(dep, dependencySignal));
        const result = await untilCancelled(dependencyRuns.get(dep.key)!, scope);
        if (!successful(result))
          return { ...result, state: scope.aborted ? 'cancelled' : 'failed' };
      }
      const retry = plan.entry.run?.retry;
      const begin = Date.now();
      for (let attempt = 1; attempt <= (retry?.attempts ?? 1); attempt++) {
        if (!(await pool.acquire(scope))) return outcome('cancelled');
        let result: RunResult;
        try {
          if (scope.aborted) return outcome('cancelled');
          const instance = `${runId}:${plan.key}`;
          const handle = startProcess(
            plan,
            runId,
            instance,
            { ...options, signal: scope },
            notify,
            async (restartSignal) => {
              if (!(await pool.acquire(restartSignal)))
                throw new Error('Service restart cancelled');
              return () => pool.release();
            },
          );
          if (plan.entry.run?.mode === 'service') {
            for (const [key, old] of this.processes) {
              if (old.id === plan.id && ['stopped', 'failed'].includes(old.state))
                this.processes.delete(key);
            }
          }
          this.processes.set(instance, handle);
          void handle.completion.then(() => {
            if (plan.entry?.run?.mode !== 'service') this.processes.delete(instance);
          });
          result = await handle.ready;
        } finally {
          pool.release();
        }
        if (result.state !== 'failed' || attempt === (retry?.attempts ?? 1))
          return {
            ...result,
            durationMs: Date.now() - begin,
            ...(retry ? { attempts: attempt } : {}),
          };
        try {
          await delay(
            Math.min(60000, (retry?.delay_ms ?? 100) * (retry?.backoff ?? 2) ** (attempt - 1)),
            undefined,
            { signal: scope },
          );
        } catch {
          return outcome('cancelled');
        }
      }
      return outcome('cancelled');
    };
    try {
      const result = await execute(root);
      // A nested deadline can stop waiting on a shared prerequisite. Keep it
      // available to other branches, then clean up any unused work before return.
      dependencyController.abort();
      await Promise.all(dependencyRuns.values());
      return { ...result, durationMs: Date.now() - started };
    } finally {
      dependencyController.abort();
      // Services retain their controller until session disposal.
      for (const id of reservations) this.reservedServices.delete(id);
      const live = this.services().filter(
        (p) =>
          p.instance.startsWith(runId) &&
          ['ready', 'unhealthy', 'starting', 'stopping'].includes(p.state),
      );
      if (!live.length) this.controllers.delete(controller);
      else
        void Promise.all(live.map((p) => p.completion)).then(() =>
          this.controllers.delete(controller),
        );
    }
  }
  async stop(instance: string, force = false): Promise<void> {
    const process = this.processes.get(instance);
    if (!process) throw new Error(`Unknown owned process: ${instance}`);
    process.stop(force);
    await process.completion;
  }
  async restart(instance: string): Promise<RunResult> {
    const old = this.processes.get(instance);
    if (!old || old.plan.entry?.run?.mode !== 'service') throw new Error('Unknown service');
    await this.stop(instance);
    this.processes.delete(instance);
    return this.run({ ...old.plan, dependencies: [] }, { stdin: old.options.stdin });
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    for (const controller of this.controllers) controller.abort();
    const handles = [...this.processes.values()];
    for (const handle of handles) handle.stop();
    await Promise.all(handles.map((h) => h.completion));
    this.controllers.clear();
    this.listeners.clear();
  }
}
function untilCancelled(result: Promise<RunResult>, signal: AbortSignal): Promise<RunResult> {
  if (signal.aborted) return Promise.resolve(outcome('cancelled'));
  return new Promise((resolve, reject) => {
    const abort = () => resolve(outcome('cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    void result.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
    if (signal.aborted) abort();
  });
}
class Slots {
  private active = 0;
  private waiters = new Set<() => void>();
  constructor(private readonly limit: number) {}
  async acquire(signal: AbortSignal): Promise<boolean> {
    while (this.active >= this.limit && !signal.aborted)
      await new Promise<void>((resolve) => {
        const wake = () => {
          this.waiters.delete(wake);
          signal.removeEventListener('abort', wake);
          resolve();
        };
        this.waiters.add(wake);
        signal.addEventListener('abort', wake, { once: true });
        if (signal.aborted) wake();
      });
    if (signal.aborted) return false;
    this.active++;
    return true;
  }
  release(): void {
    this.active--;
    this.waiters.values().next().value?.();
  }
}
