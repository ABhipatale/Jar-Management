import { useCallback, useEffect, useRef, useState } from 'react';
import api, { errorMessage } from '../api/client';

/** GET `url` with `params`; refetches when either changes. Pass url=null to skip. */
export function useApi(url, params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState(null);
  const key = url ? url + JSON.stringify(params || {}) : null;
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const n = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params });
      if (n === latest.current) setData(res.data);
    } catch (err) {
      if (n === latest.current) setError(errorMessage(err));
    } finally {
      if (n === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, setData };
}

/** Debounce a changing value (search boxes). */
export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
