import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api.js";

// Loads JSON from a GET endpoint whenever `path` changes. Pass null to skip.
// With keepPrevious, old data stays on screen while the next request runs,
// which keeps the list from flashing blank when it loads more.
export function useApiData(path, { keepPrevious = false } = {}) {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: Boolean(path),
  });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({
      data: keepPrevious ? previous.data : null,
      error: null,
      loading: true,
    }));
    apiFetch(path, { signal: controller.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setState({ data: null, error, loading: false });
        }
      });
    return () => controller.abort();
  }, [path, keepPrevious, reloadCount]);

  const reload = useCallback(() => setReloadCount((n) => n + 1), []);
  return { ...state, reload };
}
