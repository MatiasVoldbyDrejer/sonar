"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Position, Account } from "@/types";
import Link from "next/link";

function formatDKK(value: number): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function Dashboard() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountFilter, setAccountFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresh quotes every 60 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredPositions =
    accountFilter === "all"
      ? positions
      : positions.filter((p) => p.accountId === Number(accountFilter));

  const activePositions = filteredPositions.filter((p) => p.quantity > 0);

  // Single DKK portfolio summary
  const totalValue = activePositions.reduce((sum, p) => sum + (p.currentValue ?? 0), 0);
  const totalCost = activePositions.reduce((sum, p) => sum + p.costBasis, 0);
  const totalGainLoss = activePositions.reduce((sum, p) => sum + p.unrealizedGainLoss, 0);
  const totalPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Summary Card */}
      {activePositions.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Portfolio
            </CardTitle>
            <Badge variant={totalGainLoss >= 0 ? "default" : "destructive"}>
              {formatPercent(totalPct)}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDKK(totalValue)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Cost basis: {formatDKK(totalCost)}
              {" · "}
              {activePositions.length} holding{activePositions.length !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>
      ) : !loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No positions yet. Go to{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>{" "}
            to add instruments and transactions.
          </CardContent>
        </Card>
      ) : null}

      {/* Holdings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={accountFilter}
            onValueChange={setAccountFilter}
            className="mb-4"
          >
            <TabsList>
              <TabsTrigger value="all">All Accounts</TabsTrigger>
              {accounts.map((acc) => (
                <TabsTrigger key={acc.id} value={String(acc.id)}>
                  {acc.name}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={accountFilter} className="mt-4">
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading positions...
                </div>
              ) : activePositions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No active positions.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Instrument</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Avg Price</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Gain/Loss</TableHead>
                      <TableHead>Account</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePositions.map((p, i) => {
                      const gainPct =
                        p.costBasis > 0
                          ? (p.unrealizedGainLoss / p.costBasis) * 100
                          : 0;
                      return (
                        <TableRow key={i}>
                          <TableCell>
                            <Link
                              href={`/instrument/${p.instrument.isin}`}
                              className="hover:underline"
                            >
                              <div className="font-medium">
                                {p.instrument.ticker || p.instrument.isin}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.instrument.name}
                                {p.instrument.currency !== "DKK" && (
                                  <span className="ml-1 text-muted-foreground/60">
                                    ({p.instrument.currency})
                                  </span>
                                )}
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            {p.quantity.toFixed(p.quantity % 1 === 0 ? 0 : 4)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatDKK(p.averagePrice)}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.currentPrice !== null
                              ? formatDKK(p.currentPrice)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.currentValue !== null
                              ? formatDKK(p.currentValue)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                p.unrealizedGainLoss >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {p.currentValue !== null
                                ? `${formatDKK(
                                    p.unrealizedGainLoss
                                  )} (${formatPercent(gainPct)})`
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{p.accountName}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
