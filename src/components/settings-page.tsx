"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { Instrument, Account, Transaction } from "@/types";
import { EditInstrumentForm } from "@/components/edit-instrument-form";
import { InstrumentBadge } from "@/components/instrument-badge";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function SettingsPage() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [instRes, accRes, txRes] = await Promise.all([
        fetch("/api/instruments"),
        fetch("/api/accounts"),
        fetch("/api/transactions"),
      ]);
      setInstruments(await instRes.json());
      setAccounts(await accRes.json());
      setTransactions(await txRes.json());
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.025em" }}>Settings</h1>
      <Tabs defaultValue="instruments">
        <TabsList>
          <TabsTrigger value="instruments">Instruments</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="instruments" style={{ marginTop: 16 }}>
          <InstrumentsTab
            instruments={instruments}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="transactions" style={{ marginTop: 16 }}>
          <TransactionsTab
            transactions={transactions}
            instruments={instruments}
            accounts={accounts}
            onRefresh={fetchData}
          />
        </TabsContent>

        <TabsContent value="import" style={{ marginTop: 16 }}>
          <ImportTab accounts={accounts} onRefresh={fetchData} />
        </TabsContent>

        <TabsContent value="accounts" style={{ marginTop: 16 }}>
          <AccountsTab accounts={accounts} onRefresh={fetchData} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Instruments Tab ──────────────────────────────────────────────────

function InstrumentsTab({
  instruments,
  onRefresh,
}: {
  instruments: Instrument[];
  onRefresh: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);

  return (
    <Card>
      <CardHeader style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CardTitle>Instruments</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Instrument</Button>
          </DialogTrigger>
          <DialogContent style={{ maxWidth: 512 }}>
            <DialogHeader>
              <DialogTitle>Add Instrument</DialogTitle>
            </DialogHeader>
            <AddInstrumentForm
              onSuccess={() => {
                setDialogOpen(false);
                onRefresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {instruments.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)", textAlign: "center", paddingTop: 16, paddingBottom: 16 }}>
            No instruments. Add one to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ISIN</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Yahoo Symbol</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instruments.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell style={{ fontWeight: 500 }}>
                    <InstrumentBadge instrument={inst} linked={false}>
                      {inst.name}
                    </InstrumentBadge>
                  </TableCell>
                  <TableCell style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.75rem" }}>{inst.isin}</TableCell>
                  <TableCell>{inst.ticker || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{inst.type}</Badge>
                  </TableCell>
                  <TableCell>{inst.currency}</TableCell>
                  <TableCell style={{ fontSize: "0.75rem" }}>
                    {inst.yahooSymbol ? (
                      <span style={{ color: "var(--muted-foreground)" }}>{inst.yahooSymbol}</span>
                    ) : (
                      <span style={{ color: "rgba(234, 179, 8, 0.8)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle style={{ height: 12, width: 12 }} />
                        Missing
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingInstrument(inst)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: "var(--destructive)" }}
                        onClick={async () => {
                          const res = await fetch(`/api/instruments/${inst.id}`, {
                            method: "DELETE",
                          });
                          if (res.ok) {
                            toast.success("Instrument deleted");
                            onRefresh();
                          } else {
                            const data = await res.json();
                            toast.error(data.error || "Failed to delete");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Edit Instrument Dialog */}
      <Dialog open={!!editingInstrument} onOpenChange={(open) => !open && setEditingInstrument(null)}>
        <DialogContent style={{ maxWidth: 512 }}>
          <DialogHeader>
            <DialogTitle>Edit Instrument</DialogTitle>
          </DialogHeader>
          {editingInstrument && (
            <EditInstrumentForm
              instrument={editingInstrument}
              onSuccess={() => {
                setEditingInstrument(null);
                onRefresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Add Instrument Form ──────────────────────────────────────────────

function AddInstrumentForm({ onSuccess }: { onSuccess: () => void }) {
  const [isin, setIsin] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [type, setType] = useState<string>("stock");
  const [currency, setCurrency] = useState("DKK");
  const [yahooSymbol, setYahooSymbol] = useState("");
  const [exchange, setExchange] = useState("");
  const [resolving, setResolving] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; exchange: string; type: string }>
  >([]);

  const resolveIsin = async () => {
    if (!isin || isin.length !== 12) {
      toast.error("Please enter a valid 12-character ISIN");
      return;
    }
    setResolving(true);
    try {
      const res = await fetch("/api/instruments/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isin }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        toast.info("No results found. Enter details manually.");
      }
    } catch {
      toast.error("Resolution failed");
    } finally {
      setResolving(false);
    }
  };

  const selectResult = (result: {
    symbol: string;
    name: string;
    exchange: string;
  }) => {
    setYahooSymbol(result.symbol);
    if (!name) setName(result.name);
    if (result.exchange) setExchange(result.exchange);
    setSearchResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isin,
          yahooSymbol: yahooSymbol || null,
          ticker: ticker || null,
          name,
          type,
          currency,
          exchange: exchange || null,
        }),
      });
      if (res.ok) {
        toast.success("Instrument added");
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add instrument");
      }
    } catch {
      toast.error("Failed to add instrument");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Label htmlFor="isin">ISIN</Label>
          <Input
            id="isin"
            value={isin}
            onChange={(e) => setIsin(e.target.value.toUpperCase())}
            placeholder="e.g. US0378331005"
            maxLength={12}
            required
          />
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <Button
            type="button"
            variant="outline"
            onClick={resolveIsin}
            disabled={resolving}
          >
            {resolving ? "..." : "Resolve"}
          </Button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 8, display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--muted-foreground)", marginBottom: 4 }}>
            Select a match:
          </p>
          {searchResults.map((r, i) => (
            <button
              key={i}
              type="button"
              style={{ width: "100%", textAlign: "left", paddingLeft: 8, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: "var(--radius-md)", fontSize: "0.875rem", background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}
              data-hover="search-result"
              onClick={() => selectResult(r)}
            >
              <span style={{ fontWeight: 500 }}>{r.symbol}</span>
              <span style={{ color: "var(--muted-foreground)", marginLeft: 8 }}>{r.name}</span>
              <span style={{ color: "var(--muted-foreground)", marginLeft: 8, fontSize: "0.75rem" }}>
                {r.exchange}
              </span>
            </button>
          ))}
        </div>
      )}

      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Apple Inc."
          required
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Label htmlFor="ticker">Ticker</Label>
          <Input
            id="ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
          />
        </div>
        <div>
          <Label htmlFor="yahoo-symbol">Yahoo Symbol</Label>
          <Input
            id="yahoo-symbol"
            value={yahooSymbol}
            onChange={(e) => setYahooSymbol(e.target.value)}
            placeholder="e.g. AAPL"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stock">Stock</SelectItem>
              <SelectItem value="fund">Fund</SelectItem>
              <SelectItem value="etf">ETF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="DKK"
            maxLength={3}
            required
          />
        </div>
        <div>
          <Label htmlFor="exchange">Exchange</Label>
          <Input
            id="exchange"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            placeholder="e.g. NASDAQ"
          />
        </div>
      </div>

      <Button type="submit" style={{ width: "100%" }}>
        Add Instrument
      </Button>
    </form>
  );
}

// ─── Transactions Tab ──────────────────────────────────────────────────

function TransactionsTab({
  transactions,
  instruments,
  accounts,
  onRefresh,
}: {
  transactions: Transaction[];
  instruments: Instrument[];
  accounts: Account[];
  onRefresh: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const instMap = new Map(instruments.map((i) => [i.id, i]));
  const accMap = new Map(accounts.map((a) => [a.id, a]));

  return (
    <Card>
      <CardHeader style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <CardTitle>Transactions</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">Add Transaction</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
            </DialogHeader>
            <AddTransactionForm
              instruments={instruments}
              accounts={accounts}
              onSuccess={() => {
                setDialogOpen(false);
                onRefresh();
              }}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p style={{ color: "var(--muted-foreground)", textAlign: "center", paddingTop: 16, paddingBottom: 16 }}>
            No transactions. Add one or import from CSV/XLSX.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead>Type</TableHead>
                <TableHead style={{ textAlign: "right" }}>Qty</TableHead>
                <TableHead style={{ textAlign: "right" }}>Price</TableHead>
                <TableHead style={{ textAlign: "right" }}>Fee</TableHead>
                <TableHead>Account</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                const inst = instMap.get(tx.instrumentId);
                const acc = accMap.get(tx.accountId);
                return (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell>
                      {inst ? (
                        <InstrumentBadge instrument={inst} linked={false}>
                          {inst.ticker || inst.name}
                        </InstrumentBadge>
                      ) : (
                        String(tx.instrumentId)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "buy" ? "default" : "secondary"}>
                        {tx.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      {tx.quantity.toFixed(tx.quantity % 1 === 0 ? 0 : 4)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      {inst
                        ? formatCurrency(tx.price, inst.currency)
                        : tx.price.toFixed(2)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      {tx.fee > 0
                        ? tx.fee.toFixed(2)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {acc?.name || tx.accountId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: "var(--destructive)" }}
                        onClick={async () => {
                          const res = await fetch(
                            `/api/transactions/${tx.id}`,
                            { method: "DELETE" }
                          );
                          if (res.ok) {
                            toast.success("Transaction deleted");
                            onRefresh();
                          } else {
                            toast.error("Failed to delete");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Transaction Form ──────────────────────────────────────────────

function AddTransactionForm({
  instruments,
  accounts,
  onSuccess,
}: {
  instruments: Instrument[];
  accounts: Account[];
  onSuccess: () => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [instrumentId, setInstrumentId] = useState("");
  const [type, setType] = useState("buy");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [fee, setFee] = useState("0");
  const [feeCurrency, setFeeCurrency] = useState("");
  const [notes, setNotes] = useState("");

  const selectedInstrument = instruments.find((i) => String(i.id) === instrumentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: Number(accountId),
          instrumentId: Number(instrumentId),
          type,
          date,
          quantity: Number(quantity),
          price: Number(price),
          fee: Number(fee),
          feeCurrency: feeCurrency || selectedInstrument?.currency || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        toast.success("Transaction added");
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add transaction");
      }
    } catch {
      toast.error("Failed to add transaction");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Label>Account</Label>
        <Select value={accountId} onValueChange={setAccountId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={String(acc.id)}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Instrument</Label>
        <Select value={instrumentId} onValueChange={setInstrumentId} required>
          <SelectTrigger>
            <SelectValue placeholder="Select instrument" />
          </SelectTrigger>
          <SelectContent>
            {instruments.map((inst) => (
              <SelectItem key={inst.id} value={String(inst.id)}>
                {inst.ticker || inst.isin} — {inst.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="price">Price per unit</Label>
          <Input
            id="price"
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ gridColumn: "span 2" }}>
          <Label htmlFor="fee">Fee</Label>
          <Input
            id="fee"
            type="number"
            step="any"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="fee-currency">Fee Currency</Label>
          <Input
            id="fee-currency"
            value={feeCurrency || selectedInstrument?.currency || ""}
            onChange={(e) => setFeeCurrency(e.target.value.toUpperCase())}
            placeholder={selectedInstrument?.currency || "DKK"}
            maxLength={3}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <Button type="submit" style={{ width: "100%" }}>
        Add Transaction
      </Button>
    </form>
  );
}

// ─── Import Tab ──────────────────────────────────────────────────

interface PreviewTx {
  date: string;
  type: string;
  isin: string;
  name: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
}

function ImportTab({
  accounts,
  onRefresh,
}: {
  accounts: Account[];
  onRefresh: () => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewTx[] | null>(null);
  const [importing, setImporting] = useState(false);

  const handlePreview = async () => {
    if (!file || !accountId) {
      toast.error("Select an account and file first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    formData.append("action", "preview");

    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setPreview(data.transactions);
        toast.success(`${data.count} transactions parsed`);
      } else {
        toast.error(data.error || "Parse failed");
      }
    } catch {
      toast.error("Failed to parse file");
    }
  };

  const handleCommit = async () => {
    if (!file || !accountId) return;
    setImporting(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    formData.append("action", "commit");

    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          `${data.imported} imported${data.skipped ? `, ${data.skipped} duplicates skipped` : ''}`
        );
        setPreview(null);
        setFile(null);
        onRefresh();
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Transactions</CardTitle>
      </CardHeader>
      <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
          Import transaction history from Nordnet (CSV) or Saxo Invest (XLSX).
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="import-file">File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Button
            onClick={handlePreview}
            variant="outline"
            disabled={!file || !accountId}
          >
            Preview
          </Button>
          {preview && (
            <Button onClick={handleCommit} disabled={importing}>
              {importing
                ? "Importing..."
                : `Import ${preview.length} Transactions`}
            </Button>
          )}
        </div>

        {preview && preview.length > 0 && (
          <div style={{ maxHeight: 384, overflow: "auto" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>ISIN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Qty</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Price</TableHead>
                  <TableHead style={{ textAlign: "right" }}>Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((tx, i) => (
                  <TableRow key={i}>
                    <TableCell>{tx.date}</TableCell>
                    <TableCell>
                      <Badge variant={tx.type === "buy" ? "default" : "secondary"}>
                        {tx.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: "0.75rem" }}>
                      {tx.isin}
                    </TableCell>
                    <TableCell>{tx.name}</TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      {tx.quantity.toFixed(2)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      {tx.price.toFixed(2)}
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      {tx.fee.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Accounts Tab ──────────────────────────────────────────────────

function AccountsTab({
  accounts,
  onRefresh,
  loading,
}: {
  accounts: Account[];
  onRefresh: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("nordnet");

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, broker }),
      });
      if (res.ok) {
        toast.success("Account added");
        setName("");
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add");
      }
    } catch {
      toast.error("Failed to add account");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts</CardTitle>
      </CardHeader>
      <CardContent style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loading ? (
          <p style={{ color: "var(--muted-foreground)" }}>Loading...</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Broker</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc.id}>
                  <TableCell style={{ fontWeight: 500 }}>{acc.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{acc.broker}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Label htmlFor="acc-name">Account Name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Nordnet"
              required
            />
          </div>
          <div>
            <Label>Broker</Label>
            <Select value={broker} onValueChange={setBroker}>
              <SelectTrigger style={{ width: 128 }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nordnet">Nordnet</SelectItem>
                <SelectItem value="saxo">Saxo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Add</Button>
        </form>
      </CardContent>
    </Card>
  );
}
