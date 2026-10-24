import type { RunEvent } from '@yaroslavlky/mink-core';
import { safeText } from '../actions.js';
interface Chunk {
  sequence: number;
  runId: string;
  instance: string;
  id: string;
  stream: 'stdout' | 'stderr';
  text: string;
  bytes: number;
}
export interface LogLine {
  key: string;
  id: string;
  stream: 'stdout' | 'stderr';
  text: string;
}
export type LogFilter = { runId: string } | { instance: string };
export function filterLogLines(
  lines: LogLine[],
  query: string,
  stream = 'all',
  owner?: string,
): LogLine[] {
  const needle = query.toLocaleLowerCase();
  return lines.filter(
    (line) =>
      (stream === 'all' || line.stream === stream) &&
      (!owner || line.id === owner) &&
      (!needle || line.text.toLocaleLowerCase().includes(needle)),
  );
}
const MAX_BYTES = 262144,
  MAX_CHUNKS = 1000;
export class LogBuffer {
  private chunks: Chunk[] = [];
  private sequence = 0;
  private bytes = 0;
  truncated = false;
  get byteLength(): number {
    return this.bytes;
  }
  append(event: RunEvent): void {
    if ((event.type !== 'stdout' && event.type !== 'stderr') || !event.chunk) return;
    let text = safeText(event.chunk),
      bytes = Buffer.byteLength(text);
    if (bytes > MAX_BYTES) {
      let tail = Buffer.from(text).subarray(-MAX_BYTES);
      while (tail.length && (tail[0] & 0xc0) === 0x80) tail = tail.subarray(1);
      text = tail.toString('utf8');
      bytes = Buffer.byteLength(text);
      this.truncated = true;
    }
    this.chunks.push({
      sequence: this.sequence++,
      runId: event.runId,
      instance: event.instance,
      id: event.id,
      stream: event.type,
      text,
      bytes,
    });
    this.bytes += bytes;
    while (this.bytes > MAX_BYTES || this.chunks.length > MAX_CHUNKS) {
      this.bytes -= this.chunks.shift()!.bytes;
      this.truncated = true;
    }
  }
  lines(filter?: LogFilter): LogLine[] {
    if (!filter) return [];
    const lines: LogLine[] = [],
      pending = new Map<string, LogLine>();
    for (const chunk of this.chunks) {
      if ('runId' in filter ? chunk.runId !== filter.runId : chunk.instance !== filter.instance)
        continue;
      const owner = `${chunk.instance}:${chunk.stream}`,
        parts = chunk.text.split('\n');
      parts.forEach((part, index) => {
        if (!part && index === parts.length - 1) return;
        let line = pending.get(owner);
        if (!line) {
          line = {
            key: `${chunk.sequence}:${index}`,
            id: chunk.id,
            stream: chunk.stream,
            text: '',
          };
          lines.push(line);
          pending.set(owner, line);
        }
        line.text += part;
        if (index < parts.length - 1) pending.delete(owner);
      });
      if (chunk.text.endsWith('\n')) pending.delete(owner);
    }
    return lines;
  }
}
