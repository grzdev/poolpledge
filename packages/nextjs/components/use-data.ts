"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { walletError } from "../lib/rules.mjs";
export function useData<T>(url: string, revision = 0) {
  const [result, setResult] = useState<{ url: string; data: T | null; error: string; loading: boolean }>({ url: "", data: null, error: "", loading: true });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    const id = ++generation.current;
    async function load() {
      setResult({ url, data: null, error: "", loading: true });
      try {
        const response = await fetch(url, { cache: "no-store", signal: abort.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "On-chain read failed.");
        if (id === generation.current) setResult({ url, data: json, error: "", loading: false });
      } catch (e) { if (!abort.signal.aborted && id === generation.current) setResult({ url, data: null, error: walletError(e), loading: false }); }
    }
    void load();
    return () => abort.abort();
  }, [url, revision, attempt]);
  return { data: result.url === url ? result.data : null, error: result.url === url ? result.error : "", loading: result.url !== url || result.loading, refresh };
}
