import { afterEach, expect, it } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { MinkApp } from '../packages/tui/src/app.js';
import { Input } from '../packages/tui/src/input.js';
import { safeText } from '../packages/tui/src/actions.js';
import { project, command } from './helpers.js';
afterEach(cleanup);

it('filters the palette, edits parameters, previews and runs with output', async () => {
  const m = await project({
    greet: command('process.stdout.write("Hello "+process.env.NAME)', {
      params: { name: { type: 'string', env: 'NAME' } },
    }),
  });
  const ui = render(<MinkApp mink={m} />);
  await expect.poll(ui.lastFrame).toContain('Search');
  ui.stdin.write('greet');
  await expect.poll(ui.lastFrame).toContain('Search › greet');
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain('name (string)');
  ui.stdin.write('Ada');
  await expect.poll(ui.lastFrame).toContain('Ada');
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain("NAME='Ada'");
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain('succeeded');
  expect(ui.lastFrame()).toContain('Hello Ada');
  ui.stdin.write('\u001b');
  await expect.poll(ui.lastFrame).toContain('Search');
});

it('masks secrets in input and command preview', async () => {
  const m = await project({
    a: command('', { params: { token: { type: 'secret', env: 'TOKEN' } } }),
  });
  const ui = render(<MinkApp mink={m} />);
  await expect.poll(ui.lastFrame).toContain('Search');
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain('secret');
  ui.stdin.write('private-token');
  await expect.poll(ui.lastFrame).toContain('•••');
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain('[hidden]');
  expect(ui.frames.join('\n')).not.toContain('private-token');
});

it('preserves boolean defaults and exposes ready services', async () => {
  const m = await project({
    server: command('setInterval(()=>{},100)', {
      params: { enabled: { type: 'boolean', default: true, env: 'ENABLED' } },
      run: { mode: 'service' },
    }),
  });
  const ui = render(<MinkApp mink={m} />);
  await expect.poll(ui.lastFrame).toContain('Search');
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain('← → true');
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain("ENABLED='true'");
  ui.stdin.write('\r');
  await expect.poll(ui.lastFrame).toContain('· ready');
  ui.stdin.write('\u0013');
  await expect.poll(ui.lastFrame).toContain('Services owned by this session');
  ui.stdin.write('s');
  await expect.poll(ui.lastFrame).toContain('stopped');
});

it('edits at the cursor and strips terminal escape sequences', async () => {
  let value = '';
  const ui = render(
    <Input
      initial="ac"
      submit={(v) => {
        value = v;
      }}
    />,
  );
  await expect.poll(ui.lastFrame).toContain('ac');
  ui.stdin.write('\u001b[D');
  await new Promise((resolve) => setImmediate(resolve));
  ui.stdin.write('b');
  await expect.poll(ui.lastFrame).toContain('abc');
  ui.stdin.write('\r');
  await expect.poll(() => value).toBe('abc');
  expect(safeText('\u001b[31mred\u001b[0m\u001b]0;title\u0007\r\n')).toBe('red\n');
});
