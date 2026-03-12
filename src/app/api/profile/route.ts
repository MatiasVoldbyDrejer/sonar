import { NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/lib/db';
import type { InvestorProfile } from '@/types';

const VALID_RISK = new Set(['conservative', 'moderate', 'aggressive']);
const VALID_HORIZON = new Set(['short', 'medium', 'long']);
const VALID_EXPERIENCE = new Set(['beginner', 'intermediate', 'advanced']);

export async function GET() {
  const raw = getSetting('investor_profile');
  const profile: InvestorProfile = raw ? JSON.parse(raw) : {};
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const profile = (await req.json()) as InvestorProfile;

  // Validate enums
  if (profile.riskTolerance && !VALID_RISK.has(profile.riskTolerance)) {
    return NextResponse.json({ error: 'Invalid riskTolerance' }, { status: 400 });
  }
  if (profile.timeHorizon && !VALID_HORIZON.has(profile.timeHorizon)) {
    return NextResponse.json({ error: 'Invalid timeHorizon' }, { status: 400 });
  }
  if (profile.investmentExperience && !VALID_EXPERIENCE.has(profile.investmentExperience)) {
    return NextResponse.json({ error: 'Invalid investmentExperience' }, { status: 400 });
  }

  setSetting('investor_profile', JSON.stringify(profile));
  return NextResponse.json({ profile });
}
