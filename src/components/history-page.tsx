"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Search, Clock } from "lucide-react";
import type { ChatSummary } from "@/types";

function formatRelativeTime(dateStr: string, timeStr?: string): string {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateStr + "T00:00:00");

  // If we have a full timestamp and it's today, show relative time
  if (timeStr) {
    const full = new Date(timeStr);
    const diffMs = now.getTime() - full.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin} minutes ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  const diff = today.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function HistoryPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/chats?source=user")
      .then((res) => res.json())
      .then((data) => setChats(data))
      .catch(() => {});
  }, []);

  const filtered = search
    ? chats.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      )
    : chats;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>
          History
        </span>
        <Link
          href="/chat"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--foreground)",
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: "var(--radius-lg)",
            background: "var(--background)",
            border: "1px solid var(--border)",
            transition: "background 150ms",
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "var(--background-quiet-color)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "var(--background)";
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          New Thread
        </Link>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            padding: "20px 24px",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 20 }}>
            <Search
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                width: 15,
                height: 15,
                color: "var(--muted-foreground)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search your threads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                fontSize: 14,
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--color-card)",
                color: "var(--foreground)",
                outline: "none",
              }}
            />
          </div>

          {/* Thread list */}
          <div>
            {filtered.map((chat, i) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                style={{
                  display: "block",
                  padding: "16px 0",
                  borderBottom:
                    i < filtered.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  textDecoration: "none",
                }}
                onMouseOver={(e) => {
                  const title = e.currentTarget.querySelector<HTMLElement>("[data-title]");
                  if (title) title.style.color = "var(--primary)";
                }}
                onMouseOut={(e) => {
                  const title = e.currentTarget.querySelector<HTMLElement>("[data-title]");
                  if (title) title.style.color = "var(--foreground)";
                }}
              >
                <div
                  data-title
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    color: "var(--foreground)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: "1.4",
                    transition: "color 150ms",
                  }}
                >
                  {chat.title}
                </div>
                {chat.preview && (
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--muted-foreground)",
                      marginTop: 4,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      lineHeight: "1.5",
                    }}
                  >
                    {chat.preview}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 8,
                    fontSize: 12,
                    color: "var(--foreground-quieter-color)",
                  }}
                >
                  <Clock style={{ width: 12, height: 12 }} />
                  {formatRelativeTime(chat.date, chat.updatedAt)}
                </div>
              </Link>
            ))}
            {filtered.length === 0 && chats.length > 0 && (
              <p
                style={{
                  fontSize: 14,
                  color: "var(--muted-foreground)",
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                No threads matching &ldquo;{search}&rdquo;
              </p>
            )}
            {chats.length === 0 && (
              <p
                style={{
                  fontSize: 14,
                  color: "var(--muted-foreground)",
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                No conversations yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
