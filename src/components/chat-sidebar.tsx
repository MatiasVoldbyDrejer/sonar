"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "@/types";

interface ChatSidebarProps {
  chats: ChatSummary[];
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

export function ChatSidebar({ chats }: ChatSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="glass w-56 shrink-0">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-semibold">Conversations</h2>
      </div>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <div className="p-2 space-y-0.5">
          {chats.map((chat) => {
            const href = `/chat/${chat.id}`;
            const isActive = pathname === href || (pathname === "/chat" && chat.date === new Date().toISOString().split("T")[0]);

            return (
              <Link
                key={chat.id}
                href={href}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors duration-100",
                  isActive
                    ? "bg-white/[0.06] text-foreground"
                    : "text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
                )}
              >
                <div className="font-medium truncate">{formatDate(chat.date)}</div>
                <div className="text-xs text-muted-foreground truncate">{chat.title}</div>
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
