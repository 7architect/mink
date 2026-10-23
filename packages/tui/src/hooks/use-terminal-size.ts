import { useEffect, useState } from 'react';
import { useStdout } from 'ink';
export function useTerminalSize() {
  const { stdout } = useStdout();
  const read = () => ({
    columns: (stdout as NodeJS.WriteStream).columns ?? 80,
    rows: (stdout as NodeJS.WriteStream).rows ?? 24,
  });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const resize = () =>
      setSize({
        columns: (stdout as NodeJS.WriteStream).columns ?? 80,
        rows: (stdout as NodeJS.WriteStream).rows ?? 24,
      });
    stdout.on('resize', resize);
    return () => {
      stdout.off('resize', resize);
    };
  }, [stdout]);
  return size;
}
