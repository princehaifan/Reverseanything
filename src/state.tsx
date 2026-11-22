import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Meta } from '../server/api-types';

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: keep working in memory */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export interface Filters { country: string; platform: string; days: number }
interface Ctx {
  filters: Filters;
  setFilters: (patch: Partial<Filters>) => void;
  meta: Meta | null;
  watchlist: string[];
  toggleWatch: (id: string) => void;
  theme: string;
  setTheme: (t: string) => void;
}
const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, setAll] = useStored<Filters>('tm.filters', { country: 'WW', platform: 'all', days: 30 });
  const [watchlist, setWatchlist] = useStored<string[]>('tm.watchlist', []);
  const [theme, setTheme] = useStored<string>('tm.theme', 'system');
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    fetch('/api/meta').then((r) => r.json()).then(setMeta).catch(() => setMeta(null));
  }, []);
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value = useMemo<Ctx>(() => ({
    filters, meta, watchlist, theme, setTheme,
    setFilters: (patch) => setAll((f) => ({ ...f, ...patch })),
    toggleWatch: (id) => setWatchlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id])),
  }), [filters, meta, watchlist, theme, setAll, setWatchlist, setTheme]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

type Params = Record<string, string | number | undefined | null>;
export interface ApiState<T> { data: T | null; loading: boolean; error: string | null; reload: () => void }

/**
 * Fetch an API path with the global filters applied. While a refetch is in
 * flight the previous data stays on screen (dimmed by the caller) so the
 * layout never jumps. Pass `null` as the path to skip the request.
 */
export function useApi<T>(path: string | null, params: Params = {}, withFilters = true): ApiState<T> {
  const { filters } = useApp();
  const query = new URLSearchParams();
  if (withFilters) for (const [k, v] of Object.entries(filters)) query.set(k, String(v));
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') query.set(k, String(v));
  const url = path === null ? null : `/api${path}?${query}`;

  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null, loading: !!url, error: null,
  });
  const [nonce, setNonce] = useState(0);
  const lastPath = useRef(path);

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    // A different entity (not just different filters) must not show stale data.
    const keep = lastPath.current === path;
    lastPath.current = path;
    setState((s) => ({ data: keep ? s.data : null, loading: true, error: null }));
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error ?? `Request failed (${r.status})`);
        return body as T;
      })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'Request failed' });
      });
    return () => ctrl.abort();
    // `path` is part of `url`; `nonce` forces a manual reload.
  }, [url, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
