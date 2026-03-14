import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import { MODEL_OPTIONS, DEFAULT_TELEGRAM_MODEL } from '@/lib/constants';

const ALLOWED_MODELS = MODEL_OPTIONS.map(o => o.value);

export async function GET() {
  const model = getSetting('telegram_model') ?? DEFAULT_TELEGRAM_MODEL;
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

  setSetting('telegram_model', model);
  return NextResponse.json({ model });
}
