import * as XLSX from 'xlsx';
import type { ParsedTransaction } from './nordnet';

/**
 * Parse Saxo XLSX export.
 *
 * Saxo's export format has:
 * - Transaction Type: "Trade" for buy/sell rows
 * - Event: "Buy 2 @ 396.98 USD" — encodes direction, quantity, price, currency
 * - Instrument ISIN, Instrument, Instrument currency, Exchange Description
 * - Total cost: fee (negative number)
 * - Currency: account currency (DKK)
 */
export function parseSaxoXlsx(buffer: ArrayBuffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const results: ParsedTransaction[] = [];

  for (const row of rows) {
    // Flexible column matching — returns first column whose name includes the key
    const findValue = (keys: string[]) => {
      for (const key of keys) {
        const match = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()));
        if (match && row[match] != null) return row[match];
      }
      return null;
    };

    // Exact column lookup (for disambiguation, e.g. "Instrument currency" vs "Currency")
    const exactValue = (col: string) => row[col] ?? null;

    // Try Event column first: "Buy 2 @ 396.98 USD"
    const event = String(exactValue('Event') || '');
    const eventMatch = event.match(/^(Buy|Sell|Købt|Solgt)\s+([\d.,]+)\s+@\s+([\d.,]+)/i);

    let txType: 'buy' | 'sell' | null = null;
    let eventQty = 0;
    let eventPrice = 0;

    if (eventMatch) {
      const dir = eventMatch[1].toLowerCase();
      if (dir === 'buy' || dir === 'købt') txType = 'buy';
      else if (dir === 'sell' || dir === 'solgt') txType = 'sell';
      eventQty = parseFloat(eventMatch[2].replace(',', '.'));
      eventPrice = parseFloat(eventMatch[3].replace(',', '.'));
    }

    // Fall back to legacy column detection
    if (!txType) {
      const rawType = String(findValue(['Buy/Sell', 'Handelstype', 'Action']) || '').toLowerCase();
      if (rawType.includes('buy') || rawType.includes('køb') || rawType.includes('bought')) {
        txType = 'buy';
      } else if (rawType.includes('sell') || rawType.includes('salg') || rawType.includes('sold')) {
        txType = 'sell';
      }
    }

    // Parse dividend rows: Corporate action + Cash dividend
    if (!txType) {
      const rawTxType = String(findValue(['Transaction Type', 'Transaktionstype']) || '').toLowerCase();
      if (rawTxType.includes('corporate action') && event.toLowerCase().includes('cash dividend')) {
        const isin = String(findValue(['ISIN']) || '');
        if (!isin || isin.length !== 12) continue;

        const rawDate = findValue(['Trade Date', 'Handelsdato', 'Date', 'Dato']);
        const date = normalizeExcelDate(rawDate);
        if (!date) continue;

        const bookedAmount = Math.abs(Number(exactValue('Booked Amount') ?? findValue(['Booked Amount']) ?? 0));
        const conversionRate = Number(exactValue('Conversion Rate') ?? findValue(['Conversion Rate']) ?? 0);
        const instrumentCurrency = String(exactValue('Instrument currency') || '');
        const fallbackCurrency = String(findValue(['Currency', 'Valuta']) || 'DKK');
        const currency = instrumentCurrency || fallbackCurrency;

        // Back-calculate amount in instrument currency
        const amount = conversionRate > 0 ? bookedAmount / conversionRate : bookedAmount;

        results.push({
          date,
          type: 'dividend',
          isin,
          name: String(findValue(['Instrument', 'Værdipapir', 'Name', 'Navn']) || isin),
          quantity: 0,
          price: amount,
          fee: 0,
          currency,
          feeCurrency: fallbackCurrency,
        });
        continue;
      }
      continue;
    }

    // "Instrument ISIN" is matched by findValue(['ISIN']) via includes
    const isin = String(findValue(['ISIN']) || '');
    if (!isin || isin.length !== 12) continue;

    const rawDate = findValue(['Trade Date', 'Handelsdato', 'Date', 'Dato']);
    const date = normalizeExcelDate(rawDate);
    if (!date) continue;

    const quantity = eventQty || Math.abs(Number(findValue(['Amount', 'Antal', 'Quantity', 'Units'])) || 0);
    const price = eventPrice || Math.abs(Number(findValue(['Price', 'Kurs', 'Pris'])) || 0);
    const fee = Math.abs(Number(exactValue('Total cost') ?? findValue(['Commission', 'Kurtage', 'Fee', 'Gebyr']) ?? 0));

    // Prefer "Instrument currency" over generic "Currency" (which is account currency)
    const instrumentCurrency = String(exactValue('Instrument currency') || '');
    const fallbackCurrency = String(findValue(['Currency', 'Valuta']) || 'DKK');
    const currency = instrumentCurrency || fallbackCurrency;

    results.push({
      date,
      type: txType,
      isin,
      name: String(findValue(['Instrument', 'Værdipapir', 'Name', 'Navn']) || isin),
      quantity,
      price,
      fee,
      currency,
      feeCurrency: fallbackCurrency,
    });
  }

  return results;
}

function normalizeExcelDate(value: unknown): string {
  if (!value) return '';

  // Excel serial number
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10);

  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }

  return '';
}
