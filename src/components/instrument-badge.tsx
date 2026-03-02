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
import { cn } from "@/lib/utils";
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
  className?: string;
  children?: ReactNode;
}

export function InstrumentBadge({
  instrument,
  position,
  showName = true,
  linked = true,
  size = "sm",
  className,
  children,
}: InstrumentBadgeProps) {
  const { getPositions } = usePositionLookup();
  const positions = position ? [position] : getPositions(instrument.isin);

  const avatarSize = size === "lg" ? "size-8" : "size-[18px]";
  const textSize = size === "lg" ? "text-[11px]" : "text-[9px]";
  const logoUrl = getLogoUrl(instrument.yahooSymbol);
  const [imgFailed, setImgFailed] = useState(false);

  const logo = (
    <span
      className={cn(
        avatarSize,
        "shrink-0 rounded-full overflow-hidden inline-flex items-center justify-center",
        "ring-1 ring-white/20 ring-offset-muted",
        !logoUrl || imgFailed ? "bg-muted" : "bg-black"
      )}
    >
      {logoUrl && !imgFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={instrument.name}
          className="size-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className={cn(textSize, "font-medium text-muted-foreground")}>
          {getInitials(instrument.name, instrument.ticker)}
        </span>
      )}
    </span>
  );

  const defaultLabel = showName ? (
    <span>{instrument.ticker || instrument.name}</span>
  ) : null;

  const content = (
    <span className={cn("inline-flex items-center gap-1 align-middle mb-[3px]", className)}>
      {logo}
      {children ?? defaultLabel}
    </span>
  );

  const wrappedContent = linked ? (
    <Link href={`/instrument/${instrument.isin}`} className="hover:underline">
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>{wrappedContent}</HoverCardTrigger>
      <HoverCardContent className="w-72" side="top" align="start">
        <PositionHoverContent instrument={instrument} positions={positions} />
      </HoverCardContent>
    </HoverCard>
  );
}
