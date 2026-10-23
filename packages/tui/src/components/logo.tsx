import { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { colors } from '../theme.js';

// Deliberately typographic: the detailed wordmark belongs to the web and docs,
// while the terminal gets a mark that stays sharp in any cell grid.
// Generated with cfonts "tiny" from MINK, then stripped of ANSI colors.
const MARK = ['█▀▄▀█ █ █▄ █ █▄▀', '█ ▀ █ █ █ ▀█ █ █'] as const;

const BLOCK = /[█▀▄░]/;

export const LOGO_HEIGHT = MARK.length;

function shimmer(line: string, head: number) {
  const runs: { text: string; lit: boolean }[] = [];
  Array.from(line).forEach((character, index) => {
    const lit = BLOCK.test(character) && Math.abs(index - head) <= 1;
    const last = runs.at(-1);
    if (last && last.lit === lit) last.text += character;
    else runs.push({ text: character, lit });
  });
  return runs;
}

export function LogoMark() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 160);
    return () => clearInterval(timer);
  }, []);
  const head = (tick % (MARK[0].length + 10)) - 5,
    lit = colors.accent === colors.text ? colors.muted : colors.text;
  return (
    <Box flexDirection="column" alignItems="center">
      {MARK.map((line) => (
        <Text key={line} color={colors.accent} bold>
          {shimmer(line, head).map((run, index) => (
            <Text key={index} color={run.lit ? lit : colors.accent}>
              {run.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}
