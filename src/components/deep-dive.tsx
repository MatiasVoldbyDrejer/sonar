"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { formatDKK, formatPercent } from "@/lib/utils";
import { fadeIn } from "@/lib/motion";
import { AnimatedNumber } from "@/components/animated-number";
import { DeepDiveSkeleton } from "@/components/skeleton-shimmer";
import type { DeepDiveData, AllocationSlice } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(65% 0.15 280)",
  "oklch(70% 0.12 60)",
  "oklch(60% 0.14 330)",
];

const tabs = [
  { key: "sector" as const, label: "Sector" },
  { key: "industry" as const, label: "Industry" },
  { key: "country" as const, label: "Geography" },
];

const stagger = { animate: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] as const },
};

function glColor(value: number): string {
  if (value > 0) return "var(--gain)";
  if (value < 0) return "var(--loss)";
  return "var(--muted-foreground)";
}

function scoreColor(s: number): string {
  if (s < 25) return "var(--loss)";
  if (s < 50) return "var(--chart-3)";
  if (s < 75) return "var(--chart-2)";
  return "var(--gain)";
}

// --- Summary Stats ---

function SummaryStats({ data }: { data: DeepDiveData }) {
  const stats = [
    { label: "Cost Basis", value: formatDKK(data.totalCostBasis) },
    { label: "Unrealized P/L", value: formatDKK(data.totalUnrealizedGainLoss), color: glColor(data.totalUnrealizedGainLoss) },
    { label: "Realized P/L", value: formatDKK(data.totalRealizedGainLoss), color: glColor(data.totalRealizedGainLoss) },
    { label: "Top 5 Concentration", value: `${data.top5Concentration.toFixed(1)}%` },
  ];

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {stats.map((stat) => (
        <motion.div
          key={stat.label}
          {...fadeUp}
          style={{
            flex: 1,
            border: "1px solid var(--border)",
            background: "var(--card)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
          }}
        >
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--muted-foreground)",
          }}>
            {stat.label}
          </span>
          <div style={{
            fontSize: 22,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            marginTop: 4,
            color: stat.color ?? "var(--foreground)",
          }}>
            {stat.value}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// --- Top Holdings Bar ---

function TopHoldingsBar({ data }: { data: DeepDiveData }) {
  if (data.topHoldings.length === 0) return null;

  return (
    <motion.div {...fadeUp}>
      {/* Stacked bar */}
      <div style={{
        display: "flex",
        height: 28,
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--muted)",
      }}>
        {data.topHoldings.map((h, i) => (
          <div
            key={h.isin}
            style={{
              width: `${h.weight}%`,
              height: "100%",
              background: CHART_COLORS[i % CHART_COLORS.length],
              transition: "width 0.4s ease",
            }}
            title={`${h.name}: ${h.weight.toFixed(1)}%`}
          />
        ))}
      </div>

      {/* Compact list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10 }}>
        {data.topHoldings.map((h, i) => (
          <div
            key={h.isin}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              fontSize: 13,
            }}
          >
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: CHART_COLORS[i % CHART_COLORS.length],
              flexShrink: 0,
            }} />
            <span style={{
              flex: 1,
              color: "var(--foreground)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {h.name}
            </span>
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--foreground)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 44,
              textAlign: "right",
            }}>
              {h.weight.toFixed(1)}%
            </span>
            <span style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-mono)",
              minWidth: 90,
              textAlign: "right",
            }}>
              {formatDKK(h.value)}
            </span>
            <span style={{
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-mono)",
              color: glColor(h.unrealizedGainLoss),
              minWidth: 56,
              textAlign: "right",
            }}>
              {formatPercent(h.unrealizedGainLossPercent)}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// --- Diversification Gauge ---

function DiversificationGauge({
  score,
  label,
  diversification,
}: {
  score: number;
  label: string;
  diversification: DeepDiveData["diversification"];
}) {
  const radius = 62;
  const stroke = 10;
  const center = radius + stroke;
  const size = (radius + stroke) * 2;
  const circumference = Math.PI * radius;
  const progress = (score / 100) * circumference;

  const subScores = [
    { label: "Sector", score: Math.max(0, Math.min(100, Math.round(100 - diversification.sectorHHI / 100))) },
    { label: "Industry", score: Math.max(0, Math.min(100, Math.round(100 - diversification.industryHHI / 100))) },
    { label: "Country", score: Math.max(0, Math.min(100, Math.round(100 - diversification.countryHHI / 100))) },
  ];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
    }}>
      <svg
        width={size}
        height={center + 4}
        viewBox={`0 0 ${size} ${center + 4}`}
      >
        <path
          d={`M ${stroke} ${center} A ${radius} ${radius} 0 0 1 ${size - stroke} ${center}`}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${stroke} ${center} A ${radius} ${radius} 0 0 1 ${size - stroke} ${center}`}
          fill="none"
          stroke={scoreColor(score)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s ease-out, stroke 0.4s ease" }}
        />
        <text
          x={center}
          y={center - 12}
          textAnchor="middle"
          style={{
            fontSize: 32,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            fontFamily: "var(--font-mono)",
            fill: "var(--foreground)",
          }}
        >
          {score}
        </text>
        <text
          x={center}
          y={center + 10}
          textAnchor="middle"
          style={{ fontSize: 12, fill: scoreColor(score), fontWeight: 500 }}
        >
          {label}
        </text>
      </svg>

      {/* Sub-score breakdown */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
        {subScores.map((sub) => (
          <div key={sub.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              width: 56,
              flexShrink: 0,
            }}>
              {sub.label}
            </span>
            <div style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: "var(--muted)",
              overflow: "hidden",
            }}>
              <div style={{
                width: `${sub.score}%`,
                height: "100%",
                borderRadius: 2,
                background: scoreColor(sub.score),
                transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: scoreColor(sub.score),
              width: 24,
              textAlign: "right",
            }}>
              {sub.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Active shape for donut hover ---

function renderActiveShape(props: any) {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill,
    payload, percent,
  } = props;

  return (
    <g>
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <text
        x={cx} y={cy - 14}
        textAnchor="middle"
        style={{ fontSize: 14, fontWeight: 600, fill: "var(--foreground)" }}
      >
        {payload.name}
      </text>
      <text
        x={cx} y={cy + 6}
        textAnchor="middle"
        style={{ fontSize: 12, fill: "var(--muted-foreground)" }}
      >
        {(percent * 100).toFixed(1)}%
      </text>
      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", fill: "var(--muted-foreground)" }}
      >
        {formatDKK(payload.value)}
      </text>
    </g>
  );
}

// --- Donut center content when not hovered ---

function DonutCenterText({ slices, tabLabel, totalValue }: { slices: AllocationSlice[]; tabLabel: string; totalValue: number }) {
  return (
    <g>
      <text
        x="50%" y="46%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fill: "var(--muted-foreground)",
        }}
      >
        {slices.length} {tabLabel.toLowerCase()}{slices.length !== 1 ? "s" : ""}
      </text>
      <text
        x="50%" y="57%"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontSize: 18,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          fill: "var(--foreground)",
        }}
      >
        {formatDKK(totalValue)}
      </text>
    </g>
  );
}

// --- Allocation Donut ---

function AllocationDonut({
  slices,
  activeIndex,
  onHover,
  tabLabel,
  totalValue,
}: {
  slices: AllocationSlice[];
  activeIndex: number | undefined;
  onHover: (index: number | undefined) => void;
  tabLabel: string;
  totalValue: number;
}) {
  const data = slices.map((s) => ({ name: s.name, value: s.value }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          dataKey="value"
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          onMouseEnter={(_, index) => onHover(index)}
          onMouseLeave={() => onHover(undefined)}
          strokeWidth={2}
          stroke="var(--background)"
        >
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        {activeIndex === undefined && (
          <DonutCenterText slices={slices} tabLabel={tabLabel} totalValue={totalValue} />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}

// --- Allocation List ---

function AllocationList({
  slices,
  activeIndex,
  onHover,
}: {
  slices: AllocationSlice[];
  activeIndex: number | undefined;
  onHover: (index: number | undefined) => void;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {slices.map((slice, i) => {
        const isActive = activeIndex === i;
        const isExpanded = expandedIndex === i;
        return (
          <div key={slice.name}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: isActive ? "var(--background-quiet-color)" : "transparent",
                transition: "background 100ms",
              }}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(undefined)}
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              {/* Color dot */}
              <div style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: CHART_COLORS[i % CHART_COLORS.length],
                flexShrink: 0,
              }} />
              {/* Name */}
              <span style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 500,
                color: "var(--foreground)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {slice.name}
              </span>
              {/* Percentage */}
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--foreground)",
                fontVariantNumeric: "tabular-nums",
                minWidth: 50,
                textAlign: "right",
              }}>
                {slice.percentage.toFixed(1)}%
              </span>
              {/* Bar */}
              <div style={{
                width: 80,
                height: 6,
                borderRadius: 3,
                background: "var(--muted)",
                flexShrink: 0,
                overflow: "hidden",
              }}>
                <div style={{
                  width: `${Math.min(slice.percentage, 100)}%`,
                  height: "100%",
                  borderRadius: 3,
                  background: CHART_COLORS[i % CHART_COLORS.length],
                  transition: "width 0.4s ease",
                }} />
              </div>
              {/* Value */}
              <span style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "var(--font-mono)",
                minWidth: 90,
                textAlign: "right",
              }}>
                {formatDKK(slice.value)}
              </span>
              {/* Unrealized P/L % */}
              <span style={{
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                fontFamily: "var(--font-mono)",
                color: glColor(slice.unrealizedGainLoss),
                minWidth: 56,
                textAlign: "right",
              }}>
                {formatPercent(slice.unrealizedGainLossPercent)}
              </span>
              {/* Chevron */}
              <ChevronRight
                size={16}
                style={{
                  color: "var(--muted-foreground)",
                  flexShrink: 0,
                  transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 150ms",
                }}
              />
            </div>

            {/* Expanded instruments */}
            <AnimatePresence>
              {isExpanded && slice.instruments.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1.0] }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{
                    borderLeft: "2px solid var(--border)",
                    marginLeft: 20,
                    paddingLeft: 16,
                    padding: "4px 0 8px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}>
                    {slice.instruments.map((inst) => (
                      <div
                        key={inst.isin}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "4px 12px",
                          fontSize: 13,
                        }}
                      >
                        <span style={{
                          flex: 1,
                          color: "var(--muted-foreground)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {inst.name}
                        </span>
                        <span style={{
                          color: "var(--muted-foreground)",
                          fontVariantNumeric: "tabular-nums",
                        }}>
                          {inst.percentage.toFixed(1)}%
                        </span>
                        <span style={{
                          color: "var(--muted-foreground)",
                          fontVariantNumeric: "tabular-nums",
                          fontFamily: "var(--font-mono)",
                          minWidth: 90,
                          textAlign: "right",
                        }}>
                          {formatDKK(inst.value)}
                        </span>
                        <span style={{
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                          fontFamily: "var(--font-mono)",
                          color: glColor(inst.unrealizedGainLoss),
                          minWidth: 56,
                          textAlign: "right",
                        }}>
                          {formatPercent(inst.unrealizedGainLossPercent)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// --- Main Component ---

export function DeepDive() {
  const [data, setData] = useState<DeepDiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sector" | "industry" | "country">("sector");
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetch("/api/deepdive")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <DeepDiveSkeleton />;
  if (!data) return <p style={{ color: "var(--muted-foreground)" }}>Failed to load data.</p>;

  const allocationMap = {
    sector: data.sectorAllocation,
    industry: data.industryAllocation,
    country: data.countryAllocation,
  };
  const currentSlices = allocationMap[activeTab];
  const currentTabLabel = tabs.find((t) => t.key === activeTab)?.label ?? activeTab;

  return (
    <motion.div
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
      {...fadeIn}
    >
      <motion.div {...stagger} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
        <motion.div
          {...fadeUp}
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div>
            <p style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}>
              Portfolio Deepdive
            </p>
            <AnimatedNumber
              value={data.totalValue}
              style={{
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                fontVariantNumeric: "tabular-nums",
              }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
              <span style={{
                fontSize: 18,
                fontVariantNumeric: "tabular-nums",
                color: glColor(data.totalUnrealizedGainLoss),
              }}>
                {formatDKK(data.totalUnrealizedGainLoss)} ({formatPercent(data.totalUnrealizedGainLossPercent)})
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
              Cost basis {formatDKK(data.totalCostBasis)} · {data.holdingCount} holding{data.holdingCount !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Diversification Score */}
          <div style={{
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            background: "var(--card)",
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            minWidth: 200,
          }}>
            <span style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--muted-foreground)",
            }}>
              Diversification
            </span>
            <DiversificationGauge
              score={data.diversification.overall}
              label={data.diversification.label}
              diversification={data.diversification}
            />
          </div>
        </motion.div>

        {/* Summary Stats */}
        <SummaryStats data={data} />

        {/* Top Holdings */}
        <TopHoldingsBar data={data} />

        {/* Tab switcher */}
        <motion.div {...fadeUp}>
          <div style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--border)",
            position: "relative",
          }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setActiveIndex(undefined);
                  }}
                  style={{
                    padding: "8px 20px",
                    fontSize: 14,
                    fontWeight: 500,
                    border: "none",
                    background: "transparent",
                    color: active ? "var(--foreground)" : "var(--muted-foreground)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "color 150ms",
                  }}
                >
                  {tab.label}
                  {active && (
                    <motion.div
                      layoutId="tab-indicator"
                      style={{
                        position: "absolute",
                        bottom: -1,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "var(--primary)",
                        borderRadius: 1,
                      }}
                      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Chart + List */}
        <motion.div {...fadeUp}>
          {currentSlices.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "320px 1fr",
              gap: 24,
              alignItems: "start",
            }}>
              <div style={{
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                background: "var(--card)",
                padding: 16,
              }}>
                <AllocationDonut
                  slices={currentSlices}
                  activeIndex={activeIndex}
                  onHover={setActiveIndex}
                  tabLabel={currentTabLabel}
                  totalValue={data.totalValue}
                />
              </div>
              <div style={{
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                background: "var(--card)",
                padding: 8,
              }}>
                <AllocationList
                  slices={currentSlices}
                  activeIndex={activeIndex}
                  onHover={setActiveIndex}
                />
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--muted-foreground)", fontSize: 14 }}>
              No classified positions for this view.
            </p>
          )}
        </motion.div>

        {/* Unclassified */}
        {data.unclassifiedInstruments.length > 0 && (
          <motion.div
            {...fadeUp}
            style={{
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              background: "var(--card)",
              padding: 16,
            }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}>
              <AlertTriangle size={16} style={{ color: "var(--muted-foreground)" }} />
              <h3 style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--muted-foreground)",
              }}>
                Unclassified ({formatDKK(data.unclassifiedValue)})
              </h3>
            </div>
            <p style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginBottom: 12,
              opacity: 0.7,
            }}>
              Classification data unavailable from Yahoo Finance
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.unclassifiedInstruments.map((inst) => (
                <div
                  key={inst.isin}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "4px 0",
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: "var(--foreground)" }}>{inst.name}</span>
                  <span style={{
                    color: "var(--muted-foreground)",
                    fontVariantNumeric: "tabular-nums",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {formatDKK(inst.value)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
