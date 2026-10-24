// Started suspended inside a kill-on-close Windows Job Object by the supervisor.
import spawn from 'cross-spawn';
import { connect } from 'node:net';

const { file, args } = JSON.parse(
  Buffer.from(process.env.MINK_WINDOWS_PAYLOAD, 'base64').toString('utf8'),
);
const pipe = process.env.MINK_WINDOWS_PIPE;
delete process.env.MINK_WINDOWS_PAYLOAD;
delete process.env.MINK_WINDOWS_PIPE;
delete process.env.MINK_WINDOWS_NODE;
delete process.env.MINK_WINDOWS_ENTRY;
process.on('SIGBREAK', () => {});
const child = spawn(file, args, { stdio: 'inherit', windowsHide: true });
child.once('spawn', () => {
  const socket = connect(pipe, () => socket.end('started\n'));
  socket.on('error', () => child.kill());
});
child.once('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = code ?? 1;
});
