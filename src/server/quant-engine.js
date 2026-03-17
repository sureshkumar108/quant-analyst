const DEFAULT_THESIS =
  "AI infrastructure, biotech, climate and energy, quantum software";

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
  "over",
  "real",
  "screen",
  "software",
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
  "want",
  "with",
  "would",
]);

const GEO_TERMS = {
  Global: [],
  "North America": ["united states", "canada", "mexico", "north america"],
  Europe: [
    "europe",
    "united kingdom",
    "germany",
    "france",
    "italy",
    "spain",
    "estonia",
    "sweden",
  ],
  "Asia Pacific": [
    "asia",
    "pacific",
    "japan",
    "china",
    "india",
    "korea",
    "singapore",
    "australia",
  ],
  "Latin America": [
    "latin america",
    "colombia",
    "brazil",
    "mexico",
    "argentina",
    "chile",
    "peru",
  ],
  Africa: [
    "africa",
    "nigeria",
    "kenya",
    "south africa",
    "egypt",
    "morocco",
    "ghana",
  ],
  "Middle East": [
    "middle east",
    "uae",
    "united arab emirates",
    "saudi",
    "israel",
    "qatar",
  ],
};

function getEnv() {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
    secUserAgent:
      process.env.SEC_USER_AGENT ||
      "quant-analyst/1.0 (set SEC_USER_AGENT with a real contact address)",
  };
}

function safeText(value) {
  return String(value || "").trim();
}

function decodeEntities(value) {
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

function stripTags(value) {
  return decodeEntities(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pickTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? match[1] : "";
}

function pickAttr(block, tagName, attrName) {
  const match = block.match(new RegExp(`<${tagName}[^>]*${attrName}="([^"]+)"[^>]*>`, "i"));
  return match ? match[1] : "";
}

function extractKeywords(thesis) {
  const normalized = safeText(thesis || DEFAULT_THESIS)
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .replace(/\s+/g, " ");

  const keywords = normalized
    .split(" ")
    .map(word => word.trim())
    .filter(word => word.length >= 3 && !STOP_WORDS.has(word));

  return [...new Set(keywords)].slice(0, 8);
}

function matchesGeography(text, geoFilter) {
  if (!geoFilter || geoFilter === "Global") {
    return true;
  }

  const terms = GEO_TERMS[geoFilter] || [];
  const haystack = text.toLowerCase();
  return terms.some(term => haystack.includes(term));
}

function recencyDays(dateString) {
  if (!dateString) {
    return 365;
  }

  const ageMs = Date.now() - new Date(dateString).getTime();
  return Math.max(0, Math.floor(ageMs / 86_400_000));
}

function confidenceFromMatch(matchCount, daysOld, sourceCount) {
  return Math.max(
    55,
    Math.min(94, 58 + matchCount * 6 + sourceCount * 5 - Math.min(daysOld, 30)),
  );
}

function inferSignalType(text) {
  const haystack = text.toLowerCase();
  if (/(offering|private placement|financing|funding|loan|purchase agreement|acquisition)/.test(haystack)) {
    return "Capital Inflow";
  }
  if (/(approval|government|regulation|license|contract award|compliance|act )/.test(haystack)) {
    return "Regulatory Tailwind";
  }
  if (/(platform|ai|quantum|drug|biotech|semiconductor|prototype|launch)/.test(haystack)) {
    return "Tech Breakthrough";
  }
  return "Market Gap";
}

function inferSector(text) {
  const haystack = text.toLowerCase();
  if (/(biotech|drug|clinical|protein|therapeutic)/.test(haystack)) {
    return "Biotech";
  }
  if (/(energy|grid|solar|battery|climate)/.test(haystack)) {
    return "CleanTech";
  }
  if (/(chip|semiconductor|compute|ai|software|quantum|data)/.test(haystack)) {
    return "Deep Tech";
  }
  if (/(bank|credit|payment|insurance|financial)/.test(haystack)) {
    return "Fintech";
  }
  return "Emerging Tech";
}

function inferSubsector(text) {
  const haystack = text.toLowerCase();
  if (/(protein|therapeutic|clinical)/.test(haystack)) {
    return "Therapeutics";
  }
  if (/(semiconductor|chip)/.test(haystack)) {
    return "Semiconductors";
  }
  if (/(quantum)/.test(haystack)) {
    return "Quantum Computing";
  }
  if (/(grid|battery|solar)/.test(haystack)) {
    return "Energy Systems";
  }
  if (/(ai|model|software|data)/.test(haystack)) {
    return "AI Platforms";
  }
  return "General";
}

function inferGeography(text, geoFilter) {
  if (geoFilter && geoFilter !== "Global") {
    return geoFilter;
  }

  const haystack = text.toLowerCase();
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

function inferLocation(text, geography) {
  const haystack = text.toLowerCase();
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

function inferTimeSensitivity(daysOld) {
  if (daysOld <= 3) {
    return "High";
  }
  if (daysOld <= 10) {
    return "Medium";
  }
  return "Low";
}

function extractMoney(text) {
  const match = safeText(text).match(/\$ ?(\d+(?:\.\d+)?) ?(million|billion|m|bn|b)/i);
  if (!match) {
    return "";
  }
  return `$${match[1]}${match[2].toLowerCase().startsWith("b") ? "B" : "M"}`;
}

function summarizeSentence(text, maxLength = 210) {
  const normalized = safeText(text).replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function dedupe(items, keyFn) {
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

function parseSecFeed(xmlText, formType) {
  const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

  return entries.map(block => {
    const rawTitle = stripTags(pickTag(block, "title"));
    const title = rawTitle.replace(new RegExp(`^${formType}\\s*-\\s*`, "i"), "").trim();
    const company = title.replace(/\(\d+\)\s+\((?:Filer|Subject)\).*$/i, "").trim();
    const summary = stripTags(pickTag(block, "summary"));
    const link =
      pickAttr(block, "link", "href") ||
      stripTags(pickTag(block, "link")) ||
      stripTags(pickTag(block, "id"));
    const updated = stripTags(pickTag(block, "updated"));

    return {
      id: stripTags(pickTag(block, "id")) || link || `${formType}-${company}`,
      company: company || rawTitle || "Unknown issuer",
      summary,
      link,
      updated,
      formType,
    };
  });
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Upstream request failed (${response.status})`);
  }
  return response.text();
}

export async function fetchSecDeals({ thesis, geoFilter, limit = 6 }) {
  const { secUserAgent } = getEnv();
  const keywords = extractKeywords(thesis);
  const forms = ["8-K", "10-K", "10-Q"];
  const trace = [];

  const secHeaders = {
    "User-Agent": secUserAgent,
    Accept: "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
  };

  const feeds = await Promise.all(
    forms.map(async formType => {
      const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(formType)}&count=40&output=atom`;
      const xmlText = await fetchText(url, secHeaders);
      const entries = parseSecFeed(xmlText, formType);
      trace.push(`Fetched ${entries.length} live ${formType} filings from SEC EDGAR.`);
      return entries;
    }),
  );

  const deals = dedupe(feeds.flat(), entry => `${entry.company}-${entry.formType}`)
    .map(entry => {
      const searchableText = `${entry.company} ${entry.summary}`.toLowerCase();
      const matches = keywords.filter(keyword => searchableText.includes(keyword));
      const geography = inferGeography(searchableText, geoFilter);
      const daysOld = recencyDays(entry.updated);

      return {
        id: entry.id,
        company: entry.company,
        sector: inferSector(searchableText),
        subsector: inferSubsector(searchableText),
        location: inferLocation(searchableText, geography),
        signal_type: inferSignalType(searchableText),
        description: summarizeSentence(
          `${entry.formType} filing dated ${entry.updated || "recently"}. ${entry.summary}`,
          260,
        ),
        investment_thesis: summarizeSentence(
          matches.length
            ? `Matched thesis terms: ${matches.join(", ")}. Filing text suggests a live corporate event that may shift capital allocation, partnerships, or product execution in the near term.`
            : `Recent ${entry.formType} filing indicates a fresh public-company event that should be reviewed against the active thesis for signal confirmation.`,
          260,
        ),
        risk_factors:
          "This signal is derived from headline filing text only. Confirm the underlying exhibits, financial statements, and subsequent market reaction before treating it as investable.",
        stage: "Public Co.",
        estimated_valuation: "",
        funding_raised: extractMoney(entry.summary),
        confidence_score: confidenceFromMatch(matches.length, daysOld, 1),
        time_sensitivity: inferTimeSensitivity(daysOld),
        data_sources: ["SEC EDGAR"],
        geography,
        founder_background: "",
        comparable_exits: [],
        patent_activity: "",
        capital_flow_signal: summarizeSentence(
          `${entry.formType} filing cadence plus event text provide a live capital and corporate-activity signal.`,
          140,
        ),
        source_url: entry.link,
        matched_keywords: matches,
        form_type: entry.formType,
        published_at: entry.updated,
        source_kind: "sec",
      };
    })
    .filter(deal => matchesGeography(`${deal.location} ${deal.description}`, geoFilter))
    .sort((left, right) => right.confidence_score - left.confidence_score)
    .slice(0, limit);

  return { deals, trace };
}

function parseArxivFeed(xmlText) {
  const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

  return entries.map(block => ({
    id: stripTags(pickTag(block, "id")),
    title: stripTags(pickTag(block, "title")),
    summary: stripTags(pickTag(block, "summary")),
    published: stripTags(pickTag(block, "published")),
    authors: Array.from(block.matchAll(/<name>([\s\S]*?)<\/name>/gi)).map(match => stripTags(match[1])),
  }));
}

export async function fetchResearchSignals({ thesis, limit = 6 }) {
  const keywords = extractKeywords(thesis);
  const searchQuery = keywords.length
    ? keywords.map(keyword => `all:"${keyword}"`).join("+OR+")
    : 'all:"artificial intelligence"+OR+all:"biotech"+OR+all:"energy"';
  const url = `https://export.arxiv.org/api/query?search_query=${searchQuery}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
  const xmlText = await fetchText(url);
  const papers = parseArxivFeed(xmlText);

  return {
    papers,
    trace: [`Fetched ${papers.length} live arXiv papers matching the active thesis.`],
  };
}

function buildTimeSignals({ deals, papers, thesis }) {
  const latestDeal = deals[0];
  const latestPaper = papers[0];
  const keywords = extractKeywords(thesis);

  return [
    `${deals.length} live SEC filings matched the latest scan for ${keywords.slice(0, 3).join(", ") || "broad market themes"}.`,
    latestDeal
      ? `${latestDeal.company}: ${latestDeal.form_type} filed ${latestDeal.published_at || "recently"} with signal type ${latestDeal.signal_type}.`
      : "No SEC matches cleared the current confidence threshold.",
    latestPaper
      ? `arXiv: "${summarizeSentence(latestPaper.title, 92)}" published ${latestPaper.published.slice(0, 10)}.`
      : "No research matches returned from the current paper scan.",
  ].filter(Boolean);
}

function buildMarketSummary({ deals, papers, thesis, geoFilter }) {
  const topDeals = deals.slice(0, 3).map(deal => `${deal.company} (${deal.signal_type})`);
  const keywords = extractKeywords(thesis);
  const geoNote = geoFilter && geoFilter !== "Global" ? `${geoFilter} filter applied.` : "Global scan.";

  return [
    `Live dashboard built from SEC EDGAR filings and arXiv research results for ${keywords.join(", ") || DEFAULT_THESIS}. ${geoNote}`,
    topDeals.length
      ? `Top current filing signals: ${topDeals.join(", ")}.`
      : "No high-confidence filing signals are currently available for the selected thesis.",
    papers.length
      ? `${papers.length} recent research papers also matched the thesis, which helps confirm whether filing activity aligns with active technical momentum.`
      : "Research coverage is currently limited, so the view is driven mostly by filing data.",
  ].join(" ");
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

function buildKpis({ deals, papers, latencyMs, sourceStatus }) {
  const avgConfidence = deals.length
    ? Math.round(deals.reduce((sum, deal) => sum + deal.confidence_score, 0) / deals.length)
    : 0;
  const diversityIndex = computeDiversityIndex(deals);
  const highConfidence = deals.filter(deal => deal.confidence_score >= 70).length;
  const latencyMinutes = Number((latencyMs / 60_000).toFixed(1));

  return {
    liveDeals: deals.length,
    researchSignals: papers.length,
    avgConfidence,
    sourceCoverage: sourceStatus.filter(source => source.status === "online").length,
    queryLatencyMs: latencyMs,
    diversityIndex,
    ddr: deals.length ? Math.round((highConfidence / deals.length) * 100) : 0,
    ttm: latencyMinutes,
    apg: deals.length,
    dix: diversityIndex,
    isr: Number((1 + papers.length / 4).toFixed(1)),
  };
}

function buildSourceStatus({ secTraceCount, paperCount }) {
  const { anthropicApiKey, discordWebhookUrl } = getEnv();
  return [
    {
      key: "sec",
      label: "SEC EDGAR",
      status: "online",
      detail: `${secTraceCount} SEC feed pulls completed`,
    },
    {
      key: "research",
      label: "arXiv Research",
      status: paperCount ? "online" : "warning",
      detail: paperCount ? `${paperCount} papers returned` : "No thesis matches returned",
    },
    {
      key: "anthropic",
      label: "Anthropic Memo",
      status: anthropicApiKey ? "online" : "disabled",
      detail: anthropicApiKey ? "Server-side memo generation enabled" : "Set ANTHROPIC_API_KEY to enable live memo generation",
    },
    {
      key: "discord",
      label: "Discord Alerts",
      status: discordWebhookUrl ? "online" : "warning",
      detail: discordWebhookUrl ? "Default webhook configured on server" : "Client webhook or DISCORD_WEBHOOK_URL required",
    },
  ];
}

function buildWarnings(sourceStatus) {
  const warnings = [];
  if (!getEnv().anthropicApiKey) {
    warnings.push("Anthropic memo generation is not configured. The app will use a deterministic memo fallback.");
  }
  warnings.push("Private-company funding and patent APIs are not configured in this build, so the live view currently favors public-company filings and research signals.");
  if (sourceStatus.some(source => source.key === "sec" && source.status !== "online")) {
    warnings.push("SEC EDGAR is currently unavailable.");
  }
  return warnings;
}

export async function buildLiveSnapshot({ thesis, geoFilter, sources }) {
  const startedAt = Date.now();
  const activeSources = sources || { "SEC Filings": true, "Academic Papers": true };
  const trace = [];

  let deals = [];
  let papers = [];

  if (activeSources["SEC Filings"] !== false) {
    const secResult = await fetchSecDeals({ thesis, geoFilter, limit: 8 });
    deals = secResult.deals;
    trace.push(...secResult.trace);
  } else {
    trace.push("SEC filings source disabled by user.");
  }

  if (activeSources["Academic Papers"] !== false) {
    const researchResult = await fetchResearchSignals({ thesis, limit: 6 });
    papers = researchResult.papers;
    trace.push(...researchResult.trace);
  } else {
    trace.push("Academic papers source disabled by user.");
  }

  const sourceStatus = buildSourceStatus({
    secTraceCount: trace.filter(line => line.includes("SEC")).length,
    paperCount: papers.length,
  });

  return {
    ok: true,
    deals,
    marketSummary: buildMarketSummary({ deals, papers, thesis, geoFilter }),
    timeSignals: buildTimeSignals({ deals, papers, thesis }),
    sourceStatus,
    warnings: buildWarnings(sourceStatus),
    kpis: buildKpis({
      deals,
      papers,
      latencyMs: Date.now() - startedAt,
      sourceStatus,
    }),
    trace,
    generatedAt: new Date().toISOString(),
    defaultThesis: DEFAULT_THESIS,
  };
}

function deterministicMemo(deal) {
  return [
    `Executive summary: ${deal.company} generated a live ${deal.form_type || deal.signal_type} signal sourced from ${deal.data_sources.join(", ")}. The current read-through is ${deal.signal_type.toLowerCase()}, with a confidence score of ${deal.confidence_score}/100 based on recency and thesis keyword overlap.`,
    `Market opportunity and thesis: ${deal.investment_thesis} The current description from the source is: ${deal.description}`,
    `Risks and mitigants: ${deal.risk_factors} Mitigant: validate the underlying filing exhibits, compare with peer disclosures, and confirm whether the event is already reflected in price action or consensus expectations.`,
    `Recommendation: treat this as a live diligence candidate rather than a finished memo. Review the primary filing at ${deal.source_url || "the source link"}, then decide whether it warrants deeper valuation work or watchlist status.`,
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
        "You are a senior investment analyst. Write a concise 4-paragraph memo with an executive summary, thesis, risks, and recommendation. Use only the supplied evidence and stay factual.",
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
          title: `Investment signal: ${deal.company}`,
          description: deal.description,
          color,
          fields: [
            { name: "Signal", value: deal.signal_type || "N/A", inline: true },
            { name: "Confidence", value: `${deal.confidence_score}/100`, inline: true },
            { name: "Stage", value: deal.stage || "N/A", inline: true },
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
