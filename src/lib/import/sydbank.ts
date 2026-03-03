import type { ParsedTransaction } from './nordnet';

/**
 * Parse a Nordic-format number string (1.003,00 → 1003.00).
 * Strips thousands separators (.) and replaces decimal comma with dot.
 */
function parseNordicNumber(val: string): number {
  if (!val || !val.trim()) return 0;
  const cleaned = val.trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Normalize DD-MM-YYYY to YYYY-MM-DD.
 */
function normalizeDate(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return '';
}

/**
 * Parse Sydbank CSV export (semicolon-separated, Nordic format).
 * Columns: Dato;Papir;Fondskode;ISIN;Detaljer;Antal (stk./nom.);Kurs;Valuta;Depotnummer;Depotnavn;Depottype;Depotejer
 *
 * Transaction type is extracted from the Detaljer column:
 *   "Køb ordrenr. ..." → buy
 *   "Salg ordrenr. ..." → sell
 *   Everything else (Ombytning, Overført, etc.) → skipped
 *
 * Fees are not included in Sydbank's depot export.
 */
export function parseSydbankCsv(csvContent: string): ParsedTransaction[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, '').toLowerCase());

  const findCol = (names: string[]) =>
    headers.findIndex(h => names.some(n => h.includes(n)));

  const dateCol = findCol(['dato']);
  const nameCol = findCol(['papir']);
  const isinCol = findCol(['isin']);
  const detailsCol = findCol(['detaljer']);
  const quantityCol = findCol(['antal']);
  const priceCol = findCol(['kurs']);
  const currencyCol = findCol(['valuta']);

  if (dateCol < 0 || isinCol < 0 || detailsCol < 0 || quantityCol < 0 || priceCol < 0) {
    return [];
  }

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.trim().replace(/"/g, ''));

    const isin = cols[isinCol] ?? '';
    if (!isin || isin.length !== 12) continue;

    // Detect transaction type from Detaljer
    const details = (cols[detailsCol] ?? '').toLowerCase();
    let type: 'buy' | 'sell' | null = null;
    if (details.includes('køb')) type = 'buy';
    else if (details.includes('salg')) type = 'sell';
    else continue; // Skip ombytning, overført, etc.

    const date = normalizeDate(cols[dateCol] ?? '');
    if (!date) continue;

    const price = parseNordicNumber(cols[priceCol] ?? '');
    if (price <= 0) continue;

    const currency = (cols[currencyCol] ?? '').toUpperCase();
    if (!currency) continue;

    const rawQuantity = (cols[quantityCol] ?? '').replace(/[+\-]/g, '');
    const quantity = parseNordicNumber(rawQuantity);
    if (quantity <= 0) continue;

    const name = cols[nameCol] ?? isin;

    transactions.push({
      date,
      type,
      isin,
      name,
      quantity,
      price,
      fee: 0,
      currency,
      feeCurrency: currency,
    });
  }

  return transactions;
}
