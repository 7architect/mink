import { watch } from 'chokidar';
import { relative, resolve, sep } from 'node:path';

export interface WatchOptions {
  directory: string;
  paths?: string[];
  ignore?: string[];
  debounceMs?: number;
  mode?: 'restart' | 'queue';
  signal: AbortSignal;
  run: (signal: AbortSignal) => Promise<void>;
  onError?: (error: unknown) => void;
  onReady?: () => void;
}

/** Serializes runs. Restart mode awaits cancellation before launching a replacement. */
export async function watchTasks(options: WatchOptions): Promise<void> {
  if (options.signal.aborted) return;
  const debounce = options.debounceMs ?? 150;
  if (!Number.isInteger(debounce) || debounce < 10 || debounce > 60000)
    throw new Error('Watch debounce must be an integer between 10 and 60000 ms');
  const ignored = new Set(['node_modules', '.git', '.mink', '.next', 'dist', 'out', 'coverage']);
  const exclusions = (options.ignore ?? []).map((path) => resolve(options.directory, path));
  const watcher = watch(
    (options.paths?.length ? options.paths : ['.']).map((path) => resolve(options.directory, path)),
    {
      ignoreInitial: true,
      ignored: (path) => {
        const absolute = resolve(path);
        return (
          relative(options.directory, absolute)
            .split(sep)
            .some((part) => ignored.has(part)) ||
          exclusions.some(
            (excluded) => absolute === excluded || absolute.startsWith(excluded + sep),
          )
        );
      },
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let pending = false;
  let watcherError: unknown;
  const kick = () => {
    if (options.signal.aborted || watcherError) return;
    pending = true;
    if (options.mode !== 'queue') controller?.abort();
    if (running) return;
    running = (async () => {
      while (pending && !options.signal.aborted && !watcherError) {
        pending = false;
        controller = new AbortController();
        try {
          await options.run(AbortSignal.any([options.signal, controller.signal]));
        } catch (error) {
          if (!controller.signal.aborted && !options.signal.aborted) options.onError?.(error);
        } finally {
          controller = undefined;
        }
      }
    })().finally(() => {
      running = undefined;
      if (pending && !options.signal.aborted && !watcherError) kick();
    });
  };
  let finish!: () => void;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const abort = () => {
    controller?.abort();
    finish();
  };
  options.signal.addEventListener('abort', abort, { once: true });
  watcher.on('all', () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(kick, debounce);
  });
  watcher.on('error', (error) => {
    watcherError = error;
    controller?.abort();
    finish();
  });
  watcher.once('ready', () => {
    options.onReady?.();
    kick();
  });
  if (options.signal.aborted) abort();
  try {
    await done;
  } finally {
    if (timer) clearTimeout(timer);
    options.signal.removeEventListener('abort', abort);
    controller?.abort();
    await watcher.close();
    await running;
  }
  if (watcherError) throw watcherError;
}
