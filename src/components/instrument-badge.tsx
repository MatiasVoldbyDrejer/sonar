"use client";

import { useState } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { PositionHoverContent } from "@/components/position-hover-content";
import { usePositionLookup } from "@/hooks/use-position-lookup";
import Link from "next/link";
import type { Position } from "@/types";
import type { ReactNode } from "react";

function getLogoUrl(symbol: string | null | undefined): string | undefined {
  if (!symbol) return undefined;
  return `https://assets.parqet.com/logos/symbol/${symbol}`;
}

function getInitials(name: string, ticker?: string | null): string {
  if (ticker) return ticker.slice(0, 2);
  const words = name.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface InstrumentBadgeProps {
  instrument: {
    isin: string;
    yahooSymbol?: string | null;
    ticker?: string | null;
    name: string;
    type?: string;
    currency?: string;
  };
  position?: Position;
  showName?: boolean;
  linked?: boolean;
  size?: "sm" | "lg";
  children?: ReactNode;
}

const sizes = {
  sm: { avatar: 18, text: 9 },
  lg: { avatar: 32, text: 11 },
};

export function InstrumentBadge({
  instrument,
  position,
  showName = true,
  linked = true,
  size = "sm",
  children,
}: InstrumentBadgeProps) {
  const { getPositions } = usePositionLookup();
  const positions = position ? [position] : getPositions(instrument.isin);

  const s = sizes[size];
  const logoUrl = getLogoUrl(instrument.yahooSymbol);
  const [imgFailed, setImgFailed] = useState(false);

  const logo = (
    <span
      style={{
        width: s.avatar,
        height: s.avatar,
        flexShrink: 0,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.2)",
        background: !logoUrl || imgFailed ? "var(--muted)" : "#000",
      }}
    >
      {logoUrl && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={instrument.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          style={{
            fontSize: s.text,
            fontWeight: 500,
            color: "var(--muted-foreground)",
          }}
        >
          {getInitials(instrument.name, instrument.ticker)}
        </span>
      )}
    </span>
  );

  const defaultLabel = showName ? (
    <span>{instrument.ticker || instrument.name}</span>
  ) : null;

  const content = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        verticalAlign: "middle",
        marginBottom: 3,
      }}
    >
      {logo}
      {children ?? defaultLabel}
    </span>
  );

  const wrappedContent = linked ? (
    <Link
      href={`/instrument/${instrument.isin}`}
      style={{ textDecoration: "none" }}
    >
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{wrappedContent}</HoverCardTrigger>
      <HoverCardContent style={{ width: 288 }} side="top" align="start">
        <PositionHoverContent instrument={instrument} positions={positions} />
      </HoverCardContent>
    </HoverCard>
  );
}
