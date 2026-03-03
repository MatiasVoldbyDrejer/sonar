"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronRight } from "lucide-react";
import type { Position, Account, Transaction } from "@/types";
import Link from "next/link";
import { formatAmount, formatPercent, portfolioWeight } from "@/lib/utils";
import { fadeIn } from "@/lib/motion";
import { AnimatedNumber } from "@/components/animated-number";
import { Sparkline } from "@/components/sparkline";
import { DashboardSkeleton } from "@/components/skeleton-shimmer";
import { PortfolioPulse } from "@/components/portfolio-pulse";
import { PortfolioChart } from "@/components/portfolio-chart";
import { InstrumentBadge } from "@/components/instrument-badge";

type SortKey = 'name' | 'value' | 'dayChange' | 'unrealizedGainLoss' | 'weight';

function glColor(value: number): string {
  if (value > 0) return "var(--gain)";
  if (value < 0) return "var(--loss)";
  return "var(--muted-foreground)";
}

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
    <TableHead style={align === 'right' ? { textAlign: 'right' } : undefined}>
      <button
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          transition: "color 0.15s",
          marginTop: -4,
          marginBottom: -4,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
          ...(align === 'right' ? { flexDirection: "row-reverse", marginLeft: "auto" } : {}),
        }}
        data-hover="sort-btn"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon
          style={{
            height: 12,
            width: 12,
            flexShrink: 0,
            color: isActive ? "var(--foreground)" : "color-mix(in srgb, var(--muted-foreground) 50%, transparent)",
          }}
        />
      </button>
    </TableHead>
  );
}

function mergePositionsByInstrument(positions: Position[]): Position[] {
  const byIsin = new Map<string, Position[]>();
  for (const p of positions) {
    const key = p.instrument.isin;
    if (!byIsin.has(key)) byIsin.set(key, []);
    byIsin.get(key)!.push(p);
  }
  const merged: Position[] = [];
  for (const group of byIsin.values()) {
    if (group.length === 1) {
      merged.push(group[0]);
      continue;
    }
    merged.push({
      instrument: group[0].instrument,
      accountId: 0,
      accountName: group.map((p) => p.accountName).join(", "),
      quantity: group.reduce((s, p) => s + p.quantity, 0),
      costBasis: group.reduce((s, p) => s + p.costBasis, 0),
      averagePrice: 0,
      realizedGainLoss: group.reduce((s, p) => s + p.realizedGainLoss, 0),
      unrealizedGainLoss: group.reduce((s, p) => s + p.unrealizedGainLoss, 0),
      totalDividends: group.reduce((s, p) => s + p.totalDividends, 0),
      currentPrice: group[0].currentPrice,
      currentValue: group.reduce((s, p) => s + (p.currentValue ?? 0), 0),
      dayChange: group.some((p) => p.dayChange !== null)
        ? group.reduce((s, p) => s + (p.dayChange ?? 0), 0)
        : null,
      dayChangePercent: group[0].dayChangePercent,
      reportingCurrency: group[0].reportingCurrency,
    });
  }
  return merged;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState("all");
  const [pulseIsins, setPulseIsins] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' });
  const [showClosed, setShowClosed] = useState(false);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [posRes, accRes, txRes] = await Promise.all([
        fetch("/api/positions"),
        fetch("/api/accounts"),
        fetch("/api/transactions"),
      ]);
      const posData = await posRes.json();
      const accData = await accRes.json();
      const txData = await txRes.json();
      setPositions(Array.isArray(posData) ? posData : []);
      setAccounts(Array.isArray(accData) ? accData : []);
      setTransactions(Array.isArray(txData) ? txData : []);
    } catch {
      // silently handle
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Wallet sync — runs once on mount, then every 5 minutes
  const walletSyncRef = useRef(false);
  const syncWallets = useCallback(async () => {
    try {
      await fetch("/api/wallet/sync", { method: "POST" });
    } catch {
      // silently handle — wallet sync is best-effort
    }
  }, []);

  useEffect(() => {
    fetchData(true);
    // Initial wallet sync (once)
    if (!walletSyncRef.current) {
      walletSyncRef.current = true;
      syncWallets().then(() => fetchData(false));
    }
    const interval = setInterval(() => fetchData(false), 60_000);
    const walletInterval = setInterval(() => {
      syncWallets().then(() => fetchData(false));
    }, 5 * 60_000); // sync wallets every 5 min
    return () => {
      clearInterval(interval);
      clearInterval(walletInterval);
    };
  }, [fetchData, syncWallets]);

  const allActivePositions = positions.filter((p) => p.quantity > 0);

  const filteredPositions =
    accountFilter === "all"
      ? positions
      : positions.filter((p) => p.accountId === Number(accountFilter));

  const activePositions = useMemo(() => {
    const active = filteredPositions.filter((p) => p.quantity > 0);
    return accountFilter === "all" ? mergePositionsByInstrument(active) : active;
  }, [filteredPositions, accountFilter]);

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
  const totalDividends = positions.reduce((sum, p) => sum + (p.totalDividends ?? 0), 0);
  const reportingCurrency = positions[0]?.reportingCurrency ?? 'DKK';

  const sortedActivePositions = useMemo(
    () => sortPositions(activePositions, sort, totalValue),
    [activePositions, sort, totalValue]
  );

  const closedPositions = useMemo(() => {
    const closed = filteredPositions.filter((p) => p.quantity === 0 && p.realizedGainLoss !== 0);
    return accountFilter === "all" ? mergePositionsByInstrument(closed) : closed;
  }, [filteredPositions, accountFilter]);

  const instrumentLookup = useMemo(() => {
    const lookup: Record<number, string> = {};
    for (const p of positions) {
      lookup[p.instrument.id] = p.instrument.ticker || p.instrument.name;
    }
    return lookup;
  }, [positions]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.div style={{ display: "flex", flexDirection: "column", gap: 24 }} {...fadeIn}>
      {/* Hero Section */}
      {allActivePositions.length > 0 ? (
        <div>
          <p style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: 4,
          }}>
            Portfolio
          </p>
          <AnimatedNumber
            value={totalValue}
            currency={reportingCurrency}
            style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.025em", fontVariantNumeric: "tabular-nums" }}
          />
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
            <span style={{ fontSize: 18, fontVariantNumeric: "tabular-nums", color: glColor(totalGainLoss) }}>
              {formatAmount(totalGainLoss, reportingCurrency)} ({formatPercent(totalPct)})
            </span>
            {totalDayChange !== 0 && (
              <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", color: glColor(totalDayChange) }}>
                Today {totalDayChange >= 0 ? "+" : ""}{formatAmount(totalDayChange, reportingCurrency)}
              </span>
            )}
          </div>
          {(totalRealized !== 0 || totalDividends > 0) && (
            <p style={{ fontSize: 12, marginTop: 4 }}>
              {totalRealized !== 0 && (
                <>
                  <span style={{ color: "var(--muted-foreground)" }}>Realized </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: glColor(totalRealized) }}>
                    {formatAmount(totalRealized, reportingCurrency)}
                  </span>
                </>
              )}
              {totalDividends > 0 && (
                <>
                  {totalRealized !== 0 && <span style={{ color: "var(--muted-foreground)" }}> · </span>}
                  <span style={{ color: "var(--muted-foreground)" }}>Dividends </span>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--gain)" }}>
                    {formatAmount(totalDividends, reportingCurrency)}
                  </span>
                </>
              )}
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
            Cost basis {formatAmount(totalCost, reportingCurrency)} · {allActivePositions.length} holding{allActivePositions.length !== 1 ? "s" : ""}
          </p>
        </div>
      ) : (
        <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: "center", color: "var(--muted-foreground)" }}>
          No positions yet. Go to{" "}
          <Link href="/settings" style={{ color: "var(--primary)", textDecoration: "none" }}>
            Settings
          </Link>{" "}
          to add instruments and transactions.
        </div>
      )}

      {/* Portfolio Chart */}
      {allActivePositions.length > 0 && (
        <PortfolioChart transactions={transactions} instrumentLookup={instrumentLookup} />
      )}

      {/* Portfolio Pulse */}
      {allActivePositions.length > 0 && (
        <PortfolioPulse onItemsLoaded={(isins) => setPulseIsins(new Set(isins))} />
      )}

      {/* Holdings Table */}
      {positions.some((p) => p.quantity > 0) && (
        <div>
          <Tabs value={accountFilter} onValueChange={setAccountFilter} style={{ marginBottom: 12 }}>
            <TabsList>
              <TabsTrigger value="all">All Accounts</TabsTrigger>
              {accounts.map((acc) => (
                <TabsTrigger key={acc.id} value={String(acc.id)}>
                  {acc.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={accountFilter} style={{ marginTop: 12 }}>
              {activePositions.length === 0 ? (
                <div style={{ paddingTop: 32, paddingBottom: 32, textAlign: "center", color: "var(--muted-foreground)" }}>
                  No positions yet. Go to{" "}
                  <Link href="/settings" style={{ color: "var(--primary)", textDecoration: "none" }}>
                    Settings
                  </Link>{" "}
                  to add instruments and transactions.
                </div>
              ) : (
                <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--card)" }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHead label="Instrument" sortKey="name" currentSort={sort} onSort={handleSort} />
                        <TableHead style={{ width: 80 }}></TableHead>
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
                          <TableRow key={i} data-hover="table-row">
                            <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              <InstrumentBadge instrument={p.instrument} position={p} align="top">
                                <div>
                                  <div style={{ fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                                    {pulseIsins.has(p.instrument.isin) && (
                                      <span style={{
                                        height: 6,
                                        width: 6,
                                        borderRadius: "50%",
                                        background: "var(--primary)",
                                        flexShrink: 0,
                                        display: "inline-block",
                                      }} />
                                    )}
                                    {p.instrument.ticker || p.instrument.isin}
                                    {p.instrument.currency !== reportingCurrency && (
                                      <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted-foreground)" }}>
                                        {p.instrument.currency}
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                                    {p.instrument.name}
                                  </div>
                                </div>
                              </InstrumentBadge>
                            </TableCell>
                            <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              {p.instrument.yahooSymbol && (
                                <Sparkline
                                  symbol={p.instrument.yahooSymbol}
                                  style={{ height: 28, width: 80 }}
                                />
                              )}
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14 }}>
                              {p.currentValue !== null ? formatAmount(p.currentValue, reportingCurrency) : "\u2014"}
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              {p.dayChange !== null && p.dayChangePercent !== null ? (
                                <div style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: glColor(p.dayChange) }}>
                                  <div>{p.dayChange >= 0 ? "+" : ""}{formatAmount(p.dayChange, reportingCurrency)}</div>
                                  <div style={{ fontSize: 12 }}>{formatPercent(p.dayChangePercent)}</div>
                                </div>
                              ) : (
                                <span style={{ color: "var(--muted-foreground)" }}>{"\u2014"}</span>
                              )}
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              {p.currentValue !== null ? (
                                <div style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: glColor(p.unrealizedGainLoss) }}>
                                  <div>{formatAmount(p.unrealizedGainLoss, reportingCurrency)}</div>
                                  <div style={{ fontSize: 12 }}>({formatPercent(gainPct)})</div>
                                </div>
                              ) : (
                                <span style={{ color: "var(--muted-foreground)" }}>{"\u2014"}</span>
                              )}
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--muted-foreground)" }}>
                              {portfolioWeight(p.currentValue ?? 0, totalValue)}
                            </TableCell>
                            <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                {p.accountName.split(", ").map((name) => (
                                  <Badge key={name} variant="outline">
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    {(() => {
                      const tabValue = activePositions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
                      const tabDay = activePositions.reduce((s, p) => s + (p.dayChange ?? 0), 0);
                      const tabDayPct = tabValue > 0 ? activePositions.reduce((s, p) => s + ((p.dayChangePercent ?? 0) * (p.currentValue ?? 0)), 0) / tabValue : 0;
                      const tabGL = activePositions.reduce((s, p) => s + p.unrealizedGainLoss, 0);
                      const tabCost = activePositions.reduce((s, p) => s + p.costBasis, 0);
                      const tabGLPct = tabCost > 0 ? (tabGL / tabCost) * 100 : 0;
                      return (
                        <TableFooter>
                          <TableRow style={{ fontWeight: 600 }}>
                            <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, fontSize: 14 }}>Total</TableCell>
                            <TableCell />
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14 }}>
                              {formatAmount(tabValue, reportingCurrency)}
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              <div style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: glColor(tabDay) }}>
                                <div>{tabDay >= 0 ? "+" : ""}{formatAmount(tabDay, reportingCurrency)}</div>
                                <div style={{ fontSize: 12 }}>{formatPercent(tabDayPct)}</div>
                              </div>
                            </TableCell>
                            <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                              <div style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: glColor(tabGL) }}>
                                <div>{formatAmount(tabGL, reportingCurrency)}</div>
                                <div style={{ fontSize: 12 }}>({formatPercent(tabGLPct)})</div>
                              </div>
                            </TableCell>
                            <TableCell />
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      );
                    })()}
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Closed Positions */}
          {closedPositions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClosed((v) => !v)}
              >
                {showClosed ? (
                  <ChevronDown style={{ height: 16, width: 16 }} />
                ) : (
                  <ChevronRight style={{ height: 16, width: 16 }} />
                )}
                Closed Positions ({closedPositions.length})
              </Button>
              {showClosed && (
                <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", background: "var(--card)", marginTop: 8 }}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instrument</TableHead>
                        <TableHead style={{ textAlign: "right" }}>Realized P/L</TableHead>
                        <TableHead>Account</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {closedPositions.map((p, i) => (
                        <TableRow key={i} data-hover="table-row">
                          <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                            <InstrumentBadge instrument={p.instrument} position={p} align="top">
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>
                                  {p.instrument.ticker || p.instrument.isin}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted-foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                                  {p.instrument.name}
                                </div>
                              </div>
                            </InstrumentBadge>
                          </TableCell>
                          <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: glColor(p.realizedGainLoss) }}>
                              {formatAmount(p.realizedGainLoss, reportingCurrency)}
                            </span>
                          </TableCell>
                          <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                            <Badge variant="outline">
                              {p.accountName}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow style={{ fontWeight: 600 }}>
                        <TableCell style={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12, fontSize: 14 }}>Total</TableCell>
                        <TableCell style={{ textAlign: "right", paddingTop: 10, paddingBottom: 10, paddingLeft: 12, paddingRight: 12 }}>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontFamily: "var(--font-mono)", fontSize: 14, color: glColor(closedPositions.reduce((s, p) => s + p.realizedGainLoss, 0)) }}>
                            {formatAmount(closedPositions.reduce((s, p) => s + p.realizedGainLoss, 0), reportingCurrency)}
                          </span>
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
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
