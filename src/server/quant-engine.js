import { normalizeSourceSelection } from "../shared/source-options.js";
import { fetchAlpacaSignals } from "./providers/alpaca.js";
import { fetchBenzingaSignals } from "./providers/benzinga.js";
import { fetchFmpQuoteMap, fetchFmpSignals } from "./providers/fmp.js";
import { fetchResearchSignals } from "./providers/research.js";
import { fetchSecSignals } from "./providers/sec.js";
import { fetchXSignals } from "./providers/x.js";
import {
  DEFAULT_THESIS,
  applyQuoteToDeal,
  dedupe,
  extractKeywords,
  safeText,
  summarizeSentence,
} from "./signal-utils.js";

const PROVIDERS = [
  {
    sourceKey: "SEC Filings",
    key: "sec",
    label: "SEC EDGAR",
    run: fetchSecSignals,
  },
  {
    sourceKey: "X Posts",
    key: "x",
    label: "X Posts",
    run: fetchXSignals,
  },
  {
    sourceKey: "Benzinga News",
    key: "benzinga",
    label: "Benzinga News",
    run: fetchBenzingaSignals,
  },
  {
    sourceKey: "Alpaca News",
    key: "alpaca",
    label: "Alpaca News",
    run: fetchAlpacaSignals,
  },
  {
    sourceKey: "FMP Stock News",
    key: "fmp",
    label: "FMP Stock News",
    run: fetchFmpSignals,
  },
  {
    sourceKey: "Academic Papers",
    key: "research",
    label: "arXiv Research",
    run: fetchResearchSignals,
  },
];

function getEnv() {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
    secUserAgent:
      process.env.SEC_USER_AGENT ||
      "quant-analyst/1.0 (set SEC_USER_AGENT with a real contact address)",
    xBearerToken: process.env.X_BEARER_TOKEN || "",
    benzingaApiToken: process.env.BENZINGA_API_TOKEN || "",
    alpacaApiKeyId: process.env.APCA_API_KEY_ID || "",
    alpacaApiSecretKey: process.env.APCA_API_SECRET_KEY || "",
    fmpApiKey: process.env.FMP_API_KEY || "",
  };
}

function computeDiversityIndex(deals) {
  if (!deals.length) {
    return 0;
  }

  const counts = deals.reduce((accumulator, deal) => {
    accumulator[deal.geography] = (accumulator[deal.geography] || 0) + 1;
    return accumulator;
  }, {});

  const total = deals.length;
  const sumSquares = Object.values(counts).reduce((sum, count) => {
    const ratio = count / total;
    return sum + ratio * ratio;
  }, 0);

  return Number((1 - sumSquares).toFixed(2));
}

function finalizeDeals(deals) {
  return dedupe(
    deals.filter(
      deal =>
        deal &&
        deal.confidence_score >= 55 &&
        ((deal.catalyst_score || 0) >= -3 || (deal.breakout_score || 0) >= 65),
    ),
    deal =>
      [
        deal.ticker || "",
        safeText(deal.headline).toLowerCase(),
        safeText(deal.published_at).slice(0, 16),
        safeText(deal.source_url).replace(/\?.*$/, ""),
      ].join("|"),
  ).sort(
    (left, right) =>
      right.confidence_score - left.confidence_score || (right.breakout_score || 0) - (left.breakout_score || 0),
  );
}

async function maybeApplyQuoteConfirmation({ env, deals, activeSources, sourceStatus, trace }) {
  if (!env.fmpApiKey || activeSources["FMP Stock News"] === false) {
    return { deals, sourceStatus, trace };
  }

  const quoteMap = await fetchFmpQuoteMap({
    apiKey: env.fmpApiKey,
    tickers: deals.map(deal => deal.ticker).filter(Boolean),
  });

  if (!quoteMap.size) {
    return { deals, sourceStatus, trace };
  }

  const nextDeals = deals.map(deal =>
    deal.ticker && quoteMap.has(deal.ticker) ? applyQuoteToDeal(deal, quoteMap.get(deal.ticker)) : deal,
  );

  const nextStatus = sourceStatus.map(status =>
    status.key === "fmp" && status.status !== "disabled"
      ? {
          ...status,
          detail: `${status.detail}; ${quoteMap.size} tickers received quote confirmation`,
        }
      : status,
  );

  return {
    deals: nextDeals,
    sourceStatus: nextStatus,
    trace: [...trace, `Pulled FMP quotes for ${quoteMap.size} tickers to confirm breakout conditions.`],
  };
}

function buildTimeSignals({ deals, papers, thesis, sourceStatus }) {
  const keywords = extractKeywords(thesis);
  const topDeal = deals[0];
  const topPaper = papers[0];
  const liveSources = sourceStatus
    .filter(source => source.status === "online")
    .map(source => source.label)
    .slice(0, 3);

  return [
    `${deals.length} live catalyst signals are active across ${liveSources.join(", ") || "the configured feeds"}.`,
    topDeal
      ? `${topDeal.company}${topDeal.ticker ? ` (${topDeal.ticker})` : ""}: ${topDeal.signal_type} with ${topDeal.confidence_score}/100 confidence and breakout score ${topDeal.breakout_score || 0}/100.`
      : "No current signal cleared the positive catalyst threshold.",
    topPaper
      ? `Research overlay: "${summarizeSentence(topPaper.title, 88)}" published ${safeText(topPaper.published).slice(0, 10)}.`
      : `Keyword focus: ${keywords.slice(0, 4).join(", ") || DEFAULT_THESIS}.`,
  ];
}

function buildMarketSummary({ deals, papers, thesis, geoFilter, sourceStatus }) {
  const keywords = extractKeywords(thesis);
  const sourceList = sourceStatus
    .filter(source => source.status === "online")
    .map(source => source.label)
    .join(", ");
  const topDeals = deals.slice(0, 3).map(deal => `${deal.company} (${deal.signal_type})`);
  const geoNote = geoFilter && geoFilter !== "Global" ? `${geoFilter} filter applied.` : "Global scan.";

  return [
    `This scan is tuned for positive catalyst breaks and momentum continuation, using ${sourceList || "the available feeds"}. ${geoNote}`,
    keywords.length
      ? `Current thesis keywords: ${keywords.join(", ")}.`
      : `Current thesis profile: ${DEFAULT_THESIS}.`,
    topDeals.length
      ? `Top actionable names: ${topDeals.join(", ")}.`
      : "No high-confidence catalyst or breakout candidate is active right now.",
    papers.length
      ? `${papers.length} arXiv matches are available as optional context, but the dashboard prioritizes tradable news and social catalysts first.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildKpis({ deals, papers, latencyMs, sourceStatus }) {
  const avgConfidence = deals.length
    ? Math.round(deals.reduce((sum, deal) => sum + deal.confidence_score, 0) / deals.length)
    : 0;
  const diversityIndex = computeDiversityIndex(deals);
  const highConfidence = deals.filter(deal => deal.confidence_score >= 70).length;
  const newsSignals = deals.filter(deal => deal.source_kind !== "research").length;
  const socialSignals = deals.filter(deal => deal.source_kind === "social").length;
  const breakoutSignals = deals.filter(deal => (deal.breakout_score || 0) >= 70).length;

  return {
    liveDeals: deals.length,
    newsSignals,
    socialSignals,
    breakoutSignals,
    researchSignals: papers.length,
    avgConfidence,
    sourceCoverage: sourceStatus.filter(
      source => source.status === "online" || source.status === "warning",
    ).length,
    queryLatencyMs: latencyMs,
    diversityIndex,
    ddr: deals.length ? Math.round((highConfidence / deals.length) * 100) : 0,
    ttm: Number((latencyMs / 60_000).toFixed(1)),
    apg: deals.length,
    dix: diversityIndex,
    isr: Number((1 + papers.length / 4).toFixed(1)),
  };
}

function buildWarnings({ env, activeSources, sourceStatus }) {
  const warnings = [];

  if (!env.anthropicApiKey) {
    warnings.push("Anthropic memo generation is not configured. The app will use a deterministic memo fallback.");
  }

  if (activeSources["X Posts"] && !env.xBearerToken) {
    warnings.push("X Posts are enabled in the scan controls, but X_BEARER_TOKEN is not set. See DATA_SOURCES.md.");
  }

  if (activeSources["Benzinga News"] && !env.benzingaApiToken) {
    warnings.push("Benzinga News is enabled in the scan controls, but BENZINGA_API_TOKEN is not set. See DATA_SOURCES.md.");
  }

  if (activeSources["Alpaca News"] && (!env.alpacaApiKeyId || !env.alpacaApiSecretKey)) {
    warnings.push("Alpaca News is enabled in the scan controls, but APCA_API_KEY_ID / APCA_API_SECRET_KEY are missing. See DATA_SOURCES.md.");
  }

  if (activeSources["FMP Stock News"] && !env.fmpApiKey) {
    warnings.push("FMP Stock News is enabled in the scan controls, but FMP_API_KEY is not set. This also disables quote-based breakout confirmation. See DATA_SOURCES.md.");
  }

  if (sourceStatus.some(source => source.status === "offline")) {
    warnings.push("One or more live providers failed during this scan. Check credentials, provider availability, and rate limits.");
  }

  return warnings;
}

export async function buildLiveSnapshot({ thesis, geoFilter, sources }) {
  const env = getEnv();
  const startedAt = Date.now();
  const activeSources = normalizeSourceSelection(sources);
  const trace = [];
  const sourceStatus = [];
  let deals = [];
  let papers = [];

  const enabledProviders = PROVIDERS.filter(provider => activeSources[provider.sourceKey] !== false);
  const disabledProviders = PROVIDERS.filter(provider => activeSources[provider.sourceKey] === false);

  disabledProviders.forEach(provider => {
    sourceStatus.push({
      key: provider.key,
      label: provider.label,
      status: "disabled",
      detail: "Disabled in scan controls",
    });
    trace.push(`${provider.label} disabled by user.`);
  });

  const results = await Promise.allSettled(
    enabledProviders.map(provider =>
      provider.run({
        env,
        thesis,
        geoFilter,
      }),
    ),
  );

  results.forEach((result, index) => {
    const provider = enabledProviders[index];
    if (result.status === "fulfilled") {
      const payload = result.value || {};
      deals.push(...(payload.deals || []));
      papers.push(...(payload.papers || []));
      trace.push(...(payload.trace || []));
      if (payload.sourceStatus) {
        sourceStatus.push(payload.sourceStatus);
      }
      return;
    }

    sourceStatus.push({
      key: provider.key,
      label: provider.label,
      status: "offline",
      detail: result.reason?.message || "Provider request failed",
    });
    trace.push(`${provider.label} failed: ${result.reason?.message || "Provider request failed"}`);
  });

  const quoteConfirmed = await maybeApplyQuoteConfirmation({
    env,
    deals,
    activeSources,
    sourceStatus,
    trace,
  });

  deals = finalizeDeals(quoteConfirmed.deals).slice(0, 16);
  const nextSourceStatus = quoteConfirmed.sourceStatus;
  const nextTrace = quoteConfirmed.trace;

  return {
    ok: true,
    deals,
    marketSummary: buildMarketSummary({
      deals,
      papers,
      thesis,
      geoFilter,
      sourceStatus: nextSourceStatus,
    }),
    timeSignals: buildTimeSignals({
      deals,
      papers,
      thesis,
      sourceStatus: nextSourceStatus,
    }),
    sourceStatus: nextSourceStatus,
    warnings: buildWarnings({
      env,
      activeSources,
      sourceStatus: nextSourceStatus,
    }),
    kpis: buildKpis({
      deals,
      papers,
      latencyMs: Date.now() - startedAt,
      sourceStatus: nextSourceStatus,
    }),
    trace: nextTrace,
    generatedAt: new Date().toISOString(),
    defaultThesis: DEFAULT_THESIS,
  };
}

function deterministicMemo(deal) {
  return [
    `Executive summary: ${deal.company} generated a live ${deal.signal_type.toLowerCase()} signal sourced from ${(deal.data_sources || []).join(", ")}. The current read-through is ${deal.confidence_score}/100 confidence with breakout score ${deal.breakout_score || 0}/100.`,
    `Market opportunity and thesis: ${deal.investment_thesis} The headline context is: ${deal.description}`,
    `Risks and mitigants: ${deal.risk_factors} Confirm the primary source, liquidity, premarket volume, and whether the move is already extended before acting on it.`,
    `Recommendation: treat this as a live catalyst candidate rather than a finished investment memo. Review ${deal.source_url || "the source link"} and confirm the tape before sizing the trade.`,
  ].join("\n\n");
}

export async function generateMemoFromDeal(deal) {
  const { anthropicApiKey, anthropicModel } = getEnv();
  if (!anthropicApiKey) {
    return {
      ok: true,
      memo: deterministicMemo(deal),
      mode: "deterministic",
    };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 900,
      system:
        "You are a senior trading analyst. Write a concise 4-paragraph memo with an executive summary, catalyst read-through, risks, and trading recommendation. Use only the supplied evidence and stay factual.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(deal, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Anthropic memo request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  const memo =
    data.content
      ?.filter(block => block.type === "text")
      .map(block => block.text)
      .join("\n") || deterministicMemo(deal);

  return {
    ok: true,
    memo,
    mode: "anthropic",
  };
}

export async function sendDiscordAlert({ deal, webhookUrl }) {
  const { discordWebhookUrl } = getEnv();
  const target = webhookUrl || discordWebhookUrl;

  if (!target) {
    throw new Error("Discord webhook is not configured");
  }

  const color =
    deal.confidence_score >= 80 ? 0x00ff88 : deal.confidence_score >= 70 ? 0xffd600 : 0xff8800;

  const response = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "QuantAI Analyst",
      embeds: [
        {
          title: `Catalyst signal: ${deal.company}`,
          description: deal.description,
          color,
          fields: [
            { name: "Signal", value: deal.signal_type || "N/A", inline: true },
            { name: "Confidence", value: `${deal.confidence_score}/100`, inline: true },
            {
              name: "Breakout",
              value: `${deal.breakout_score || 0}/100`,
              inline: true,
            },
            { name: "Ticker", value: deal.ticker || "N/A", inline: true },
            { name: "Location", value: deal.location || "N/A", inline: true },
            { name: "Source", value: (deal.data_sources || []).join(", ") || "N/A", inline: false },
            {
              name: "Thesis",
              value: summarizeSentence(deal.investment_thesis || "No thesis available", 500),
              inline: false,
            },
          ],
          footer: {
            text: deal.source_url || "Generated by QuantAI",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${details}`);
  }

  return {
    ok: true,
    sentAt: new Date().toISOString(),
  };
}
