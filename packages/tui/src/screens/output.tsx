import { Box, Text, useInput } from 'ink';
import type { SessionView } from '../hooks/use-session.js';
import { planRows } from '../model/commands.js';
import { LogView } from '../components/log-view.js';
import { PipelineSteps } from '../components/pipeline-steps.js';
import { EmptyState, Panel, StatusBadge } from '../components/ui.js';
import type { Viewport } from '../components/frame.js';
import { safeText } from '../actions.js';
import { colors } from '../theme.js';
import { t } from '../i18n.js';
export function OutputScreen({
  active,
  session,
  viewport,
  onRerun,
  onCopy,
}: {
  active: boolean;
  session: SessionView;
  viewport: Viewport;
  onRerun: () => void;
  onCopy: () => void;
}) {
  const run = session.invocation;
  useInput(
    (input, key) => {
      if (!key.ctrl && !key.meta && input === 'r' && run && !run.busy) onRerun();
      if (!key.ctrl && !key.meta && input === 'y' && run) onCopy();
    },
    { isActive: active },
  );
  if (!run)
    return (
      <Panel title={t('common.output')} height={viewport.height} width={viewport.width}>
        <EmptyState title={t('output.emptyTitle')} detail={t('output.emptyDetail')} />
      </Panel>
    );
  const state = run.busy
    ? 'running'
    : Object.values(session.states).includes('failed')
      ? 'failed'
      : (run.result?.state ?? 'idle');
  const sidebar = viewport.wide ? Math.min(38, Math.floor(viewport.width * 0.34)) : 0;
  const summaryHeight = viewport.wide
    ? viewport.height
    : run.plan.entry
      ? 4
      : Math.min(8, viewport.height - 6);
  return (
    <Box
      flexDirection={viewport.wide ? 'row' : 'column'}
      height={viewport.height}
      gap={viewport.wide ? 1 : 0}
    >
      <Panel
        title={t('output.invocation')}
        height={summaryHeight}
        width={viewport.wide ? sidebar : viewport.width}
        meta={<StatusBadge state={state} />}
      >
        <Text bold wrap="truncate">
          {safeText(run.id)}
          {run.result
            ? t('output.exit', {
                code: run.result.exitCode ?? run.result.signal ?? '—',
                duration: run.result.durationMs,
              }) + (run.result.timedOut ? t('output.timedOut') : '')
            : t('output.running')}
        </Text>
        {(viewport.wide || !run.plan.entry) && (
          <>
            {viewport.wide && <Text> </Text>}
            <PipelineSteps
              rows={planRows(run.plan)}
              states={session.states}
              limit={viewport.wide ? viewport.height - 7 : Math.max(1, summaryHeight - 5)}
            />
          </>
        )}
      </Panel>
      <Panel
        title={t('output.process')}
        active
        width={viewport.wide ? viewport.width - sidebar - 1 : viewport.width}
        height={viewport.wide ? viewport.height : viewport.height - summaryHeight}
        meta={
          <Text color={colors.muted}>
            {t('output.stdout')}
            <Text color={colors.danger}>stderr</Text>
          </Text>
        }
      >
        {run.result?.error && (
          <Text color={colors.danger} wrap="truncate">
            {safeText(run.result.error)}
          </Text>
        )}
        <LogView
          active={active}
          key={session.runId ?? run.id}
          lines={session.logs.lines(session.runId ? { runId: session.runId } : undefined)}
          height={
            (viewport.wide ? viewport.height : viewport.height - summaryHeight) -
            3 -
            (run.result?.error ? 1 : 0)
          }
          truncated={session.logs.truncated}
        />
      </Panel>
    </Box>
  );
}
