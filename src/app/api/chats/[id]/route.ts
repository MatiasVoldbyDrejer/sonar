import { NextRequest, NextResponse } from 'next/server';
import { getChatById, saveChatMessages } from '@/lib/chat-db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = getChatById(id);

  if (!chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  return NextResponse.json(chat);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { messages } = await request.json();

  saveChatMessages(id, messages);
  return NextResponse.json({ ok: true });
}
