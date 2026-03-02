"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage } from "@/components/chat-message";
import { Send } from "lucide-react";
import type { Chat, AgentType, Instrument } from "@/types";

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: { agent?: AgentType; citations?: string[] };
}

const AGENTS: { id: AgentType; label: string }[] = [
  { id: "market-analyst", label: "@market-analyst" },
  { id: "portfolio-analyst", label: "@portfolio-analyst" },
];

function detectAgent(text: string): AgentType | null {
  if (text.includes("@market-analyst")) return "market-analyst";
  if (text.includes("@portfolio-analyst")) return "portfolio-analyst";
  return null;
}

interface ChatViewProps {
  chat: Chat;
}

export function ChatView({ chat }: ChatViewProps) {
  const [currentAgent, setCurrentAgent] = useState<AgentType>("portfolio-analyst");
  const [messages, setMessages] = useState<StoredMessage[]>(chat.messages);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<AgentType | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dailyTriggeredRef = useRef(false);

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Fetch instruments for inline badges in chat
  useEffect(() => {
    fetch("/api/instruments")
      .then((r) => r.json())
      .then((data) => setInstruments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const persistMessages = useCallback(
    (msgs: StoredMessage[]) => {
      fetch(`/api/chats/${chat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
    },
    [chat.id]
  );

  const streamCitationsRef = useRef<string[]>([]);

  const streamResponse = useCallback(
    async (
      apiMessages: Array<{ role: string; content: string }>,
      agent: AgentType,
      signal?: AbortSignal
    ): Promise<{ content: string; citations: string[] }> => {
      setStreamingAgent(agent);
      setStreamingContent("");
      streamCitationsRef.current = [];
      setIsStreaming(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            chatId: chat.id,
            agent,
          }),
          signal,
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let content = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.type === "citations" && parsed.citations) {
                streamCitationsRef.current = parsed.citations;
              }
              if (parsed.type === "text-delta" && parsed.delta) {
                content += parsed.delta;
                setStreamingContent(content);
              }
            } catch {
              // skip
            }
          }
        }

        return { content, citations: streamCitationsRef.current };
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingAgent(null);
      }
    },
    [chat.id]
  );

  // Trigger daily messages on new chat (empty messages)
  const triggerDailyMessages = useCallback(async () => {
    if (dailyTriggeredRef.current || chat.messages.length > 0) return;
    dailyTriggeredRef.current = true;
    setGeneratingDaily(true);

    try {
      // Market analyst
      const marketResult = await streamResponse(
        [{ role: "user", content: "Provide your daily market briefing." }],
        "market-analyst"
      );

      const marketMsg: StoredMessage = {
        id: `msg_market_${Date.now()}`,
        role: "assistant",
        content: marketResult.content,
        metadata: { agent: "market-analyst", citations: marketResult.citations },
      };
      setMessages([marketMsg]);

      // Portfolio analyst
      const portfolioResult = await streamResponse(
        [{ role: "user", content: "Provide your daily portfolio scan." }],
        "portfolio-analyst"
      );

      const portfolioMsg: StoredMessage = {
        id: `msg_portfolio_${Date.now()}`,
        role: "assistant",
        content: portfolioResult.content,
        metadata: { agent: "portfolio-analyst", citations: portfolioResult.citations },
      };

      const allMessages = [marketMsg, portfolioMsg];
      setMessages(allMessages);
      persistMessages(allMessages);
    } catch (err) {
      console.error("Failed to generate daily messages:", err);
    } finally {
      setGeneratingDaily(false);
    }
  }, [chat.messages.length, streamResponse, persistMessages]);

  useEffect(() => {
    triggerDailyMessages();
  }, [triggerDailyMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming || generatingDaily) return;

    const mentioned = detectAgent(inputValue);
    const agent = mentioned ?? currentAgent;
    if (mentioned) setCurrentAgent(mentioned);

    const userMsg: StoredMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: inputValue,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");
    setShowMentionMenu(false);

    const apiMessages = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current = new AbortController();

    try {
      const result = await streamResponse(apiMessages, agent, abortRef.current.signal);

      const assistantMsg: StoredMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: result.content,
        metadata: { agent, citations: result.citations },
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      persistMessages(finalMessages);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Chat error:", err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === "Escape") {
      setShowMentionMenu(false);
    }
  };

  const insertMention = (agentId: AgentType) => {
    const cursorPos = inputRef.current?.selectionStart ?? inputValue.length;
    const beforeCursor = inputValue.slice(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf("@");
    const before = atIndex >= 0 ? inputValue.slice(0, atIndex) : inputValue;
    const after = inputValue.slice(cursorPos);
    setInputValue(`${before}@${agentId} ${after}`);
    setShowMentionMenu(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="max-w-3xl mx-auto py-4 space-y-6">
          {generatingDaily && messages.length === 0 && !streamingContent && (
            <div className="text-center py-8 text-muted-foreground">
              <span className="blink-cursor text-sm">Generating daily briefings</span>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              agent={message.metadata?.agent}
              citations={message.metadata?.citations}
              instruments={instruments}
            />
          ))}

          {isStreaming && streamingAgent && (
            <ChatMessage
              role="assistant"
              content={streamingContent}
              agent={streamingAgent}
              citations={streamCitationsRef.current.length > 0 ? streamCitationsRef.current : undefined}
              isStreaming
              instruments={instruments}
            />
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="glass p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative">
          {showMentionMenu && (
            <div className="glass absolute bottom-full mb-1 left-0 rounded-md shadow-md p-1 z-10">
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  className="block w-full text-left text-sm px-3 py-1.5 rounded hover:bg-white/[0.06]"
                  onClick={() => insertMention(agent.id)}
                >
                  {agent.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (e.target.value.endsWith("@")) {
                  setShowMentionMenu(true);
                } else if (!e.target.value.includes("@")) {
                  setShowMentionMenu(false);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message @market-analyst or @portfolio-analyst..."
              className="flex-1 min-h-[44px] max-h-[200px] resize-none rounded-lg bg-white/[0.04] border-white/[0.08] border px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={1}
              disabled={isStreaming || generatingDaily}
            />
            <Button
              type="submit"
              size="icon"
              className="h-[44px] w-[44px] shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!inputValue.trim() || isStreaming || generatingDaily}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Type <kbd className="px-1 py-0.5 bg-muted rounded text-xs">@</kbd> to mention an agent.
            Currently routing to: <span className="font-medium">{currentAgent}</span>
          </p>
        </form>
      </div>
    </div>
  );
}
