import { Box, Text } from 'ink';
import { safeText } from '../actions.js';
import { commandKind, type CommandEntry } from '../model/commands.js';
import { colors } from '../theme.js';
import { KindBadge, Panel } from './ui.js';
import { t } from '../i18n.js';
export function CommandDetails({
  id,
  entry,
  width,
  height,
  compact = false,
}: {
  id?: string;
  entry?: CommandEntry;
  width: number;
  height: number;
  compact?: boolean;
}) {
  return (
    <Panel
      title={t('common.details')}
      width={width}
      height={height}
      meta={entry && <KindBadge kind={commandKind(entry)} />}
    >
      {!entry ? (
        <Text color={colors.muted}>{t('details.select')}</Text>
      ) : (
        <>
          <Text bold wrap="truncate">
            {safeText(entry.name)}
          </Text>
          <Box height={compact ? 1 : 4} overflow="hidden">
            <Text color={colors.muted} wrap={compact ? 'truncate' : 'wrap'}>
              {safeText(entry.description ?? id ?? '')}
            </Text>
          </Box>
          {!compact && (
            <Text color={colors.accent} bold>
              {entry.kind === 'pipeline' ? t('common.workflow') : t('common.command')}
            </Text>
          )}
          <Text wrap="truncate" color={entry.kind === 'pipeline' ? colors.pipeline : colors.text}>
            {safeText(
              entry.kind === 'command'
                ? entry.command
                : t('details.steps', {
                    steps: Object.keys(entry.steps).length,
                    parallel: entry.max_parallel ?? t('common.unlimited'),
                  }),
            )}
          </Text>
          {!compact && (
            <>
              <Text> </Text>
              <Text bold color={colors.accent}>
                {t('common.parameters')}
              </Text>
              {Object.entries(entry.params ?? {}).length ? (
                Object.entries(entry.params ?? {})
                  .slice(0, Math.max(1, height - 13))
                  .map(([name, parameter]) => (
                    <Text key={name} wrap="truncate">
                      <Text color={colors.text}>{safeText(name)}</Text>
                      <Text color={colors.muted}>
                        {' '}
                        · {parameter.type}
                        {parameter.default !== undefined
                          ? ` · ${t('common.default')}`
                          : ` · ${t('common.required')}`}
                      </Text>
                    </Text>
                  ))
              ) : (
                <Text color={colors.muted}>{t('common.noInputs')}</Text>
              )}
            </>
          )}
        </>
      )}
    </Panel>
  );
}
