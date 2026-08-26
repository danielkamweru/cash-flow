"use client";

import { apiGet } from "@/lib/api/client";
import type { EntitySnapshot } from "@/lib/api/types";
import type { EntityType } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type EntityContextValue = {
  entityType: EntityType;
  entityId: string;
  setEntityType: (type: "PERSONAL" | "BUSINESS") => void;
  data: EntitySnapshot | null;
  consolidatedNetWorth: number;
  source: "api";
  loading: boolean;
  error?: string;
  refresh: () => void;
};

const EntityContext = createContext<EntityContextValue | null>(null);

const ENTITY_TYPE_KEY = "wealthloop.entityType";

function initialEntityType(): "PERSONAL" | "BUSINESS" {
  if (typeof window === "undefined") return "PERSONAL";
  const stored = window.localStorage.getItem(ENTITY_TYPE_KEY);
  return stored === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

export function EntityProvider({ children }: { children: ReactNode }) {
  const [entityType, setEntityTypeState] = useState<"PERSONAL" | "BUSINESS">(initialEntityType);
  const [data, setData] = useState<EntitySnapshot | null>(null);
  const [entityId, setEntityId] = useState("");
  const [consolidatedNetWorth, setConsolidated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [tick, setTick] = useState(0);

  const setEntityType = useCallback((type: "PERSONAL" | "BUSINESS") => {
    setEntityTypeState(type);
    try {
      window.localStorage.setItem(ENTITY_TYPE_KEY, type);
    } catch {
      // Storage can be unavailable (private mode) — the switch still works for the session.
    }
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(undefined);
      try {
        const remote = await apiGet<EntitySnapshot>(`/entities/by-type/${entityType}/snapshot`);
        if (cancelled) return;
        setData(remote);
        setEntityId(remote.entity.id);
        setConsolidated(remote.consolidatedNetWorth ?? remote.netWorth);
      } catch (e) {
        if (cancelled) return;
        setData(null);
        setEntityId("");
        setConsolidated(0);
        setError(e instanceof Error ? e.message : "API unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entityType, tick]);

  const value = useMemo(
    () => ({
      entityType,
      entityId,
      setEntityType,
      data,
      consolidatedNetWorth,
      source: "api" as const,
      loading,
      error,
      refresh,
    }),
    [entityType, entityId, setEntityType, data, consolidatedNetWorth, loading, error, refresh],
  );

  return <EntityContext.Provider value={value}>{children}</EntityContext.Provider>;
}

export function useEntity() {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error("useEntity must be used within EntityProvider");
  return ctx;
}

/** Guarantees a loaded snapshot — use in pages after the shell has waited on loading. */
export function useEntityData(): EntitySnapshot {
  const { data, loading, error } = useEntity();
  if (loading && !data) {
    throw new Error("Entity snapshot still loading");
  }
  if (!data) {
    throw new Error(error ?? "Entity snapshot unavailable — start the ASP.NET API on :4000");
  }
  return data;
}
