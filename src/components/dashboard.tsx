"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronRight } from "lucide-react";
import type { Position, Account } from "@/types";
import Link from "next/link";
import { cn, formatDKK, formatPercent, gainLossColor, portfolioWeight } from "@/lib/utils";
import { fadeIn } from "@/lib/motion";
import { AnimatedNumber } from "@/components/animated-number";
import { Sparkline } from "@/components/sparkline";
import { DashboardSkeleton } from "@/components/skeleton-shimmer";
import { PortfolioPulse } from "@/components/portfolio-pulse";
import { PortfolioChart } from "@/components/portfolio-chart";
import { InstrumentBadge } from "@/components/instrument-badge";

type SortKey = 'name' | 'value' | 'dayChange' | 'unrealizedGainLoss' | 'weight';

function SortableHead({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: { key: SortKey; dir: 'asc' | 'desc' };
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentSort.key === sortKey;
  const Icon = isActive
    ? currentSort.dir === 'asc' ? ChevronUp : ChevronDown
    : ChevronsUpDown;

  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors -my-1",
          align === 'right' && "flex-row-reverse ml-auto"
        )}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className={cn("h-3 w-3 shrink-0", isActive ? "text-foreground" : "text-muted-foreground/50")} />
      </button>
    </TableHead>
  );
}

function sortPositions(
  positions: Position[],
  sort: { key: SortKey; dir: 'asc' | 'desc' },
  totalValue: number,
): Position[] {
  const sorted = [...positions].sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case 'name':
        cmp = (a.instrument.name || '').localeCompare(b.instrument.name || '');
        break;
      case 'value':
        cmp = (a.currentValue ?? 0) - (b.currentValue ?? 0);
        break;
      case 'dayChange':
        cmp = (a.dayChange ?? 0) - (b.dayChange ?? 0);
        break;
      case 'unrealizedGainLoss':
        cmp = a.unrealizedGainLoss - b.unrealizedGainLoss;
        break;
      case 'weight': {
        const wA = totalValue > 0 ? (a.currentValue ?? 0) / totalValue : 0;
        const wB = totalValue > 0 ? (b.currentValue ?? 0) / totalValue : 0;
        cmp = wA - wB;
        break;
      }
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

export function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState("all");
  const [pulseIsins, setPulseIsins] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' });
  const [showClosed, setShowClosed] = useState(false);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [posRes, accRes] = await Promise.all([
        fetch("/api/positions"),
        fetch("/api/accounts"),
      ]);
      const posData = await posRes.json();
      const accData = await accRes.json();
      setPositions(Array.isArray(posData) ? posData : []);
      setAccounts(Array.isArray(accData) ? accData : []);
    } catch {
      // silently handle
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const allActivePositions = positions.filter((p) => p.quantity > 0);

  const filteredPositions =
    accountFilter === "all"
      ? positions
      : positions.filter((p) => p.accountId === Number(accountFilter));

  const activePositions = filteredPositions.filter((p) => p.quantity > 0);

  const handleSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );
  }, []);

  // Hero always shows portfolio-wide totals
  const totalValue = allActivePositions.reduce((sum, p) => sum + (p.currentValue ?? 0), 0);
  const totalCost = allActivePositions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalGainLoss = allActivePositions.reduce((sum, p) => sum + p.unrealizedGainLoss, 0);
  const totalPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const totalDayChange = allActivePositions.reduce((sum, p) => sum + (p.dayChange ?? 0), 0);
  const totalRealized = positions.reduce((sum, p) => sum + p.realizedGainLoss, 0);

  const sortedActivePositions = useMemo(
    () => sortPositions(activePositions, sort, totalValue),
    [activePositions, sort, totalValue]
  );

  const closedPositions = useMemo(
    () => filteredPositions.filter((p) => p.quantity === 0 && p.realizedGainLoss !== 0),
    [filteredPositions]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div className="space-y-6" {...fadeIn}>
      {/* Hero Section */}
      {allActivePositions.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Portfolio
          </p>
          <AnimatedNumber
            value={totalValue}
            className="text-5xl font-semibold tracking-tight tabular-nums"
          />
          <div className="flex items-baseline gap-3 mt-1">
            <span className={cn("text-lg tabular-nums", gainLossColor(totalGainLoss))}>
              {formatDKK(totalGainLoss)} ({formatPercent(totalPct)})
            </span>
            {totalDayChange !== 0 && (
              <span className={cn("text-sm tabular-nums", gainLossColor(totalDayChange))}>
                Today {totalDayChange >= 0 ? "+" : ""}{formatDKK(totalDayChange)}
              </span>
            )}
          </div>
          {totalRealized !== 0 && (
            <p className="text-xs mt-1">
              <span className="text-muted-foreground">Realized </span>
              <span className={cn("tabular-nums", gainLossColor(totalRealized))}>
                {formatDKK(totalRealized)}
              </span>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Cost basis {formatDKK(totalCost)} · {allActivePositions.length} holding{allActivePositions.length !== 1 ? "s" : ""}
          </p>
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          No positions yet. Go to{" "}
          <Link href="/settings" className="text-primary hover:underline">
            Settings
          </Link>{" "}
          to add instruments and transactions.
        </div>
      )}

      {/* Portfolio Chart */}
      {allActivePositions.length > 0 && <PortfolioChart />}

      {/* Portfolio Pulse */}
      {allActivePositions.length > 0 && (
        <PortfolioPulse onItemsLoaded={(isins) => setPulseIsins(new Set(isins))} />
      )}

      {/* Holdings Table */}
      {positions.some((p) => p.quantity > 0) && (
        <div>
          <Tabs value={accountFilter} onValueChange={setAccountFilter} className="mb-3">
            <TabsList>
              <TabsTrigger value="all">All Accounts</TabsTrigger>
              {accounts.map((acc) => (
                <TabsTrigger key={acc.id} value={String(acc.id)}>
                  {acc.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={accountFilter} className="mt-3">
              {activePositions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No positions yet. Go to{" "}
                  <Link href="/settings" className="text-primary hover:underline">
                    Settings
                  </Link>{" "}
                  to add instruments and transactions.
                </div>
              ) : (
                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <SortableHead label="Instrument" sortKey="name" currentSort={sort} onSort={handleSort} />
                        <TableHead className="w-20"></TableHead>
                        <SortableHead label="Value" sortKey="value" currentSort={sort} onSort={handleSort} align="right" />
                        <SortableHead label="Day" sortKey="dayChange" currentSort={sort} onSort={handleSort} align="right" />
                        <SortableHead label="Total P/L" sortKey="unrealizedGainLoss" currentSort={sort} onSort={handleSort} align="right" />
                        <SortableHead label="Weight" sortKey="weight" currentSort={sort} onSort={handleSort} align="right" />
                        <TableHead>Account</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedActivePositions.map((p, i) => {
                        const gainPct =
                          p.costBasis > 0
                            ? (p.unrealizedGainLoss / p.costBasis) * 100
                            : 0;
                        return (
                          <TableRow
                            key={i}
                            className="transition-colors duration-100 hover:bg-white/[0.02]"
                          >
                            <TableCell className="py-2.5 px-3">
                              <InstrumentBadge instrument={p.instrument} position={p}>
                                <div>
                                  <div className="font-medium text-sm flex items-center gap-1.5">
                                    {pulseIsins.has(p.instrument.isin) && (
                                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                    )}
                                    {p.instrument.ticker || p.instrument.isin}
                                    {p.instrument.currency !== "DKK" && (
                                      <span className="ml-1.5 text-xs text-muted-foreground">
                                        {p.instrument.currency}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {p.instrument.name}
                                  </div>
                                </div>
                              </InstrumentBadge>
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              {p.instrument.yahooSymbol && (
                                <Sparkline
                                  symbol={p.instrument.yahooSymbol}
                                  className="h-7 w-20"
                                />
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-3 tabular-nums font-mono text-sm">
                              {p.currentValue !== null ? formatDKK(p.currentValue) : "—"}
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-3">
                              {p.dayChange !== null && p.dayChangePercent !== null ? (
                                <div className={cn("tabular-nums font-mono text-sm", gainLossColor(p.dayChange))}>
                                  <div>{p.dayChange >= 0 ? "+" : ""}{formatDKK(p.dayChange)}</div>
                                  <div className="text-xs">{formatPercent(p.dayChangePercent)}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-3">
                              {p.currentValue !== null ? (
                                <div className={cn("tabular-nums font-mono text-sm", gainLossColor(p.unrealizedGainLoss))}>
                                  <div>{formatDKK(p.unrealizedGainLoss)}</div>
                                  <div className="text-xs">({formatPercent(gainPct)})</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right py-2.5 px-3 tabular-nums font-mono text-sm text-muted-foreground">
                              {portfolioWeight(p.currentValue ?? 0, totalValue)}
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              <Badge variant="outline" className="text-xs">
                                {p.accountName}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Closed Positions */}
          {closedPositions.length > 0 && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground gap-1 px-0"
                onClick={() => setShowClosed((v) => !v)}
              >
                {showClosed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Closed Positions ({closedPositions.length})
              </Button>
              {showClosed && (
                <div className="rounded-lg border bg-card mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Instrument</TableHead>
                        <TableHead className="text-right">Realized P/L</TableHead>
                        <TableHead>Account</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedPositions.map((p, i) => (
                        <TableRow
                          key={i}
                          className="transition-colors duration-100 hover:bg-white/[0.02]"
                        >
                          <TableCell className="py-2.5 px-3">
                            <InstrumentBadge instrument={p.instrument} position={p}>
                              <div>
                                <div className="font-medium text-sm">
                                  {p.instrument.ticker || p.instrument.isin}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {p.instrument.name}
                                </div>
                              </div>
                            </InstrumentBadge>
                          </TableCell>
                          <TableCell className="text-right py-2.5 px-3">
                            <span className={cn("tabular-nums font-mono text-sm", gainLossColor(p.realizedGainLoss))}>
                              {formatDKK(p.realizedGainLoss)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <Badge variant="outline" className="text-xs">
                              {p.accountName}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
