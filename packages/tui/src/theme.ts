import type { ThemeName } from '@mink/core';

export interface Palette {
  accent: string;
  task: string;
  pipeline: string;
  service: string;
  success: string;
  warning: string;
  danger: string;
  muted: string;
  text: string;
  focus: string;
}

export const palettes: Record<ThemeName, Palette> = {
  mink: {
    accent: 'cyan',
    task: 'blueBright',
    pipeline: 'magentaBright',
    service: 'cyanBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    text: 'white',
    focus: '#164E63',
  },
  slate: {
    accent: '#94A3B8',
    task: '#CBD5E1',
    pipeline: '#64748B',
    service: '#E2E8F0',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: '#64748B',
    text: '#E2E8F0',
    focus: '#1E293B',
  },
  stone: {
    accent: '#A8A29E',
    task: '#D6D3D1',
    pipeline: '#78716C',
    service: '#E7E5E4',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: '#78716C',
    text: '#E7E5E4',
    focus: '#292524',
  },
  sand: {
    accent: '#D6C7A1',
    task: '#E7DCC0',
    pipeline: '#A8A29E',
    service: '#F5EFE1',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: '#A8A29E',
    text: '#F5EFE1',
    focus: '#3F3A2E',
  },
  graphite: {
    accent: 'gray',
    task: 'white',
    pipeline: 'gray',
    service: 'white',
    success: 'green',
    warning: 'yellow',
    danger: 'red',
    muted: 'gray',
    text: 'white',
    focus: '#27272A',
  },
  forest: {
    accent: 'green',
    task: 'cyanBright',
    pipeline: 'yellowBright',
    service: 'greenBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    text: 'white',
    focus: '#14532D',
  },
  amber: {
    accent: 'yellow',
    task: 'yellowBright',
    pipeline: 'redBright',
    service: 'yellow',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    text: 'white',
    focus: '#713F12',
  },
  violet: {
    accent: 'magenta',
    task: 'blueBright',
    pipeline: 'magentaBright',
    service: 'magentaBright',
    success: 'greenBright',
    warning: 'yellowBright',
    danger: 'redBright',
    muted: 'gray',
    text: 'white',
    focus: '#4C1D95',
  },
  mono: {
    accent: 'white',
    task: 'white',
    pipeline: 'gray',
    service: 'white',
    success: 'white',
    warning: 'gray',
    danger: 'whiteBright',
    muted: 'gray',
    text: 'white',
    focus: '#374151',
  },
};

export const colors: Palette = { ...palettes.stone };

export function applyTheme(name: ThemeName): void {
  Object.assign(colors, palettes[name]);
}

export function statusColor(state: string): string {
  if (['succeeded', 'ready'].includes(state)) return colors.success;
  if (['failed', 'error'].includes(state)) return colors.danger;
  if (['cancelled', 'stopping'].includes(state)) return colors.warning;
  if (['running', 'starting'].includes(state)) return colors.accent;
  return colors.muted;
}
