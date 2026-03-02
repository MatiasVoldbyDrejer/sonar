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

  for (const tx of sorted) {
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
    lots,
  };
}

/**
 * Aggregate positions across all instruments and accounts, converting everything to DKK.
 *
 * @param historicalRates - Map of "currency:date" → DKK rate (for cost basis conversion)
 * @param currentRates - Map of currency → current DKK rate (for market value conversion)
 */
export function aggregatePositionsDKK(
  transactions: Transaction[],
  instruments: Map<number, Instrument>,
  accounts: Map<number, string>,
  currentPrices: Map<string, number>,
  historicalRates: Map<string, number>,
  currentRates: Map<string, number>
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

    const result = computePosition(txs);
    if (result.quantity === 0 && result.realizedGainLoss === 0) continue;

    const currency = instrument.currency;
    const currentFxRate = currentRates.get(currency) ?? 1.0;

    // Convert cost basis to DKK using historical rates per lot
    let costBasisDKK = 0;
    for (const lot of result.lots) {
      const historicalRate = historicalRates.get(`${currency}:${lot.date}`) ?? 1.0;
      costBasisDKK += lot.totalCost * historicalRate;
    }

    // Convert realized gain/loss to DKK using current rate (approximation)
    const realizedGainLossDKK = result.realizedGainLoss * currentFxRate;

    // Current value in DKK
    const currentPrice = currentPrices.get(instrument.yahooSymbol || instrument.isin) ?? null;
    const currentValueDKK = currentPrice !== null ? currentPrice * result.quantity * currentFxRate : null;
    const unrealizedGainLossDKK = currentValueDKK !== null ? currentValueDKK - costBasisDKK : 0;

    // Current price in DKK
    const currentPriceDKK = currentPrice !== null ? currentPrice * currentFxRate : null;

    // Average price in DKK
    const averagePriceDKK = result.quantity > 0 ? costBasisDKK / result.quantity : 0;

    positions.push({
      instrument,
      accountId,
      accountName: accounts.get(accountId) || 'Unknown',
      quantity: result.quantity,
      costBasis: costBasisDKK,
      averagePrice: averagePriceDKK,
      realizedGainLoss: realizedGainLossDKK,
      unrealizedGainLoss: unrealizedGainLossDKK,
      currentPrice: currentPriceDKK,
      currentValue: currentValueDKK,
      reportingCurrency: 'DKK',
    });
  }

  return positions;
}
