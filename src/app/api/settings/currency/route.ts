import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';

const SUPPORTED_CURRENCIES = ['DKK', 'EUR', 'USD', 'GBP', 'SEK', 'NOK', 'CHF'];

export async function GET() {
  const currency = getSetting('reporting_currency') ?? 'DKK';
  return NextResponse.json({ currency });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { currency } = body;

  if (!currency || !SUPPORTED_CURRENCIES.includes(currency)) {
    return NextResponse.json(
      { error: `Invalid currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` },
      { status: 400 }
    );
  }

  setSetting('reporting_currency', currency);
  return NextResponse.json({ currency });
}
