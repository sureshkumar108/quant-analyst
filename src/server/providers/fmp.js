import {
  createSignalDeal,
  dedupe,
  extractKeywords,
  extractTickerCandidates,
  fetchJson,
  safeText,
} from "../signal-utils.js";

function withApiKey(path, apiKey, params = {}) {
  const url = new URL(path);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

function articleMatchesThesis(article, tickers, keywords) {
  const haystack = safeText(
    [article.symbol, article.title, article.text, article.content, article.site].join(" "),
  ).toLowerCase();

  if (tickers.length && tickers.some(ticker => haystack.includes(ticker.toLowerCase()))) {
    return true;
  }

  return !keywords.length || keywords.some(keyword => haystack.includes(keyword));
}

function normalizeFmpArticle(item, type) {
  return {
    id: safeText(item.id || item.url || `${type}-${item.title}`),
    symbol: safeText(item.symbol || item.ticker || item.symbols || ""),
    title: safeText(item.title || item.headline),
    text: safeText(item.text || item.content || item.summary),
    site: safeText(item.site || item.publisher),
    url: safeText(item.url || item.link),
    publishedAt: safeText(item.publishedDate || item.date || item.publishedAt),
    type,
  };
}

export async function fetchFmpSignals({ env, thesis, geoFilter, limit = 8 }) {
  if (!env.fmpApiKey) {
    return {
      deals: [],
      trace: ["FMP Stock News disabled. Set FMP_API_KEY to enable stock news and quote checks."],
      sourceStatus: {
        key: "fmp",
        label: "FMP Stock News",
        status: "disabled",
        detail: "Set FMP_API_KEY in .env.local",
      },
    };
  }

  const tickers = extractTickerCandidates(thesis);
  const keywords = extractKeywords(thesis);
  const newsUrl = withApiKey(
    "https://financialmodelingprep.com/stable/news/stock-latest",
    env.fmpApiKey,
    { page: 0, limit: 25 },
  );
  const pressUrl = tickers.length
    ? withApiKey(
        "https://financialmodelingprep.com/stable/news/press-releases",
        env.fmpApiKey,
        { symbols: tickers.join(",") },
      )
    : withApiKey(
        "https://financialmodelingprep.com/stable/news/press-releases-latest",
        env.fmpApiKey,
        { page: 0, limit: 15 },
      );

  const [newsPayload, pressPayload] = await Promise.all([
    fetchJson(newsUrl),
    fetchJson(pressUrl),
  ]);

  const articles = dedupe(
    [
      ...(Array.isArray(newsPayload) ? newsPayload : []).map(item => normalizeFmpArticle(item, "stock news")),
      ...(Array.isArray(pressPayload) ? pressPayload : []).map(item =>
        normalizeFmpArticle(item, "press release"),
      ),
    ],
    item => `${item.symbol}-${item.title}-${item.publishedAt}`,
  );

  const deals = articles
    .filter(article => articleMatchesThesis(article, tickers, keywords))
    .map(article =>
      createSignalDeal({
        id: article.id,
        company: article.symbol ? `$${article.symbol}` : article.site || "FMP headline",
        ticker: article.symbol || extractTickerCandidates(article.title)[0] || "",
        title: article.title,
        summary: article.text,
        publishedAt: article.publishedAt,
        sourceLabel: "FMP",
        sourceKind: "news",
        url: article.url,
        geoFilter,
        keywords,
        extraDataSources: [article.type],
      }),
    )
    .filter(deal => deal.confidence_score >= 56)
    .slice(0, limit);

  return {
    deals,
    trace: [
      `Fetched ${(Array.isArray(newsPayload) ? newsPayload.length : 0) + (Array.isArray(pressPayload) ? pressPayload.length : 0)} FMP headlines and press releases.`,
    ],
    sourceStatus: {
      key: "fmp",
      label: "FMP Stock News",
      status: deals.length ? "online" : "warning",
      detail: deals.length
        ? `${deals.length} news catalysts matched; quote confirmation runs after aggregation`
        : "Feed reachable, but no stock news or press release matched the current scan",
    },
  };
}

export async function fetchFmpQuoteMap({ apiKey, tickers }) {
  const uniqueTickers = dedupe(
    (tickers || []).map(ticker => safeText(ticker).toUpperCase()).filter(Boolean),
  ).slice(0, 12);

  if (!apiKey || !uniqueTickers.length) {
    return new Map();
  }

  const quotePairs = await Promise.all(
    uniqueTickers.map(async ticker => {
      const url = withApiKey("https://financialmodelingprep.com/stable/quote", apiKey, {
        symbol: ticker,
      });
      const payload = await fetchJson(url);
      const quote = Array.isArray(payload) ? payload[0] : payload;
      return [ticker, quote];
    }),
  );

  return new Map(quotePairs.filter(([, quote]) => quote));
}
