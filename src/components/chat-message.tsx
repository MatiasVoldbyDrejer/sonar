"use client";

import { MarkdownContent } from "@/components/markdown-content";
import { BarChart3, Briefcase } from "lucide-react";
import type { AgentType, Instrument } from "@/types";

const agentConfig = {
  "market-analyst": {
    label: "MARKET ANALYST",
    icon: BarChart3,
  },
  "portfolio-analyst": {
    label: "PORTFOLIO ANALYST",
    icon: Briefcase,
  },
} as const;

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  agent?: AgentType;
  citations?: string[];
  isStreaming?: boolean;
  instruments?: Instrument[];
}

export function ChatMessage({
  role,
  content,
  agent,
  citations,
  isStreaming,
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

  const config = agent
    ? agentConfig[agent]
    : agentConfig["portfolio-analyst"];
  const Icon = config.icon;

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
        <Icon
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
          {config.label}
        </span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        {content ? (
          <div className={isStreaming ? "blink-cursor" : undefined}>
            <MarkdownContent
              content={content}
              citations={citations}
              instruments={instruments}
            />
          </div>
        ) : (
          <span
            className="blink-cursor"
            style={{ fontSize: 14, color: "var(--muted-foreground)" }}
          />
        )}
      </div>
    </div>
  );
}
