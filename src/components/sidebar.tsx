"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, MessageSquare, Settings, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChatSummary } from "@/types";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = today.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString("en-US", { weekday: "long" });

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function Sidebar() {
  const pathname = usePathname();
  const [chats, setChats] = useState<ChatSummary[]>([]);

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => res.json())
      .then((data) => setChats(data))
      .catch(() => {});
  }, []);

  return (
    <aside
      className="glass"
      style={{
        width: 224,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: 12 }}>
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Activity
            style={{ width: 20, height: 20, color: "var(--primary)" }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "-0.025em",
            }}
          >
            Sonar
          </span>
        </Link>
      </div>

      <nav style={{ padding: "0 8px" }}>
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: "var(--radius-md)",
                padding: "6px 12px",
                fontSize: 14,
                fontWeight: 500,
                color: active
                  ? "var(--foreground)"
                  : "var(--muted-foreground)",
                transition: "color 150ms",
                textDecoration: "none",
                marginBottom: 2,
              }}
              {...(!active ? { "data-hover": "nav-link" } : {})}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255, 255, 255, 0.06)",
                  }}
                  transition={{
                    duration: 0.2,
                    ease: [0.25, 0.1, 0.25, 1.0],
                  }}
                />
              )}
              <Icon style={{ position: "relative", width: 16, height: 16 }} />
              <span style={{ position: "relative" }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          margin: "12px 0",
        }}
      />
      <div style={{ padding: "0 12px", marginBottom: 4 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--muted-foreground)",
          }}
        >
          Recent
        </span>
      </div>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <div style={{ padding: "0 8px" }}>
          {chats.map((chat) => {
            const href = `/chat/${chat.id}`;
            const active =
              pathname === href ||
              (pathname === "/chat" &&
                chat.date === new Date().toISOString().split("T")[0]);

            return (
              <Link
                key={chat.id}
                href={href}
                style={{
                  display: "block",
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  fontSize: 14,
                  transition: "color 100ms, background 100ms",
                  textDecoration: "none",
                  marginBottom: 2,
                  background: active
                    ? "rgba(255, 255, 255, 0.06)"
                    : "transparent",
                  color: active
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
                }}
                {...(!active ? { "data-hover": "chat-link" } : {})}
              >
                <div
                  style={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatDate(chat.date)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {chat.title}
                </div>
              </Link>
            );
          })}
          {chats.length === 0 && (
            <p
              style={{
                fontSize: 12,
                color: "var(--muted-foreground)",
                padding: "8px 12px",
              }}
            >
              No conversations yet.
            </p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
