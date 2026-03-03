export interface Instrument {
  id: number;
  isin: string;
  yahooSymbol: string | null;
  ticker: string | null;
  name: string;
  type: 'stock' | 'fund' | 'etf';
  currency: string;
  exchange: string | null;
  hasQuoteSource: boolean;
}

export interface Account {
  id: number;
  name: string;
  broker: 'saxo' | 'nordnet';
}

export interface Transaction {
  id: number;
  accountId: number;
  instrumentId: number;
  type: 'buy' | 'sell';
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
  reportingCurrency: 'DKK';
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
  type: 'buy' | 'sell';
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
  createdAt: string;
  updatedAt: string;
}

export interface ChatSummary {
  id: string;
  date: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  metadata?: {
    agent?: 'market-analyst' | 'portfolio-analyst';
  };
}

export type AgentType = 'market-analyst' | 'portfolio-analyst';

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
