"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat-message";
import { ArrowUp, ChevronDown, Briefcase, BarChart3, Check } from "lucide-react";
import type { Chat, AgentType, Instrument } from "@/types";

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: { agent?: AgentType; citations?: string[] };
}

const AGENTS: { id: AgentType; label: string; description: string; icon: typeof Briefcase }[] = [
  { id: "portfolio-analyst", label: "Portfolio Analyst", description: "Analyzes your holdings", icon: Briefcase },
  { id: "market-analyst", label: "Market Analyst", description: "Tracks market trends", icon: BarChart3 },
];

interface ChatViewProps {
  chat: Chat | null;
}

export function ChatView({ chat }: ChatViewProps) {
  const router = useRouter();
  const isNewThread = chat === null;
  const chatIdRef = useRef<string | null>(chat?.id ?? null);

  const [currentAgent, setCurrentAgent] =
    useState<AgentType>("portfolio-analyst");
  const [messages, setMessages] = useState<StoredMessage[]>(chat?.messages ?? []);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<AgentType | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    fetch("/api/instruments")
      .then((r) => r.json())
      .then((data) => setInstruments(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setShowAgentMenu(false);
      }
    }
    if (showAgentMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAgentMenu]);

  const persistMessages = useCallback(
    (msgs: StoredMessage[], id?: string) => {
      const chatId = id ?? chatIdRef.current;
      if (!chatId) return;
      fetch(`/api/chats/${chatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs }),
      });
    },
    []
  );

  const streamCitationsRef = useRef<string[]>([]);

  const streamResponse = useCallback(
    async (
      apiMessages: Array<{ role: string; content: string }>,
      agent: AgentType,
      chatId: string,
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
            chatId,
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
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const agent = currentAgent;

    const userMsg: StoredMessage = {
      id: `msg_user_${Date.now()}`,
      role: "user",
      content: inputValue,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputValue("");

    // Create chat on first message if this is a new thread
    let chatId = chatIdRef.current;
    if (!chatId) {
      try {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: inputValue.slice(0, 100) }),
        });
        const newChat = await res.json();
        chatId = newChat.id;
        chatIdRef.current = chatId;
      } catch {
        console.error("Failed to create chat");
        return;
      }
    }

    const apiMessages = updatedMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current = new AbortController();

    try {
      const result = await streamResponse(
        apiMessages,
        agent,
        chatId!,
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
      persistMessages(finalMessages, chatId!);

      // Navigate to the new chat URL if this was a new thread
      if (isNewThread && chatId) {
        router.replace(`/chat/${chatId}`);
      }
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
  };

  const showCentered = isNewThread && messages.length === 0 && !isStreaming;

  const inputForm = (
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 768,
        width: "100%",
        margin: "0 auto",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          borderRadius: 20,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 0 4px 2pxrgba(0, 0, 0, 0.08)",
          padding: "12px 16px",
        }}
      >
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          style={{
            width: "100%",
            minHeight: showCentered ? 80 : 28,
            maxHeight: 200,
            resize: "none",
            background: "transparent",
            padding: 0,
            fontSize: 15,
            border: "none",
            color: "inherit",
            outline: "none",
            lineHeight: 1.5,
          }}
          rows={showCentered ? 3 : 1}
          disabled={isStreaming}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {/* Agent dropdown */}
          <div ref={agentMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowAgentMenu((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-muted-foreground)",
                background: "none",
                border: "none",
                padding: "4px 0",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {AGENTS.find((a) => a.id === currentAgent)?.label}
              <ChevronDown style={{ width: 12, height: 12 }} />
            </button>

            {showAgentMenu && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: -8,
                  minWidth: 220,
                  borderRadius: 12,
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "var(--popover)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                  padding: 4,
                  zIndex: 30,
                }}
              >
                {AGENTS.map((agent) => {
                  const Icon = agent.icon;
                  const isSelected = currentAgent === agent.id;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setCurrentAgent(agent.id);
                        setShowAgentMenu(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "transparent",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        font: "inherit",
                      }}
                      data-hover="search-result"
                    >
                      <Icon style={{ width: 14, height: 14, flexShrink: 0, color: "var(--muted-foreground)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12 }}>{agent.label}</div>
                        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{agent.description}</div>
                      </div>
                      {isSelected && (
                        <Check style={{ width: 14, height: 14, flexShrink: 0, color: "var(--primary)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            style={{
              height: 32,
              width: 32,
              borderRadius: "50%",
              flexShrink: 0,
              background: "var(--foreground)",
              color: "var(--background)",
            }}
            disabled={!inputValue.trim() || isStreaming}
          >
            <ArrowUp style={{ width: 16, height: 16 }} />
          </Button>
        </div>
      </div>
    </form>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AnimatePresence mode="wait">
        {showCentered ? (
          <motion.div
            key="new-thread"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 16px",
            }}
          >
            <motion.img
              src="/logo.svg"
              alt="Sonar"
              style={{ height: 40, marginBottom: 32, color: "var(--muted-foreground)" }}
              exit={{ opacity: 0, scale: 1.1, y: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
            {inputForm}
          </motion.div>
        ) : (
          <motion.div
            key="chat-thread"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            style={{ display: "flex", flexDirection: "column", flex: 1 }}
          >
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
              <div
                style={{
                  maxWidth: 768,
                  margin: "0 auto",
                  padding: "16px 0",
                  paddingBottom: 160,
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                }}
              >
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
            </div>

            {/* Chat input — fixed to bottom */}
            <div
              style={{
                position: "fixed",
                bottom: "1rem",
                left: 224,
                right: 0,
                zIndex: 20,
                padding: "0 16px",
                pointerEvents: "none",
              }}
            >
              {inputForm}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
