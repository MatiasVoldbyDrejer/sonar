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
import { cn } from "@/lib/utils";
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
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Portfolio Pulse
          </p>
        </div>
        <PulseSkeleton />
        {state.phase === "generating" && (
          <p className="text-xs text-muted-foreground mt-2 animate-pulse">
            Scanning your holdings...
          </p>
        )}
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Portfolio Pulse
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{state.error}</p>
        <button
          onClick={generate}
          className="text-sm text-primary hover:underline mt-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.phase === "quiet") {
    return (
      <motion.div className="rounded-lg border bg-card p-5" {...fadeIn}>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Portfolio Pulse
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CircleCheck className="h-5 w-5 text-gain shrink-0" />
          <div>
            <p className="text-sm">{state.summary ?? "All quiet — nothing needs your attention right now."}</p>
          </div>
        </div>
        <PulseFooter createdAt={state.createdAt} onRefresh={generate} />
      </motion.div>
    );
  }

  // phase === "ok" with items
  return (
    <motion.div {...fadeIn}>
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Portfolio Pulse
        </p>
      </div>

      {state.summary && (
        <p className="text-sm text-muted-foreground mb-3">{state.summary}</p>
      )}

      <div className="space-y-2">
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
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        isRisk && "bg-loss/5",
        isOpportunity && "bg-gain/5"
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            isRisk ? "text-loss" : isOpportunity ? "text-gain" : "text-primary"
          )}
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">{item.headline}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {item.explanation}
          </p>
          <p className="text-xs text-muted-foreground/70 italic">
            {item.suggestedAction}
          </p>
          <span className="text-xs text-primary">
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
    <div className="flex items-center justify-between mt-3">
      <p className="text-xs text-muted-foreground">
        {createdAt ? `Updated ${timeAgo(createdAt)}` : ""}
      </p>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RefreshCw className="h-3 w-3" />
        Refresh
      </button>
    </div>
  );
}
