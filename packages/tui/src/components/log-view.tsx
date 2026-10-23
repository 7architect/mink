import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { LogLine } from '../model/log-buffer.js';
import { colors } from '../theme.js';
import { safeText } from '../actions.js';
import { t } from '../i18n.js';
export function LogView({
  active = true,
  lines,
  height,
  truncated,
  showOwner = true,
}: {
  active?: boolean;
  lines: LogLine[];
  height: number;
  truncated: boolean;
  showOwner?: boolean;
}) {
  const [anchor, setAnchor] = useState<string>();
  const count = Math.max(1, height - 1),
    tail = Math.max(0, lines.length - count);
  const start = anchor
    ? Math.max(
        0,
        lines.findIndex((line) => line.key === anchor),
      )
    : tail;
  useInput(
    (_input, key) => {
      if (key.pageUp) setAnchor(lines[Math.max(0, start - count)]?.key);
      if (key.pageDown) {
        const next = Math.min(tail, start + count);
        setAnchor(next === tail ? undefined : lines[next]?.key);
      }
      if (key.home) setAnchor(lines[0]?.key);
      if (key.end) setAnchor(undefined);
    },
    { isActive: active },
  );
  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {!lines.length && <Text color={colors.muted}>{t('log.waiting')}</Text>}
        {lines.slice(start, start + count).map((line) => (
          <Text key={line.key} wrap="truncate">
            {showOwner && <Text color={colors.muted}>[{safeText(line.id)}] </Text>}
            <Text color={line.stream === 'stderr' ? colors.danger : colors.text}>
              {line.text || ' '}
            </Text>
          </Text>
        ))}
      </Box>
      <Text wrap="truncate" color={anchor ? colors.warning : colors.muted}>
        <Text color={anchor ? colors.warning : colors.success}>
          {anchor ? t('log.paused') : t('log.live')}
        </Text>{' '}
        ·{' '}
        {lines.length
          ? `${start + 1}–${Math.min(start + count, lines.length)}/${lines.length}`
          : t('log.lines', { count: 0 })}{' '}
        · {t('log.footer')}
        {truncated ? ` · ${t('log.trimmed')}` : ''}
      </Text>
    </Box>
  );
}
