import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Ajv } from 'ajv';
import { load } from 'js-yaml';
import schema from '../../schema/mink.schema.json' with { type: 'json' };
import type { MinkConfiguration } from '../types/schema.js';
import { validateReferences } from './validate.js';

const ajv = new Ajv({ allErrors: true });
const validateShape = ajv.compile<MinkConfiguration>(schema);

export interface LoadedConfig {
  file: string;
  directory: string;
  config: MinkConfiguration;
}

export async function loadConfig(file?: string): Promise<LoadedConfig> {
  const { absoluteFile, contents } = file === undefined
    ? await findConfigFile()
    : await readExplicitConfig(file);
  const parsed: unknown = load(contents);
  if (!validateShape(parsed)) {
    throw new Error(`Invalid ${absoluteFile}: ${ajv.errorsText(validateShape.errors)}`);
  }
  validateReferences(parsed);
  return { file: absoluteFile, directory: dirname(absoluteFile), config: parsed };
}

async function readExplicitConfig(file: string): Promise<{ absoluteFile: string; contents: string }> {
  const absoluteFile = resolve(file);
  return { absoluteFile, contents: await readFile(absoluteFile, 'utf8') };
}

async function findConfigFile(): Promise<{ absoluteFile: string; contents: string }> {
  let directory = process.cwd();
  while (true) {
    const absoluteFile = join(directory, 'mink.yml');
    try {
      return { absoluteFile, contents: await readFile(absoluteFile, 'utf8') };
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not find mink.yml in ${process.cwd()} or any parent directory`);
    }
    directory = parent;
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
