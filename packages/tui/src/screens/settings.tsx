import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  languages,
  themes,
  type Language,
  type Settings,
  type ThemeName,
} from '@yaroslavlky/mink-core';
import { Panel } from '../components/ui.js';
import type { Viewport } from '../components/frame.js';
import { colors } from '../theme.js';
import { t } from '../i18n.js';

function cellWidth(value: string): number {
  let width = 0;
  for (const character of value) {
    width +=
      /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(
        character,
      )
        ? 2
        : 1;
  }
  return width;
}

function Row({ label, value, selected }: { label: string; value: string; selected: boolean }) {
  return (
    <Text backgroundColor={selected ? colors.focus : undefined}>
      <Text color={selected ? colors.accent : colors.muted}>{selected ? '› ' : '  '}</Text>
      <Text bold color={selected ? colors.accent : colors.text}>
        {label + ' '.repeat(Math.max(0, 12 - cellWidth(label)))}
      </Text>
      <Text color={colors.muted}>‹ </Text>
      <Text color={selected ? colors.accent : colors.text}>{value}</Text>
      <Text color={colors.muted}> ›</Text>
    </Text>
  );
}

export function SettingsScreen({
  active,
  settings,
  viewport,
  onChange,
  onClose,
}: {
  active: boolean;
  settings: Settings;
  viewport: Viewport;
  onChange: (change: Partial<Settings>) => void;
  onClose: () => void;
}) {
  const [row, setRow] = useState(0);
  useInput(
    (_input, key) => {
      if (key.escape) {
        onClose();
        return;
      }
      if (key.upArrow) setRow(0);
      if (key.downArrow) setRow(1);
      if (key.return) {
        onClose();
        return;
      }
      if (!key.leftArrow && !key.rightArrow) return;
      const delta = key.leftArrow ? -1 : 1;
      if (row === 0) {
        const index = themes.indexOf(settings.theme);
        onChange({ theme: themes[(index + delta + themes.length) % themes.length] as ThemeName });
      } else {
        const index = languages.indexOf(settings.language);
        onChange({
          language: languages[(index + delta + languages.length) % languages.length] as Language,
        });
      }
    },
    { isActive: active },
  );
  return (
    <Panel title={t('settings.title')} active width={viewport.width} height={viewport.height}>
      <Text color={colors.muted}>{t('settings.hint')}</Text>
      <Box marginTop={1} flexDirection="column">
        <Row
          label={t('settings.theme')}
          value={t(`theme.${settings.theme}`)}
          selected={row === 0}
        />
        <Row
          label={t('settings.language')}
          value={t(`language.${settings.language}`)}
          selected={row === 1}
        />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold color={colors.accent}>
          {t('settings.preview')}
        </Text>
        <Text>
          <Text color={colors.accent}>{t('tab.commands')}</Text>
          <Text color={colors.muted}> · </Text>
          <Text color={colors.task}>[task]</Text>
          <Text color={colors.muted}> · </Text>
          <Text color={colors.pipeline}>[pipeline]</Text>
          <Text color={colors.muted}> · </Text>
          <Text color={colors.service}>[service]</Text>
          <Text color={colors.muted}> · </Text>
          <Text color={colors.success}>{t('state.ready')}</Text>
          <Text color={colors.muted}> · </Text>
          <Text color={colors.danger}>{t('state.failed')}</Text>
        </Text>
        <Text color={colors.muted}>
          {t('palette.footer', { count: 12 })} · {t('log.footer')}
        </Text>
      </Box>
    </Panel>
  );
}
