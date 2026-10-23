import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'apps/docs/out');
const cardHtml = path.join(outDir, 'og-card/index.html');
const target = path.join(root, 'apps/docs/public/og.png');
const chromeBinary = process.env.CHROME_BIN ?? 'google-chrome';

if (!existsSync(cardHtml)) {
  console.error('Build the docs first: pnpm docs:build');
  process.exit(1);
}

const mime = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const server = createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.join(outDir, pathname);
    if (!file.startsWith(outDir)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const profile = path.join(tmpdir(), `mink-og-${process.pid}`);
await mkdir(profile, { recursive: true });

const chrome = spawn(
  chromeBinary,
  [
    '--headless=new',
    '--no-sandbox',
    '--hide-scrollbars',
    '--mute-audio',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--remote-debugging-port=9333',
    `--user-data-dir=${profile}`,
    '--window-size=1200,630',
    '--force-device-scale-factor=1',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=gl',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);

let chromeLog = '';
chrome.stdout.on('data', (chunk) => {
  chromeLog += chunk;
});
chrome.stderr.on('data', (chunk) => {
  chromeLog += chunk;
});

async function waitForDebugger() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9333/json/version');
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome did not start.\n${chromeLog}`);
}

async function connect() {
  await waitForDebugger();
  const response = await fetch(
    `http://127.0.0.1:9333/json/new?${encodeURIComponent(`http://127.0.0.1:${port}/og-card/`)}`,
    { method: 'PUT' },
  );
  const page = await response.json();
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve));

  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const messageId = ++id;
      pending.set(messageId, resolve);
      socket.send(JSON.stringify({ id: messageId, method, params }));
    });

  return { socket, send };
}

try {
  const { socket, send } = await connect();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 630,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/og-card/` });

  let hasCanvas = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const check = await send('Runtime.evaluate', {
      expression: "Boolean(document.querySelector('.pattern-waves canvas'))",
      returnByValue: true,
    });
    if (check.result.result.value) {
      hasCanvas = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await new Promise((resolve) => setTimeout(resolve, 1400));

  const gpu = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.querySelector('.pattern-waves canvas');
      if (!canvas) return 'canvas-missing';
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) return 'no-webgl';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    })()`,
    returnByValue: true,
  });
  console.log(`Canvas: ${hasCanvas ? 'ok' : 'missing'}`);
  console.log(`WebGL renderer: ${gpu.result.result.value}`);

  const screenshot = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(target, Buffer.from(screenshot.result.data, 'base64'));
  console.log(`Wrote ${path.relative(root, target)} (1200x630)`);
  socket.close();
} finally {
  server.close();
  chrome.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 800));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(
    () => {},
  );
}
