import {
  extractKeywords,
  fetchText,
  pickTag,
  stripTags,
} from "../signal-utils.js";

function parseArxivFeed(xmlText) {
  const entries = xmlText.match(/<entry>[\s\S]*?<\/entry>/gi) || [];

  return entries.map(block => ({
    id: stripTags(pickTag(block, "id")),
    title: stripTags(pickTag(block, "title")),
    summary: stripTags(pickTag(block, "summary")),
    published: stripTags(pickTag(block, "published")),
    authors: Array.from(block.matchAll(/<name>([\s\S]*?)<\/name>/gi)).map(match =>
      stripTags(match[1]),
    ),
  }));
}

export async function fetchResearchSignals({ thesis, limit = 6 }) {
  const keywords = extractKeywords(thesis);
  const searchQuery = keywords.length
    ? keywords.map(keyword => `all:"${keyword}"`).join("+OR+")
    : 'all:"earnings"+OR+all:"market microstructure"+OR+all:"price discovery"';
  const url =
    `https://export.arxiv.org/api/query?search_query=${searchQuery}` +
    `&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
  const xmlText = await fetchText(url);
  const papers = parseArxivFeed(xmlText);

  return {
    papers,
    trace: [`Fetched ${papers.length} live arXiv papers matching the active thesis.`],
    sourceStatus: {
      key: "research",
      label: "arXiv Research",
      status: papers.length ? "online" : "warning",
      detail: papers.length ? `${papers.length} recent papers returned` : "No research matches returned",
    },
  };
}
