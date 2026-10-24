import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer, type Socket } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { PreparedCommand } from '../commands/resolve.js';
import { commandLine } from '../commands/resolve.js';

export interface OwnedProcess {
  started: Promise<void>;
  completion: Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: string }>;
  stop(force: boolean): void;
}

export function invocation(prepared: PreparedCommand): { file: string; args: string[] } {
  if (prepared.executable) return { file: prepared.executable, args: prepared.args };
  const shell =
    prepared.shell === 'auto' || !prepared.shell
      ? process.platform === 'win32'
        ? 'powershell'
        : 'sh'
      : prepared.shell;
  if (shell === 'powershell' || shell === 'pwsh')
    return {
      file: shell === 'powershell' ? 'powershell.exe' : 'pwsh',
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        commandLine(prepared, 'powershell'),
      ],
    };
  return {
    file: shell === 'bash' ? 'bash' : process.platform === 'win32' ? 'sh' : '/bin/sh',
    args: ['-c', commandLine(prepared)],
  };
}

export function spawnOwned(
  prepared: PreparedCommand,
  stdin: 'inherit' | 'ignore',
  output: (stream: 'stdout' | 'stderr', chunk: string) => void,
): OwnedProcess {
  let child: ChildProcess | undefined;
  let stopped = false;
  let force = false;
  let control: Socket | undefined;
  const sockets = new Set<Socket>();
  let server: ReturnType<typeof createServer> | undefined;
  let closed = false;
  let started!: () => void;
  // A failed launch resolves only completion; start is deliberately never emitted.
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finish!: (result: Awaited<OwnedProcess['completion']>) => void;
  const completion = new Promise<Awaited<OwnedProcess['completion']>>((resolve) => {
    finish = resolve;
  });
  const done = (result: Awaited<OwnedProcess['completion']>) => {
    if (closed) return;
    closed = true;
    for (const socket of sockets) socket.destroy();
    server?.close();
    finish(result);
  };
  const stop = (immediate: boolean) => {
    stopped = true;
    force ||= immediate;
    if (!child?.pid || closed) return;
    if (process.platform === 'win32') {
      if (control && !control.destroyed) control.write(force ? 'kill\n' : 'stop\n');
      // Before the pipe connects, killing the supervisor cannot orphan a process:
      // it creates children only after connecting, and the Job owns them before resume.
      else child.kill('SIGKILL');
    } else {
      try {
        process.kill(-child.pid, force ? 'SIGKILL' : 'SIGTERM');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
          child.kill(force ? 'SIGKILL' : 'SIGTERM');
      }
    }
  };
  const launch = (file: string, args: string[], env: NodeJS.ProcessEnv) => {
    if (stopped) {
      done({ code: null, signal: null });
      return;
    }
    child = spawn(file, args, {
      cwd: prepared.cwd,
      env,
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: [stdin, 'pipe', 'pipe'],
    });
    child.stdout?.setEncoding('utf8').on('data', (chunk: string) => output('stdout', chunk));
    child.stderr?.setEncoding('utf8').on('data', (chunk: string) => output('stderr', chunk));
    child.once('error', (error) => done({ code: null, signal: null, error: error.message }));
    if (process.platform !== 'win32') child.once('spawn', started);
    child.once('exit', () => {
      if (process.platform !== 'win32' && child?.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          /* Already exited. */
        }
      }
    });
    child.once('close', (code, signal) => done({ code, signal }));
  };
  const target = invocation(prepared);
  const env =
    process.platform === 'win32'
      ? Object.fromEntries(
          [...Object.entries(process.env), ...Object.entries(prepared.env)].map(([key, value]) => [
            key.toUpperCase(),
            value,
          ]),
        )
      : { ...process.env, ...prepared.env };
  if (process.platform !== 'win32') launch(target.file, target.args, env);
  else {
    const pipe = `\\\\.\\pipe\\mink-${randomUUID()}`;
    server = createServer((socket) => {
      sockets.add(socket);
      socket.setEncoding('utf8');
      let pending = '';
      socket.on('data', (chunk: string) => {
        pending += chunk;
        if (pending.startsWith('control\n') || pending.startsWith('control\r\n')) {
          control = socket;
          if (stopped) stop(force);
        } else if (pending.startsWith('started\n') && !stopped) started();
      });
      socket.on('error', () => {});
      socket.on('close', () => sockets.delete(socket));
    });
    server.once('error', (error) => done({ code: null, signal: null, error: error.message }));
    server.listen(pipe, () =>
      launch(
        'powershell.exe',
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          fileURLToPath(new URL('./windows-supervisor.ps1', import.meta.url)),
        ],
        {
          ...env,
          MINK_WINDOWS_PIPE: pipe,
          MINK_WINDOWS_NODE: process.execPath,
          MINK_WINDOWS_ENTRY: fileURLToPath(new URL('./windows-entry.mjs', import.meta.url)),
          MINK_WINDOWS_PAYLOAD: Buffer.from(JSON.stringify(target)).toString('base64'),
        },
      ),
    );
  }
  return { started: startedPromise, completion, stop };
}
