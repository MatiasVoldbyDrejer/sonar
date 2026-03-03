"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, MessageSquare, Settings, Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
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
    <aside className="glass w-56 shrink-0 flex flex-col h-screen sticky top-0">
      <div className="p-3">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">Sonar</span>
        </Link>
      </div>

      <nav className="px-2 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-md bg-white/[0.06]"
                  transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
                />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border my-3" />
      <div className="px-3 mb-1">
        <span className="text-xs font-medium text-muted-foreground">Recent</span>
      </div>
      <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 space-y-0.5">
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
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors duration-100",
                      active
                        ? "bg-white/[0.06] text-foreground"
                        : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                    )}
                  >
                    <div className="font-medium truncate">
                      {formatDate(chat.date)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {chat.title}
                    </div>
                  </Link>
                );
              })}
              {chats.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  No conversations yet.
                </p>
              )}
            </div>
      </ScrollArea>
    </aside>
  );
}
