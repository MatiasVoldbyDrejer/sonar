"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InstrumentBadge } from "@/components/instrument-badge";
import type { Instrument } from "@/types";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

interface MarkdownContentProps {
  content: string;
  citations?: string[];
  instruments?: Instrument[];
}

/**
 * Replace {{TICKER|ISIN}} tokens (from AI prompt instructions) with
 * markdown link syntax: [TICKER](inst://ISIN)
 */
function replaceInstrumentTokens(content: string): string {
  return content.replace(
    /\{\{([^}|]+)\|([A-Z0-9]{12})\}\}/g,
    (_match, ticker, isin) => `[${ticker}](inst://${isin})`
  );
}

/**
 * Build a lookup map from ticker/ISIN/yahooSymbol → Instrument
 */
function buildIdentifierMap(instruments: Instrument[]): Map<string, Instrument> {
  const map = new Map<string, Instrument>();
  for (const inst of instruments) {
    if (inst.isin) map.set(inst.isin.toUpperCase(), inst);
    if (inst.ticker && inst.ticker.length >= 2) map.set(inst.ticker.toUpperCase(), inst);
    if (inst.yahooSymbol && inst.yahooSymbol.length >= 2 && inst.yahooSymbol !== inst.ticker) {
      map.set(inst.yahooSymbol.toUpperCase(), inst);
    }
  }
  return map;
}

/**
 * Annotate plain-text tickers/ISINs in markdown content by replacing them
 * with custom link syntax: [AAPL](inst://US0378331005).
 * Skips text inside existing markdown links or code blocks.
 */
function annotateInstruments(content: string, identifierMap: Map<string, Instrument>): string {
  if (identifierMap.size === 0) return content;

  const patterns = [...identifierMap.keys()];
  patterns.sort((a, b) => b.length - a.length);

  const escaped = patterns.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?<=^|[\\s(,*_])(?:${escaped.join("|")})(?=[\\s),.:;!?*_\\]]|$)`, "gi");

  // Don't replace inside existing markdown links or code blocks
  const protectedPattern = /(\[(?:[^\]]*)\]\([^)]*\)|`[^`]*`|```[\s\S]*?```)/g;
  const segments = content.split(protectedPattern);

  return segments
    .map((segment, i) => {
      // Odd indices are protected (links, code) — leave them alone
      if (i % 2 === 1) return segment;

      return segment.replace(regex, (match) => {
        const inst = identifierMap.get(match.toUpperCase());
        if (!inst) return match;
        return `[${match}](inst://${inst.isin})`;
      });
    })
    .join("");
}

/**
 * Extract plain text content from React children (for matching link text
 * against known tickers).
 */
function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node && typeof node === "object" && "props" in node) {
    return getTextContent((node as any).props.children);
  }
  return "";
}

export function MarkdownContent({ content, citations, instruments }: MarkdownContentProps) {
  // Replace citation references [1], [2] etc. with links
  let processedContent = content;
  if (citations && citations.length > 0) {
    citations.forEach((url, index) => {
      const ref = `[${index + 1}]`;
      processedContent = processedContent.replaceAll(
        ref,
        `[\\[${index + 1}\\]](${url})`
      );
    });
  }

  // Replace {{TICKER|ISIN}} tokens with inst:// links
  processedContent = replaceInstrumentTokens(processedContent);

  // Build identifier lookup (ticker/ISIN/yahooSymbol → Instrument)
  const identifierMap = instruments ? buildIdentifierMap(instruments) : new Map<string, Instrument>();

  // Annotate remaining plain-text tickers with inst:// links
  if (instruments && instruments.length > 0) {
    processedContent = annotateInstruments(processedContent, identifierMap);
  }

  // Build ISIN-only lookup for inst:// link rendering
  const instrumentByIsin = instruments
    ? new Map(instruments.map((i) => [i.isin, i]))
    : new Map<string, Instrument>();

  const components: Components = {
    a: ({ href, children, ...props }) => {
      // Explicit inst:// links (from token replacement or text annotation)
      if (href?.startsWith("inst://")) {
        const isin = href.slice(7);
        const inst = instrumentByIsin.get(isin);
        if (inst) {
          return (
            <InstrumentBadge instrument={inst} className="text-primary" />
          );
        }
        // Unknown ISIN — render as plain text, not a broken link
        return <>{children}</>;
      }

      // Check if the link text matches a known ticker/ISIN
      // (catches AI-generated links like [AAPL](https://finance.yahoo.com/...))
      const text = getTextContent(children).trim();
      if (text) {
        const inst = identifierMap.get(text.toUpperCase());
        if (inst) {
          return (
            <InstrumentBadge instrument={inst} className="text-primary" />
          );
        }
      }

      return (
        <a href={href} {...props}>
          {children}
        </a>
      );
    },
  };

  return (
    <div className="prose prose-sm prose-invert max-w-none prose-a:text-primary prose-a:no-underline hover:prose-a:underline">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processedContent}
      </ReactMarkdown>
      {citations && citations.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Sources
          </p>
          <ol className="text-xs text-muted-foreground space-y-1">
            {citations.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {url}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
