export interface Instrument {
  id: number;
  isin: string;
  yahooSymbol: string | null;
  ticker: string | null;
  name: string;
  type: 'stock' | 'fund' | 'etf' | 'crypto';
  currency: string;
  exchange: string | null;
  hasQuoteSource: boolean;
  sector: string | null;
  industry: string | null;
  country: string | null;
}

export interface Account {
  id: number;
  name: string;
  broker: 'saxo' | 'nordnet' | 'metamask' | 'sydbank';
  walletAddress: string | null;
}

export interface Transaction {
  id: number;
  accountId: number;
  instrumentId: number;
  type: 'buy' | 'sell' | 'dividend';
  date: string;
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string | null;
  notes: string | null;
  createdAt?: string;
}

export interface Position {
  instrument: Instrument;
  accountId: number;
  accountName: string;
  quantity: number;
  costBasis: number;
  averagePrice: number;
  realizedGainLoss: number;
  unrealizedGainLoss: number;
  currentPrice: number | null;
  currentValue: number | null;
  dayChange: number | null;
  dayChangePercent: number | null;
  totalDividends: number;
  reportingCurrency: string;
}

export interface AnalysisCache {
  id: number;
  cacheKey: string;
  content: string;
  citations: string[] | null;
  queryUsed: string | null;
  createdAt: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketState: string;
  updatedAt: string;
}

export interface ChartDataPoint {
  date: string;
  close: number;
  volume?: number;
}

export interface TradeMarker {
  type: 'buy' | 'sell' | 'dividend';
  quantity: number;
  price: number;
  fee: number;
  feeCurrency: string | null;
  date: string;
  instrumentName?: string;
}

export interface ChartDataPointWithTrades extends ChartDataPoint {
  trades?: TradeMarker[];
}

export interface Chat {
  id: string;
  date: string;
  title: string;
  messages: ChatMessage[];
  source: 'user' | 'recurring_task' | 'telegram';
  recurringTaskId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSummary {
  id: string;
  date: string;
  title: string;
  preview?: string;
  source: 'user' | 'recurring_task' | 'telegram';
  recurringTaskId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTask {
  id: number;
  name: string;
  prompt: string;
  cronExpression: string;
  timezone: string;
  active: boolean;
  lastRunAt: string | null;
  lastChatId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  metadata?: {
    agent?: string;
    citations?: string[];
  };
}

export type PulseSignalType = 'earnings' | 'risk' | 'analyst-change' | 'opportunity' | 'catalyst' | 'news';

export interface PulseItem {
  isin: string;
  ticker: string | null;
  instrumentName: string;
  signalType: PulseSignalType;
  headline: string;
  explanation: string;
  suggestedAction: string;
}

export interface PulseResponse {
  summary: string;
  items: PulseItem[];
}

export interface AllocationSlice {
  name: string;
  value: number;
  percentage: number;
  costBasis: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  instruments: Array<{
    name: string;
    isin: string;
    value: number;
    percentage: number;
    costBasis: number;
    unrealizedGainLoss: number;
    unrealizedGainLossPercent: number;
  }>;
}

export interface DiversificationScore {
  overall: number;
  sectorHHI: number;
  industryHHI: number;
  countryHHI: number;
  label: 'Low' | 'Moderate' | 'Good' | 'Excellent';
}

export interface DeepDiveData {
  totalValue: number;
  totalCostBasis: number;
  totalUnrealizedGainLoss: number;
  totalUnrealizedGainLossPercent: number;
  totalRealizedGainLoss: number;
  totalDividends: number;
  holdingCount: number;
  top5Concentration: number;
  reportingCurrency: string;
  topHoldings: Array<{
    name: string;
    ticker: string | null;
    isin: string;
    value: number;
    weight: number;
    unrealizedGainLoss: number;
    unrealizedGainLossPercent: number;
  }>;
  sectorAllocation: AllocationSlice[];
  industryAllocation: AllocationSlice[];
  countryAllocation: AllocationSlice[];
  diversification: DiversificationScore;
  unclassifiedValue: number;
  unclassifiedInstruments: Array<{ name: string; isin: string; value: number }>;
}

export interface InvestorProfile {
  // Identity
  name?: string;
  birthYear?: number;
  location?: string;
  baseCurrency?: string;

  // Investment style
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  timeHorizon?: 'short' | 'medium' | 'long';  // <3y, 3-10y, 10y+
  investmentGoals?: string[];  // retirement, wealth-building, income, capital-preservation, speculation

  // Focus areas
  regionFocus?: string[];     // Nordics, Europe, US, Asia, Emerging Markets, Global
  sectorInterests?: string[];
  assetTypePreferences?: string[];  // stocks, funds, etf, crypto, bonds

  // Financial context
  incomeBracket?: string;
  netWorthRange?: string;
  investmentExperience?: 'beginner' | 'intermediate' | 'advanced';

  // Free-form
  notes?: string;  // injected directly into AI context
}

export interface InstrumentStats {
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  marketCap: number | null;
  peRatio: number | null;
  dividendYield: number | null;
}
