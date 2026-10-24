import spawn from 'cross-spawn';

export function run(file, args, options = {}) {
  const result = spawn.sync(file, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.error || result.status !== 0) {
    const error = new Error(
      `${file} ${args[0] ?? ''} failed (${result.status ?? result.error?.code})`,
    );
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return result.stdout ?? '';
}

export { spawn };
