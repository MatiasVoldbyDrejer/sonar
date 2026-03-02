"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MarkdownContent } from "@/components/markdown-content";
import { PriceChart } from "@/components/price-chart";
import { InstrumentSkeleton } from "@/components/skeleton-shimmer";
import { InstrumentBadge } from "@/components/instrument-badge";
import { cn, gainLossColor } from "@/lib/utils";
import type { Instrument, Transaction, Position, InstrumentStats, Quote } from "@/types";
import Link from "next/link";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDKK(value: number): string {
  return formatCurrency(value, "DKK");
}

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString("da-DK");
}

interface AnalysisData {
  content: string;
  citations: string[];
  cached: boolean;
  createdAt: string;
}

export function InstrumentDetail({ isin }: { isin: string }) {
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [stats, setStats] = useState<InstrumentStats | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const instRes = await fetch("/api/instruments");
      const instruments: Instrument[] = await instRes.json();
      const inst = instruments.find((i) => i.isin === isin);
      if (!inst) {
        setLoading(false);
        return;
      }
      setInstrument(inst);

      const promises: Promise<void>[] = [];

      promises.push(
        fetch("/api/positions")
          .then((r) => r.json())
          .then((data: Position[]) => {
            setPositions(data.filter((p) => p.instrument.isin === isin));
          })
      );

      promises.push(
        fetch(`/api/transactions?instrumentId=${inst.id}`)
          .then((r) => r.json())
          .then((data) => setTransactions(data))
      );

      if (inst.yahooSymbol && inst.hasQuoteSource) {
        promises.push(
          fetch(`/api/quotes/${encodeURIComponent(inst.yahooSymbol)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data) {
                setQuote(data.quote);
                setStats(data.stats);
              }
            })
        );
      }

      await Promise.allSettled(promises);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [isin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchAnalysis = async () => {
    setLoadingAnalysis(true);
    try {
      const res = await fetch(`/api/analysis/instrument/${isin}`, {
        method: "POST",
      });
      const data = await res.json();
      setAnalysis(data);
    } catch {
      // silently handle
    } finally {
      setLoadingAnalysis(false);
    }
  };

  if (loading) {
    return <InstrumentSkeleton />;
  }

  if (!instrument) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Instrument not found.</p>
        <Link href="/" className="text-primary hover:underline mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const totalPosition = positions.reduce(
    (acc, p) => ({
      quantity: acc.quantity + p.quantity,
      costBasis: acc.costBasis + p.costBasis,
      currentValue: acc.currentValue + (p.currentValue ?? 0),
      unrealizedGainLoss: acc.unrealizedGainLoss + p.unrealizedGainLoss,
      realizedGainLoss: acc.realizedGainLoss + p.realizedGainLoss,
    }),
    {
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
      unrealizedGainLoss: 0,
      realizedGainLoss: 0,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Portfolio
            </Link>
            <span className="text-muted-foreground">/</span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <InstrumentBadge instrument={instrument} showName={false} linked={false} size="lg" />
            <h1 className="text-2xl font-semibold">{instrument.name}</h1>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{instrument.type.toUpperCase()}</Badge>
            {instrument.ticker && (
              <span className="text-sm text-muted-foreground">
                {instrument.ticker}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {instrument.isin}
            </span>
            <span className="text-sm text-muted-foreground">
              {instrument.currency}
            </span>
          </div>
        </div>
        {quote && (
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums">
              {formatCurrency(quote.price, quote.currency)}
            </div>
            <div className={cn("tabular-nums", gainLossColor(quote.change))}>
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {quote.marketState === "REGULAR" ? "Market Open" : "Market Closed"}
            </div>
          </div>
        )}
      </div>

      {/* Position Summary + Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        {totalPosition.quantity > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Your Position (DKK)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shares</span>
                <span className="tabular-nums">{totalPosition.quantity.toFixed(totalPosition.quantity % 1 === 0 ? 0 : 4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost Basis</span>
                <span className="tabular-nums">{formatDKK(totalPosition.costBasis)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market Value</span>
                <span className="tabular-nums">{formatDKK(totalPosition.currentValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unrealized P/L</span>
                <span className={cn("tabular-nums", gainLossColor(totalPosition.unrealizedGainLoss))}>
                  {formatDKK(totalPosition.unrealizedGainLoss)}
                  {totalPosition.costBasis > 0 &&
                    ` (${((totalPosition.unrealizedGainLoss / totalPosition.costBasis) * 100).toFixed(2)}%)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Realized P/L</span>
                <span className={cn("tabular-nums", gainLossColor(totalPosition.realizedGainLoss))}>
                  {formatDKK(totalPosition.realizedGainLoss)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {stats && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Key Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Previous Close</span>
                <span className="tabular-nums">{stats.previousClose != null ? formatCurrency(stats.previousClose, instrument.currency) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Day Range</span>
                <span className="tabular-nums">
                  {stats.dayLow != null && stats.dayHigh != null
                    ? `${stats.dayLow.toFixed(2)} – ${stats.dayHigh.toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">52W Range</span>
                <span className="tabular-nums">
                  {stats.fiftyTwoWeekLow != null && stats.fiftyTwoWeekHigh != null
                    ? `${stats.fiftyTwoWeekLow.toFixed(2)} – ${stats.fiftyTwoWeekHigh.toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Market Cap</span>
                <span className="tabular-nums">{formatNumber(stats.marketCap)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">P/E Ratio</span>
                <span className="tabular-nums">{stats.peRatio != null ? stats.peRatio.toFixed(2) : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dividend Yield</span>
                <span className="tabular-nums">{stats.dividendYield != null ? `${(stats.dividendYield * 100).toFixed(2)}%` : "—"}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Price Chart */}
      {instrument.yahooSymbol && instrument.hasQuoteSource && (
        <PriceChart symbol={instrument.yahooSymbol} currency={instrument.currency} />
      )}

      {/* AI Analysis */}
      <div className="pt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!analysis ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">
                  Get a comprehensive AI-powered analysis of this instrument.
                </p>
                <Button onClick={fetchAnalysis} disabled={loadingAnalysis}>
                  {loadingAnalysis ? "Analyzing..." : "Generate Analysis"}
                </Button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {analysis.cached && (
                    <Badge variant="secondary">Cached</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Generated{" "}
                    {new Date(analysis.createdAt).toLocaleString("da-DK")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchAnalysis}
                    disabled={loadingAnalysis}
                  >
                    {loadingAnalysis ? "Refreshing..." : "Refresh"}
                  </Button>
                </div>
                <MarkdownContent
                  content={analysis.content}
                  citations={analysis.citations}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No transactions recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">
                    Price ({instrument.currency})
                  </TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">
                    Total ({instrument.currency})
                  </TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.type === "buy" ? "default" : "secondary"}
                        >
                          {tx.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tx.quantity.toFixed(tx.quantity % 1 === 0 ? 0 : 4)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(tx.price, instrument.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tx.fee > 0
                          ? formatCurrency(tx.fee, tx.feeCurrency || instrument.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(tx.quantity * tx.price, instrument.currency)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {tx.notes || ""}
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
