import { createContext } from 'react';

export const LogInputContext = createContext({
  editing: false,
  editingRef: { current: false },
  setEditing: (_editing: boolean) => {},
});
