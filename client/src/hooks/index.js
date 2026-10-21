import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api.js';

/** Fetch data from a GET endpoint; re-runs when `deps` change. */
export function useApi(path, params, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params || {});

  useEffect(() => {
    if (!path) return undefined;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get(path, params, { signal: ctrl.signal })
      .then((d) => setData(d))
      .catch((e) => e.name !== 'AbortError' && setError(e))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, setData, error, loading, reload };
}

/**
 * Paginated list with "load more". Resets when `params` change.
 * Returns items, total, hasMore, loading flags and helpers to mutate items locally.
 */
export function usePaginated(path, params = {}, { limit } = {}) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get(path, { ...params, page: 1, limit }, { signal: ctrl.signal })
      .then((d) => {
        setItems(d.items || []);
        setMeta({ total: d.total ?? d.items?.length ?? 0, hasMore: !!d.hasMore, extra: d });
        setPage(1);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, tick, limit]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const d = await api.get(path, { ...params, page: page + 1, limit });
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i._id));
        return [...prev, ...(d.items || []).filter((i) => !seen.has(i._id))];
      });
      setMeta((m) => ({ ...m, total: d.total, hasMore: !!d.hasMore }));
      setPage((p) => p + 1);
    } catch (e) {
      setError(e);
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, page, limit]);

  const updateItem = useCallback((id, patch) => setItems((list) => list.map((i) => (i._id === id ? { ...i, ...(typeof patch === 'function' ? patch(i) : patch) } : i))), []);
  const removeItem = useCallback((id) => {
    setItems((list) => list.filter((i) => i._id !== id));
    setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) }));
  }, []);
  const prependItem = useCallback((item) => {
    setItems((list) => [item, ...list]);
    setMeta((m) => ({ ...m, total: m.total + 1 }));
  }, []);

  return { items, setItems, total: meta.total, hasMore: meta.hasMore, extra: meta.extra, loading, loadingMore, error, loadMore, reload: () => setTick((t) => t + 1), updateItem, removeItem, prependItem };
}

export function useDebounce(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Filter state stored in the URL query string so filters survive refresh & sharing. */
export function useQueryFilters(defaults = {}) {
  const [sp, setSp] = useSearchParams();
  const filters = { ...defaults };
  for (const k of Object.keys(defaults)) if (sp.has(k)) filters[k] = sp.get(k);
  const setFilter = useCallback(
    (k, v) =>
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === '' || v === undefined || v === null || v === defaults[k]) next.delete(k);
          else next.set(k, v);
          return next;
        },
        { replace: true }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSp]
  );
  const reset = useCallback(() => setSp({}, { replace: true }), [setSp]);
  return [filters, setFilter, reset];
}

/** Run an async action with a busy flag; reports errors via onError. */
export function useAction(fn, { onError } = {}) {
  const [busy, setBusy] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(
    async (...args) => {
      setBusy(true);
      try {
        return await fnRef.current(...args);
      } catch (e) {
        onError?.(e);
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [onError]
  );
  return [run, busy];
}

export function useInterval(fn, ms, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') ref.current();
    }, ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · DIU Student Hub` : 'DIU Student Hub';
  }, [title]);
}
