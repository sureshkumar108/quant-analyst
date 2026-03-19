# Data Sources

This document covers the live data providers wired into this repo as of March 18, 2026.

## What Phase 1 Adds

- `SEC EDGAR` for filing-driven catalysts
- `X API recent search` for social/news-break posts with cashtags or thesis matches
- `Benzinga News` for structured breaking-news headlines
- `Alpaca News` for tradable news headlines through Alpaca's market-data stack
- `FMP Stock News` for stock news, press releases, and quote-based breakout confirmation
- `arXiv Research` as an optional context layer

## Environment Variables

Copy `.env.example` to `.env.local` and set only the providers you want to enable:

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

## Setup By Provider

### SEC EDGAR

- Purpose: filing-driven catalysts such as 8-K, 6-K, 10-Q, and 10-K.
- Key needed: no API key, but `SEC_USER_AGENT` is required.
- Subscription details: free.
- Official docs:
  - https://www.sec.gov/edgar/search/
  - https://www.sec.gov/os/accessing-edgar-data

### X API

- Purpose: scan recent social/news-break posts for cashtags and positive catalyst language.
- Env var: `X_BEARER_TOKEN`
- How to get it:
  - Create an app in the X Developer Console.
  - Generate a bearer token for read access.
- Current pricing/access on March 18, 2026:
  - X documents the API as pay-per-usage rather than the old fixed public tiers.
  - Exact usage cost is shown in the Developer Console for your project.
  - The public pricing docs describe a pay-per-use model and note a 2 million Post-read monthly cap before enterprise.
- Official docs:
  - https://docs.x.com/x-api/getting-started/pricing
  - https://docs.x.com/x-api/posts/search/quickstart/recent-search
  - https://docs.x.com/x-api/fundamentals/authentication/oauth-2-0/bearer-token

### Benzinga News

- Purpose: structured breaking-news headlines that are more tradable than generic consumer-news feeds.
- Env var: `BENZINGA_API_TOKEN`
- How to get it:
  - Request API access or a trial from Benzinga.
  - Use the issued token in `BENZINGA_API_TOKEN`.
- Current pricing/access on March 18, 2026:
  - Benzinga exposes a public trial/contact path.
  - Production pricing is not publicly posted on the docs pages; expect a sales or partner conversation.
- Official docs:
  - https://docs.benzinga.com/ws-reference/data-websocket/get-news-stream
  - https://www.benzinga.com/apis/data-partners/alpha-news-stream/

### Alpaca News

- Purpose: market-data account path for news scanning, useful if you already trade through Alpaca.
- Env vars:
  - `APCA_API_KEY_ID`
  - `APCA_API_SECRET_KEY`
- How to get them:
  - Create an Alpaca account.
  - Generate market-data API credentials from the dashboard.
- Current pricing/access on March 18, 2026:
  - `Basic` is listed as free.
  - `Algo Trader Plus` is listed at `$99/month`.
- Official docs:
  - https://docs.alpaca.markets/docs/about-market-data-api
  - https://docs.alpaca.markets/docs/historical-news-data
  - https://docs.alpaca.markets/v1.3/reference/news

### Financial Modeling Prep

- Purpose: stock news, press releases, and quote confirmation used here for breakout scoring.
- Env var: `FMP_API_KEY`
- How to get it:
  - Create an account at Financial Modeling Prep.
  - Copy the API key from the dashboard.
- Current pricing/access on March 18, 2026:
  - `Starter`: `$22/month`
  - `Premium`: `$59/month`
  - `Ultimate`: `$149/month`
- Official docs:
  - https://site.financialmodelingprep.com/developer/docs/pricing
  - https://site.financialmodelingprep.com/developer/docs/stable/stock-news
  - https://site.financialmodelingprep.com/developer/docs/stable/press-releases
  - https://site.financialmodelingprep.com/developer/docs/stable/quote

### arXiv Research

- Purpose: optional context overlay, not a primary day-trading feed.
- Key needed: none.
- Subscription details: free.
- Official docs:
  - https://info.arxiv.org/help/api/index.html

## How The App Uses These Feeds

- `SEC EDGAR`: detects filing-based catalysts and filters them through the active thesis.
- `X API`: scans recent posts for cashtags plus positive catalyst language.
- `Benzinga` and `Alpaca`: contribute headline-driven news breaks.
- `FMP`: contributes stock news and press releases, then enriches ticker matches with quotes for breakout scoring.
- `arXiv`: stays optional and is mainly there for thematic context, not intraday execution.

## Current Breakout Logic

Phase 1 breakout confirmation is intentionally simple and server-side:

- positive catalyst headline or filing text
- recentness
- thesis keyword overlap
- FMP quote change percentage
- day-high proximity
- volume versus average volume when available

The app exposes this as `breakout_score` on each signal card.

## Current Limitations

- This is still request-time scanning, not a 24/7 ingestion daemon.
- X uses recent search in this build, not a persistent filtered stream worker.
- Benzinga is integrated as an HTTP news source in this phase, not a persistent WebSocket consumer.
- There is no watchlist database, market-open scheduler, or persistent alert history beyond the client session.
- For serious intraday automation, the next step is a background worker plus a database-backed event store.
