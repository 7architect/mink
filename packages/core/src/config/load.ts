import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Ajv } from 'ajv';
import { load } from 'js-yaml';
import schema from '../../schema/mink.schema.json' with { type: 'json' };
import type { MinkConfiguration } from '../types/schema.js';
import { validateReferences } from './validate.js';
import { discover, findUp } from './discover.js';
const validateShape = new Ajv({
  allErrors: true,
  allowUnionTypes: true,
}).compile<MinkConfiguration>(schema);
export interface LoadedConfig {
  file: string;
  directory: string;
  config: MinkConfiguration;
  discovered: boolean;
}
export function validateConfig(value: unknown): asserts value is MinkConfiguration {
  if (!validateShape(value))
    throw new Error(
      `Invalid Mink configuration: ${validateShape.errors?.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ')}`,
    );
  validateReferences(value);
}
export async function loadConfig(
  file?: string,
  cwd = process.cwd(),
  discovery = true,
): Promise<LoadedConfig> {
  const found = file ? resolve(cwd, file) : await findUp('mink.yml', cwd);
  const packageFile = !found && discovery ? await findUp('package.json', cwd) : undefined;
  const directory = found ? dirname(found) : packageFile ? dirname(packageFile) : resolve(cwd);
  let config: MinkConfiguration = { version: 1, commands: {} };
  if (found) {
    const parsed: unknown = load(await readFile(found, 'utf8'));
    validateConfig(parsed);
    config = parsed;
  }
  if (discovery) config.commands = { ...(await discover(directory)), ...config.commands };
  if (!found && !Object.keys(config.commands).length)
    throw new Error(`No mink.yml or discoverable commands in ${directory}; run mink init`);
  validateConfig(config);
  return { file: found ?? join(directory, 'mink.yml'), directory, config, discovered: !found };
}
