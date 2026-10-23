import type { ComponentProps, ReactNode } from 'react';
import { Box, Text } from 'ink';
import { colors, statusColor } from '../theme.js';
import { safeText } from '../actions.js';
import type { CommandKind } from '../model/commands.js';
import { stateLabel, t } from '../i18n.js';
export function Panel({
  title,
  meta,
  active = false,
  children,
  ...props
}: ComponentProps<typeof Box> & { title: string; meta?: ReactNode; active?: boolean }) {
  return (
    <Box
      borderStyle="round"
      borderColor={active ? colors.accent : colors.muted}
      flexDirection="column"
      paddingX={1}
      overflow="hidden"
      {...props}
    >
      <Box flexShrink={0} height={1} justifyContent="space-between">
        <Text bold color={active ? colors.accent : colors.text}>
          {title}
        </Text>
        {meta}
      </Box>
      {children}
    </Box>
  );
}
export function KindBadge({ kind }: { kind: CommandKind }) {
  return (
    <Text bold color={colors[kind]}>
      [{kind}]
    </Text>
  );
}
export function StatusBadge({ state }: { state: string }) {
  const mark = ['succeeded', 'ready'].includes(state)
    ? '●'
    : state === 'failed'
      ? '×'
      : ['running', 'starting'].includes(state)
        ? '◌'
        : '·';
  return (
    <Text color={statusColor(state)} bold>
      {mark} {stateLabel(state)}
    </Text>
  );
}
export function KeyHints({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <Text wrap="truncate">
      {items.map(([key, label], index) => (
        <Text key={key}>
          {index > 0 ? '  ' : ''}
          <Text color={colors.accent} bold>
            {key}
          </Text>
          <Text color={colors.muted}> {t(label)}</Text>
        </Text>
      ))}
    </Text>
  );
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <Box flexGrow={1} justifyContent="center" flexDirection="column" alignItems="center">
      <Text bold>{title}</Text>
      <Text color={colors.muted} wrap="truncate">
        {detail}
      </Text>
    </Box>
  );
}
export function Feedback({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <Box
      height={3}
      borderStyle="round"
      borderColor={error ? colors.danger : colors.warning}
      paddingX={1}
    >
      <Text color={error ? colors.danger : colors.warning} wrap="truncate">
        {error ? t('common.error', { message: safeText(error) }) : safeText(notice!)}
      </Text>
    </Box>
  );
}
