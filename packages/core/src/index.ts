import { createConsola, type ConsolaInstance } from 'consola';
import { loadConfig } from './config/load.js';
import {
  assertParameterValue,
  prepareEntry,
  resolveValues,
  type ParameterValue,
  type PreparedCommand,
} from './commands/resolve.js';
import { createCommandSearch, type CommandSearchResult } from './commands/search.js';
import { planExecution, type ExecutionPlan } from './commands/plan.js';
import { Session } from './runtime/session.js';
import type { RunEvent, RunOptions, RunResult, ServiceInfo } from './runtime/process.js';
import {
  SettingsStore,
  StateStore,
  languages,
  themes,
  type LocalState,
  type Settings,
} from './storage.js';
import type { MinkConfiguration } from './types/schema.js';
export interface Mink {
  readonly configFile: string;
  readonly directory: string;
  readonly logger: ConsolaInstance;
  getConfig(): MinkConfiguration;
  searchCommands(query: string, limit?: number): CommandSearchResult[];
  prepare(id: string, values?: Record<string, ParameterValue>): PreparedCommand;
  plan(id: string, values?: Record<string, ParameterValue>): ExecutionPlan;
  run(
    id: string,
    values?: Record<string, ParameterValue>,
    options?: RunOptions,
  ): Promise<RunResult>;
  subscribe(listener: (event: RunEvent) => void): () => void;
  services(): ServiceInfo[];
  stopService(instance: string, force?: boolean): Promise<void>;
  restartService(instance: string): Promise<RunResult>;
  state(): Promise<LocalState>;
  settings(): Promise<Settings>;
  updateSettings(change: Partial<Settings>): Promise<Settings>;
  favorite(id: string): Promise<void>;
  savePreset(id: string, name: string, values: Record<string, ParameterValue>): Promise<void>;
  preset(id: string, name: string): Promise<Record<string, ParameterValue>>;
  dispose(): Promise<void>;
}
export interface MinkOptions {
  configFile?: string;
  cwd?: string;
  logger?: ConsolaInstance;
  discover?: boolean;
  stateDirectory?: string;
}
export async function createMink(options: MinkOptions = {}): Promise<Mink> {
  const logger = options.logger ?? createConsola().withTag('mink');
  const loaded = await loadConfig(options.configFile, options.cwd, options.discover ?? true);
  const session = new Session(),
    store = new StateStore(loaded.file, options.stateDirectory),
    settingsStore = new SettingsStore(options.stateDirectory);
  const getEntry = (id: string) => {
    if (!Object.hasOwn(loaded.config.commands, id)) throw new Error(`Unknown command: ${id}`);
    return loaded.config.commands[id];
  };
  return {
    configFile: loaded.file,
    directory: loaded.directory,
    logger,
    getConfig: () => structuredClone(loaded.config),
    searchCommands: createCommandSearch(loaded.config),
    prepare: (id, values = {}) => {
      const entry = getEntry(id);
      if (entry.kind !== 'command') throw new Error(`${id} is a pipeline; use plan()`);
      return prepareEntry(entry, resolveValues(entry, values, id), loaded.directory);
    },
    plan: (id, values = {}) => planExecution(loaded.config, loaded.directory, id, values),
    async run(id, values = {}, runOptions = {}) {
      if (process.platform === 'win32')
        throw new Error(
          'This alpha supports Linux and macOS; Windows process semantics are not implemented',
        );
      const plan = planExecution(loaded.config, loaded.directory, id, values);
      const result = await session.run(plan, runOptions);
      try {
        await store.update((state) => {
          state.history.unshift({
            id,
            time: new Date().toISOString(),
            state: result.state,
            durationMs: result.durationMs,
          });
          state.history = state.history.slice(0, 100);
        });
      } catch (error) {
        logger.warn('Could not save history', error);
      }
      return result;
    },
    subscribe: (listener) => session.subscribe(listener),
    services: () =>
      session.services().map(({ instance, id, state, started, url, completion }) => ({
        instance,
        id,
        state,
        started,
        url,
        completion,
      })),
    stopService: (id, force) => session.stop(id, force),
    restartService: (id) => session.restart(id),
    dispose: () => session.dispose(),
    state: () => store.read(),
    settings: () => settingsStore.read(),
    async updateSettings(change) {
      if (change.theme !== undefined && !themes.includes(change.theme))
        throw new Error(`Unknown theme: ${change.theme}`);
      if (change.language !== undefined && !languages.includes(change.language))
        throw new Error(`Unknown language: ${change.language}`);
      return settingsStore.update((settings) => {
        if (change.theme !== undefined) settings.theme = change.theme;
        if (change.language !== undefined) settings.language = change.language;
      });
    },
    async favorite(id) {
      getEntry(id);
      await store.update((state) => {
        state.favorites = state.favorites.includes(id)
          ? state.favorites.filter((v) => v !== id)
          : [...state.favorites, id];
      });
    },
    async savePreset(id, name, values) {
      const entry = getEntry(id);
      if (!name.trim()) throw new Error('Preset name is required');
      const snapshot = structuredClone(values);
      for (const [key, value] of Object.entries(snapshot)) {
        if (!Object.hasOwn(entry.params ?? {}, key))
          throw new Error(`${id}: unknown parameter ${key}`);
        const p = entry.params![key];
        if (p.type === 'secret') throw new Error('Secret parameters cannot be saved in presets');
        assertParameterValue(`${id}.${key}`, p, value);
      }
      await store.update((state) => {
        if (
          Object.hasOwn(state.presets[id] ?? {}, name) ||
          Object.hasOwn(entry.presets ?? {}, name)
        )
          throw new Error('Preset exists; choose a new name');
        if (!Object.hasOwn(state.presets, id))
          Object.defineProperty(state.presets, id, {
            value: {},
            enumerable: true,
            writable: true,
            configurable: true,
          });
        Object.defineProperty(state.presets[id], name, {
          value: snapshot,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      });
    },
    async preset(id, name) {
      const entry = getEntry(id),
        state = await store.read();
      const local =
        Object.hasOwn(state.presets, id) && Object.hasOwn(state.presets[id], name)
          ? state.presets[id][name]
          : undefined;
      const repo =
        entry.presets && Object.hasOwn(entry.presets, name) ? entry.presets[name] : undefined;
      const values = local ?? repo;
      if (!values) throw new Error(`Unknown preset ${id}@${name}`);
      for (const key of Object.keys(values)) {
        if (!entry.params?.[key]) throw new Error(`Stale preset: unknown parameter ${key}`);
        if (entry.params[key].type === 'secret')
          throw new Error('Secret values in preset are forbidden');
      }
      return structuredClone(values);
    },
  };
}
export { themes, languages, defaultSettings, detectLanguage } from './storage.js';
export type { Settings, ThemeName, Language } from './storage.js';
export { validateConfig } from './config/load.js';
export { initConfig } from './config/init.js';
export {
  resolveValues,
  parseParameter,
  parameterFields,
  commandLine,
  shellQuote,
} from './commands/resolve.js';
export type { MinkConfiguration, Command, Pipeline, Parameter } from './types/schema.js';
export type {
  ParameterValue,
  PreparedCommand,
  CommandSearchResult,
  ExecutionPlan,
  RunEvent,
  RunOptions,
  RunResult,
  ServiceInfo,
  LocalState,
};
