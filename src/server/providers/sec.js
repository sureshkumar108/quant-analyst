import {
  createSignalDeal,
  dedupe,
  extractKeywords,
  fetchText,
  pickAttr,
  pickTag,
  safeText,
  stripTags,
  summarizeSentence,
} from "../signal-utils.js";

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

export async function fetchSecSignals({ env, thesis, geoFilter, limit = 8 }) {
  const keywords = extractKeywords(thesis);
  const forms = ["8-K", "6-K", "10-Q", "10-K"];
  const trace = [];

  const xmlFeeds = await Promise.all(
    forms.map(async formType => {
      const url =
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=` +
        `${encodeURIComponent(formType)}&count=40&output=atom`;
      const xmlText = await fetchText(url, {
        "User-Agent": env.secUserAgent,
        Accept: "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
      });
      const entries = parseSecFeed(xmlText, formType);
      trace.push(`Fetched ${entries.length} live ${formType} filings from SEC EDGAR.`);
      return entries;
    }),
  );

  const deals = dedupe(xmlFeeds.flat(), entry => `${entry.company}-${entry.formType}-${entry.updated}`)
    .map(entry => {
      const deal = createSignalDeal({
        id: entry.id,
        company: entry.company,
        title: `${entry.formType} filing`,
        summary: entry.summary,
        publishedAt: entry.updated,
        sourceLabel: "SEC EDGAR",
        sourceKind: "filing",
        url: entry.link,
        geoFilter,
        keywords,
        extraDataSources: [entry.formType],
      });

      return {
        ...deal,
        description: summarizeSentence(
          `${entry.formType} filing dated ${entry.updated || "recently"}. ${safeText(entry.summary)}`,
          260,
        ),
      };
    })
    .filter(deal => deal.confidence_score >= 52)
    .slice(0, limit);

  return {
    deals,
    trace,
    sourceStatus: {
      key: "sec",
      label: "SEC EDGAR",
      status: deals.length ? "online" : "warning",
      detail: deals.length
        ? `${deals.length} filing catalysts matched the active thesis`
        : "Feed reachable, but no high-confidence filing catalysts matched",
    },
  };
}
