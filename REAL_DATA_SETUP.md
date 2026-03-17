# Real Data Setup

This app now loads live data through server-side `/api` routes instead of relying on seed data.

## What is live today

- `SEC EDGAR`: current `8-K`, `10-K`, and `10-Q` Atom feeds
- `arXiv`: recent papers matching the active thesis
- `Discord`: webhook delivery through the backend route
- `Anthropic`: optional server-side memo generation if `ANTHROPIC_API_KEY` is set

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
SEC_USER_AGENT=quant-analyst/1.0 (your-email@example.com)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
DISCORD_WEBHOOK_URL=
```

`SEC_USER_AGENT` should include a real contact string for SEC fair-access compliance.

## Local development

Run:

```bash
npm run dev
```

The Vite dev server now mounts the API routes directly, so the frontend can call `/api/bootstrap`, `/api/run-agent`, `/api/memo`, and `/api/discord` without a second process.

## Production

The `api/` directory contains serverless entrypoints for deployment platforms that support Node-style API routes, including Vercel.

## Current limitations

- Patent and private-company funding providers are not configured in this build.
- The live opportunity cards are currently strongest for public-company filing signals and research momentum.
- Memo generation falls back to a deterministic template if Anthropic is not configured.
