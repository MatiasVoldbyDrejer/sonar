import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'sonar.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS instruments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      isin TEXT UNIQUE NOT NULL,
      yahoo_symbol TEXT,
      ticker TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('stock', 'fund', 'etf')),
      currency TEXT NOT NULL,
      exchange TEXT,
      has_quote_source INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      broker TEXT NOT NULL CHECK(broker IN ('saxo', 'nordnet'))
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      instrument_id INTEGER NOT NULL REFERENCES instruments(id),
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell')),
      date TEXT NOT NULL,
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      fee REAL NOT NULL DEFAULT 0,
      fee_currency TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      query_used TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fx_rates (
      currency_pair TEXT NOT NULL,
      date TEXT NOT NULL,
      rate REAL NOT NULL,
      PRIMARY KEY (currency_pair, date)
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Daily Analysis',
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chats_date ON chats(date);
  `);

  // Migrate: add classification columns to instruments
  const cols = db.prepare("PRAGMA table_info(instruments)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map(c => c.name));
  if (!colNames.has('sector')) db.exec('ALTER TABLE instruments ADD COLUMN sector TEXT');
  if (!colNames.has('industry')) db.exec('ALTER TABLE instruments ADD COLUMN industry TEXT');
  if (!colNames.has('country')) db.exec('ALTER TABLE instruments ADD COLUMN country TEXT');

  // Seed default accounts if empty
  const count = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO accounts (name, broker) VALUES (?, ?)');
    insert.run('Saxo Invest', 'saxo');
    insert.run('Nordnet', 'nordnet');
  }
}

// Row mappers
export function mapInstrumentRow(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    isin: row.isin as string,
    yahooSymbol: row.yahoo_symbol as string | null,
    ticker: row.ticker as string | null,
    name: row.name as string,
    type: row.type as 'stock' | 'fund' | 'etf',
    currency: row.currency as string,
    exchange: row.exchange as string | null,
    hasQuoteSource: Boolean(row.has_quote_source),
    sector: (row.sector as string) ?? null,
    industry: (row.industry as string) ?? null,
    country: (row.country as string) ?? null,
  };
}

export function mapTransactionRow(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    accountId: row.account_id as number,
    instrumentId: row.instrument_id as number,
    type: row.type as 'buy' | 'sell',
    date: row.date as string,
    quantity: row.quantity as number,
    price: row.price as number,
    fee: row.fee as number,
    feeCurrency: row.fee_currency as string | null,
    notes: row.notes as string | null,
    createdAt: row.created_at as string | undefined,
  };
}

export function mapAccountRow(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    name: row.name as string,
    broker: row.broker as 'saxo' | 'nordnet',
  };
}
