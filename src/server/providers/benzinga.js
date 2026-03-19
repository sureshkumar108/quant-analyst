import {
  createSignalDeal,
  dedupe,
  extractKeywords,
  extractTickerCandidates,
  fetchJson,
  safeText,
} from "../signal-utils.js";

function articleMatchesThesis(article, tickers, keywords) {
  const haystack = safeText([article.title, article.summary, article.tickers.join(" ")].join(" "))
    .toLowerCase();

  if (tickers.length && article.tickers.some(ticker => tickers.includes(ticker))) {
    return true;
  }

  return !keywords.length || keywords.some(keyword => haystack.includes(keyword));
}

function normalizeTickers(item) {
  if (Array.isArray(item.stocks)) {
    return item.stocks
      .map(stock => safeText(stock.name || stock.symbol || stock.ticker))
      .filter(Boolean);
  }

  if (Array.isArray(item.tickers)) {
    return item.tickers.map(ticker => safeText(ticker)).filter(Boolean);
  }

  return extractTickerCandidates(`${item.title || ""} ${item.teaser || ""}`);
}

export async function fetchBenzingaSignals({ env, thesis, geoFilter, limit = 8 }) {
  if (!env.benzingaApiToken) {
    return {
      deals: [],
      trace: ["Benzinga News disabled. Set BENZINGA_API_TOKEN to enable it."],
      sourceStatus: {
        key: "benzinga",
        label: "Benzinga News",
        status: "disabled",
        detail: "Set BENZINGA_API_TOKEN in .env.local",
      },
    };
  }

  const tickers = extractTickerCandidates(thesis);
  const keywords = extractKeywords(thesis);
  const url = new URL("https://api.benzinga.com/api/v2/news");
  url.searchParams.set("token", env.benzingaApiToken);
  url.searchParams.set("pageSize", "25");
  if (tickers.length) {
    url.searchParams.set("tickers", tickers.join(","));
  }

  const payload = await fetchJson(url.toString(), {
    headers: { Accept: "application/json" },
  });

  const rawItems = Array.isArray(payload) ? payload : payload.data || [];
  const articles = dedupe(
    rawItems.map(item => ({
      id: safeText(item.id || item.url || item.title),
      title: safeText(item.title || item.headline),
      summary: safeText(item.teaser || item.summary || item.body),
      url: safeText(item.url || item.link),
      updatedAt: safeText(item.updated || item.updated_at || item.created || item.created_at),
      tickers: normalizeTickers(item),
    })),
    item => `${item.id}-${item.updatedAt}`,
  );

  const deals = articles
    .filter(article => articleMatchesThesis(article, tickers, keywords))
    .map(article =>
      createSignalDeal({
        id: article.id,
        company: article.tickers[0] ? `$${article.tickers[0]}` : "Benzinga headline",
        ticker: article.tickers[0] || "",
        title: article.title,
        summary: article.summary,
        publishedAt: article.updatedAt,
        sourceLabel: "Benzinga",
        sourceKind: "news",
        url: article.url,
        geoFilter,
        keywords,
      }),
    )
    .filter(deal => deal.confidence_score >= 58)
    .slice(0, limit);

  return {
    deals,
    trace: [`Fetched ${rawItems.length} Benzinga news items.`],
    sourceStatus: {
      key: "benzinga",
      label: "Benzinga News",
      status: deals.length ? "online" : "warning",
      detail: deals.length
        ? `${deals.length} breaking-news catalysts matched the active scan`
        : "Feed reachable, but no Benzinga item matched the current scan",
    },
  };
}
