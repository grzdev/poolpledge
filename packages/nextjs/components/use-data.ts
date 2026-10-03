"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { walletError } from "../lib/rules.mjs";
export function useData<T>(url: string | null, revision = 0) {
  const [result, setResult] = useState<{ url: string | null; data: T | null; error: string; loading: boolean }>({ url: null, data: null, error: "", loading: false });
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    const id = ++generation.current;
    const timeout = setTimeout(() => abort.abort(new Error("Read timed out. Retry the request.")), 30000);
    let active = true;
    async function load() {
      setResult(old => ({ url, data: old.url === url ? old.data : null, error: "", loading: true }));
      try {
        const response = await fetch(url!, { cache: "no-store", signal: abort.signal });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "On-chain read failed.");
        if (active && id === generation.current) setResult({ url, data: json, error: "", loading: false });
      } catch (e) {
        if (active && id === generation.current) setResult(old => ({url, data: old.url === url ? old.data : null, error: walletError(e), loading: false}));
      } finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); abort.abort(); };
  }, [url, revision, attempt]);
  return { data: url && result.url === url ? result.data : null, error: url && result.url === url ? result.error : "", loading: Boolean(url && (result.url !== url || result.loading)), refresh };
}
