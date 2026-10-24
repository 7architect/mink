import { appendFileSync, closeSync, openSync } from 'node:fs';
import type { ExecutionPlan } from '../commands/plan.js';
import type { RunEvent } from './process.js';

export function executionSecrets(root: ExecutionPlan): string[] {
  const secrets = new Set<string>();
  const visit = (plan: ExecutionPlan) => {
    for (const param of Object.values(plan.entry?.params ?? {})) {
      const value = param.env && plan.prepared?.env[param.env];
      if (param.type === 'secret' && value) secrets.add(value);
    }
    plan.dependencies.forEach(visit);
    Object.values(plan.steps).forEach((step) => visit(step.plan));
  };
  visit(root);
  return [...secrets].sort((a, b) => b.length - a.length);
}

export function redactSecrets(text: string, root: ExecutionPlan): string {
  const secrets = [
    ...new Set(executionSecrets(root).flatMap((value) => [value, ...value.split(/\r?\n/)])),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return secrets.reduce((output, secret) => output.replaceAll(secret, '[hidden]'), text);
}

/** Keeps only the tail needed to recognize a secret spanning adjacent chunks. */
export class StreamingRedactor {
  private pending = '';
  private readonly length: number;
  constructor(private readonly secrets: string[]) {
    this.length = Math.max(1, ...secrets.map((value) => value.length));
  }
  push(chunk: string, final = false): string {
    this.pending += chunk;
    const boundary = final
      ? this.pending.length
      : Math.max(0, this.pending.length - this.length + 1);
    let output = '',
      cursor = 0;
    while (cursor < boundary) {
      let index = -1,
        match = '';
      for (const secret of this.secrets) {
        if (!secret) continue;
        const found = this.pending.indexOf(secret, cursor);
        if (
          found >= 0 &&
          (index < 0 || found < index || (found === index && secret.length > match.length))
        ) {
          index = found;
          match = secret;
        }
      }
      if (index >= 0 && index < boundary) {
        output += this.pending.slice(cursor, index) + '[hidden]';
        cursor = index + match.length;
      } else {
        output += this.pending.slice(cursor, boundary);
        cursor = boundary;
      }
    }
    this.pending = this.pending.slice(cursor);
    return output;
  }
}

export function createRunLog(
  file: string,
  plan: ExecutionPlan,
): { write(event: RunEvent): void; close(): void } {
  const descriptor = openSync(file, 'wx', 0o600);
  const secrets = executionSecrets(plan);
  const streams = new Map<string, { redactor: StreamingRedactor; event: RunEvent }>();
  let failure: unknown,
    closed = false;
  const append = (event: RunEvent, text: string) => {
    if (!text || failure) return;
    try {
      appendFileSync(
        descriptor,
        JSON.stringify({
          time: new Date(event.time).toISOString(),
          id: event.id,
          instance: event.instance,
          stream: event.type,
          text,
        }) + '\n',
      );
    } catch (error) {
      failure = error;
    }
  };
  return {
    write(event) {
      if (closed || !event.chunk || (event.type !== 'stdout' && event.type !== 'stderr')) return;
      const key = `${event.instance}:${event.type}`;
      if (!streams.has(key)) streams.set(key, { redactor: new StreamingRedactor(secrets), event });
      const stream = streams.get(key)!;
      stream.event = event;
      append(event, stream.redactor.push(event.chunk));
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        for (const stream of streams.values()) append(stream.event, stream.redactor.push('', true));
      } finally {
        closeSync(descriptor);
      }
      if (failure) throw failure;
    },
  };
}
