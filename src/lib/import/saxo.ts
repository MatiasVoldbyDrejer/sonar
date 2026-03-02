import * as XLSX from 'xlsx';
import type { ParsedTransaction } from './nordnet';

/**
 * Parse Saxo XLSX export.
 * Saxo exports have columns like:
 * Trade Date, Instrument, ISIN, Buy/Sell, Amount, Price, Commission, Currency
 */
export function parseSaxoXlsx(buffer: ArrayBuffer): ParsedTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  const results: ParsedTransaction[] = [];

  for (const row of rows) {
    // Flexible column matching
    const findValue = (keys: string[]) => {
      for (const key of keys) {
        const match = Object.keys(row).find(k => k.toLowerCase().includes(key.toLowerCase()));
        if (match && row[match] != null) return row[match];
      }
      return null;
    };

    const rawType = String(findValue(['Buy/Sell', 'Type', 'Handelstype', 'Action']) || '').toLowerCase();
    let txType: 'buy' | 'sell' | null = null;

    if (rawType.includes('buy') || rawType.includes('køb') || rawType.includes('bought')) {
      txType = 'buy';
    } else if (rawType.includes('sell') || rawType.includes('salg') || rawType.includes('sold')) {
      txType = 'sell';
    }

    if (!txType) continue;

    const isin = String(findValue(['ISIN']) || '');
    if (!isin || isin.length !== 12) continue;

    const rawDate = findValue(['Trade Date', 'Handelsdato', 'Date', 'Dato']);
    const date = normalizeExcelDate(rawDate);
    if (!date) continue;

    results.push({
      date,
      type: txType,
      isin,
      name: String(findValue(['Instrument', 'Værdipapir', 'Name', 'Navn']) || isin),
      quantity: Math.abs(Number(findValue(['Amount', 'Antal', 'Quantity', 'Units'])) || 0),
      price: Math.abs(Number(findValue(['Price', 'Kurs', 'Pris'])) || 0),
      fee: Math.abs(Number(findValue(['Commission', 'Kurtage', 'Fee', 'Gebyr'])) || 0),
      currency: String(findValue(['Currency', 'Valuta']) || 'DKK'),
      feeCurrency: String(findValue(['Currency', 'Valuta']) || 'DKK'),
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
