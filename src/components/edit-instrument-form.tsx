"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import type { Instrument } from "@/types";

export function EditInstrumentForm({
  instrument,
  onSuccess,
}: {
  instrument: Instrument;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(instrument.name);
  const [ticker, setTicker] = useState(instrument.ticker || "");
  const [type, setType] = useState<string>(instrument.type);
  const [currency, setCurrency] = useState(instrument.currency);
  const [yahooSymbol, setYahooSymbol] = useState(
    instrument.yahooSymbol || ""
  );
  const [exchange, setExchange] = useState(instrument.exchange || "");
  const [resolving, setResolving] = useState(false);
  const [searchResults, setSearchResults] = useState<
    Array<{ symbol: string; name: string; exchange: string; type: string }>
  >([]);

  const resolveIsin = async () => {
    setResolving(true);
    try {
      const res = await fetch("/api/instruments/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isin: instrument.isin }),
      });
      const data = await res.json();
      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        toast.info("No results found.");
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
      const res = await fetch(`/api/instruments/${instrument.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          yahooSymbol: yahooSymbol || null,
          ticker: ticker || null,
          name,
          type,
          currency,
          exchange: exchange || null,
        }),
      });
      if (res.ok) {
        toast.success("Instrument updated");
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update instrument");
      }
    } catch {
      toast.error("Failed to update instrument");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Label>ISIN</Label>
          <Input
            value={instrument.isin}
            disabled
            style={{ fontFamily: "var(--font-mono)" }}
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
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: 8,
            maxHeight: 160,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 4,
            }}
          >
            Select a match:
          </p>
          {searchResults.map((r, i) => (
            <button
              key={i}
              type="button"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "4px 8px",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
              data-hover="search-result"
              onClick={() => selectResult(r)}
            >
              <span style={{ fontWeight: 500 }}>{r.symbol}</span>
              <span
                style={{ color: "var(--muted-foreground)", marginLeft: 8 }}
              >
                {r.name}
              </span>
              <span
                style={{
                  color: "var(--muted-foreground)",
                  marginLeft: 8,
                  fontSize: 12,
                }}
              >
                {r.exchange}
              </span>
            </button>
          ))}
        </div>
      )}

      <div>
        <Label htmlFor="edit-name">Name</Label>
        <Input
          id="edit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <div>
          <Label htmlFor="edit-ticker">Ticker</Label>
          <Input
            id="edit-ticker"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL"
          />
        </div>
        <div>
          <Label htmlFor="edit-yahoo-symbol">Yahoo Symbol</Label>
          <Input
            id="edit-yahoo-symbol"
            value={yahooSymbol}
            onChange={(e) => setYahooSymbol(e.target.value)}
            placeholder="e.g. AAPL"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
      >
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
              <SelectItem value="crypto">Crypto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="edit-currency">Currency</Label>
          <Input
            id="edit-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-exchange">Exchange</Label>
          <Input
            id="edit-exchange"
            value={exchange}
            onChange={(e) => setExchange(e.target.value)}
            placeholder="e.g. NASDAQ"
          />
        </div>
      </div>

      <Button type="submit" style={{ width: "100%" }}>
        Save Changes
      </Button>
    </form>
  );
}
