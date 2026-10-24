import { createRequire } from 'node:module';
import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PassThrough, Writable } from 'node:stream';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const cliRequire = createRequire(await realpath(join(process.argv[2], 'dist/index.js')));
const tuiEntry = cliRequire.resolve('@yaroslavlky/mink-tui');
const tuiRequire = createRequire(await realpath(tuiEntry));
const React = tuiRequire('react');
const { render } = await import(pathToFileURL(tuiRequire.resolve('ink')).href);
const { MinkApp } = await import(pathToFileURL(tuiEntry).href);
const { createMink } = await import(
  pathToFileURL(cliRequire.resolve('@yaroslavlky/mink-core')).href
);
const mink = await createMink({ cwd: process.argv[3], discover: false });
let frame = '';
const stdout = new Writable({
  write(chunk, _encoding, next) {
    frame += chunk.toString();
    next();
  },
});
Object.assign(stdout, { columns: 100, rows: 30, isTTY: true });
const stdin = new PassThrough();
Object.assign(stdin, { isTTY: true, setRawMode() {}, ref() {}, unref() {} });
const app = render(React.createElement(MinkApp, { mink, overrides: { language: 'en' } }), {
  stdin,
  stdout,
  stderr: stdout,
  debug: true,
  patchConsole: false,
  exitOnCtrlC: false,
});
try {
  for (let i = 0; i < 50 && !frame.includes('COMMANDS'); i++) await delay(100);
  assert.match(frame, /COMMANDS/);
  assert.match(frame, /hello/);
} finally {
  app.unmount();
  app.cleanup();
  stdin.destroy();
  stdout.destroy();
  await mink.dispose();
}
