"use client";

import { useEffect, useState, useMemo } from "react";
import { formatDKK } from "@/lib/utils";
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { Transaction, ChartDataPointWithTrades, TradeMarker } from "@/types";

const periods = [
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
];

const chartConfig = {
  close: {
    label: "Value",
    color: "var(--primary)",
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function TradeDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.trades?.length) return null;

  const dominantType = payload.trades[payload.trades.length - 1].type;
  const color = dominantType === "buy" ? "var(--gain)" : "var(--loss)";

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke="var(--background)"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
      />
      {payload.trades.length > 1 && (
        <text
          x={cx}
          y={cy + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={8}
          fontWeight={700}
          fill="var(--background)"
        >
          {payload.trades.length}
        </text>
      )}
    </g>
  );
}

function TradeActiveDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.trades?.length) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill="var(--primary)"
        stroke="var(--background)"
        strokeWidth={2}
      />
    );
  }

  const dominantType = payload.trades[payload.trades.length - 1].type;
  const color = dominantType === "buy" ? "var(--gain)" : "var(--loss)";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill={color}
      stroke="var(--background)"
      strokeWidth={2}
      style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }}
    />
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function PortfolioChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPointWithTrades }>;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div
      style={{
        background: "var(--popover)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: "8px 12px",
        fontSize: 13,
        minWidth: 160,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      <div
        style={{
          color: "var(--muted-foreground)",
          fontSize: 11,
          marginBottom: 4,
        }}
      >
        {new Date(point.date).toLocaleDateString("da-DK", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </div>
      <div style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
        {formatDKK(point.close)}
      </div>

      {point.trades && point.trades.length > 0 && (
        <>
          <div
            style={{
              borderTop: "1px solid var(--border)",
              margin: "6px 0",
            }}
          />
          {point.trades.map((trade, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: i > 0 ? 4 : 0,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background:
                    trade.type === "buy" ? "var(--gain)" : "var(--loss)",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontWeight: 500, textTransform: "uppercase" }}>
                {trade.type}
              </span>
              {trade.instrumentName && (
                <span style={{ color: "var(--foreground)" }}>
                  {trade.instrumentName}
                </span>
              )}
              <span
                style={{
                  color: "var(--muted-foreground)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ×{trade.quantity.toFixed(trade.quantity % 1 === 0 ? 0 : 4)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function PortfolioChart({
  transactions,
  instrumentLookup,
}: {
  transactions?: Transaction[];
  instrumentLookup?: Record<number, string>;
}) {
  const [data, setData] = useState<ChartDataPointWithTrades[]>([]);
  const [period, setPeriod] = useState("1y");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/portfolio/chart?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [period]);

  const chartData = useMemo(() => {
    if (!transactions?.length || !data.length) return data;

    const txByDate = new Map<string, TradeMarker[]>();
    for (const tx of transactions) {
      const markers = txByDate.get(tx.date) || [];
      markers.push({
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price,
        fee: tx.fee,
        feeCurrency: tx.feeCurrency,
        date: tx.date,
        instrumentName: instrumentLookup?.[tx.instrumentId],
      });
      txByDate.set(tx.date, markers);
    }

    const chartDates = data.map((d) => d.date);

    function snapToChart(dateStr: string): string | null {
      const target = new Date(dateStr).getTime();
      let bestDate: string | null = null;
      let bestDist = Infinity;
      for (const cd of chartDates) {
        const dist = Math.abs(new Date(cd).getTime() - target);
        if (dist < bestDist) {
          bestDist = dist;
          bestDate = cd;
        }
      }
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      return bestDist <= sevenDays ? bestDate : null;
    }

    const snappedTrades = new Map<string, TradeMarker[]>();
    for (const [date, trades] of txByDate) {
      const snapped = chartDates.includes(date) ? date : snapToChart(date);
      if (!snapped) continue;
      const existing = snappedTrades.get(snapped) || [];
      existing.push(...trades);
      snappedTrades.set(snapped, existing);
    }

    return data.map((point) => {
      const trades = snappedTrades.get(point.date);
      return trades ? { ...point, trades } : point;
    });
  }, [data, transactions, instrumentLookup]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.025em",
          }}
        >
          Performance
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          {periods.map((p) => (
            <button
              key={p.value}
              style={{
                height: 28,
                padding: "0 10px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: "var(--radius-md)",
                border: "none",
                cursor: "pointer",
                transition: "color 150ms, background 150ms",
                background:
                  period === p.value ? "var(--primary)" : "transparent",
                color:
                  period === p.value
                    ? "var(--primary-foreground)"
                    : "var(--muted-foreground)",
              }}
              {...(period !== p.value ? { "data-hover": "period-btn" } : {})}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 200ms" }}>
        {data.length === 0 && !loading ? (
          <div
            style={{
              height: 300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted-foreground)",
            }}
          >
            No chart data available
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            style={{ height: 300, width: "100%" }}
          >
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--primary)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return d.toLocaleDateString("da-DK", {
                      month: "short",
                      year: period === "5y" ? "2-digit" : undefined,
                    });
                  }}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  tickFormatter={(val) =>
                    new Intl.NumberFormat("da-DK", {
                      style: "currency",
                      currency: "DKK",
                      notation: "compact",
                    }).format(val)
                  }
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={80}
                  domain={["auto", "auto"]}
                />
                <ChartTooltip
                  content={<PortfolioChartTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="var(--primary)"
                  fillOpacity={1}
                  fill="url(#colorPortfolio)"
                  strokeWidth={1.5}
                  dot={<TradeDot />}
                  activeDot={<TradeActiveDot />}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
