import {
  createSignalDeal,
  dedupe,
  extractKeywords,
  extractTickerCandidates,
  fetchJson,
  safeText,
} from "../signal-utils.js";

function buildXQuery(thesis) {
  const tickers = extractTickerCandidates(thesis);
  const keywords = extractKeywords(thesis).slice(0, 5);
  const positiveTerms = [
    '"raises guidance"',
    '"beats estimates"',
    '"contract win"',
    '"FDA approval"',
    "partnership",
    "buyback",
    "upgrade",
    "breakout",
  ];

  const marketClause = tickers.length
    ? tickers.map(ticker => `$${ticker}`).join(" OR ")
    : keywords.map(keyword => `"${keyword}"`).join(" OR ") || "stocks OR nasdaq OR nyse";

  return `(${marketClause}) (${positiveTerms.join(" OR ")}) lang:en -is:retweet -is:reply`;
}

export async function fetchXSignals({ env, thesis, geoFilter, limit = 8 }) {
  if (!env.xBearerToken) {
    return {
      deals: [],
      trace: ["X Posts disabled. Set X_BEARER_TOKEN to enable social catalyst scans."],
      sourceStatus: {
        key: "x",
        label: "X Posts",
        status: "disabled",
        detail: "Set X_BEARER_TOKEN in .env.local",
      },
    };
  }

  const keywords = extractKeywords(thesis);
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", buildXQuery(thesis));
  url.searchParams.set("max_results", "20");
  url.searchParams.set("sort_order", "relevancy");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("tweet.fields", "created_at,lang,public_metrics,author_id");
  url.searchParams.set("user.fields", "name,username,verified,public_metrics");

  const payload = await fetchJson(url.toString(), {
    headers: {
      Authorization: `Bearer ${env.xBearerToken}`,
      Accept: "application/json",
    },
  });

  const users = new Map((payload.includes?.users || []).map(user => [user.id, user]));

  const deals = dedupe(payload.data || [], post => post.id)
    .map(post => {
      const author = users.get(post.author_id);
      const tickers = extractTickerCandidates(post.text);
      if (!tickers.length && !keywords.some(keyword => post.text.toLowerCase().includes(keyword))) {
        return null;
      }

      return createSignalDeal({
        id: post.id,
        company: tickers[0] ? `$${tickers[0]}` : `@${author?.username || "market"}`,
        ticker: tickers[0] || "",
        title: `X catalyst post from @${author?.username || "unknown"}`,
        summary: safeText(post.text),
        publishedAt: post.created_at,
        sourceLabel: "X API",
        sourceKind: "social",
        url: `https://x.com/i/web/status/${post.id}`,
        geoFilter,
        keywords,
        socialMetrics: post.public_metrics,
        extraDataSources: author?.verified ? ["Verified account"] : [],
      });
    })
    .filter(Boolean)
    .filter(deal => deal.confidence_score >= 58)
    .slice(0, limit);

  return {
    deals,
    trace: [`Fetched ${payload.data?.length || 0} live X posts from recent search.`],
    sourceStatus: {
      key: "x",
      label: "X Posts",
      status: deals.length ? "online" : "warning",
      detail: deals.length
        ? `${deals.length} social catalysts with ticker or thesis matches`
        : "Search completed, but no actionable post matched the current scan",
    },
  };
}
