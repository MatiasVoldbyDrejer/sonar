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

function replaceInstrumentTokens(content: string): string {
  return content.replace(
    /\{\{([^}|]+)\|([A-Z0-9]{12})\}\}/g,
    (_match, ticker, isin) => `[${ticker}](inst://${isin})`
  );
}

function buildIdentifierMap(
  instruments: Instrument[]
): Map<string, Instrument> {
  const map = new Map<string, Instrument>();
  for (const inst of instruments) {
    if (inst.isin) map.set(inst.isin.toUpperCase(), inst);
    if (inst.ticker && inst.ticker.length >= 2)
      map.set(inst.ticker.toUpperCase(), inst);
    if (
      inst.yahooSymbol &&
      inst.yahooSymbol.length >= 2 &&
      inst.yahooSymbol !== inst.ticker
    ) {
      map.set(inst.yahooSymbol.toUpperCase(), inst);
    }
  }
  return map;
}

function annotateInstruments(
  content: string,
  identifierMap: Map<string, Instrument>
): string {
  if (identifierMap.size === 0) return content;

  const patterns = [...identifierMap.keys()];
  patterns.sort((a, b) => b.length - a.length);

  const escaped = patterns.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(
    `(?<=^|[\\s(,*_])(?:${escaped.join("|")})(?=[\\s),.:;!?*_\\]]|$)`,
    "gi"
  );

  const protectedPattern =
    /(\[(?:[^\]]*)\]\([^)]*\)|`[^`]*`|```[\s\S]*?```)/g;
  const segments = content.split(protectedPattern);

  return segments
    .map((segment, i) => {
      if (i % 2 === 1) return segment;

      return segment.replace(regex, (match) => {
        const inst = identifierMap.get(match.toUpperCase());
        if (!inst) return match;
        return `[${match}](inst://${inst.isin})`;
      });
    })
    .join("");
}

function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (node && typeof node === "object" && "props" in node) {
    return getTextContent((node as any).props.children);
  }
  return "";
}

export function MarkdownContent({
  content,
  citations,
  instruments,
}: MarkdownContentProps) {
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

  processedContent = replaceInstrumentTokens(processedContent);

  const identifierMap = instruments
    ? buildIdentifierMap(instruments)
    : new Map<string, Instrument>();

  if (instruments && instruments.length > 0) {
    processedContent = annotateInstruments(processedContent, identifierMap);
  }

  const instrumentByIsin = instruments
    ? new Map(instruments.map((i) => [i.isin, i]))
    : new Map<string, Instrument>();

  const components: Components = {
    a: ({ href, children, ...props }) => {
      if (href?.startsWith("inst://")) {
        const isin = href.slice(7);
        const inst = instrumentByIsin.get(isin);
        if (inst) {
          return <InstrumentBadge instrument={inst} />;
        }
        return <>{children}</>;
      }

      const text = getTextContent(children).trim();
      if (text) {
        const inst = identifierMap.get(text.toUpperCase());
        if (inst) {
          return <InstrumentBadge instrument={inst} />;
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
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--muted-foreground)",
              marginBottom: 8,
            }}
          >
            Sources
          </p>
          <ol
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {citations.map((url, i) => (
              <li key={i}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "var(--primary)",
                    wordBreak: "break-all",
                  }}
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
