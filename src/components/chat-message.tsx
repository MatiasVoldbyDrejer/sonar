"use client";

import { MarkdownContent } from "@/components/markdown-content";
import { Activity, Loader2 } from "lucide-react";
import type { Instrument } from "@/types";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  isStreaming?: boolean;
  isResearching?: boolean;
  instruments?: Instrument[];
}

export function ChatMessage({
  role,
  content,
  citations,
  isStreaming,
  isResearching,
  instruments,
}: ChatMessageProps) {
  if (role === "user") {
    return (
      <div
        style={{
          borderLeft: "2px solid var(--primary)",
          paddingLeft: 16,
          padding: "4px 0 4px 16px",
        }}
      >
        <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{content}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 0" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <Activity
          style={{
            width: 14,
            height: 14,
            color: "var(--muted-foreground)",
          }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--muted-foreground)",
          }}
        >
          SONAR
        </span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        {isResearching && !content && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--muted-foreground)",
            }}
          >
            <Loader2
              style={{
                width: 14,
                height: 14,
                animation: "spin 1s linear infinite",
              }}
            />
            Researching...
          </div>
        )}
        {content ? (
          <div className={isStreaming ? "blink-cursor" : undefined}>
            <MarkdownContent
              content={content}
              citations={citations}
              instruments={instruments}
            />
          </div>
        ) : !isResearching ? (
          <span
            className="blink-cursor"
            style={{ fontSize: 14, color: "var(--muted-foreground)" }}
          />
        ) : null}
      </div>
    </div>
  );
}
