import {
  createSignalDeal,
  dedupe,
  extractKeywords,
  extractTickerCandidates,
  fetchJson,
  safeText,
} from "../signal-utils.js";

function articleMatchesThesis(article, tickers, keywords) {
  const haystack = safeText([article.headline, article.summary, article.symbols.join(" ")].join(" "))
    .toLowerCase();

  if (tickers.length && article.symbols.some(symbol => tickers.includes(symbol))) {
    return true;
  }

  return !keywords.length || keywords.some(keyword => haystack.includes(keyword));
}

export async function fetchAlpacaSignals({ env, thesis, geoFilter, limit = 8 }) {
  if (!env.alpacaApiKeyId || !env.alpacaApiSecretKey) {
    return {
      deals: [],
      trace: ["Alpaca News disabled. Set APCA_API_KEY_ID and APCA_API_SECRET_KEY to enable it."],
      sourceStatus: {
        key: "alpaca",
        label: "Alpaca News",
        status: "disabled",
        detail: "Set APCA_API_KEY_ID and APCA_API_SECRET_KEY in .env.local",
      },
    };
  }

  const tickers = extractTickerCandidates(thesis);
  const keywords = extractKeywords(thesis);
  const url = new URL("https://data.alpaca.markets/v1beta1/news");
  url.searchParams.set("limit", "20");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("include_content", "false");
  if (tickers.length) {
    url.searchParams.set("symbols", tickers.join(","));
  }

  const payload = await fetchJson(url.toString(), {
    headers: {
      "APCA-API-KEY-ID": env.alpacaApiKeyId,
      "APCA-API-SECRET-KEY": env.alpacaApiSecretKey,
      Accept: "application/json",
    },
  });

  const rawItems = Array.isArray(payload) ? payload : payload.news || [];
  const articles = dedupe(
    rawItems.map(item => ({
      id: safeText(item.id || item.url || item.headline),
      headline: safeText(item.headline),
      summary: safeText(item.summary),
      url: safeText(item.url),
      createdAt: safeText(item.created_at || item.updated_at),
      symbols: Array.isArray(item.symbols) ? item.symbols.map(symbol => safeText(symbol)) : [],
      source: safeText(item.source),
    })),
    item => `${item.id}-${item.createdAt}`,
  );

  const deals = articles
    .filter(article => articleMatchesThesis(article, tickers, keywords))
    .map(article =>
      createSignalDeal({
        id: article.id,
        company: article.symbols[0] ? `$${article.symbols[0]}` : article.source || "Alpaca headline",
        ticker: article.symbols[0] || "",
        title: article.headline,
        summary: article.summary,
        publishedAt: article.createdAt,
        sourceLabel: "Alpaca",
        sourceKind: "news",
        url: article.url,
        geoFilter,
        keywords,
        extraDataSources: article.source ? [article.source] : [],
      }),
    )
    .filter(deal => deal.confidence_score >= 56)
    .slice(0, limit);

  return {
    deals,
    trace: [`Fetched ${rawItems.length} live Alpaca news items.`],
    sourceStatus: {
      key: "alpaca",
      label: "Alpaca News",
      status: deals.length ? "online" : "warning",
      detail: deals.length
        ? `${deals.length} tradable headlines matched the active scan`
        : "Feed reachable, but no Alpaca headline matched the current scan",
    },
  };
}
