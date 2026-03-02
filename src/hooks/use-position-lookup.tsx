"use client";

import { createContext, useContext, useCallback, useRef, type ReactNode } from "react";
import type { Position } from "@/types";

interface PositionLookupContextValue {
  getPositions: (isin: string) => Position[];
  prefetch: () => void;
}

const PositionLookupContext = createContext<PositionLookupContextValue>({
  getPositions: () => [],
  prefetch: () => {},
});

const CACHE_TTL = 60_000; // 60 seconds

export function PositionLookupProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<{
    data: Map<string, Position[]>;
    timestamp: number;
  } | null>(null);
  const fetchPromiseRef = useRef<Promise<void> | null>(null);

  const doFetch = useCallback(async () => {
    try {
      const res = await fetch("/api/positions");
      const positions: Position[] = await res.json();
      const map = new Map<string, Position[]>();
      for (const p of positions) {
        const existing = map.get(p.instrument.isin) || [];
        existing.push(p);
        map.set(p.instrument.isin, existing);
      }
      cacheRef.current = { data: map, timestamp: Date.now() };
    } catch {
      // Keep stale cache if fetch fails
    } finally {
      fetchPromiseRef.current = null;
    }
  }, []);

  const ensureCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) return;
    if (!fetchPromiseRef.current) {
      fetchPromiseRef.current = doFetch();
    }
  }, [doFetch]);

  const getPositions = useCallback(
    (isin: string): Position[] => {
      ensureCache();
      return cacheRef.current?.data.get(isin) || [];
    },
    [ensureCache]
  );

  const prefetch = useCallback(() => {
    ensureCache();
  }, [ensureCache]);

  return (
    <PositionLookupContext.Provider value={{ getPositions, prefetch }}>
      {children}
    </PositionLookupContext.Provider>
  );
}

export function usePositionLookup() {
  return useContext(PositionLookupContext);
}
