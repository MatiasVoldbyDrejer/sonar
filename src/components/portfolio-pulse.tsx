"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Zap,
  Newspaper,
  CircleCheck,
  RefreshCw,
  Activity,
} from "lucide-react";
import { fadeIn } from "@/lib/motion";
import { PulseSkeleton } from "@/components/skeleton-shimmer";
import { InstrumentBadge } from "@/components/instrument-badge";
import type { PulseItem, PulseSignalType } from "@/types";

const SIGNAL_ICONS: Record<PulseSignalType, typeof CalendarDays> = {
  earnings: CalendarDays,
  risk: AlertTriangle,
  "analyst-change": TrendingUp,
  opportunity: Sparkles,
  catalyst: Zap,
  news: Newspaper,
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

interface PulseState {
  phase: "loading" | "generating" | "ok" | "quiet" | "error";
  summary?: string;
  items?: PulseItem[];
  createdAt?: string;
  error?: string;
}

interface PortfolioPulseProps {
  onItemsLoaded?: (isins: string[]) => void;
}

export function PortfolioPulse({ onItemsLoaded }: PortfolioPulseProps) {
  const [state, setState] = useState<PulseState>({ phase: "loading" });

  const generate = useCallback(async () => {
    setState((s) => ({ ...s, phase: "generating" }));
    try {
      const res = await fetch("/api/pulse", { method: "POST" });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      const items: PulseItem[] = data.items ?? [];
      const phase = items.length > 0 ? "ok" : "quiet";
      setState({
        phase,
        summary: data.summary,
        items,
        createdAt: data.createdAt,
      });
      onItemsLoaded?.(items.map((i) => i.isin));
    } catch {
      setState({ phase: "error", error: "Failed to generate pulse." });
    }
  }, [onItemsLoaded]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const res = await fetch("/api/pulse");
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (cancelled) return;

        if (data.status === "ok") {
          const items: PulseItem[] = data.items ?? [];
          const phase = items.length > 0 ? "ok" : "quiet";
          setState({
            phase,
            summary: data.summary,
            items,
            createdAt: data.createdAt,
          });
          onItemsLoaded?.(items.map((i) => i.isin));
        } else {
          // empty or expired — auto-generate
          generate();
        }
      } catch {
        if (!cancelled) generate();
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.phase === "loading" || state.phase === "generating") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Activity style={{ height: "1rem", width: "1rem", color: "var(--primary)" }} />
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
            Portfolio Pulse
          </p>
        </div>
        <PulseSkeleton />
        {state.phase === "generating" && (
          <p className="animate-pulse" style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginTop: "0.5rem" }}>
            Scanning your holdings...
          </p>
        )}
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--card)", padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Activity style={{ height: "1rem", width: "1rem", color: "var(--primary)" }} />
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
            Portfolio Pulse
          </p>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>{state.error}</p>
        <button
          onClick={generate}
          style={{ fontSize: "0.875rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer", marginTop: "0.5rem", padding: 0 }}
          data-hover="text-btn"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.phase === "quiet") {
    return (
      <motion.div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--card)", padding: "1.25rem" }} {...fadeIn}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <Activity style={{ height: "1rem", width: "1rem", color: "var(--primary)" }} />
          <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
            Portfolio Pulse
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <CircleCheck style={{ height: "1.25rem", width: "1.25rem", color: "var(--gain)", flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: "0.875rem" }}>{state.summary ?? "All quiet — nothing needs your attention right now."}</p>
          </div>
        </div>
        <PulseFooter createdAt={state.createdAt} onRefresh={generate} />
      </motion.div>
    );
  }

  // phase === "ok" with items
  return (
    <motion.div {...fadeIn}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <Activity style={{ height: "1rem", width: "1rem", color: "var(--primary)" }} />
        <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.025em" }}>
          Portfolio Pulse
        </p>
      </div>

      {state.summary && (
        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", marginBottom: "0.75rem" }}>{state.summary}</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {state.items?.map((item) => (
          <PulseItemCard key={item.isin + item.signalType} item={item} />
        ))}
      </div>

      <PulseFooter createdAt={state.createdAt} onRefresh={generate} />
    </motion.div>
  );
}

function PulseItemCard({ item }: { item: PulseItem }) {
  const Icon = SIGNAL_ICONS[item.signalType] ?? Newspaper;
  const isRisk = item.signalType === "risk";
  const isOpportunity = item.signalType === "opportunity";

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)",
        background: isRisk
          ? "oklch(0.68 0.12 20 / 0.05)"
          : isOpportunity
            ? "oklch(0.75 0.10 155 / 0.05)"
            : "var(--card)",
        padding: "1rem",
        transition: "border-color 0.15s",
      }}
      data-hover="card"
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <Icon
          style={{
            height: "1rem",
            width: "1rem",
            marginTop: "0.125rem",
            flexShrink: 0,
            color: isRisk ? "var(--loss)" : isOpportunity ? "var(--gain)" : "var(--primary)",
          }}
        />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, lineHeight: 1.4 }}>{item.headline}</p>
          <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)", lineHeight: 1.625 }}>
            {item.explanation}
          </p>
          <p style={{ fontSize: "0.75rem", color: "color-mix(in oklch, var(--muted-foreground) 70%, transparent)", fontStyle: "italic" }}>
            {item.suggestedAction}
          </p>
          <span style={{ fontSize: "0.75rem", color: "var(--primary)" }}>
            <InstrumentBadge
              instrument={{ isin: item.isin, ticker: item.ticker, name: item.instrumentName }}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

function PulseFooter({
  createdAt,
  onRefresh,
}: {
  createdAt?: string;
  onRefresh: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.75rem" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>
        {createdAt ? `Updated ${timeAgo(createdAt)}` : ""}
      </p>
      <button
        onClick={onRefresh}
        style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--muted-foreground)", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.15s" }}
        data-hover="text-btn"
      >
        <RefreshCw style={{ height: "0.75rem", width: "0.75rem" }} />
        Refresh
      </button>
    </div>
  );
}
