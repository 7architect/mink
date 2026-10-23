import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import lockfile from 'proper-lockfile';
import type { ParameterValue } from './commands/resolve.js';
export interface HistoryEntry {
  id: string;
  time: string;
  state: string;
  durationMs: number;
}
export interface LocalState {
  history: HistoryEntry[];
  favorites: string[];
  presets: Record<string, Record<string, Record<string, ParameterValue>>>;
}
const fresh = (): LocalState => ({ history: [], favorites: [], presets: {} });
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function presets(value: unknown): LocalState['presets'] {
  if (!record(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entries]) => record(entries))
      .map(([id, entries]) => [
        id,
        Object.fromEntries(
          Object.entries(entries as Record<string, unknown>).filter(
            ([, values]) =>
              record(values) &&
              Object.values(values).every(
                (value) =>
                  typeof value === 'string' ||
                  typeof value === 'boolean' ||
                  (typeof value === 'number' && Number.isFinite(value)),
              ),
          ),
        ),
      ]),
  ) as LocalState['presets'];
}
export class StateStore {
  readonly file: string;
  constructor(project: string, directory?: string) {
    const root =
      directory ??
      (process.env.XDG_STATE_HOME
        ? join(process.env.XDG_STATE_HOME, 'mink')
        : process.platform === 'darwin'
          ? join(homedir(), 'Library', 'Application Support', 'mink')
          : join(homedir(), '.local', 'state', 'mink'));
    this.file = join(root, createHash('sha256').update(resolve(project)).digest('hex') + '.json');
  }
  async read(): Promise<LocalState> {
    try {
      const data: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (!data || typeof data !== 'object') return fresh();
      const d = data as LocalState;
      return {
        history: Array.isArray(d.history)
          ? d.history
              .filter(
                (h) =>
                  h &&
                  typeof h.id === 'string' &&
                  typeof h.time === 'string' &&
                  typeof h.state === 'string' &&
                  typeof h.durationMs === 'number',
              )
              .slice(0, 100)
          : [],
        favorites: Array.isArray(d.favorites)
          ? d.favorites.filter((v) => typeof v === 'string')
          : [],
        presets: presets(d.presets),
      };
    } catch (error) {
      if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT')
        return fresh();
      throw error;
    }
  }
  async update(change: (state: LocalState) => void): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    const release = await lockfile.lock(this.file, {
      realpath: false,
      retries: { retries: 30, minTimeout: 20, maxTimeout: 100 },
      stale: 10000,
    });
    const temporary = this.file + '.' + randomUUID() + '.tmp';
    try {
      const state = await this.read();
      change(state);
      await writeFile(temporary, JSON.stringify(state) + '\n', { mode: 0o600 });
      await rename(temporary, this.file);
    } finally {
      await unlink(temporary).catch(() => {});
      await release();
    }
  }
}
