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
      type TEXT NOT NULL CHECK(type IN ('stock', 'fund', 'etf', 'crypto')),
      currency TEXT NOT NULL,
      exchange TEXT,
      has_quote_source INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      broker TEXT NOT NULL CHECK(broker IN ('saxo', 'nordnet', 'metamask')),
      wallet_address TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      instrument_id INTEGER NOT NULL REFERENCES instruments(id),
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'dividend')),
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings (key, value) VALUES ('reporting_currency', 'DKK');
  `);

  // Migrate: add classification columns to instruments
  const cols = db.prepare("PRAGMA table_info(instruments)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map(c => c.name));
  if (!colNames.has('sector')) db.exec('ALTER TABLE instruments ADD COLUMN sector TEXT');
  if (!colNames.has('industry')) db.exec('ALTER TABLE instruments ADD COLUMN industry TEXT');
  if (!colNames.has('country')) db.exec('ALTER TABLE instruments ADD COLUMN country TEXT');

  // Migrate: widen CHECK constraints for crypto/metamask support
  // Uses transactions to be atomic — no orphaned _old tables on crash
  const tableExists = (name: string) =>
    !!(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));

  // Clean up any leftover _old tables from previous failed migrations
  if (tableExists('instruments_old') && tableExists('instruments')) {
    db.exec('DROP TABLE instruments_old');
  } else if (tableExists('instruments_old') && !tableExists('instruments')) {
    db.exec('ALTER TABLE instruments_old RENAME TO instruments');
  }
  if (tableExists('accounts_old') && tableExists('accounts')) {
    db.exec('DROP TABLE accounts_old');
  } else if (tableExists('accounts_old') && !tableExists('accounts')) {
    db.exec('ALTER TABLE accounts_old RENAME TO accounts');
  }
  if (tableExists('transactions_old') && tableExists('transactions')) {
    db.exec('DROP TABLE transactions_old');
  } else if (tableExists('transactions_old') && !tableExists('transactions')) {
    db.exec('ALTER TABLE transactions_old RENAME TO transactions');
  }

  const instrumentSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name='instruments'").get() as { sql: string } | undefined)?.sql ?? '';
  if (instrumentSql && !instrumentSql.includes("'crypto'")) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`ALTER TABLE instruments RENAME TO instruments_old`);
      db.exec(`CREATE TABLE instruments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isin TEXT UNIQUE NOT NULL,
        yahoo_symbol TEXT,
        ticker TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('stock', 'fund', 'etf', 'crypto')),
        currency TEXT NOT NULL,
        exchange TEXT,
        has_quote_source INTEGER DEFAULT 1,
        sector TEXT,
        industry TEXT,
        country TEXT
      )`);
      db.exec(`INSERT INTO instruments SELECT * FROM instruments_old`);
      db.exec(`DROP TABLE instruments_old`);
    })();
    db.pragma('foreign_keys = ON');
  }

  const accountSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name='accounts'").get() as { sql: string } | undefined)?.sql ?? '';
  if (accountSql && !accountSql.includes("'metamask'")) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`ALTER TABLE accounts RENAME TO accounts_old`);
      db.exec(`CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        broker TEXT NOT NULL CHECK(broker IN ('saxo', 'nordnet', 'metamask')),
        wallet_address TEXT
      )`);
      db.exec(`INSERT INTO accounts (id, name, broker) SELECT id, name, broker FROM accounts_old`);
      db.exec(`DROP TABLE accounts_old`);
    })();
    db.pragma('foreign_keys = ON');
  }

  // Migrate: widen transactions CHECK constraint to include 'dividend'
  const txSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name='transactions'").get() as { sql: string } | undefined)?.sql ?? '';
  if (txSql && !txSql.includes("'dividend'")) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`ALTER TABLE transactions RENAME TO transactions_old`);
      db.exec(`CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        instrument_id INTEGER NOT NULL REFERENCES instruments(id),
        type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'dividend')),
        date TEXT NOT NULL,
        quantity REAL NOT NULL,
        price REAL NOT NULL,
        fee REAL NOT NULL DEFAULT 0,
        fee_currency TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`);
      db.exec(`INSERT INTO transactions SELECT * FROM transactions_old`);
      db.exec(`DROP TABLE transactions_old`);
    })();
    db.pragma('foreign_keys = ON');
  }

  // Migrate: add wallet_address column to accounts if missing
  const accCols = db.prepare("PRAGMA table_info(accounts)").all() as Array<{ name: string }>;
  const accColNames = new Set(accCols.map(c => c.name));
  if (!accColNames.has('wallet_address')) db.exec('ALTER TABLE accounts ADD COLUMN wallet_address TEXT');

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
    type: row.type as 'stock' | 'fund' | 'etf' | 'crypto',
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
    type: row.type as 'buy' | 'sell' | 'dividend',
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
    broker: row.broker as 'saxo' | 'nordnet' | 'metamask',
    walletAddress: (row.wallet_address as string) ?? null,
  };
}

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}
