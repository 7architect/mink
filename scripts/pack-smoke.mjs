import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import { delimiter, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { packPackages, root } from './release.mjs';
import { run, spawn } from './process.mjs';

const temporary = await mkdtemp(join(tmpdir(), 'mink-pack-'));
let registryProcess;
let registryExit;
let registryLog = '';
try {
  const artifacts = await packPackages(join(temporary, 'tarballs'));
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const registry = `http://127.0.0.1:${port}`;
  const config = join(temporary, 'registry.yaml');
  await writeFile(
    config,
    JSON.stringify({
      storage: join(temporary, 'storage'),
      auth: { htpasswd: { file: join(temporary, 'htpasswd') } },
      uplinks: { npmjs: { url: 'https://registry.npmjs.org/' } },
      packages: {
        '@yaroslavlky/*': { access: '$all', publish: '$authenticated' },
        '**': { access: '$all', proxy: 'npmjs' },
      },
      log: { type: 'stdout', format: 'json', level: 'warn' },
    }),
  );
  const verdaccio = JSON.parse(
    await readFile(join(root, 'node_modules/verdaccio/package.json'), 'utf8'),
  );
  const bin = typeof verdaccio.bin === 'string' ? verdaccio.bin : verdaccio.bin.verdaccio;
  const env = {
    ...process.env,
    NO_PROXY: `${process.env.NO_PROXY ?? ''},127.0.0.1,localhost`,
    no_proxy: `${process.env.no_proxy ?? ''},127.0.0.1,localhost`,
    NPM_CONFIG_USERCONFIG: join(temporary, '.npmrc'),
    XDG_STATE_HOME: join(temporary, 'state'),
  };
  registryProcess = spawn(
    process.execPath,
    [
      resolve(root, 'node_modules/verdaccio', bin),
      '--config',
      config,
      '--listen',
      `127.0.0.1:${port}`,
    ],
    { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
  );
  registryExit = new Promise((resolve) => registryProcess.once('close', resolve));
  registryProcess.stdout.on('data', (chunk) => {
    registryLog = (registryLog + chunk).slice(-12000);
  });
  registryProcess.stderr.on('data', (chunk) => {
    registryLog = (registryLog + chunk).slice(-12000);
  });
  registryProcess.once('error', (error) => {
    registryLog += error.message;
  });
  let available = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${registry}/-/ping`)).ok) {
        available = true;
        break;
      }
    } catch {
      /* Starting. */
    }
    if (registryProcess.exitCode !== null) break;
    await delay(100);
  }
  assert.ok(available, `Local registry did not start: ${registryLog}`);
  const account = await fetch(`${registry}/-/user/org.couchdb.user:smoke`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'smoke',
      password: 'temporary-local-smoke-only',
      email: 'smoke@example.invalid',
      type: 'user',
    }),
  });
  assert.ok(account.ok, `Cannot configure local registry (${account.status})`);
  const { token } = await account.json();
  await writeFile(
    env.NPM_CONFIG_USERCONFIG,
    `registry=${registry}\n//127.0.0.1:${port}/:_authToken=${token}\n`,
    { mode: 0o600 },
  );
  for (const artifact of artifacts)
    run(
      'npm',
      [
        'publish',
        artifact.file,
        '--access=public',
        `--registry=${registry}`,
        '--ignore-scripts',
        '--provenance=false',
      ],
      { cwd: temporary, env },
    );
  const cli = artifacts.at(-1);
  const project = join(temporary, 'project with spaces Юникод');
  await mkdir(project);
  await writeFile(
    join(project, 'hello.mjs'),
    'process.stdout.write("packed-mink:" + process.env.PERSON)',
  );
  await writeFile(
    join(project, 'mink.yml'),
    JSON.stringify({
      version: 1,
      commands: {
        hello: {
          kind: 'command',
          name: 'Hello',
          exec: process.execPath,
          args: ['hello.mjs'],
          params: { person: { type: 'string', env: 'PERSON', default: 'team' } },
        },
      },
    }),
  );
  for (const manager of ['npm', 'pnpm']) {
    const prefix = join(temporary, manager);
    const globalBin = join(prefix, 'bin');
    await mkdir(globalBin, { recursive: true });
    const installEnv = { ...env, PNPM_HOME: globalBin };
    for (const key of Object.keys(installEnv))
      if (key.toLowerCase() === 'path') delete installEnv[key];
    installEnv.PATH = `${globalBin}${delimiter}${process.env.PATH}`;
    if (manager === 'npm')
      run(
        'npm',
        [
          'install',
          '--global',
          '--prefix',
          prefix,
          '--ignore-scripts',
          '--no-audit',
          '--no-fund',
          `${cli.name}@${cli.version}`,
        ],
        { cwd: temporary, env: installEnv },
      );
    else
      run(
        'pnpm',
        [
          'add',
          '--global',
          '--global-dir',
          join(prefix, 'global'),
          '--global-bin-dir',
          globalBin,
          '--store-dir',
          join(prefix, 'store'),
          '--ignore-scripts',
          `${cli.name}@${cli.version}`,
        ],
        { cwd: temporary, env: installEnv },
      );
    const binDirectory = manager === 'npm' && process.platform === 'win32' ? prefix : globalBin;
    const executable = join(binDirectory, process.platform === 'win32' ? 'mink.cmd' : 'mink');
    const invoke = (args) => run(executable, args, { cwd: project, env: installEnv });
    assert.match(invoke(['--help']), /repository control center/);
    assert.match(invoke(['--version']), new RegExp(cli.version.replaceAll('.', '\\.')));
    assert.equal(
      invoke(['run', 'hello', '--no-discovery', '--param', "person=Ada ' & % !"]),
      "packed-mink:Ada ' & % !",
    );
    assert.equal(
      JSON.parse(invoke(['plan', 'hello', '--json', '--no-discovery'])).plan.env.PERSON,
      'team',
    );
    assert.equal(JSON.parse(invoke(['doctor', '--json', '--no-discovery'])).ok, true);
    const packageDirectory =
      manager === 'npm'
        ? join(prefix, process.platform === 'win32' ? 'node_modules' : 'lib/node_modules', cli.name)
        : JSON.parse(
            run(
              'pnpm',
              [
                'list',
                '--global',
                '--json',
                '--depth',
                '0',
                `--config.global-dir=${join(prefix, 'global')}`,
                `--config.global-bin-dir=${globalBin}`,
              ],
              { cwd: temporary, env: installEnv },
            ),
          )
            .flatMap((project) => Object.entries(project.dependencies ?? {}))
            .find(([name]) => name === cli.name)?.[1].path;
    assert.ok(packageDirectory, 'Cannot locate the globally installed CLI');
    assert.ok((await readFile(join(packageDirectory, 'dist/index.d.ts'), 'utf8')).length);
    run(process.execPath, [join(root, 'scripts/packed-tui-smoke.mjs'), packageDirectory, project], {
      cwd: project,
      env: installEnv,
    });
    console.log(
      `${manager}: global install, CLI, execution, plan, doctor and installed TUI passed.`,
    );
  }
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  registryProcess?.kill('SIGTERM');
  if (registryExit) await registryExit;
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
