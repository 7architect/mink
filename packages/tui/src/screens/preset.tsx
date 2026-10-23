import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Input } from '../components/input.js';
import { Panel } from '../components/ui.js';
import type { Viewport } from '../components/frame.js';
import { colors } from '../theme.js';
import { safeText } from '../actions.js';
import { t } from '../i18n.js';
export function PresetScreen({
  active,
  saving,
  names,
  viewport,
  onSubmit,
}: {
  active: boolean;
  saving: boolean;
  names: string[];
  viewport: Viewport;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [index, setIndex] = useState(0),
    [pending, setPending] = useState(false);
  const selected = names[Math.min(index, Math.max(0, names.length - 1))] ?? '';
  useInput(
    (_input, key) => {
      if (saving || key.ctrl || key.meta) return;
      if (key.upArrow) setIndex((value) => Math.max(0, value - 1));
      if (key.downArrow) setIndex((value) => Math.min(names.length - 1, value + 1));
    },
    { isActive: active },
  );
  async function submit(name: string) {
    if (pending) return;
    setPending(true);
    try {
      await onSubmit(name);
    } finally {
      setPending(false);
    }
  }
  return (
    <Panel
      title={saving ? t('preset.save') : t('preset.load')}
      active
      width={viewport.width}
      height={viewport.height}
    >
      <Text color={colors.muted}>{saving ? t('preset.saveHint') : t('preset.loadHint')}</Text>
      <Box height={3} borderStyle="round" borderColor={colors.accent} paddingX={1}>
        <Input
          active={active}
          key={saving ? 'new' : selected}
          initial={saving ? '' : selected}
          submit={(name) => {
            void submit(name);
          }}
        />
      </Box>
      <Text color={colors.accent} bold>
        {pending ? t('preset.working') : t('preset.existing')}
      </Text>
      {!names.length && <Text color={colors.muted}>{t('preset.none')}</Text>}
      {names.slice(0, Math.max(1, viewport.height - 10)).map((name) => (
        <Text
          key={name}
          wrap="truncate"
          color={!saving && name === selected ? colors.accent : colors.muted}
        >
          {!saving && name === selected ? '› ' : '  '}
          {safeText(name)}
        </Text>
      ))}
      {saving && <Text color={colors.warning}>{t('preset.preserve')}</Text>}
    </Panel>
  );
}
