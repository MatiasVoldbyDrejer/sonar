"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MarkdownContent } from "@/components/markdown-content";
import { PriceChart } from "@/components/price-chart";
import { InstrumentSkeleton } from "@/components/skeleton-shimmer";
import { InstrumentBadge } from "@/components/instrument-badge";
import type { Instrument, Transaction, Position, InstrumentStats, Quote } from "@/types";
import Link from "next/link";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

function formatReporting(value: number, currency: string): string {
  return formatCurrency(value, currency);
}

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString("da-DK");
}

function glColor(value: number): string {
  if (value > 0) return "var(--gain)";
  if (value < 0) return "var(--loss)";
  return "var(--foreground)";
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

  const fetchAnalysis = async (refresh = false) => {
    setLoadingAnalysis(true);
    try {
      const url = `/api/analysis/instrument/${isin}${refresh ? "?refresh=true" : ""}`;
      const res = await fetch(url, { method: "POST" });
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
      <div style={{ paddingTop: 48, paddingBottom: 48, textAlign: "center" }}>
        <p style={{ color: "var(--muted-foreground)" }}>Instrument not found.</p>
        <Link href="/" style={{ color: "var(--primary)", marginTop: 8, display: "inline-block", textDecoration: "none" }} data-hover="link">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const reportingCurrency = positions[0]?.reportingCurrency ?? 'DKK';

  const totalPosition = positions.reduce(
    (acc, p) => ({
      quantity: acc.quantity + p.quantity,
      costBasis: acc.costBasis + p.costBasis,
      currentValue: acc.currentValue + (p.currentValue ?? 0),
      unrealizedGainLoss: acc.unrealizedGainLoss + p.unrealizedGainLoss,
      realizedGainLoss: acc.realizedGainLoss + p.realizedGainLoss,
      totalDividends: acc.totalDividends + (p.totalDividends ?? 0),
    }),
    {
      quantity: 0,
      costBasis: 0,
      currentValue: 0,
      unrealizedGainLoss: 0,
      realizedGainLoss: 0,
      totalDividends: 0,
    }
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link
              href="/"
              style={{ color: "var(--muted-foreground)", fontSize: 14, textDecoration: "none" }}
              data-hover="text-btn"
            >
              Portfolio
            </Link>
            <span style={{ color: "var(--muted-foreground)" }}>/</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
            <InstrumentBadge instrument={instrument} showName={false} linked={false} size="lg" />
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>{instrument.name}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <Badge variant="outline">{instrument.type.toUpperCase()}</Badge>
            {instrument.ticker && (
              <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
                {instrument.ticker}
              </span>
            )}
            <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
              {instrument.isin}
            </span>
            <span style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
              {instrument.currency}
            </span>
          </div>
        </div>
        {quote && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.875rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {formatCurrency(quote.price, quote.currency)}
            </div>
            <div style={{ fontVariantNumeric: "tabular-nums", color: glColor(quote.change) }}>
              {quote.change >= 0 ? "+" : ""}
              {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
            </div>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
              {quote.marketState === "REGULAR" ? "Market Open" : "Market Closed"}
            </div>
          </div>
        )}
      </div>

      {/* Position Summary + Stats */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 350px), 1fr))" }}>
        {totalPosition.quantity > 0 && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: 14, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Your Position ({reportingCurrency})
              </CardTitle>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Shares</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{totalPosition.quantity.toFixed(totalPosition.quantity % 1 === 0 ? 0 : 4)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Cost Basis</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatReporting(totalPosition.costBasis, reportingCurrency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Market Value</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatReporting(totalPosition.currentValue, reportingCurrency)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Unrealized P/L</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: glColor(totalPosition.unrealizedGainLoss) }}>
                  {formatReporting(totalPosition.unrealizedGainLoss, reportingCurrency)}
                  {totalPosition.costBasis > 0 &&
                    ` (${((totalPosition.unrealizedGainLoss / totalPosition.costBasis) * 100).toFixed(2)}%)`}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Realized P/L</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: glColor(totalPosition.realizedGainLoss) }}>
                  {formatReporting(totalPosition.realizedGainLoss, reportingCurrency)}
                </span>
              </div>
              {totalPosition.totalDividends > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--muted-foreground)" }}>Dividends</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--gain)" }}>
                    {formatReporting(totalPosition.totalDividends, reportingCurrency)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {stats && (
          <Card>
            <CardHeader>
              <CardTitle style={{ fontSize: 14, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Key Stats
              </CardTitle>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Previous Close</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{stats.previousClose != null ? formatCurrency(stats.previousClose, instrument.currency) : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Day Range</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stats.dayLow != null && stats.dayHigh != null
                    ? `${stats.dayLow.toFixed(2)} – ${stats.dayHigh.toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>52W Range</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stats.fiftyTwoWeekLow != null && stats.fiftyTwoWeekHigh != null
                    ? `${stats.fiftyTwoWeekLow.toFixed(2)} – ${stats.fiftyTwoWeekHigh.toFixed(2)}`
                    : "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Market Cap</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatNumber(stats.marketCap)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>P/E Ratio</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{stats.peRatio != null ? stats.peRatio.toFixed(2) : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--muted-foreground)" }}>Dividend Yield</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{stats.dividendYield != null ? `${(stats.dividendYield * 100).toFixed(2)}%` : "—"}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Price Chart */}
      {instrument.yahooSymbol && instrument.hasQuoteSource && (
        <PriceChart symbol={instrument.yahooSymbol} currency={instrument.currency} transactions={transactions} />
      )}

      {/* AI Analysis */}
      <div style={{ paddingTop: 16 }}>
        <Card>
          <CardHeader>
            <CardTitle style={{ fontSize: 14, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              AI Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!analysis ? (
              <div style={{ textAlign: "center", paddingTop: 24, paddingBottom: 24 }}>
                <p style={{ color: "var(--muted-foreground)", marginBottom: 12 }}>
                  Get a comprehensive AI-powered analysis of this instrument.
                </p>
                <Button onClick={() => fetchAnalysis()} disabled={loadingAnalysis}>
                  {loadingAnalysis ? "Analyzing..." : "Generate Analysis"}
                </Button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  {analysis.cached && (
                    <Badge variant="secondary">Cached</Badge>
                  )}
                  <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                    Generated{" "}
                    {new Date(analysis.createdAt).toLocaleString("da-DK")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchAnalysis(true)}
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
          <CardTitle style={{ fontSize: 14, fontWeight: 500, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p style={{ color: "var(--muted-foreground)", textAlign: "center", paddingTop: 16, paddingBottom: 16 }}>
              No transactions recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Qty</TableHead>
                  <TableHead style={{ textAlign: "right" }}>
                    Price ({instrument.currency})
                  </TableHead>
                  <TableHead style={{ textAlign: "right" }}>Fee</TableHead>
                  <TableHead style={{ textAlign: "right" }}>
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
                          variant={tx.type === "dividend" ? "outline" : tx.type === "buy" ? "default" : "secondary"}
                          style={tx.type === "dividend" ? { color: "var(--gain)", borderColor: "var(--gain)" } : undefined}
                        >
                          {tx.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {tx.type === "dividend" ? "—" : tx.quantity.toFixed(tx.quantity % 1 === 0 ? 0 : 4)}
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {tx.type === "dividend"
                          ? formatCurrency(tx.price, instrument.currency)
                          : formatCurrency(tx.price, instrument.currency)}
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {tx.fee > 0
                          ? formatCurrency(tx.fee, tx.feeCurrency || instrument.currency)
                          : "—"}
                      </TableCell>
                      <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {tx.type === "dividend"
                          ? formatCurrency(tx.price, instrument.currency)
                          : formatCurrency(tx.quantity * tx.price, instrument.currency)}
                      </TableCell>
                      <TableCell style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        {tx.notes || ""}
                      </TableCell>
                    </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow style={{ fontWeight: 600 }}>
                  <TableCell style={{ fontSize: 14 }}>Total</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(transactions.reduce((s, tx) => s + tx.fee, 0), instrument.currency)}
                  </TableCell>
                  <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(
                      transactions.reduce((s, tx) => s + (tx.type === "dividend" ? tx.price : tx.quantity * tx.price), 0),
                      instrument.currency
                    )}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
