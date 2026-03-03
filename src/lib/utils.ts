import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function gainLossColor(value: number): string {
  if (value > 0) return "text-gain"
  if (value < 0) return "text-loss"
  return "text-muted-foreground"
}

export function portfolioWeight(value: number, total: number): string {
  if (total <= 0) return "0.0%"
  return `${((value / total) * 100).toFixed(1)}%`
}

export function formatAmount(value: number, currency = "DKK"): string {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

/** @deprecated Use formatAmount instead */
export const formatDKK = (value: number) => formatAmount(value, "DKK");

export function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}
