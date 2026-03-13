"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/chat-message";
import { ArrowUp, ChevronDown } from "lucide-react";
import type { Chat, Instrument } from "@/types";

const MODEL_OPTIONS = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "gemini-flash-lite", label: "Flash Lite" },
];

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: { citations?: string[] };
}

interface ChatViewProps {
  chat: Chat | null;
}

export function ChatView({ chat }: ChatViewProps) {
  const isNewThread = chat === null;
  const chatIdRef = useRef<string | null>(chat?.id ?? null);

  const [messages, setMessages] = useState<StoredMessage[]>(
    chat?.messages ?? []
  );
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load default model from settings on mount (only for new chats)
  useEffect(() => {
    if (isNewThread) {
      fetch("/api/settings/model")
        .then((r) => r.json())
        .then((data) => setSelectedModel(data.model ?? "sonnet"))
        .catch(() => setSelectedModel("sonnet"));
    }
  }, [isNewThread]);

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

  const persistMessages = useCallback(
    async (msgs: StoredMessage[], id?: string) => {
      const chatId = id ?? chatIdRef.current;
      if (!chatId) return;
      try {
        await fetch(`/api/chats/${chatId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: msgs }),
        });
      } catch (err) {
        console.error("Failed to persist messages:", err);
      }
    },
    []
  );

  const streamResponse = useCallback(
    async (
      apiMessages: StoredMessage[],
      chatId: string,
      signal?: AbortSignal,
      model?: string | null
    ): Promise<{ content: string; citations: string[] }> => {
      setStreamingContent("");
      setIsStreaming(true);
      setIsWorking(true);

      const citations: string[] = [];

      try {
        // Send as UIMessage format for the AI SDK route
        const uiMessages = apiMessages.map((m) => ({
          id: m.id,
          role: m.role,
          parts: [{ type: "text", text: m.content }],
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: uiMessages, ...(model ? { model } : {}), chatId: chatIdRef.current }),
          signal,
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let content = "";
        let lineBuffer = "";
        let sawTool = false;
        let toolsDone = false;
        let finalTextStarted = false;
        let pureTextMode = false;
        let pureTextTimer: ReturnType<typeof setTimeout> | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = (lineBuffer + chunk).split("\n");
          lineBuffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload);

              // Track tool activity
              if (parsed.type === "tool-input-start") {
                sawTool = true;
                toolsDone = false;
                finalTextStarted = false;
                pureTextMode = false;
                if (pureTextTimer) { clearTimeout(pureTextTimer); pureTextTimer = null; }
                setIsWorking(true);
                content = "";
                setStreamingContent("");
              }

              // Extract citations from tool output
              if (parsed.type === "tool-output-available") {
                toolsDone = true;
                if (parsed.output?.citations?.length) {
                  citations.push(...parsed.output.citations);
                }
              }

              // Text content streaming — suppress intermediate reasoning between tool calls
              if (parsed.type === "text-delta" && parsed.delta) {
                if (pureTextMode) {
                  // Confirmed pure text response — stream directly
                  content += parsed.delta;
                  setStreamingContent(content);
                } else if (!sawTool) {
                  // No tools seen yet — buffer and start a timer.
                  // If no tool-input-start arrives soon, switch to pure text mode.
                  content += parsed.delta;
                  if (!pureTextTimer) {
                    pureTextTimer = setTimeout(() => {
                      pureTextMode = true;
                      setIsWorking(false);
                      setStreamingContent(content);
                    }, 150);
                  }
                } else if (finalTextStarted) {
                  // Already confirmed this is the final response after tools
                  content += parsed.delta;
                  setStreamingContent(content);
                } else if (toolsDone) {
                  // First text after tool output — show it (cleared if more tools come)
                  finalTextStarted = true;
                  content += parsed.delta;
                  setIsWorking(false);
                  setStreamingContent(content);
                }
                // else: text between tool-input-start and tool-output — suppress
              }
            } catch {
              // skip unparseable lines
            }
          }
        }

        if (pureTextTimer) clearTimeout(pureTextTimer);
        return { content, citations };
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        setIsWorking(false);
      }
    },
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

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
    let isNewChat = false;
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
        isNewChat = true;
      } catch {
        console.error("Failed to create chat");
        return;
      }
    }

    // Persist user message immediately so it survives page reloads
    await persistMessages(updatedMessages, chatId!);

    abortRef.current = new AbortController();

    try {
      const result = await streamResponse(
        updatedMessages,
        chatId!,
        abortRef.current.signal,
        selectedModel
      );

      const assistantMsg: StoredMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: result.content,
        metadata: {
          citations: result.citations.length > 0 ? result.citations : undefined,
        },
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      await persistMessages(finalMessages, chatId!);

      // Update URL only after messages are persisted, so /chat/[id] won't load stale data
      if (isNewChat) {
        window.history.replaceState(null, "", `/chat/${chatId}`);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Chat error:", err);
      }
      // Still update URL if chat was created, so refresh works
      if (isNewChat) {
        window.history.replaceState(null, "", `/chat/${chatId}`);
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
          boxShadow: "0 0 4px 2px rgba(0, 0, 0, 0.08)",
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
          <div style={{ position: "relative" }}>
            {showCentered && selectedModel && (
              <>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 13,
                    color: "var(--muted-foreground)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-md)",
                    transition: "color 150ms",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = "var(--foreground)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = "var(--muted-foreground)";
                  }}
                >
                  {MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label ?? selectedModel}
                  <ChevronDown style={{ width: 14, height: 14 }} />
                </button>
                {modelMenuOpen && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 40 }}
                      onClick={() => setModelMenuOpen(false)}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 4px)",
                        left: 0,
                        background: "var(--color-card)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        padding: 4,
                        zIndex: 50,
                        minWidth: 160,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      }}
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.value);
                            setModelMenuOpen(false);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "8px 12px",
                            fontSize: 13,
                            border: "none",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            color:
                              selectedModel === m.value
                                ? "var(--foreground)"
                                : "var(--muted-foreground)",
                            background:
                              selectedModel === m.value
                                ? "rgba(255,255,255,0.06)"
                                : "transparent",
                            fontWeight: selectedModel === m.value ? 500 : 400,
                          }}
                          onMouseOver={(e) => {
                            if (selectedModel !== m.value)
                              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                          }}
                          onMouseOut={(e) => {
                            if (selectedModel !== m.value)
                              e.currentTarget.style.background = "transparent";
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
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
              style={{
                height: 40,
                marginBottom: 32,
                color: "var(--muted-foreground)",
              }}
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
            <div
              ref={scrollRef}
              style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}
            >
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
                    citations={message.metadata?.citations}
                    instruments={instruments}
                  />
                ))}

                {isStreaming && (
                  <ChatMessage
                    role="assistant"
                    content={streamingContent}
                    isStreaming
                    isResearching={isWorking && !streamingContent}
                    instruments={instruments}
                  />
                )}
              </div>
            </div>

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
