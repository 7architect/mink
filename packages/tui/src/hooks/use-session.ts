import { useEffect, useRef, useState } from 'react';
import type {
  ExecutionPlan,
  Mink,
  ParameterValue,
  RunEvent,
  RunResult,
  ServiceInfo,
} from '@yaroslavlky/mink-core';
import { LogBuffer } from '../model/log-buffer.js';
import { resultStates } from '../model/commands.js';
import { t } from '../i18n.js';
interface Invocation {
  id: string;
  plan: ExecutionPlan;
  values: Record<string, ParameterValue>;
  busy: boolean;
  result?: RunResult;
}
export interface SessionView {
  invocation?: Invocation;
  services: ServiceInfo[];
  logs: LogBuffer;
  runId?: string;
  states: Record<string, string>;
  start: (
    id: string,
    values: Record<string, ParameterValue>,
    retryFailed?: RunResult,
  ) => Promise<void>;
  cancel: () => void;
  stop: (instance: string, force?: boolean) => Promise<void>;
  restart: (instance: string) => Promise<RunResult>;
}
export function useSession(mink: Mink): SessionView {
  const [invocation, setInvocation] = useState<Invocation>();
  const [, refresh] = useState(0);
  const buffer = useRef(new LogBuffer()),
    controller = useRef<AbortController | undefined>(undefined);
  const busy = useRef(false),
    generation = useRef(0),
    runId = useRef<string | undefined>(undefined);
  const states = useRef<Record<string, string>>({});
  useEffect(() => {
    let dirty = false,
      second = Math.floor(Date.now() / 1000);
    const unsubscribe = mink.subscribe((event) => {
      buffer.current.append(event);
      dirty = true;
    });
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      if (
        dirty ||
        (now !== second &&
          mink
            .services()
            .some((service) =>
              ['starting', 'ready', 'unhealthy', 'stopping'].includes(service.state),
            ))
      ) {
        dirty = false;
        second = now;
        refresh((value) => value + 1);
      }
    }, 100);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [mink]);
  async function start(
    id: string,
    values: Record<string, ParameterValue>,
    retryFailed?: RunResult,
  ) {
    if (busy.current) throw new Error(t('notice.cancelBeforeStart'));
    const plan = mink.plan(id, values),
      current = ++generation.current;
    busy.current = true;
    runId.current = undefined;
    states.current = retryFailed ? resultStates(retryFailed, plan.key) : {};
    controller.current = new AbortController();
    setInvocation({ id, plan, values, busy: true });
    const observe = (event: RunEvent) => {
      if (generation.current !== current) return;
      runId.current = event.runId;
      const key = event.instance.slice(event.instance.indexOf(':') + 1);
      if (event.type === 'start') states.current[key] = 'running';
      if (event.type === 'ready') states.current[key] = 'ready';
      if (event.type === 'health') states.current[key] = event.healthy ? 'ready' : 'unhealthy';
      if (event.type === 'restart') states.current[key] = 'starting';
      if (event.type === 'finish') states.current[key] = event.result!.state;
    };
    try {
      const result = await mink.run(id, values, {
        signal: controller.current.signal,
        retryFailed,
        onEvent: observe,
      });
      states.current = { ...resultStates(result, plan.key), ...states.current };
      setInvocation({ id, plan, values, busy: false, result });
    } finally {
      busy.current = false;
      setInvocation((value) => (value ? { ...value, busy: false } : value));
    }
  }
  return {
    invocation,
    services: mink.services(),
    logs: buffer.current,
    runId: runId.current,
    states: states.current,
    start,
    cancel: () => controller.current?.abort(),
    stop: (instance: string, force = false) => mink.stopService(instance, force),
    restart: (instance: string) => mink.restartService(instance),
  };
}
