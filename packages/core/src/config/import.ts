import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'js-yaml';
import type { Command } from '../types/schema.js';
import { exists } from './discover.js';

export const projectFiles = [
  'package.json',
  'GNUmakefile',
  'makefile',
  'Makefile',
  'Taskfile.yml',
  'Taskfile.yaml',
  'compose.yml',
  'compose.yaml',
  'docker-compose.yml',
  'docker-compose.yaml',
];
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const identifier = (name: string) => /^[A-Za-z0-9_][A-Za-z0-9_./:-]*$/.test(name);

/** Static discovery only: never run make, task, Docker or embedded shell expressions. */
export async function importTasks(directory: string): Promise<Record<string, Command>> {
  const entries: Record<string, Command> = Object.create(null);
  const first = async (files: string[]) => {
    for (const file of files) if (await exists(join(directory, file))) return file;
  };
  const make = await first(['GNUmakefile', 'makefile', 'Makefile']);
  if (make) {
    const text = await readFile(join(directory, make), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = /^([^\s#:=]+(?:[ \t]+[^\s#:=]+)*)[ \t]*:(?![=])/.exec(line);
      if (!match) continue;
      for (const name of match[1].split(/\s+/))
        if (identifier(name) && !name.startsWith('.'))
          entries[`make:${name}`] = {
            kind: 'command',
            name: `make ${name}`,
            description: `Target from ${make}`,
            exec: 'make',
            args: ['--file', make, '--', name],
          };
    }
  }
  const taskfile = await first(['Taskfile.yml', 'Taskfile.yaml']);
  if (taskfile) {
    const data: unknown = load(await readFile(join(directory, taskfile), 'utf8'));
    if (!record(data) || !record(data.tasks)) throw new Error(`Invalid tasks in ${taskfile}`);
    for (const [name, task] of Object.entries(data.tasks))
      if (identifier(name) && !(record(task) && task.internal))
        entries[`task:${name}`] = {
          kind: 'command',
          name: `task ${name}`,
          description:
            record(task) && typeof task.desc === 'string' ? task.desc : `Task from ${taskfile}`,
          exec: 'task',
          args: ['--taskfile', taskfile, name],
        };
  }
  const compose = await first([
    'compose.yml',
    'compose.yaml',
    'docker-compose.yml',
    'docker-compose.yaml',
  ]);
  if (compose) {
    const data: unknown = load(await readFile(join(directory, compose), 'utf8'));
    if (!record(data) || !record(data.services)) throw new Error(`Invalid services in ${compose}`);
    for (const action of ['up', 'down', 'build', 'logs', 'ps', 'config'])
      entries[`compose:${action}`] = {
        kind: 'command',
        name: `docker compose ${action}`,
        description: `${compose}${action === 'up' ? ' (detached containers are managed by Docker)' : ''}`,
        exec: 'docker',
        args: ['compose', '--file', compose, action, ...(action === 'up' ? ['--detach'] : [])],
      };
    for (const name of Object.keys(data.services))
      if (identifier(name))
        entries[`compose:up:${name}`] = {
          kind: 'command',
          name: `Start ${name}`,
          description: `Detached Docker service from ${compose}`,
          exec: 'docker',
          args: ['compose', '--file', compose, 'up', '--detach', name],
        };
  }
  return entries;
}
