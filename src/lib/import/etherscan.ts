import type { ParsedTransaction } from './nordnet';
import { getChart } from '@/lib/market-data';

// ─── Chain Configuration ─────────────────────────────────────────

interface ChainConfig {
  chainId: number;
  name: string;
  nativeSymbol: string;
  yahooSymbol: string;
}

export const CHAINS: ChainConfig[] = [
  { chainId: 1, name: 'Ethereum', nativeSymbol: 'ETH', yahooSymbol: 'ETH-USD' },
  { chainId: 137, name: 'Polygon', nativeSymbol: 'POL', yahooSymbol: 'POL-USD' },
  { chainId: 42161, name: 'Arbitrum', nativeSymbol: 'ETH', yahooSymbol: 'ETH-USD' },
  { chainId: 10, name: 'Optimism', nativeSymbol: 'ETH', yahooSymbol: 'ETH-USD' },
  { chainId: 8453, name: 'Base', nativeSymbol: 'ETH', yahooSymbol: 'ETH-USD' },
  { chainId: 56, name: 'BSC', nativeSymbol: 'BNB', yahooSymbol: 'BNB-USD' },
];

// Native token pseudo-address
const NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

// ─── Known ERC-20 Tokens ─────────────────────────────────────────

interface KnownToken {
  yahooSymbol: string;
  name: string;
}

// Lowercase contract address → token info (Ethereum mainnet addresses)
const KNOWN_TOKENS: Record<string, KnownToken> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { yahooSymbol: 'USDC-USD', name: 'USD Coin' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { yahooSymbol: 'USDT-USD', name: 'Tether' },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { yahooSymbol: 'ETH-USD', name: 'Wrapped Ether' },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { yahooSymbol: 'WBTC-USD', name: 'Wrapped Bitcoin' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { yahooSymbol: 'DAI-USD', name: 'Dai' },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { yahooSymbol: 'LINK-USD', name: 'Chainlink' },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { yahooSymbol: 'UNI-USD', name: 'Uniswap' },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { yahooSymbol: 'AAVE-USD', name: 'Aave' },
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': { yahooSymbol: 'SHIB-USD', name: 'Shiba Inu' },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': { yahooSymbol: 'MATIC-USD', name: 'Polygon' },
  // Polygon USDC
  '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': { yahooSymbol: 'USDC-USD', name: 'USD Coin' },
  '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': { yahooSymbol: 'USDC-USD', name: 'USD Coin (Bridged)' },
  // Arbitrum
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { yahooSymbol: 'USDC-USD', name: 'USD Coin' },
  '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8': { yahooSymbol: 'USDC-USD', name: 'USD Coin (Bridged)' },
  // Base
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { yahooSymbol: 'USDC-USD', name: 'USD Coin' },
};

// ─── Types ────────────────────────────────────────────────────────

export interface WalletParsedTransaction extends ParsedTransaction {
  yahooSymbol: string | null;
  ticker: string | null;
  txHash: string;
  hasQuoteSource: boolean;
}

interface EtherscanTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  // ERC-20 specific
  contractAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}

// ─── Etherscan API ────────────────────────────────────────────────

async function fetchEtherscanPage(
  chainId: number,
  action: 'txlist' | 'tokentx',
  address: string,
  apiKey: string,
  page: number = 1,
): Promise<EtherscanTx[]> {
  const url = new URL('https://api.etherscan.io/v2/api');
  url.searchParams.set('chainid', String(chainId));
  url.searchParams.set('module', 'account');
  url.searchParams.set('action', action);
  url.searchParams.set('address', address);
  url.searchParams.set('startblock', '0');
  url.searchParams.set('endblock', '99999999');
  url.searchParams.set('page', String(page));
  url.searchParams.set('offset', '10000');
  url.searchParams.set('sort', 'asc');
  url.searchParams.set('apikey', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Etherscan API error: ${res.status}`);

  const data = await res.json();
  if (data.status === '0') {
    const result = typeof data.result === 'string' ? data.result.toLowerCase() : '';
    // "No transactions found" / "No records found" are expected empty results
    if (
      data.message === 'No transactions found' ||
      result.includes('no transactions found') ||
      result.includes('no records found') ||
      (Array.isArray(data.result) && data.result.length === 0)
    ) {
      return [];
    }
    // Rate limit — throw so caller sees it
    if (result.includes('rate limit') || result.includes('max rate')) {
      throw new Error(`Etherscan rate limit hit — try again in a moment`);
    }
    // Invalid API key or other real errors
    if (result.includes('invalid api') || result.includes('missing or invalid')) {
      throw new Error(`Etherscan API key error: ${data.result}`);
    }
    // For anything else on status '0', treat as empty (NOTOK on chains with no activity)
    console.warn(`Etherscan returned status 0 for chain ${chainId}/${action}: ${data.message} — ${data.result}`);
    return [];
  }
  return data.result || [];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchAllTransactions(
  address: string,
  chainIds: number[],
  apiKey: string,
): Promise<{ chainId: number; action: string; txs: EtherscanTx[] }[]> {
  const results: { chainId: number; action: string; txs: EtherscanTx[] }[] = [];

  for (const chainId of chainIds) {
    for (const action of ['txlist', 'tokentx'] as const) {
      const txs = await fetchEtherscanPage(chainId, action, address, apiKey);
      results.push({ chainId, action, txs });
      await delay(350); // 3/sec free tier rate limit
    }
  }

  return results;
}

// ─── Wei Conversion ───────────────────────────────────────────────

function weiToNumber(weiStr: string, decimals: number = 18): number {
  if (!weiStr || weiStr === '0') return 0;
  try {
    const wei = BigInt(weiStr);
    const divisor = BigInt(10 ** Math.min(decimals, 18));
    const whole = wei / divisor;
    const remainder = wei % divisor;
    const remainderStr = remainder.toString().padStart(decimals, '0');
    return parseFloat(`${whole}.${remainderStr}`);
  } catch {
    return 0;
  }
}

// ─── Transaction Mapping ──────────────────────────────────────────

export function mapToTransactions(
  rawData: { chainId: number; action: string; txs: EtherscanTx[] }[],
  walletAddress: string,
): WalletParsedTransaction[] {
  const results: WalletParsedTransaction[] = [];
  const addr = walletAddress.toLowerCase();

  for (const { chainId, action, txs } of rawData) {
    const chain = CHAINS.find(c => c.chainId === chainId);
    if (!chain) continue;

    for (const tx of txs) {
      // Skip failed txs
      if (tx.isError === '1') continue;

      if (action === 'txlist') {
        // Normal (native) transactions
        const value = weiToNumber(tx.value);
        if (value === 0) continue;

        const isIncoming = tx.to.toLowerCase() === addr;
        const txType = isIncoming ? 'buy' : 'sell';

        // Gas fee for outgoing txs
        const gasFee = !isIncoming
          ? weiToNumber(String(BigInt(tx.gasUsed) * BigInt(tx.gasPrice)))
          : 0;

        const isin = `${chainId}:${NATIVE_ADDRESS}`;

        results.push({
          date: new Date(Number(tx.timeStamp) * 1000).toISOString().split('T')[0],
          type: txType,
          isin,
          name: chain.nativeSymbol,
          quantity: value,
          price: 0, // filled in by lookupHistoricalPrices
          fee: gasFee,
          currency: 'USD',
          feeCurrency: 'USD',
          yahooSymbol: chain.yahooSymbol,
          ticker: chain.nativeSymbol,
          txHash: tx.hash,
          hasQuoteSource: true,
        });
      } else {
        // ERC-20 token transfers
        const decimals = parseInt(tx.tokenDecimal || '18', 10);
        const value = weiToNumber(tx.value, decimals);
        if (value === 0) continue;

        const isIncoming = tx.to.toLowerCase() === addr;
        const txType = isIncoming ? 'buy' : 'sell';
        const contractAddr = (tx.contractAddress || '').toLowerCase();
        const known = KNOWN_TOKENS[contractAddr];

        const isin = `${chainId}:${contractAddr}`;
        const tokenName = known?.name || tx.tokenName || tx.tokenSymbol || 'Unknown Token';

        results.push({
          date: new Date(Number(tx.timeStamp) * 1000).toISOString().split('T')[0],
          type: txType,
          isin,
          name: tokenName,
          quantity: value,
          price: 0,
          fee: 0,
          currency: 'USD',
          feeCurrency: 'USD',
          yahooSymbol: known?.yahooSymbol || null,
          ticker: tx.tokenSymbol || null,
          txHash: tx.hash,
          hasQuoteSource: !!known,
        });
      }
    }
  }

  return results;
}

// ─── Historical Price Lookup ──────────────────────────────────────

export async function lookupHistoricalPrices(
  transactions: WalletParsedTransaction[],
): Promise<void> {
  // Group unique (yahooSymbol, date) pairs
  const priceLookups = new Map<string, Set<string>>();
  for (const tx of transactions) {
    if (!tx.yahooSymbol) continue;
    if (!priceLookups.has(tx.yahooSymbol)) {
      priceLookups.set(tx.yahooSymbol, new Set());
    }
    priceLookups.get(tx.yahooSymbol)!.add(tx.date);
  }

  // Fetch chart data for each symbol (5y to cover old transactions)
  const priceMap = new Map<string, number>(); // "SYMBOL:DATE" → price
  for (const [symbol] of priceLookups) {
    try {
      const chartData = await getChart(symbol, '5y');
      for (const point of chartData) {
        priceMap.set(`${symbol}:${point.date}`, point.close);
      }
    } catch {
      // Skip symbols we can't fetch
    }
  }

  // Fill in prices — find closest date if exact match not available
  for (const tx of transactions) {
    if (!tx.yahooSymbol) continue;

    const exactKey = `${tx.yahooSymbol}:${tx.date}`;
    if (priceMap.has(exactKey)) {
      tx.price = priceMap.get(exactKey)!;
      continue;
    }

    // Find closest date within 7 days
    const txDate = new Date(tx.date).getTime();
    let closestPrice: number | null = null;
    let closestDiff = Infinity;

    for (const [key, price] of priceMap) {
      if (!key.startsWith(tx.yahooSymbol + ':')) continue;
      const date = new Date(key.split(':')[1]).getTime();
      const diff = Math.abs(date - txDate);
      if (diff < closestDiff && diff < 7 * 24 * 60 * 60 * 1000) {
        closestDiff = diff;
        closestPrice = price;
      }
    }

    if (closestPrice !== null) {
      tx.price = closestPrice;
    }
  }
}
