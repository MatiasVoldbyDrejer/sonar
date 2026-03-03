"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatAmount, formatPercent } from "@/lib/utils";
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
  const rc = positions[0]?.reportingCurrency ?? 'DKK';

  const meta = [instrument.ticker, instrument.type?.toUpperCase(), instrument.currency]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <Avatar className="h-8 w-8">
          <AvatarImage src={getLogoUrl(instrument.yahooSymbol)} alt={instrument.name} />
          <AvatarFallback className="text-[10px] font-medium bg-muted">
            {getInitials(instrument.name, instrument.ticker)}
          </AvatarFallback>
        </Avatar>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "0.875rem", fontWeight: 500, lineHeight: "tight", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instrument.name}</p>
          {meta && (
            <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>{meta}</p>
          )}
        </div>
      </div>

      {/* Position data */}
      {hasActive ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", fontSize: "0.75rem" }}>
          <Row label="Qty" value={`${totalQty.toFixed(totalQty % 1 === 0 ? 0 : 4)} shares`} />
          <Row label="Value" value={formatAmount(totalValue, rc)} />
          <Row label="Cost basis" value={formatAmount(totalCost, rc)} />
          <Row
            label="P/L"
            value={`${formatAmount(totalPL, rc)} (${formatPercent(plPct)})`}
            style={{ color: totalPL >= 0 ? "var(--gain)" : "var(--loss)" }}
          />
          {totalDay !== 0 && (
            <Row
              label="Today"
              value={`${totalDay >= 0 ? "+" : ""}${formatAmount(totalDay, rc)}`}
              style={{ color: totalDay >= 0 ? "var(--gain)" : "var(--loss)" }}
            />
          )}
        </div>
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}>No active position</p>
      )}

      {/* Link */}
      <Link
        href={`/instrument/${instrument.isin}`}
        style={{ fontSize: "0.75rem", color: "var(--primary)", display: "inline-block", textDecoration: "none" }}
        data-hover="link"
      >
        View details &rarr;
      </Link>
    </div>
  );
}

function Row({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono, ui-monospace, monospace)", textAlign: "right", ...style }}>{value}</span>
    </div>
  );
}
