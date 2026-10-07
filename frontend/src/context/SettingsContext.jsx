import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { setBranding } from '../lib/branding';
import { companyKey } from '../lib/storage';

/** Company settings (name, default rate, WhatsApp templates…), cached per company for offline use. */
const SettingsContext = createContext(null);
const key = () => companyKey('rws_settings');

function cached() {
  try {
    return JSON.parse(localStorage.getItem(key()) || '{}');
  } catch {
    return {};
  }
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(cached);

  const apply = (data) => {
    setSettings(data);
    // Settings carry the company's branding (name, colour, logo): keep the app in step.
    if (data?.branding) setBranding(data.branding);
    try {
      localStorage.setItem(key(), JSON.stringify(data));
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
