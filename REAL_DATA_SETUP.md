# Real Data Setup

This app now loads live data through server-side `/api` routes instead of relying on seed data.

## What is live today

- `SEC EDGAR`: current filing-driven catalysts
- `X API`: recent-search social catalyst scan when `X_BEARER_TOKEN` is set
- `Benzinga`: breaking-news scan when `BENZINGA_API_TOKEN` is set
- `Alpaca`: news scan when `APCA_API_KEY_ID` and `APCA_API_SECRET_KEY` are set
- `FMP`: stock news, press releases, and quote confirmation when `FMP_API_KEY` is set
- `arXiv`: optional context layer
- `Discord`: webhook delivery through the backend route
- `Anthropic`: optional server-side memo generation if `ANTHROPIC_API_KEY` is set

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
SEC_USER_AGENT=quant-analyst/1.0 (your-email@example.com)
X_BEARER_TOKEN=
BENZINGA_API_TOKEN=
APCA_API_KEY_ID=
APCA_API_SECRET_KEY=
FMP_API_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
DISCORD_WEBHOOK_URL=
```

`SEC_USER_AGENT` should include a real contact string for SEC fair-access compliance.

For provider-specific setup, current subscription details, and official documentation links, see `DATA_SOURCES.md`.

## Local development

Run:

```bash
npm run dev
```

The Vite dev server now mounts the API routes directly, so the frontend can call `/api/bootstrap`, `/api/run-agent`, `/api/memo`, and `/api/discord` without a second process.

## Production

The `api/` directory contains serverless entrypoints for deployment platforms that support Node-style API routes, including Vercel.

## Current limitations

- This is still request-time scanning, not a persistent stream processor.
- The strongest current setup for day trading is `X + Benzinga or Alpaca + FMP + SEC`.
- Quote-based breakout confirmation depends on `FMP_API_KEY`.
- Memo generation falls back to a deterministic template if Anthropic is not configured.
