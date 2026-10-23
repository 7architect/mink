import { Box, Text, useInput } from 'ink';
import { safeText } from '../actions.js';
import { useParameterForm } from '../hooks/use-parameter-form.js';
import type { CommandEntry, Values } from '../model/commands.js';
import type { Viewport } from '../components/frame.js';
import { Input } from '../components/input.js';
import { Panel } from '../components/ui.js';
import { colors } from '../theme.js';
import { t } from '../i18n.js';
export function ParametersScreen({
  active,
  id,
  entry,
  initial,
  viewport,
  onComplete,
}: {
  active: boolean;
  id: string;
  entry: CommandEntry;
  initial: Values;
  viewport: Viewport;
  onComplete: (values: Values) => void;
}) {
  const form = useParameterForm(entry, initial, onComplete);
  const current = form.current;
  useInput(
    (input, key) => {
      if (key.ctrl && input === 'b') {
        form.previous();
        return;
      }
      if (key.ctrl || key.meta || key.tab || !current) return;
      if (form.options.length) {
        if (key.upArrow || key.leftArrow) form.choose(-1);
        if (key.downArrow || key.rightArrow) form.choose(1);
        if (key.return) form.submit(form.options[form.selectedChoice]);
      }
    },
    { isActive: active },
  );
  if (!current) return null;
  const [name, parameter] = current,
    sidebar = viewport.wide ? 30 : 0;
  const visibleOptions = Math.max(2, Math.min(7, viewport.height - 10));
  const offset = Math.max(0, form.selectedChoice - visibleOptions + 1);
  return (
    <Box height={viewport.height} gap={viewport.wide ? 1 : 0}>
      {viewport.wide && (
        <Panel title={t('common.inputs')} width={sidebar} height={viewport.height}>
          {form.fields.slice(0, viewport.height - 4).map(([key, p], index) => (
            <Text
              key={key}
              wrap="truncate"
              color={index === form.field ? colors.accent : colors.muted}
            >
              {index === form.field ? '›' : index < form.field ? '✓' : '·'} {safeText(key)}{' '}
              <Text dimColor>{p.type === 'secret' && form.values[key] ? '••••' : ''}</Text>
            </Text>
          ))}
        </Panel>
      )}
      <Panel
        title={t('common.parameters')}
        active
        width={viewport.width - sidebar - (viewport.wide ? 1 : 0)}
        height={viewport.height}
        meta={
          <Text color={colors.accent}>
            {form.field + 1}/{form.fields.length}
          </Text>
        }
      >
        <Text bold wrap="truncate">
          {safeText(id)} · {safeText(entry.name)}
        </Text>
        <Box height={viewport.height < 16 ? 1 : 2} overflow="hidden">
          <Text color={colors.muted}>
            {safeText(parameter.description ?? t('form.description'))}
          </Text>
        </Box>
        <Text bold>
          {safeText(name)} <Text color={colors.accent}>({parameter.type})</Text>
        </Text>
        {form.options.length ? (
          <Panel
            title={t('form.choose')}
            active
            height={Math.min(visibleOptions, form.options.length) + 3}
            meta={<Text color={colors.muted}>↑↓ / ←→</Text>}
          >
            {form.options.slice(offset, offset + visibleOptions).map((option, index) => (
              <Text
                key={option}
                backgroundColor={offset + index === form.selectedChoice ? colors.focus : undefined}
                color={offset + index === form.selectedChoice ? colors.accent : colors.muted}
              >
                {offset + index === form.selectedChoice ? '› ' : '  '}
                {safeText(option)}
              </Text>
            ))}
          </Panel>
        ) : (
          <Box borderStyle="round" borderColor={colors.accent} height={3} paddingX={1}>
            <Input
              active={active}
              key={name}
              initial={String(form.values[name] ?? parameter.default ?? '')}
              secret={parameter.type === 'secret'}
              submit={form.submit}
            />
          </Box>
        )}
        {form.options.length > 0 && viewport.height >= 13 && (
          <Text color={colors.muted}>
            {t('form.selected', { value: safeText(form.options[form.selectedChoice]) })}
          </Text>
        )}
        {parameter.type === 'secret' && <Text color={colors.warning}>{t('form.secret')}</Text>}
        {form.error && (
          <Text color={colors.danger} wrap="truncate">
            {t('common.error', { message: safeText(form.error) })}
          </Text>
        )}
      </Panel>
    </Box>
  );
}
