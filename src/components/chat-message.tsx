"use client";

import { MarkdownContent } from "@/components/markdown-content";
import { Activity, Check, Loader2 } from "lucide-react";
import type { Instrument } from "@/types";

interface ActiveTool {
  id: string;
  name: string;
  done: boolean;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  isStreaming?: boolean;
  isResearching?: boolean;
  activeTools?: ActiveTool[];
  instruments?: Instrument[];
}

function formatToolName(name: string): string {
  const map: Record<string, string> = {
    research: "Researching...",
    get_quote: "Fetching quote...",
    get_holdings: "Loading holdings...",
    get_portfolio_analysis: "Analyzing portfolio...",
    get_chart: "Loading chart data...",
    get_transactions: "Loading transactions...",
    search_instrument: "Searching instruments...",
    get_portfolio_performance: "Calculating performance...",
    get_fx_rate: "Converting currency...",
    get_fund_holdings: "Loading fund holdings...",
    save_memory: "Saving preference...",
    delete_memory: "Removing preference...",
    create_recurring_task: "Creating task...",
    toggle_recurring_task: "Updating task...",
    list_recurring_tasks: "Loading tasks...",
  };
  return map[name] || `Running ${name.replace(/_/g, " ")}...`;
}

export function ChatMessage({
  role,
  content,
  citations,
  isStreaming,
  isResearching,
  activeTools,
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
        {activeTools && activeTools.length > 0 && !content && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {activeTools.map((tool) => (
              <div
                key={tool.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                }}
              >
                {tool.done ? (
                  <Check style={{ width: 14, height: 14, color: "var(--primary)" }} />
                ) : (
                  <Loader2
                    style={{
                      width: 14,
                      height: 14,
                      animation: "spin 1s linear infinite",
                    }}
                  />
                )}
                {formatToolName(tool.name)}
              </div>
            ))}
          </div>
        )}
        {isResearching && !content && (!activeTools || activeTools.length === 0) && (
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
