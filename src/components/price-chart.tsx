"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Price Chart
        </CardTitle>
        <div className="flex gap-1">
          {periods.map((p) => (
            <button
              key={p.value}
              className={cn(
                "h-7 px-2.5 text-xs font-medium rounded-md transition-colors duration-150",
                period === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
              )}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("transition-opacity duration-200", loading && "opacity-50")}>
          {data.length === 0 && !loading ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              No chart data available
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
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
