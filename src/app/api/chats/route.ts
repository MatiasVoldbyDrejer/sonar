import { NextRequest, NextResponse } from 'next/server';
import { listChats, createChat } from '@/lib/chat-db';

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source') as 'user' | 'recurring_task' | null;
  const chats = listChats(source || undefined);
  return NextResponse.json(chats);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const chat = createChat(body.title);
  return NextResponse.json(chat);
}
