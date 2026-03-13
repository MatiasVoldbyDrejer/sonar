import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

const ALLOWED_MODELS = ['sonnet', 'opus', 'gemini-flash', 'gemini-flash-lite'];

export async function GET() {
  const model = getSetting('ai_model') ?? 'sonnet';
  return NextResponse.json({ model });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { model } = body;

  if (!model || !ALLOWED_MODELS.includes(model)) {
    return NextResponse.json(
      { error: `Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}` },
      { status: 400 }
    );
  }

  setSetting('ai_model', model);
  return NextResponse.json({ model });
}
