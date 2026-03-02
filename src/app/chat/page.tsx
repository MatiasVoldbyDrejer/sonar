"use client";

import { useEffect, useState } from "react";
import { ChatView } from "@/components/chat-view";
import type { Chat } from "@/types";

export default function ChatPage() {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chats", { method: "POST" })
      .then((res) => res.json())
      .then((data) => setChat(data))
      .catch(() => setError("Failed to load chat"));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <ChatView chat={chat} />;
}
