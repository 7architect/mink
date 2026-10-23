import { render } from 'ink';
import type { Mink, ParameterValue } from '@mink/core';
import { MinkApp } from './app.js';
export { MinkApp } from './app.js';

export async function openTui(mink: Mink): Promise<void> {
  let foreground: { id: string; values: Record<string, ParameterValue> } | undefined;
  let app: ReturnType<typeof render> | undefined;
  let foregroundController: AbortController | undefined;
  let exiting = false;
  const signal = (name: NodeJS.Signals) => {
    foregroundController?.abort();
    if (foregroundController && name === 'SIGINT') return;
    exiting = true;
    process.exitCode = name === 'SIGTERM' ? 143 : 130;
    app?.unmount();
  };
  const interrupt = () => signal('SIGINT');
  const terminate = () => signal('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    do {
      foreground = undefined;
      app = render(
        <MinkApp
          mink={mink}
          onForeground={(id, values) => {
            foreground = { id, values };
          }}
        />,
        { exitOnCtrlC: false, maxFps: 20 },
      );
      try {
        await app.waitUntilExit();
      } finally {
        app.cleanup();
        app = undefined;
      }
      if (foreground && !exiting) {
        const request = foreground as { id: string; values: Record<string, ParameterValue> };
        foregroundController = new AbortController();
        let forwarding = true;
        try {
          await mink.run(request.id, request.values, {
            signal: foregroundController.signal,
            stdin: 'inherit',
            onEvent: (e) => {
              if (forwarding && e.chunk)
                (e.type === 'stderr' ? process.stderr : process.stdout).write(e.chunk);
            },
          });
        } catch (error) {
          process.stderr.write(`${String(error)}\n`);
        } finally {
          forwarding = false;
          foregroundController = undefined;
        }
      }
    } while (foreground && !exiting);
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
}
