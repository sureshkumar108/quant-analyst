export const DEFAULT_THESIS =
  "earnings beats, guidance raises, FDA approvals, contract wins, analyst upgrades, buybacks, AI partnerships";

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "analyst",
  "around",
  "because",
  "been",
  "being",
  "between",
  "breakout",
  "breakouts",
  "could",
  "despite",
  "expert",
  "focus",
  "from",
  "have",
  "into",
  "like",
  "look",
  "market",
  "more",
  "news",
  "over",
  "positive",
  "real",
  "scan",
  "scanning",
  "shares",
  "similar",
  "source",
  "sources",
  "stock",
  "stocks",
  "than",
  "that",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "trader",
  "twitter",
  "want",
  "with",
  "would",
]);

const TICKER_STOP_WORDS = new Set([
  "AI",
  "API",
  "CEO",
  "CFO",
  "EPS",
  "FDA",
  "IPO",
  "LLC",
  "NYSE",
  "SEC",
  "USA",
  "USD",
]);

const POSITIVE_CATALYST_RULES = [
  { label: "guidance raise", regex: /\b(raises?|raised|boosts?|boosted|increases?|increased)\s+guidance\b/i },
  { label: "earnings beat", regex: /\b(earnings|revenue|eps)\b[\s\S]{0,32}\b(beat|beats|above|tops)\b/i },
  { label: "contract win", regex: /\b(contract award|contract win|awarded contract|order win|purchase order|secures? order)\b/i },
  { label: "approval", regex: /\b(fda approval|clearance granted|approved by|eu approval|regulatory clearance)\b/i },
  { label: "partnership", regex: /\b(partnership|strategic collaboration|commercial agreement|distribution agreement)\b/i },
  { label: "buyback", regex: /\b(share repurchase|stock buyback|buyback authorization)\b/i },
  { label: "upgrade", regex: /\b(analyst upgrade|price target raised|upgraded to)\b/i },
  { label: "acquisition", regex: /\b(acquires?|acquisition|merger agreement|takeover)\b/i },
  { label: "special dividend", regex: /\b(special dividend|cash dividend increase)\b/i },
  { label: "launch", regex: /\b(product launch|commercial launch|launches?|rolled out)\b/i },
  { label: "new high", regex: /\b(new high|breaks? out|breakout|surges?|spikes?)\b/i },
];

const NEGATIVE_CATALYST_RULES = [
  { label: "offering", regex: /\b(offering|secondary offering|public offering|registered direct)\b/i },
  { label: "atm program", regex: /\b(at-the-market|atm program)\b/i },
  { label: "shelf", regex: /\b(shelf registration|s-3 filing)\b/i },
  { label: "guidance cut", regex: /\b(cuts? guidance|lowers? guidance|withdraws? guidance)\b/i },
  { label: "downgrade", regex: /\b(analyst downgrade|downgraded to|price target lowered)\b/i },
  { label: "investigation", regex: /\b(investigation|probe|subpoena|doj inquiry|sec inquiry)\b/i },
  { label: "bankruptcy", regex: /\b(bankruptcy|chapter 11|going concern)\b/i },
  { label: "dilution", regex: /\b(dilution|dilutive|warrant exercise|convertible note)\b/i },
  { label: "miss", regex: /\b(misses? estimates|below expectations|guidance miss)\b/i },
];

export const GEO_TERMS = {
  Global: [],
  "North America": ["united states", "canada", "mexico", "north america"],
  Europe: ["europe", "united kingdom", "germany", "france", "italy", "spain", "sweden"],
  "Asia Pacific": ["asia", "pacific", "japan", "china", "india", "korea", "singapore", "australia"],
  "Latin America": ["latin america", "colombia", "brazil", "argentina", "chile", "peru"],
  Africa: ["africa", "nigeria", "kenya", "south africa", "egypt", "morocco", "ghana"],
  "Middle East": ["middle east", "uae", "united arab emirates", "saudi", "israel", "qatar"],
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function safeText(value) {
  return String(value || "").trim();
}

export function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = safeText(value).replace(/[^0-9.-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePercent(value) {
  const parsed = toNumber(value);
  return parsed === null ? null : Number(parsed.toFixed(2));
}

export function decodeEntities(value) {
  return safeText(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function stripTags(value) {
  return decodeEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function pickTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? match[1] : "";
}

export function pickAttr(block, tagName, attrName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*${attrName}="([^"]+)"[^>]*>`, "i"));
  return match ? match[1] : "";
}

export function summarizeSentence(text, maxLength = 220) {
  const normalized = safeText(text).replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

export function dedupe(items, keyFn = item => item) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function extractKeywords(thesis) {
  const normalized = safeText(thesis || DEFAULT_THESIS)
    .toLowerCase()
    .replace(/[^a-z0-9\s/$-]/g, " ")
    .replace(/\s+/g, " ");

  const words = normalized
    .split(" ")
    .map(word => word.trim())
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word) && !word.startsWith("$"));

  return [...new Set(words)].slice(0, 10);
}

export function extractTickerCandidates(text) {
  const cashtags = Array.from(safeText(text).matchAll(/\$([A-Z]{1,5})(?=\b)/g)).map(match => match[1]);
  const upperTokens = safeText(text).match(/\b[A-Z]{2,5}\b/g) || [];

  return dedupe(
    [...cashtags, ...upperTokens].filter(token => !TICKER_STOP_WORDS.has(token)),
  ).slice(0, 12);
}

export function matchesGeography(text, geoFilter) {
  if (!geoFilter || geoFilter === "Global") {
    return true;
  }

  const haystack = safeText(text).toLowerCase();
  return (GEO_TERMS[geoFilter] || []).some(term => haystack.includes(term));
}

export function recencyDays(dateString) {
  if (!dateString) {
    return 365;
  }

  const parsed = new Date(dateString).getTime();
  if (!Number.isFinite(parsed)) {
    return 365;
  }

  const ageMs = Date.now() - parsed;
  return Math.max(0, Math.floor(ageMs / 86_400_000));
}

export function inferSector(text) {
  const haystack = safeText(text).toLowerCase();
  if (/(biotech|drug|clinical|protein|therapeutic|fda)/.test(haystack)) {
    return "Biotech";
  }
  if (/(energy|grid|solar|battery|oil|gas|uranium|power)/.test(haystack)) {
    return "Energy";
  }
  if (/(chip|semiconductor|compute|ai|software|quantum|data|cloud)/.test(haystack)) {
    return "Technology";
  }
  if (/(bank|credit|payment|insurance|financial|fintech)/.test(haystack)) {
    return "Financials";
  }
  if (/(retail|e-commerce|consumer|apparel)/.test(haystack)) {
    return "Consumer";
  }
  if (/(defense|military|aerospace|satellite)/.test(haystack)) {
    return "Defense";
  }
  return "Equities";
}

export function inferSubsector(text) {
  const haystack = safeText(text).toLowerCase();
  if (/(protein|therapeutic|clinical)/.test(haystack)) {
    return "Therapeutics";
  }
  if (/(semiconductor|chip)/.test(haystack)) {
    return "Semiconductors";
  }
  if (/(quantum)/.test(haystack)) {
    return "Quantum";
  }
  if (/(grid|battery|solar|uranium)/.test(haystack)) {
    return "Energy Systems";
  }
  if (/(ai|model|software|data|cloud)/.test(haystack)) {
    return "AI / Software";
  }
  if (/(bank|credit|payment)/.test(haystack)) {
    return "Capital Markets";
  }
  return "General";
}

export function inferGeography(text, geoFilter) {
  if (geoFilter && geoFilter !== "Global") {
    return geoFilter;
  }

  const haystack = safeText(text).toLowerCase();
  for (const [label, terms] of Object.entries(GEO_TERMS)) {
    if (label === "Global") {
      continue;
    }
    if (terms.some(term => haystack.includes(term))) {
      return label;
    }
  }
  return "North America";
}

export function inferLocation(text, geography) {
  const haystack = safeText(text).toLowerCase();
  if (/(united kingdom|uk)/.test(haystack)) {
    return "United Kingdom";
  }
  if (/estonia/.test(haystack)) {
    return "Estonia";
  }
  if (/colombia/.test(haystack)) {
    return "Colombia";
  }
  if (/nigeria/.test(haystack)) {
    return "Nigeria";
  }
  if (/canada/.test(haystack)) {
    return "Canada";
  }
  if (/japan/.test(haystack)) {
    return "Japan";
  }
  if (/germany/.test(haystack)) {
    return "Germany";
  }
  return geography === "North America" ? "United States" : geography;
}

export function inferTimeSensitivity(daysOld) {
  if (daysOld <= 1) {
    return "High";
  }
  if (daysOld <= 4) {
    return "Medium";
  }
  return "Low";
}

export function extractMoney(text) {
  const match = safeText(text).match(/\$ ?(\d+(?:\.\d+)?) ?(million|billion|m|bn|b)/i);
  if (!match) {
    return "";
  }
  return `$${match[1]}${match[2].toLowerCase().startsWith("b") ? "B" : "M"}`;
}

export function classifyCatalyst(text) {
  const haystack = safeText(text);
  const positiveTerms = POSITIVE_CATALYST_RULES.filter(rule => rule.regex.test(haystack)).map(
    rule => rule.label,
  );
  const negativeTerms = NEGATIVE_CATALYST_RULES.filter(rule => rule.regex.test(haystack)).map(
    rule => rule.label,
  );

  return {
    positiveTerms,
    negativeTerms,
    score: positiveTerms.length * 9 - negativeTerms.length * 12,
  };
}

export function inferSignalType(text, breakoutScore = 0) {
  const haystack = safeText(text).toLowerCase();
  if (breakoutScore >= 80 || /\b(breakout|new high|surges?|spikes?)\b/.test(haystack)) {
    return "Breakout";
  }
  if (/(approval|clearance|contract award|license|grant)/.test(haystack)) {
    return "Regulatory Tailwind";
  }
  if (/(buyback|acquisition|financing|investment|stake)/.test(haystack)) {
    return "Capital Inflow";
  }
  if (/(launch|partnership|guidance|earnings|upgrade|beats?)/.test(haystack)) {
    return "News Break";
  }
  if (/(platform|ai|drug|prototype)/.test(haystack)) {
    return "Tech Breakthrough";
  }
  return "Market Gap";
}

export function computeSocialProofScore(metrics = {}) {
  const likes = toNumber(metrics.like_count) || 0;
  const reposts = toNumber(metrics.retweet_count || metrics.repost_count) || 0;
  const replies = toNumber(metrics.reply_count) || 0;
  const quotes = toNumber(metrics.quote_count) || 0;
  return clamp(Math.round(Math.log10(1 + likes + reposts * 3 + replies * 2 + quotes * 2) * 8), 0, 18);
}

export function computeBreakoutScore(quote = {}) {
  const price = toNumber(quote.price);
  const dayHigh = toNumber(quote.dayHigh);
  const dayLow = toNumber(quote.dayLow);
  const volume = toNumber(quote.volume);
  const avgVolume = toNumber(quote.avgVolume);
  const changePct = parsePercent(quote.changesPercentage);

  let score = 35;

  if (changePct !== null) {
    if (changePct >= 2) {
      score += 12;
    }
    if (changePct >= 5) {
      score += 10;
    }
    if (changePct >= 10) {
      score += 8;
    }
  }

  if (volume && avgVolume) {
    const ratio = volume / avgVolume;
    if (ratio >= 1) {
      score += 10;
    }
    if (ratio >= 2) {
      score += 12;
    }
    if (ratio >= 4) {
      score += 8;
    }
  }

  if (price && dayHigh && price >= dayHigh * 0.995) {
    score += 10;
  }

  if (price && dayLow && dayHigh && price >= dayLow + (dayHigh - dayLow) * 0.8) {
    score += 5;
  }

  return clamp(Math.round(score), 0, 99);
}

export function computeConfidenceScore({
  matchCount = 0,
  daysOld = 365,
  sourceCount = 1,
  catalystScore = 0,
  socialProof = 0,
  breakoutScore = 0,
}) {
  const score =
    55 +
    matchCount * 5 +
    sourceCount * 5 +
    catalystScore +
    socialProof +
    breakoutScore * 0.15 -
    Math.min(daysOld, 14) * 3;

  return clamp(Math.round(score), 35, 97);
}

function quoteSummary(quote, breakoutScore) {
  if (!quote || breakoutScore <= 0) {
    return "";
  }

  const changePct = parsePercent(quote.changesPercentage);
  const volume = toNumber(quote.volume);
  const avgVolume = toNumber(quote.avgVolume);
  const volumePart =
    volume && avgVolume ? ` Volume is running ${(volume / avgVolume).toFixed(1)}x average.` : "";

  return ` Breakout score ${breakoutScore}/100${
    changePct !== null ? ` with ${changePct}% price change.` : "."
  }${volumePart}`;
}

function thesisSummary({ matchedKeywords, catalyst, sourceLabel, breakoutScore, quote }) {
  const parts = [];

  if (matchedKeywords.length) {
    parts.push(`Matched thesis terms: ${matchedKeywords.join(", ")}.`);
  }

  if (catalyst.positiveTerms.length) {
    parts.push(`Positive catalyst flags: ${catalyst.positiveTerms.join(", ")}.`);
  }

  if (catalyst.negativeTerms.length) {
    parts.push(`Negative flags to monitor: ${catalyst.negativeTerms.join(", ")}.`);
  }

  parts.push(`Primary source: ${sourceLabel}.`);

  const quotePart = quoteSummary(quote, breakoutScore);
  if (quotePart) {
    parts.push(quotePart.trim());
  }

  return summarizeSentence(parts.join(" "), 320);
}

function riskSummary({ sourceKind, catalyst, breakoutScore, hasQuote }) {
  const parts = [
    "Headline-derived signal; validate the primary filing, article, or post before trading.",
  ];

  if (catalyst.negativeTerms.length) {
    parts.push(`Watch for ${catalyst.negativeTerms.join(", ")} language in the full text.`);
  }

  if (!hasQuote && sourceKind !== "research") {
    parts.push("No quote confirmation is attached yet, so tape confirmation is still required.");
  }

  if (hasQuote && breakoutScore < 65) {
    parts.push("Price confirmation is present but not yet strong enough to qualify as a clean breakout.");
  }

  return summarizeSentence(parts.join(" "), 260);
}

export function createSignalDeal({
  id,
  company,
  ticker = "",
  title = "",
  summary = "",
  body = "",
  publishedAt = "",
  sourceLabel,
  sourceKind,
  url = "",
  geoFilter = "Global",
  keywords = [],
  sourceCount = 1,
  quote = null,
  socialMetrics = null,
  extraDataSources = [],
}) {
  const combinedText = safeText([company, ticker && `$${ticker}`, title, summary, body].join(". "));
  const matchedKeywords = keywords.filter(keyword => combinedText.toLowerCase().includes(keyword));
  const daysOld = recencyDays(publishedAt);
  const catalyst = classifyCatalyst(combinedText);
  const breakoutScore = computeBreakoutScore(quote);
  const confidenceScore = computeConfidenceScore({
    matchCount: matchedKeywords.length,
    daysOld,
    sourceCount,
    catalystScore: catalyst.score,
    socialProof: socialMetrics ? computeSocialProofScore(socialMetrics) : 0,
    breakoutScore,
  });
  const geography = inferGeography(combinedText, geoFilter);
  const normalizedTicker = ticker || extractTickerCandidates(combinedText)[0] || "";

  return {
    id,
    company: company || (normalizedTicker ? `$${normalizedTicker}` : "Market Signal"),
    ticker: normalizedTicker,
    sector: inferSector(combinedText),
    subsector: inferSubsector(combinedText),
    location: inferLocation(combinedText, geography),
    signal_type: inferSignalType(combinedText, breakoutScore),
    description: summarizeSentence(title ? `${title}. ${summary || body}` : `${summary || body}`, 260),
    investment_thesis: thesisSummary({
      matchedKeywords,
      catalyst,
      sourceLabel,
      breakoutScore,
      quote,
    }),
    risk_factors: riskSummary({
      sourceKind,
      catalyst,
      breakoutScore,
      hasQuote: Boolean(quote),
    }),
    stage: "Public Co.",
    estimated_valuation: "",
    funding_raised: extractMoney(combinedText),
    confidence_score: confidenceScore,
    time_sensitivity: inferTimeSensitivity(daysOld),
    data_sources: dedupe([sourceLabel, ...extraDataSources]),
    geography,
    founder_background: "",
    comparable_exits: [],
    patent_activity: "",
    capital_flow_signal: summarizeSentence(
      `${sourceLabel} flagged a live catalyst.${quoteSummary(quote, breakoutScore)}`,
      180,
    ),
    source_url: url,
    matched_keywords: matchedKeywords,
    published_at: publishedAt,
    source_kind: sourceKind,
    headline: title || summary || body,
    breakout_score: breakoutScore,
    price_change_pct: quote ? parsePercent(quote.changesPercentage) : null,
    volume: quote ? toNumber(quote.volume) : null,
    avg_volume: quote ? toNumber(quote.avgVolume) : null,
    catalyst_score: catalyst.score,
  };
}

export function applyQuoteToDeal(deal, quote) {
  if (!quote || !deal) {
    return deal;
  }

  const breakoutScore = computeBreakoutScore(quote);
  const boostedConfidence = computeConfidenceScore({
    matchCount: deal.matched_keywords?.length || 0,
    daysOld: recencyDays(deal.published_at),
    sourceCount: Math.max(1, deal.data_sources?.length || 1),
    catalystScore: deal.catalyst_score || 0,
    breakoutScore,
  });

  return {
    ...deal,
    signal_type: breakoutScore >= 80 ? "Breakout" : deal.signal_type,
    confidence_score: Math.max(deal.confidence_score, boostedConfidence),
    breakout_score: breakoutScore,
    price_change_pct: parsePercent(quote.changesPercentage),
    volume: toNumber(quote.volume),
    avg_volume: toNumber(quote.avgVolume),
    data_sources: dedupe([...(deal.data_sources || []), "Quote Confirmation"]),
    investment_thesis: summarizeSentence(
      `${deal.investment_thesis} ${quoteSummary(quote, breakoutScore)}`,
      320,
    ),
    risk_factors: summarizeSentence(
      `${deal.risk_factors} ${
        breakoutScore >= 65
          ? "Tape confirmation is present, but confirm liquidity and spreads."
          : "Quote confirmation remains weak for a clean momentum entry."
      }`,
      260,
    ),
    capital_flow_signal: summarizeSentence(
      `${deal.capital_flow_signal} ${quoteSummary(quote, breakoutScore)}`,
      180,
    ),
  };
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Upstream request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

export async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Upstream request failed (${response.status}) for ${url}`);
  }
  return response.text();
}
