import { getSetting } from '@/lib/db';
import type { InvestorProfile } from '@/types';

export function getInvestorProfile(): InvestorProfile {
  const raw = getSetting('investor_profile');
  if (!raw) return {};
  try {
    return JSON.parse(raw) as InvestorProfile;
  } catch {
    return {};
  }
}

export function buildProfileContext(profile: InvestorProfile): string {
  const parts: string[] = [];

  // Identity
  const identity: string[] = [];
  if (profile.name) identity.push(profile.name);
  if (profile.birthYear) identity.push(`born ${profile.birthYear}`);
  if (profile.location) identity.push(`based in ${profile.location}`);
  if (identity.length > 0) parts.push(`The investor is ${identity.join(', ')}.`);

  // Investment style
  if (profile.riskTolerance) parts.push(`Risk tolerance: ${profile.riskTolerance}.`);
  if (profile.timeHorizon) {
    const horizonLabels = { short: 'short-term (<3 years)', medium: 'medium-term (3–10 years)', long: 'long-term (10+ years)' };
    parts.push(`Investment horizon: ${horizonLabels[profile.timeHorizon]}.`);
  }
  if (profile.investmentGoals?.length) parts.push(`Goals: ${profile.investmentGoals.join(', ')}.`);

  // Experience
  if (profile.investmentExperience) parts.push(`Experience level: ${profile.investmentExperience}.`);

  // Focus areas
  if (profile.regionFocus?.length) parts.push(`Region focus: ${profile.regionFocus.join(', ')}.`);
  if (profile.sectorInterests?.length) parts.push(`Sector interests: ${profile.sectorInterests.join(', ')}.`);
  if (profile.assetTypePreferences?.length) parts.push(`Preferred asset types: ${profile.assetTypePreferences.join(', ')}.`);

  // Financial context
  if (profile.incomeBracket) parts.push(`Income bracket: ${profile.incomeBracket}.`);
  if (profile.netWorthRange) parts.push(`Net worth range: ${profile.netWorthRange}.`);

  // Currency
  if (profile.baseCurrency) parts.push(`Base currency: ${profile.baseCurrency}.`);

  // Free-form notes
  if (profile.notes) parts.push(`Additional context: ${profile.notes}`);

  if (parts.length === 0) return 'a retail investor';
  return parts.join(' ');
}
