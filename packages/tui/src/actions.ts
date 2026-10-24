import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
export async function copyText(text: string): Promise<void> {
  const [exe, args] =
    process.platform === 'win32'
      ? [
          'powershell.exe',
          [
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            '[Console]::InputEncoding = [Text.UTF8Encoding]::new(); Set-Clipboard -Value ([Console]::In.ReadToEnd())',
          ],
        ]
      : process.platform === 'darwin'
        ? ['pbcopy', []]
        : process.env.WAYLAND_DISPLAY
          ? ['wl-copy', []]
          : ['xclip', ['-selection', 'clipboard']];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(exe, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let error = '';
    child.stderr.on('data', (c) => {
      error += c;
    });
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(error || 'Clipboard unavailable; install wl-copy or xclip')),
    );
    child.stdin.on('error', () => {});
    child.stdin.end(text);
  });
}
export async function openUrl(value: string): Promise<void> {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Only http/https URLs may be opened');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32'
        ? 'rundll32.exe'
        : process.platform === 'darwin'
          ? 'open'
          : 'xdg-open',
      process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url.href] : [url.href],
      {
        stdio: 'ignore',
        windowsHide: true,
      },
    );
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(new Error('Could not open browser')),
    );
  });
}
export function safeText(text: string): string {
  return (
    stripVTControlCharacters(text)
      // Intentionally remove terminal controls while retaining newlines and tabs.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
  );
}
