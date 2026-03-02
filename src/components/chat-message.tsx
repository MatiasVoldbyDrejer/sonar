"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownContent } from "@/components/markdown-content";
import { BarChart3, Briefcase, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentType } from "@/types";

const agentConfig = {
  "market-analyst": {
    label: "Market Analyst",
    icon: BarChart3,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    fallback: "MA",
  },
  "portfolio-analyst": {
    label: "Portfolio Analyst",
    icon: Briefcase,
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    fallback: "PA",
  },
} as const;

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  agent?: AgentType;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, agent, isStreaming }: ChatMessageProps) {
  if (role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        </div>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  const config = agent ? agentConfig[agent] : agentConfig["portfolio-analyst"];
  const Icon = config.icon;

  return (
    <div className="flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={config.color}>
          <Icon className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground mb-1">
          {config.label}
        </p>
        <div className={cn(
          "rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5",
          isStreaming && "animate-pulse"
        )}>
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <p className="text-sm text-muted-foreground">Thinking...</p>
          )}
        </div>
      </div>
    </div>
  );
}
