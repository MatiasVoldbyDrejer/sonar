# Sonar

Personal Investment Analyst — Next.js app tracking stocks/funds/ETFs across Saxo Invest and Nordnet with FIFO cost basis and AI analysis via Perplexity.

## Tech Stack

- Next.js 16 (App Router, React 19, TypeScript, `src/` directory)
- Tailwind CSS v4 with `@tailwindcss/postcss`
- SQLite via better-sqlite3 (WAL mode)
- shadcn/ui components (in `src/components/ui/`)
- yahoo-finance2 for market data
- Perplexity API via `@ai-sdk/perplexity` and AI SDK (`ai` package)
- Recharts for charting, Framer Motion for animations
- xlsx for Saxo import, CSV parsing for Nordnet import

## Commands

```bash
npm run dev      # Dev server on port 3100 (--webpack flag)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Project Structure

```
src/
  app/
    layout.tsx, page.tsx, globals.css
    api/                  # Route handlers
      accounts/           # Account-level endpoints
      analysis/           # Perplexity analysis endpoints
      chart/[symbol]/     # Chart data
      chats/              # Chat persistence
      instruments/        # Instrument CRUD
      portfolio/          # Portfolio aggregation
      positions/          # Position queries
      quotes/             # Live quotes
      search/             # Instrument search
      transactions/       # Transaction CRUD
    chat/                 # Chat page
    instrument/           # Instrument detail page
    settings/             # Settings page
  components/
    ui/                   # shadcn/ui primitives (button, card, dialog, etc.)
    dashboard.tsx         # Main dashboard
    sidebar.tsx           # Navigation sidebar
    instrument-detail.tsx # Instrument detail view
    chat-view.tsx         # Chat interface
    portfolio-chart.tsx   # Portfolio chart
    price-chart.tsx       # Price chart
    settings-page.tsx     # Settings view
  hooks/
    use-position-lookup.tsx
  lib/
    db.ts                 # SQLite singleton, schema init, row mappers
    chat-db.ts            # Chat persistence layer
    portfolio-engine.ts   # FIFO cost basis, position aggregation
    market-data.ts        # yahoo-finance2 wrapper with TTL cache
    perplexity.ts         # Perplexity API client
    prompts.ts            # Three-tier prompt templates
    load-positions.ts     # Position loading helpers
    fx.ts                 # Currency conversion
    utils.ts              # General utilities
    import/
      nordnet.ts          # Nordnet CSV parser
      saxo.ts             # Saxo XLSX parser
  types/
    index.ts              # All TypeScript types
```

Path alias: `@/*` maps to `./src/*`.

## Database

- SQLite file: `sonar.db` in project root (with WAL mode: `.db-shm`, `.db-wal`)
- Seeds two accounts on first init: "Saxo Invest" and "Nordnet"
- Positions are computed from transactions at query time, not stored
- Analysis cache in SQLite with TTL: briefing 12h, scan 6h, instrument 4h
- Quote cache in-memory 5min, chart cache 30min

## Architecture Notes

- Positions are derived from transactions using FIFO cost basis -- never stored directly
- yahoo-finance2 types are strict and fragile -- always use `any` casts for API results and add defensive error handling
- Perplexity analysis uses the sonar-pro model via the AI SDK

## Styling Convention

Use **inline styles** (React `style` prop) instead of Tailwind utility classes for component styling. Reference CSS custom properties from `globals.css` in inline styles:

```tsx
// Correct
<div style={{ borderRadius: 'var(--radius-md)', borderColor: 'var(--border)' }}>

// Avoid
<div className="rounded-md border-border">
```

The `globals.css` `@theme inline` block and `:root` variables are the design token source. shadcn/ui components keep their own className conventions.

## gstack

Use the `/browse` skill from gstack for all web browsing. **Never** use `mcp__claude-in-chrome__*` tools.

Available skills:
- `/browse` — Web browsing via headless Chromium
- `/plan-ceo-review` — CEO/founder-mode plan review
- `/plan-eng-review` — Eng manager-mode plan review
- `/review` — Pre-landing PR review
- `/ship` — Ship workflow (merge, test, review, bump, PR)
- `/retro` — Weekly engineering retrospective
