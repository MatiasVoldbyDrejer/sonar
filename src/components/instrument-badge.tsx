"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const avatarSize = size === "lg" ? "h-8 w-8" : "h-5 w-5";
  const textSize = size === "lg" ? "text-[11px]" : "text-[9px]";

  const logo = (
    <Avatar className={cn(avatarSize, "shrink-0")}>
      <AvatarImage src={getLogoUrl(instrument.yahooSymbol)} alt={instrument.name} />
      <AvatarFallback className={cn(textSize, "font-medium bg-muted")}>
        {getInitials(instrument.name, instrument.ticker)}
      </AvatarFallback>
    </Avatar>
  );

  const defaultLabel = showName ? (
    <span>{instrument.ticker || instrument.name}</span>
  ) : null;

  const content = (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
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
