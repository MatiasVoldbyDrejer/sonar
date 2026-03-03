export interface ParsedTransaction {
  date: string;
  type: 'buy' | 'sell' | 'dividend';
  isin: string;
  name: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  feeCurrency: string;
}

/**
 * Parse Nordnet CSV export (semicolon-separated, Nordic format).
 * Expected columns vary but typically include:
 * Id, Bogføringsdag, Handelsdag, Valørdag, Transaktionstype, Værdipapirer, ISIN, Antal, Kurs, Beløb, Vekselkurs, Transaktionsgebyr, Valuta
 */
export function parseNordnetCsv(csvContent: string): ParsedTransaction[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Detect separator (semicolon or tab)
  const separator = lines[0].includes('\t') ? '\t' : ';';
  const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, '').toLowerCase());

  // Find column indices with flexible matching
  const findCol = (names: string[]) =>
    headers.findIndex(h => names.some(n => h.includes(n)));

  const dateCol = findCol(['handelsdag', 'handelsdato', 'trade date']);
  const typeCol = findCol(['transaktionstype', 'type', 'transaction type']);
  const isinCol = findCol(['isin']);
  const nameCol = findCol(['værdipapirer', 'verdipapir', 'instrument', 'name']);
  const qtyCol = findCol(['antal', 'antall', 'quantity', 'amount']);
  const priceCol = findCol(['kurs', 'pris', 'price']);
  const feeCol = findCol(['transaktionsgebyr', 'kurtasje', 'commission', 'fee']);
  const currencyCol = findCol(['valuta', 'currency']);
  const amountCol = findCol(['beløb', 'belopp', 'amount']);

  // Find the currency column that follows "Beløb" (for dividend amount currency)
  // Nordnet has multiple "Valuta" columns — the one after Beløb is the amount currency
  const amountCurrencyCol = amountCol >= 0
    ? headers.findIndex((h, idx) => idx > amountCol && (h.includes('valuta') || h.includes('currency')))
    : -1;

  const results: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim().replace(/"/g, ''));
    if (cols.length < 5) continue;

    const rawType = typeCol >= 0 ? cols[typeCol]?.toLowerCase() : '';

    const parseNumber = (val: string) => {
      if (!val) return 0;
      // Handle Nordic number format: 1.234,56 → 1234.56
      return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;
    };

    // Parse dividend rows (UDBYTTE but not UDBYTTESKAT)
    if (rawType === 'udbytte' || rawType === 'utbytte' || rawType === 'dividend') {
      const isin = isinCol >= 0 ? cols[isinCol] : '';
      if (!isin || isin.length !== 12) continue;

      const date = dateCol >= 0 ? normalizeDate(cols[dateCol]) : '';
      if (!date) continue;

      const amount = Math.abs(amountCol >= 0 ? parseNumber(cols[amountCol]) : 0);
      if (amount === 0) continue;

      const currency = amountCurrencyCol >= 0 ? cols[amountCurrencyCol] || 'DKK' : 'DKK';

      results.push({
        date,
        type: 'dividend',
        isin,
        name: nameCol >= 0 ? cols[nameCol] : isin,
        quantity: 0,
        price: amount,
        fee: 0,
        currency,
        feeCurrency: currency,
      });
      continue;
    }

    let txType: 'buy' | 'sell' | null = null;

    if (rawType.includes('køb') || rawType.includes('kjøp') || rawType.includes('buy')) {
      txType = 'buy';
    } else if (rawType.includes('salg') || rawType.includes('sälj') || rawType.includes('sell')) {
      txType = 'sell';
    }

    if (!txType) continue;

    const isin = isinCol >= 0 ? cols[isinCol] : '';
    if (!isin || isin.length !== 12) continue;

    const date = dateCol >= 0 ? normalizeDate(cols[dateCol]) : '';
    if (!date) continue;

    results.push({
      date,
      type: txType,
      isin,
      name: nameCol >= 0 ? cols[nameCol] : isin,
      quantity: Math.abs(qtyCol >= 0 ? parseNumber(cols[qtyCol]) : 0),
      price: Math.abs(priceCol >= 0 ? parseNumber(cols[priceCol]) : 0),
      fee: Math.abs(feeCol >= 0 ? parseNumber(cols[feeCol]) : 0),
      currency: currencyCol >= 0 ? cols[currencyCol] || 'DKK' : 'DKK',
      feeCurrency: currencyCol >= 0 ? cols[currencyCol] || 'DKK' : 'DKK',
    });
  }

  return results;
}

function normalizeDate(dateStr: string): string {
  // Handle various date formats: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
  if (!dateStr) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const parts = dateStr.split(/[-/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    // Assume DD-MM-YYYY
    return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  return '';
}
