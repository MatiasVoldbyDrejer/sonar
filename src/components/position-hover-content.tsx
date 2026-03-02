"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, formatDKK, formatPercent, gainLossColor } from "@/lib/utils";
import Link from "next/link";
import type { Position } from "@/types";

function getLogoUrl(symbol: string | null | undefined): string | undefined {
  if (!symbol) return undefined;
  return `https://assets.parqet.com/logos/symbol/${symbol}`;
}

function getInitials(name: string, ticker?: string | null): string {
  if (ticker) return ticker.slice(0, 2);
  const words = name.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface PositionHoverContentProps {
  instrument: {
    isin: string;
    yahooSymbol?: string | null;
    ticker?: string | null;
    name: string;
    type?: string;
    currency?: string;
  };
  positions: Position[];
}

export function PositionHoverContent({ instrument, positions }: PositionHoverContentProps) {
  const activePositions = positions.filter((p) => p.quantity > 0);
  const hasActive = activePositions.length > 0;

  // Aggregate across accounts
  const totalQty = activePositions.reduce((s, p) => s + p.quantity, 0);
  const totalValue = activePositions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalCost = activePositions.reduce((s, p) => s + p.costBasis, 0);
  const totalPL = activePositions.reduce((s, p) => s + p.unrealizedGainLoss, 0);
  const totalDay = activePositions.reduce((s, p) => s + (p.dayChange ?? 0), 0);
  const plPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;

  const meta = [instrument.ticker, instrument.type?.toUpperCase(), instrument.currency]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Avatar className="h-8 w-8">
          <AvatarImage src={getLogoUrl(instrument.yahooSymbol)} alt={instrument.name} />
          <AvatarFallback className="text-[10px] font-medium bg-muted">
            {getInitials(instrument.name, instrument.ticker)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight truncate">{instrument.name}</p>
          {meta && (
            <p className="text-xs text-muted-foreground">{meta}</p>
          )}
        </div>
      </div>

      {/* Position data */}
      {hasActive ? (
        <div className="space-y-1.5 text-xs">
          <Row label="Qty" value={`${totalQty.toFixed(totalQty % 1 === 0 ? 0 : 4)} shares`} />
          <Row label="Value" value={formatDKK(totalValue)} />
          <Row label="Cost basis" value={formatDKK(totalCost)} />
          <Row
            label="P/L"
            value={`${formatDKK(totalPL)} (${formatPercent(plPct)})`}
            className={gainLossColor(totalPL)}
          />
          {totalDay !== 0 && (
            <Row
              label="Today"
              value={`${totalDay >= 0 ? "+" : ""}${formatDKK(totalDay)}`}
              className={gainLossColor(totalDay)}
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No active position</p>
      )}

      {/* Link */}
      <Link
        href={`/instrument/${instrument.isin}`}
        className="text-xs text-primary hover:underline inline-block"
      >
        View details &rarr;
      </Link>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums font-mono text-right", className)}>{value}</span>
    </div>
  );
}
