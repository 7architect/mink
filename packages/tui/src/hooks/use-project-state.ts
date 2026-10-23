import { useCallback, useEffect, useState } from 'react';
import {
  defaultSettings,
  type LocalState,
  type Mink,
  type ParameterValue,
  type Settings,
} from '@mink/core';
export function useProjectState(mink: Mink, onError: (message: string) => void) {
  const [state, setState] = useState<LocalState>({ history: [], favorites: [], presets: {} });
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  useEffect(() => {
    let active = true;
    void Promise.all([mink.state(), mink.settings()])
      .then(([value, preferences]) => {
        if (!active) return;
        setState(value);
        setSettings(preferences);
      })
      .catch((error) => {
        if (active) onError(String(error));
      });
    return () => {
      active = false;
    };
  }, [mink, onError]);
  const reload = useCallback(async () => {
    setState(await mink.state());
  }, [mink]);
  return {
    state,
    settings,
    reload,
    async saveSettings(change: Partial<Settings>) {
      setSettings((current) => ({ ...current, ...change }));
      setSettings(await mink.updateSettings(change));
    },
    async favorite(id: string) {
      await mink.favorite(id);
      await reload();
    },
    loadPreset: (id: string, name: string) => mink.preset(id, name),
    async savePreset(id: string, name: string, values: Record<string, ParameterValue>) {
      await mink.savePreset(id, name, values);
      await reload();
    },
  };
}
