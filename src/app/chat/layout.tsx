"use client";

import { useEffect, useState } from "react";
import { ChatSidebar } from "@/components/chat-sidebar";
import type { ChatSummary } from "@/types";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [chats, setChats] = useState<ChatSummary[]>([]);

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => res.json())
      .then((data) => setChats(data))
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -my-6 -mx-4">
      <ChatSidebar chats={chats} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
