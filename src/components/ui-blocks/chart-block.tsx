"use client";

import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;
  close: number;
}

interface Annotation {
  value: number;
  label: string;
  type: "support" | "resistance" | "target";
}

interface ChartBlockData {
  title: string;
  currency: string;
  dataPoints: DataPoint[];
  annotations?: Annotation[];
}

const chartConfig = {
  close: {
    label: "Price",
    color: "var(--primary)",
  },
};

const annotationColors: Record<Annotation["type"], string> = {
  support: "var(--gain)",
  resistance: "var(--loss)",
  target: "var(--primary)",
};

function formatCurrencyValue(value: number, currency: string) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency }).format(
    value
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltipContent({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: DataPoint }>;
  currency: string;
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
        minWidth: 140,
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
        {formatCurrencyValue(point.close, currency)}
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function ChartBlock({ data }: { data: any }) {
  const { title, currency, dataPoints, annotations } = data as ChartBlockData;

  if (!dataPoints?.length) {
    return (
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "16px 20px",
          color: "var(--muted-foreground)",
          fontSize: 13,
        }}
      >
        No chart data available
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 20px 0",
          fontSize: 13,
          fontWeight: 500,
          color: "var(--muted-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.025em",
        }}
      >
        {title}
      </div>
      <div style={{ padding: "8px 8px 12px" }}>
        <ChartContainer
          config={chartConfig}
          style={{ height: 280, width: "100%" }}
        >
          <ResponsiveContainer>
            <AreaChart data={dataPoints}>
              <defs>
                <linearGradient
                  id="colorChartBlock"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
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
                content={<ChartTooltipContent currency={currency} />}
              />
              {annotations?.map((ann, i) => (
                <ReferenceLine
                  key={i}
                  y={ann.value}
                  stroke={annotationColors[ann.type]}
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `${ann.label} (${formatCurrencyValue(ann.value, currency)})`,
                    position: "insideTopRight",
                    fill: annotationColors[ann.type],
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="close"
                stroke="var(--primary)"
                fillOpacity={1}
                fill="url(#colorChartBlock)"
                strokeWidth={1.5}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--primary)",
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </div>
  );
}
