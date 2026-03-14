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
      broker TEXT NOT NULL CHECK(broker IN ('saxo', 'nordnet', 'metamask', 'sydbank')),
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

    CREATE TABLE IF NOT EXISTS recurring_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      prompt TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Europe/Copenhagen',
      active INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_chat_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('preference', 'feedback', 'investment')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS telegram_link_codes (
      code TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      chat_id TEXT,
      model_id TEXT,
      prompt TEXT,
      response_text TEXT,
      steps TEXT,
      total_input_tokens INTEGER,
      total_output_tokens INTEGER,
      duration_ms INTEGER,
      finish_reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate: whatsapp → telegram in chats source
  db.exec("UPDATE chats SET source = 'telegram' WHERE source = 'whatsapp'");

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

  // Migrate: fix corrupted FK reference (accounts_old → accounts) in transactions table
  const txSql2 = (db.prepare("SELECT sql FROM sqlite_master WHERE name='transactions'").get() as { sql: string } | undefined)?.sql ?? '';
  if (txSql2.includes('accounts_old')) {
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

  // Migrate: widen accounts CHECK constraint to include 'sydbank'
  const accSql2 = (db.prepare("SELECT sql FROM sqlite_master WHERE name='accounts'").get() as { sql: string } | undefined)?.sql ?? '';
  if (accSql2 && !accSql2.includes("'sydbank'")) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec(`ALTER TABLE accounts RENAME TO accounts_old`);
      db.exec(`CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        broker TEXT NOT NULL CHECK(broker IN ('saxo', 'nordnet', 'metamask', 'sydbank')),
        wallet_address TEXT
      )`);
      db.exec(`INSERT INTO accounts SELECT * FROM accounts_old`);
      db.exec(`DROP TABLE accounts_old`);
    })();
    db.pragma('foreign_keys = ON');
  }

  // Migrate: add wallet_address column to accounts if missing
  const accCols = db.prepare("PRAGMA table_info(accounts)").all() as Array<{ name: string }>;
  const accColNames = new Set(accCols.map(c => c.name));
  if (!accColNames.has('wallet_address')) db.exec('ALTER TABLE accounts ADD COLUMN wallet_address TEXT');

  // Migrate: add model column to recurring_tasks
  const taskCols = db.prepare("PRAGMA table_info(recurring_tasks)").all() as Array<{ name: string }>;
  if (!new Set(taskCols.map(c => c.name)).has('model')) {
    db.exec("ALTER TABLE recurring_tasks ADD COLUMN model TEXT DEFAULT 'gemini-flash'");
  }

  // Migrate: add source and recurring_task_id columns to chats
  const chatCols = db.prepare("PRAGMA table_info(chats)").all() as Array<{ name: string }>;
  const chatColNames = new Set(chatCols.map(c => c.name));
  if (!chatColNames.has('source')) db.exec("ALTER TABLE chats ADD COLUMN source TEXT NOT NULL DEFAULT 'user'");
  if (!chatColNames.has('recurring_task_id')) db.exec('ALTER TABLE chats ADD COLUMN recurring_task_id INTEGER');

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
    broker: row.broker as 'saxo' | 'nordnet' | 'metamask' | 'sydbank',
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

// Agent memory

export interface AgentMemory {
  id: number;
  name: string;
  type: 'preference' | 'feedback' | 'investment';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export function getAgentMemories(): AgentMemory[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM agent_memories ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
  return rows.map(row => ({
    id: row.id as number,
    name: row.name as string,
    type: row.type as AgentMemory['type'],
    content: row.content as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export function upsertAgentMemory(name: string, type: AgentMemory['type'], content: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO agent_memories (name, type, content)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      type = excluded.type,
      content = excluded.content,
      updated_at = datetime('now')
  `).run(name, type, content);
}

export function deleteAgentMemory(name: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM agent_memories WHERE name = ?').run(name);
  return result.changes > 0;
}

// Traces

export interface TraceStep {
  index: number;
  text: string;
  toolCalls: { toolName: string; args: unknown }[];
  toolResults: { toolName: string; args: unknown; result: unknown }[];
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  finishReason: string;
}

// Pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-6': { input: 15, output: 75 },
  'gemini-3-flash-preview': { input: 0.10, output: 0.40 },
  'gemini-3.1-flash-lite-preview': { input: 0.02, output: 0.08 },
};

function getModelPricing(modelId: string) {
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (modelId.includes(key) || key.includes(modelId)) return pricing;
  }
  return null;
}

function computeStepsCost(steps: TraceStep[]): number | null {
  let total = 0;
  let hasAnyPricing = false;
  for (const step of steps) {
    const pricing = getModelPricing(step.modelId);
    if (pricing) {
      hasAnyPricing = true;
      total += (step.inputTokens * pricing.input + step.outputTokens * pricing.output) / 1_000_000;
    }
  }
  return hasAnyPricing ? total : null;
}

export interface Trace {
  id: string;
  chatId: string | null;
  modelId: string;
  prompt: string;
  responseText: string;
  steps: TraceStep[];
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  finishReason: string;
  createdAt: string;
  costUsd: number | null;
}

export interface TraceSummary {
  id: string;
  chatId: string | null;
  modelId: string;
  prompt: string;
  toolCount: number;
  stepCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  createdAt: string;
  costUsd: number | null;
}

export function createTrace(data: {
  id: string;
  chatId: string | null;
  modelId: string;
  prompt: string;
  responseText: string;
  steps: TraceStep[];
  totalInputTokens: number;
  totalOutputTokens: number;
  durationMs: number;
  finishReason: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO traces (id, chat_id, model_id, prompt, response_text, steps, total_input_tokens, total_output_tokens, duration_ms, finish_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.id, data.chatId, data.modelId, data.prompt, data.responseText,
    JSON.stringify(data.steps), data.totalInputTokens, data.totalOutputTokens,
    data.durationMs, data.finishReason
  );
}

export function createTraceFromResult(opts: {
  chatId: string | null;
  prompt: string;
  result: { text: string; steps: any[]; finishReason?: string; response?: { modelId?: string } };
  fallbackModelId: string;
  startTime: number;
}): void {
  const { chatId, prompt, result, fallbackModelId, startTime } = opts;
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  createTrace({
    id: traceId,
    chatId,
    modelId: result.response?.modelId ?? fallbackModelId,
    prompt,
    responseText: result.text,
    steps: result.steps.map((step: any, i: number) => ({
      index: i,
      text: step.text ?? '',
      toolCalls: (step.toolCalls ?? []).map((tc: any) => ({ toolName: tc.toolName, args: tc.input })),
      toolResults: (step.toolResults ?? []).map((tr: any) => ({ toolName: tr.toolName, args: tr.input, result: tr.output })),
      inputTokens: step.usage?.inputTokens ?? 0,
      outputTokens: step.usage?.outputTokens ?? 0,
      modelId: step.response?.modelId ?? fallbackModelId,
      finishReason: step.finishReason ?? 'unknown',
    })),
    totalInputTokens: result.steps.reduce((sum: number, s: any) => sum + (s.usage?.inputTokens ?? 0), 0),
    totalOutputTokens: result.steps.reduce((sum: number, s: any) => sum + (s.usage?.outputTokens ?? 0), 0),
    durationMs: Date.now() - startTime,
    finishReason: result.finishReason ?? 'unknown',
  });
}

export function getTraceById(id: string): Trace | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM traces WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const steps = JSON.parse(row.steps as string) as TraceStep[];
  return {
    id: row.id as string,
    chatId: (row.chat_id as string) ?? null,
    modelId: row.model_id as string,
    prompt: row.prompt as string,
    responseText: row.response_text as string,
    steps,
    totalInputTokens: row.total_input_tokens as number,
    totalOutputTokens: row.total_output_tokens as number,
    durationMs: row.duration_ms as number,
    finishReason: row.finish_reason as string,
    createdAt: row.created_at as string,
    costUsd: computeStepsCost(steps),
  };
}

export function listTraces(limit = 30, cursor?: string, search?: string): TraceSummary[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (cursor) {
    conditions.push('created_at < (SELECT created_at FROM traces WHERE id = ?)');
    params.push(cursor);
  }
  if (search) {
    conditions.push('(prompt LIKE ? OR model_id LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  const rows = db.prepare(`SELECT id, chat_id, model_id, prompt, steps, total_input_tokens, total_output_tokens, duration_ms, created_at FROM traces ${where} ORDER BY created_at DESC LIMIT ?`).all(...params) as Array<Record<string, unknown>>;
  return rows.map(row => {
    const steps = JSON.parse(row.steps as string) as TraceStep[];
    const toolCount = steps.reduce((sum, s) => sum + s.toolCalls.length, 0);
    return {
      id: row.id as string,
      chatId: (row.chat_id as string) ?? null,
      modelId: row.model_id as string,
      prompt: (row.prompt as string).slice(0, 100),
      toolCount,
      stepCount: steps.length,
      totalInputTokens: row.total_input_tokens as number,
      totalOutputTokens: row.total_output_tokens as number,
      durationMs: row.duration_ms as number,
      createdAt: row.created_at as string,
      costUsd: computeStepsCost(steps),
    };
  });
}
