import { useContext, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { filterLogLines, type LogLine } from '../model/log-buffer.js';
import { LogInputContext } from './log-input.js';
import { Input } from './input.js';
import { colors } from '../theme.js';
import { safeText } from '../actions.js';
import { t } from '../i18n.js';
export function LogView({
  active = true,
  lines: source,
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
  const [query, setQuery] = useState(''),
    [editing, edit] = useState(false),
    [stream, setStream] = useState('all'),
    [owner, setOwner] = useState<string>();
  const { setEditing } = useContext(LogInputContext);
  useEffect(() => {
    if (active) setEditing(editing);
    return () => {
      if (active) setEditing(false);
    };
  }, [active, editing, setEditing]);
  const lines = filterLogLines(source, query, stream, owner);
  const count = Math.max(1, height - 2),
    tail = Math.max(0, lines.length - count);
  const start = anchor
    ? Math.max(
        0,
        lines.findIndex((line) => line.key === anchor),
      )
    : tail;
  useInput(
    (input, key) => {
      if (editing) {
        if (key.escape) edit(false);
        return;
      }
      if (input === '/' && !key.ctrl && !key.meta) {
        setEditing(true);
        edit(true);
        return;
      }
      if (key.ctrl && input === 'u') {
        setQuery('');
        setOwner(undefined);
        setStream('all');
        setAnchor(undefined);
        return;
      }
      if (key.ctrl && input === 'l') {
        setStream((value) => (value === 'all' ? 'stdout' : value === 'stdout' ? 'stderr' : 'all'));
        setAnchor(undefined);
        return;
      }
      if (key.ctrl && input === 'n') {
        const owners = [...new Set(source.map((line) => line.id))];
        const next = owner ? owners[owners.indexOf(owner) + 1] : owners[0];
        setOwner(next);
        setAnchor(undefined);
        return;
      }
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
      <Box height={1} flexShrink={0}>
        {editing ? (
          <>
            <Text color={colors.accent}>/ </Text>
            <Input
              active={active}
              initial={query}
              submit={(value) => {
                setQuery(value);
                edit(false);
                setAnchor(undefined);
              }}
            />
          </>
        ) : (
          <Text color={colors.muted} wrap="truncate">
            {t('log.filters', { stream, owner: owner ?? '*', query: query || '—' })}
          </Text>
        )}
      </Box>
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
