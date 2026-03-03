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
  const [currentAgent, setCurrentAgent] =
    useState<AgentType>("portfolio-analyst");
  const [messages, setMessages] = useState<StoredMessage[]>(chat.messages);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<AgentType | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dailyTriggeredRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingContent]);

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

  const triggerDailyMessages = useCallback(async () => {
    if (dailyTriggeredRef.current || chat.messages.length > 0) return;
    dailyTriggeredRef.current = true;
    setGeneratingDaily(true);

    try {
      const marketResult = await streamResponse(
        [{ role: "user", content: "Provide your daily market briefing." }],
        "market-analyst"
      );

      const marketMsg: StoredMessage = {
        id: `msg_market_${Date.now()}`,
        role: "assistant",
        content: marketResult.content,
        metadata: {
          agent: "market-analyst",
          citations: marketResult.citations,
        },
      };
      setMessages([marketMsg]);

      const portfolioResult = await streamResponse(
        [{ role: "user", content: "Provide your daily portfolio scan." }],
        "portfolio-analyst"
      );

      const portfolioMsg: StoredMessage = {
        id: `msg_portfolio_${Date.now()}`,
        role: "assistant",
        content: portfolioResult.content,
        metadata: {
          agent: "portfolio-analyst",
          citations: portfolioResult.citations,
        },
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
      const result = await streamResponse(
        apiMessages,
        agent,
        abortRef.current.signal
      );

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
    if (showMentionMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % AGENTS.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + AGENTS.length) % AGENTS.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertMention(AGENTS[mentionIndex].id);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <ScrollArea style={{ flex: 1, padding: "0 16px" }} ref={scrollRef}>
        <div
          style={{
            maxWidth: 768,
            margin: "0 auto",
            padding: "16px 0",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {generatingDaily && messages.length === 0 && !streamingContent && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 0",
                color: "var(--muted-foreground)",
              }}
            >
              <span className="blink-cursor" style={{ fontSize: 14 }}>
                Generating daily briefings
              </span>
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
              citations={
                streamCitationsRef.current.length > 0
                  ? streamCitationsRef.current
                  : undefined
              }
              isStreaming
              instruments={instruments}
            />
          )}
        </div>
      </ScrollArea>

      <div className="glass" style={{ padding: 16 }}>
        <form
          onSubmit={handleSubmit}
          style={{ maxWidth: 768, margin: "0 auto", position: "relative" }}
        >
          {showMentionMenu && (
            <div
              className="glass"
              style={{
                position: "absolute",
                bottom: "100%",
                marginBottom: 4,
                left: 0,
                borderRadius: "var(--radius-md)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                padding: 4,
                zIndex: 10,
              }}
            >
              {AGENTS.map((agent, i) => (
                <button
                  key={agent.id}
                  type="button"
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    fontSize: 14,
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    background:
                      i === mentionIndex
                        ? "rgba(255, 255, 255, 0.06)"
                        : "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                  }}
                  data-hover="search-result"
                  onClick={() => insertMention(agent.id)}
                  onMouseEnter={() => setMentionIndex(i)}
                >
                  {agent.label}
                </button>
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (e.target.value.endsWith("@")) {
                  setShowMentionMenu(true);
                  setMentionIndex(0);
                } else if (!e.target.value.includes("@")) {
                  setShowMentionMenu(false);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message @market-analyst or @portfolio-analyst..."
              style={{
                flex: 1,
                minHeight: 44,
                maxHeight: 200,
                resize: "none",
                borderRadius: "var(--radius-lg)",
                background: "rgba(255, 255, 255, 0.04)",
                padding: "12px 16px",
                fontSize: 14,
                border: "none",
                color: "inherit",
                outline: "none",
              }}
              rows={1}
              disabled={isStreaming || generatingDaily}
            />
            <Button
              type="submit"
              size="icon"
              style={{
                height: 44,
                width: 44,
                flexShrink: 0,
              }}
              disabled={!inputValue.trim() || isStreaming || generatingDaily}
            >
              <Send style={{ width: 16, height: 16 }} />
            </Button>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginTop: 6,
            }}
          >
            Type{" "}
            <kbd
              style={{
                padding: "1px 4px",
                background: "var(--muted)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
              }}
            >
              @
            </kbd>{" "}
            to mention an agent. Currently routing to:{" "}
            <span style={{ fontWeight: 500 }}>{currentAgent}</span>
          </p>
        </form>
      </div>
    </div>
  );
}
