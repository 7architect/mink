export const tabs = ['palette', 'output', 'services', 'settings'] as const;
export type Tab = (typeof tabs)[number];
export type Screen = Tab | 'form' | 'preview' | 'preset' | 'save';
export function tabForScreen(screen: Screen): Tab {
  return screen === 'output' || screen === 'services' || screen === 'settings' ? screen : 'palette';
}
export function adjacentTab(screen: Screen, direction: 1 | -1): Tab {
  return tabs[(tabs.indexOf(tabForScreen(screen)) + direction + tabs.length) % tabs.length];
}
