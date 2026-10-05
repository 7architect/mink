import { createConsola, type ConsolaInstance } from 'consola';
import { loadConfig } from './config/load.js';
import { resolveCommand, type ParameterValue, type PreparedCommand } from './commands/resolve.js';
import { runCommand, type RunResult } from './commands/run.js';
import { createCommandSearch, type CommandSearchResult } from './commands/search.js';
import type { MinkConfiguration } from './types/schema.js';

export interface Mink {
  readonly configFile: string;
  readonly logger: ConsolaInstance;
  getConfig(): MinkConfiguration;
  searchCommands(query: string, limit?: number): CommandSearchResult[];
  prepare(id: string, values?: Record<string, ParameterValue>): PreparedCommand;
  run(id: string, values?: Record<string, ParameterValue>): Promise<RunResult>;
}

export interface MinkOptions {
  configFile?: string;
  logger?: ConsolaInstance;
}

export async function createMink(options: MinkOptions = {}): Promise<Mink> {
  const logger = options.logger ?? createConsola().withTag('mink');
  let loaded;
  try {
    loaded = await loadConfig(options.configFile);
    logger.info(`Loaded ${loaded.file}`);
  } catch (error) {
    logger.error('Failed to load Mink configuration', error);
    throw error;
  }
  const searchCommands = createCommandSearch(loaded.config);
  return {
    configFile: loaded.file,
    logger,
    getConfig: () => structuredClone(loaded.config),
    searchCommands,
    prepare: (id, values = {}) => resolveCommand(loaded.config, id, values),
    async run(id, values = {}) {
      try {
        return await runCommand(loaded, id, logger, values);
      } catch (error) {
        logger.error(`Failed to run ${id}`, error);
        throw error;
      }
    },
  };
}

export type { ParameterValue, PreparedCommand } from './commands/resolve.js';
export type { RunResult } from './commands/run.js';
export type { CommandSearchResult } from './commands/search.js';
export type { MinkConfiguration, Command, Pipeline } from './types/schema.js';
