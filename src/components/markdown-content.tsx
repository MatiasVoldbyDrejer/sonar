"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { InstrumentBadge } from "@/components/instrument-badge";
import type { Instrument } from "@/types";
import type { Components } from "react-markdown";

interface MarkdownContentProps {
  content: string;
  citations?: string[];
  instruments?: Instrument[];
}

/**
 * Build a regex that matches known tickers and ISINs in text.
 * Patterns are sorted longest-first to avoid partial matches.
 * Tickers >= 3 chars are case-insensitive; 2-char tickers are case-sensitive.
 */
function buildInstrumentMap(instruments: Instrument[]): {
  regex: RegExp;
  lookup: Map<string, Instrument>;
} {
  const lookup = new Map<string, Instrument>();
  const patterns: string[] = [];

  for (const inst of instruments) {
    // Always match ISIN (12 chars, very specific)
    if (inst.isin && !lookup.has(inst.isin.toUpperCase())) {
      lookup.set(inst.isin.toUpperCase(), inst);
      patterns.push(inst.isin);
    }

    // Match ticker if >= 2 chars
    if (inst.ticker && inst.ticker.length >= 2 && !lookup.has(inst.ticker.toUpperCase())) {
      lookup.set(inst.ticker.toUpperCase(), inst);
      patterns.push(inst.ticker);
    }

    // Match Yahoo symbol if different from ticker and >= 2 chars
    if (
      inst.yahooSymbol &&
      inst.yahooSymbol.length >= 2 &&
      inst.yahooSymbol.toUpperCase() !== inst.ticker?.toUpperCase() &&
      !lookup.has(inst.yahooSymbol.toUpperCase())
    ) {
      lookup.set(inst.yahooSymbol.toUpperCase(), inst);
      patterns.push(inst.yahooSymbol);
    }
  }

  if (patterns.length === 0) {
    return { regex: /(?!)/g, lookup }; // never-matching regex
  }

  // Sort longest first
  patterns.sort((a, b) => b.length - a.length);

  // Escape special regex characters and join with |
  const escaped = patterns.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(?<=^|[\\s(,])(?:${escaped.join("|")})(?=[\\s),.:;!?]|$)`, "gi");

  return { regex, lookup };
}

/**
 * Annotate markdown content by replacing known tickers/ISINs with
 * custom link syntax: [AAPL](inst://US0378331005)
 */
function annotateInstruments(
  content: string,
  instruments: Instrument[]
): string {
  if (instruments.length === 0) return content;

  const { regex, lookup } = buildInstrumentMap(instruments);

  // Don't replace inside existing markdown links [text](url) or code blocks
  // Split content by markdown link patterns and code blocks to protect them
  const protectedPattern = /(\[(?:[^\]]*)\]\([^)]*\)|`[^`]*`|```[\s\S]*?```)/g;
  const segments = content.split(protectedPattern);

  return segments
    .map((segment, i) => {
      // Odd indices are protected patterns (links, code) — leave them alone
      if (i % 2 === 1) return segment;

      return segment.replace(regex, (match) => {
        const inst = lookup.get(match.toUpperCase());
        if (!inst) return match;
        return `[${match}](inst://${inst.isin})`;
      });
    })
    .join("");
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

  // Annotate instrument references
  if (instruments && instruments.length > 0) {
    processedContent = annotateInstruments(processedContent, instruments);
  }

  // Build instrument lookup for the custom link renderer
  const instrumentByIsin = instruments
    ? new Map(instruments.map((i) => [i.isin, i]))
    : new Map<string, Instrument>();

  const components: Components = {
    a: ({ href, children, ...props }) => {
      if (href?.startsWith("inst://")) {
        const isin = href.slice(7);
        const inst = instrumentByIsin.get(isin);
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
