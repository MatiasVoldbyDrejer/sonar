"use client";

import { MarkdownContent } from "@/components/markdown-content";
import { BarChart3, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function ChatMessage({ role, content, agent, citations, isStreaming, instruments }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="border-l-2 border-primary pl-4 py-1">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  const config = agent ? agentConfig[agent] : agentConfig["portfolio-analyst"];
  const Icon = config.icon;

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {config.label}
        </span>
      </div>
      <div className={cn("border-t border-border pt-3")}>
        {content ? (
          <div className={isStreaming ? "blink-cursor" : undefined}>
            <MarkdownContent content={content} citations={citations} instruments={instruments} />
          </div>
        ) : (
          <span className="blink-cursor text-sm text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
