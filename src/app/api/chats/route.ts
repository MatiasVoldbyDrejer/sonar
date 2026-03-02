import { NextResponse } from 'next/server';
import { listChats, getOrCreateTodayChat } from '@/lib/chat-db';

export async function GET() {
  const chats = listChats();
  return NextResponse.json(chats);
}

export async function POST() {
  const chat = getOrCreateTodayChat();
  return NextResponse.json(chat);
}
