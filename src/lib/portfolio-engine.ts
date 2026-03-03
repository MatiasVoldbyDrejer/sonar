import type { Transaction, Position, Instrument } from '@/types';

interface Lot {
  date: string;
  quantity: number;
  price: number;
  fee: number;
  totalCost: number; // quantity * price + fee (fee-inclusive)
}

interface PositionResult {
  quantity: number;
  costBasis: number;
  averagePrice: number;
  realizedGainLoss: number;
  totalDividends: number;
  lots: Lot[]; // exposed for DKK conversion
}

/**
 * FIFO cost basis calculation over sorted transactions for a single instrument+account.
 * Fees are included in cost basis: buy cost = qty * price + fee.
 */
export function computePosition(transactions: Transaction[]): PositionResult {
  // Sort chronologically
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const lots: Lot[] = [];
  let realizedGainLoss = 0;
  let totalDividends = 0;

  for (const tx of sorted) {
    if (tx.type === 'dividend') {
      totalDividends += tx.price;
      continue;
    }
    if (tx.type === 'buy') {
      const totalCost = tx.quantity * tx.price + tx.fee;
      lots.push({
        date: tx.date,
        quantity: tx.quantity,
        price: tx.price,
        fee: tx.fee,
        totalCost,
      });
    } else {
      // Sell — consume oldest lots first (FIFO)
      let remaining = tx.quantity;
      const salePrice = tx.price;
      const saleProceeds = tx.quantity * salePrice - tx.fee; // net of sale fee

      let consumedCost = 0;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const consumed = Math.min(remaining, lot.quantity);

        // Proportional cost from this lot (fee-inclusive)
        const costPerUnit = lot.totalCost / lot.quantity;
        const lotCostConsumed = costPerUnit * consumed;
        consumedCost += lotCostConsumed;

        lot.totalCost -= lotCostConsumed;
        lot.quantity -= consumed;
        remaining -= consumed;

        if (lot.quantity <= 0) {
          lots.shift();
        }
      }

      realizedGainLoss += saleProceeds - consumedCost;
    }
  }

  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const costBasis = lots.reduce((sum, lot) => sum + lot.totalCost, 0);
  const averagePrice = quantity > 0 ? costBasis / quantity : 0;

  return {
    quantity,
    costBasis,
    averagePrice,
    realizedGainLoss,
    totalDividends,
    lots,
  };
}

/**
 * Aggregate positions across all instruments and accounts, converting everything to the reporting currency.
 *
 * @param historicalRates - Map of "currency:date" → reporting currency rate (for cost basis conversion)
 * @param currentRates - Map of currency → current reporting currency rate (for market value conversion)
 * @param reportingCurrency - The target reporting currency (default: 'DKK')
 */
export function aggregatePositions(
  transactions: Transaction[],
  instruments: Map<number, Instrument>,
  accounts: Map<number, string>,
  currentPrices: Map<string, number>,
  historicalRates: Map<string, number>,
  currentRates: Map<string, number>,
  reportingCurrency = 'DKK'
): Position[] {
  // Group transactions by (instrumentId, accountId)
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = `${tx.instrumentId}:${tx.accountId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const positions: Position[] = [];

  for (const [key, txs] of groups) {
    const [instrumentId, accountId] = key.split(':').map(Number);
    const instrument = instruments.get(instrumentId);
    if (!instrument) continue;

    const currency = instrument.currency;

    // Convert fees from fee_currency to instrument currency before FIFO calculation
    const adjustedTxs = txs.map(tx => {
      if (tx.fee > 0 && tx.feeCurrency && tx.feeCurrency !== currency) {
        const feeRate = tx.feeCurrency === reportingCurrency
          ? 1.0
          : (historicalRates.get(`${tx.feeCurrency}:${tx.date}`) ?? 1.0);
        const instrumentRate = historicalRates.get(`${currency}:${tx.date}`) ?? 1.0;
        return { ...tx, fee: instrumentRate > 0 ? (tx.fee * feeRate) / instrumentRate : tx.fee };
      }
      return tx;
    });

    const result = computePosition(adjustedTxs);
    if (result.quantity === 0 && result.realizedGainLoss === 0 && result.totalDividends === 0) continue;

    const currentFxRate = currentRates.get(currency) ?? 1.0;

    // Convert cost basis to reporting currency using historical rates per lot
    let convertedCostBasis = 0;
    for (const lot of result.lots) {
      const historicalRate = historicalRates.get(`${currency}:${lot.date}`) ?? 1.0;
      convertedCostBasis += lot.totalCost * historicalRate;
    }

    // Convert realized gain/loss and dividends using current rate (approximation)
    const convertedRealizedGainLoss = result.realizedGainLoss * currentFxRate;
    const convertedDividends = result.totalDividends * currentFxRate;

    // Current value in reporting currency
    const currentPrice = currentPrices.get(instrument.yahooSymbol || instrument.isin) ?? null;
    const convertedCurrentValue = currentPrice !== null ? currentPrice * result.quantity * currentFxRate : null;
    const convertedUnrealizedGainLoss = convertedCurrentValue !== null ? convertedCurrentValue - convertedCostBasis : 0;

    // Current price in reporting currency
    const convertedCurrentPrice = currentPrice !== null ? currentPrice * currentFxRate : null;

    // Average price in reporting currency
    const convertedAveragePrice = result.quantity > 0 ? convertedCostBasis / result.quantity : 0;

    positions.push({
      instrument,
      accountId,
      accountName: accounts.get(accountId) || 'Unknown',
      quantity: result.quantity,
      costBasis: convertedCostBasis,
      averagePrice: convertedAveragePrice,
      realizedGainLoss: convertedRealizedGainLoss,
      unrealizedGainLoss: convertedUnrealizedGainLoss,
      currentPrice: convertedCurrentPrice,
      currentValue: convertedCurrentValue,
      dayChange: null,
      dayChangePercent: null,
      totalDividends: convertedDividends,
      reportingCurrency,
    });
  }

  return positions;
}
