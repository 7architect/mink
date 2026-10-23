import { readFile, access } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { glob } from 'tinyglobby';
import { load } from 'js-yaml';
import type { Command } from '../types/schema.js';
import { shellQuote } from '../commands/resolve.js';
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw e;
  }
}
export async function findUp(name: string, cwd: string): Promise<string | undefined> {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const file = join(dir, name);
    if (await exists(file)) return file;
    if (dirname(dir) === dir) return;
  }
}
export async function discover(directory: string): Promise<Record<string, Command>> {
  const commands: Record<string, Command> = Object.create(null);
  const manifestFile = join(directory, 'package.json');
  if (await exists(manifestFile)) {
    const root = await manifest(manifestFile),
      manager = await packageManager(directory, root.packageManager);
    await addPackage(directory, '', root, manager);
    let patterns: string[] = [];
    if (Array.isArray(root.workspaces))
      patterns = root.workspaces.filter((p: unknown) => typeof p === 'string');
    else if (root.workspaces?.packages) patterns = root.workspaces.packages;
    const pnpmFile = join(directory, 'pnpm-workspace.yaml');
    if (await exists(pnpmFile)) {
      const yaml = load(await readFile(pnpmFile, 'utf8')) as { packages?: unknown };
      if (Array.isArray(yaml?.packages))
        patterns = yaml.packages.filter((p) => typeof p === 'string');
    }
    if (patterns.length) {
      if (patterns.some((p) => p.includes('..') || p.startsWith('/')))
        throw new Error('Workspace patterns must stay within the project');
      const dirs = await glob(patterns, {
        cwd: directory,
        onlyDirectories: true,
        followSymbolicLinks: false,
        ignore: ['**/node_modules/**', '**/.git/**'],
        expandDirectories: false,
      });
      for (const dir of dirs.sort()) {
        const file = join(directory, dir, 'package.json');
        if (await exists(file))
          await addPackage(
            join(directory, dir),
            relative(directory, join(directory, dir)).split(sep).join('/'),
            await manifest(file),
            manager,
          );
      }
    }
  }
  const shells = await glob('scripts/*.sh', { cwd: directory, followSymbolicLinks: false });
  for (const file of shells.sort()) {
    const id = file.split(sep).join('/');
    if (Object.hasOwn(commands, id)) throw new Error(`Discovery ID collision: ${id}`);
    commands[id] = {
      kind: 'command',
      name: file,
      command: `sh ${shellQuote(file)}`,
      source: { shell_script: file },
    };
  }
  return commands;
  async function addPackage(
    dir: string,
    prefix: string,
    pkg: Manifest,
    manager: string,
  ): Promise<void> {
    if (pkg.scripts === undefined) return;
    if (!pkg.scripts || typeof pkg.scripts !== 'object' || Array.isArray(pkg.scripts))
      throw new Error(`Invalid scripts in ${join(dir, 'package.json')}`);
    for (const [name, script] of Object.entries(pkg.scripts)) {
      if (typeof script !== 'string') throw new Error(`Script ${name} must be a string`);
      const id = prefix ? `${prefix}:${name}` : name;
      if (Object.hasOwn(commands, id)) throw new Error(`Discovery ID collision: ${id}`);
      commands[id] = {
        kind: 'command',
        name: id,
        description: script,
        command: `${manager} run ${shellQuote(name)}${manager === 'npm' ? ' --' : ''}`,
        cwd: relative(directory, dir) || '.',
        source: {
          package_script: { manifest: relative(directory, join(dir, 'package.json')), name },
        },
      };
    }
  }
}
interface Manifest {
  scripts?: Record<string, unknown>;
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
}
async function manifest(file: string): Promise<Manifest> {
  const p: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error(`Invalid manifest: ${file}`);
  return p;
}
async function packageManager(dir: string, declared?: string): Promise<string> {
  if (declared) {
    const name = declared.split('@')[0];
    if (!['npm', 'pnpm', 'yarn'].includes(name))
      throw new Error(`Unsupported packageManager: ${declared}`);
    return name;
  }
  const detected: string[] = [];
  for (const [file, name] of [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ])
    if (await exists(join(dir, file))) detected.push(name);
  if (detected.length > 1)
    throw new Error('Conflicting lockfiles; set packageManager in package.json');
  return detected[0] ?? 'npm';
}
