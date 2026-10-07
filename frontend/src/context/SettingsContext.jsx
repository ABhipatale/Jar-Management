import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';

/** Shop settings (name, default rate, WhatsApp templates…), cached for offline use. */
const SettingsContext = createContext(null);
const KEY = 'rws_settings';

function cached() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(cached);

  const apply = (data) => {
    setSettings(data);
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  };

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      apply(data);
    } catch {
      /* keep cached copy */
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return <SettingsContext.Provider value={{ settings, setSettings: apply, reload }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
