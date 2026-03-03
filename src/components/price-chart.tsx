"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer } from "recharts";
import type { ChartDataPoint } from "@/types";

const periods = [
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
];

const chartConfig = {
  close: {
    label: "Price",
    color: "var(--primary)",
  },
};

export function PriceChart({
  symbol,
  currency,
}: {
  symbol: string;
  currency: string;
}) {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState("1y");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/chart/${encodeURIComponent(symbol)}?period=${period}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  return (
    <Card>
      <CardHeader
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <CardTitle
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.025em",
          }}
        >
          Price Chart
        </CardTitle>
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
      </CardHeader>
      <CardContent>
        <div
          style={{ opacity: loading ? 0.5 : 1, transition: "opacity 200ms" }}
        >
          {data.length === 0 && !loading ? (
            <div
              style={{
                height: 400,
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
              style={{ height: 400, width: "100%" }}
            >
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
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
                        currency,
                        notation: "compact",
                      }).format(val)
                    }
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    width={65}
                    domain={["auto", "auto"]}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          new Intl.NumberFormat("da-DK", {
                            style: "currency",
                            currency,
                          }).format(value as number)
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke="var(--primary)"
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                    strokeWidth={1.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
