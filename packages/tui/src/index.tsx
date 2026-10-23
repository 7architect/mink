import { render } from 'ink';
import type { Mink, ParameterValue, Settings } from '@mink/core';
import { MinkApp } from './app.js';
export { MinkApp } from './app.js';

export async function openTui(mink: Mink, overrides: Partial<Settings> = {}): Promise<void> {
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
  // Ink only clears on shrinking terminals; widening leaves the previous
  // frame's border behind. Force a clean repaint for every resize.
  const resized = () => app?.clear();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  process.stdout.on('resize', resized);
  try {
    do {
      foreground = undefined;
      app = render(
        <MinkApp
          mink={mink}
          overrides={overrides}
          onForeground={(id, values) => {
            foreground = { id, values };
          }}
        />,
        { exitOnCtrlC: false, maxFps: 20, alternateScreen: true },
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
    process.stdout.off('resize', resized);
  }
}
