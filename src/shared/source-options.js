export const SOURCE_OPTIONS = [
  {
    key: "SEC Filings",
    label: "SEC EDGAR",
    enabledByDefault: true,
  },
  {
    key: "X Posts",
    label: "X API recent search",
    enabledByDefault: true,
  },
  {
    key: "Benzinga News",
    label: "Benzinga news feed",
    enabledByDefault: false,
  },
  {
    key: "Alpaca News",
    label: "Alpaca news",
    enabledByDefault: false,
  },
  {
    key: "FMP Stock News",
    label: "FMP news and quote confirmation",
    enabledByDefault: true,
  },
  {
    key: "Academic Papers",
    label: "arXiv research",
    enabledByDefault: false,
  },
];

export function createDefaultSourceSelection() {
  return Object.fromEntries(
    SOURCE_OPTIONS.map(option => [option.key, option.enabledByDefault]),
  );
}

export function normalizeSourceSelection(selection = {}) {
  return {
    ...createDefaultSourceSelection(),
    ...selection,
  };
}
