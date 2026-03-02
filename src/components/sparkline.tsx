"use client";

import { useEffect, useState, useRef } from "react";

interface SparklineProps {
  symbol: string;
  className?: string;
}

export function Sparkline({ symbol, className }: SparklineProps) {
  const [points, setPoints] = useState<number[] | null>(null);
  const [inView, setInView] = useState(false);
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "100px" }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !symbol) return;
    fetch(`/api/chart/${encodeURIComponent(symbol)}?period=1m`)
      .then((r) => r.json())
      .then((data: Array<{ close: number }>) => {
        if (Array.isArray(data)) setPoints(data.map((d) => d.close));
      })
      .catch(() => {});
  }, [inView, symbol]);

  if (!points || points.length < 2) {
    return <svg ref={ref} viewBox="0 0 80 28" className={className} />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = 80 / (points.length - 1);

  const polyline = points
    .map((v, i) => `${(i * step).toFixed(1)},${(28 - ((v - min) / range) * 24 - 2).toFixed(1)}`)
    .join(" ");

  const isGain = points[points.length - 1] >= points[0];

  return (
    <svg ref={ref} viewBox="0 0 80 28" className={className}>
      <polyline
        points={polyline}
        fill="none"
        stroke={isGain ? "var(--gain)" : "var(--loss)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
