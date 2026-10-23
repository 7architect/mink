import { Box, Text } from 'ink';
import type { PlanRow } from '../model/commands.js';
import { safeText } from '../actions.js';
import { colors } from '../theme.js';
import { KindBadge, StatusBadge } from './ui.js';
import { t } from '../i18n.js';
export function PipelineSteps({
  rows,
  states = {},
  limit,
}: {
  rows: PlanRow[];
  states?: Record<string, string>;
  limit: number;
}) {
  return (
    <Box flexDirection="column" overflow="hidden">
      {rows.slice(0, limit).map((row) => (
        <Text key={row.key} wrap="truncate">
          <Text color={colors.muted}>
            {'  '.repeat(Math.min(row.depth, 3))}
            {row.depth ? '└ ' : ''}
          </Text>
          <Text bold>{safeText(row.label)}</Text>{' '}
          {states[row.key] ? (
            <StatusBadge state={states[row.key]} />
          ) : (
            <KindBadge kind={row.kind} />
          )}
          {row.needs.length > 0 && (
            <Text color={colors.muted}> ← {safeText(row.needs.join(', '))}</Text>
          )}
        </Text>
      ))}
      {rows.length > limit && (
        <Text color={colors.muted}>{t('common.moreSteps', { count: rows.length - limit })}</Text>
      )}
    </Box>
  );
}
