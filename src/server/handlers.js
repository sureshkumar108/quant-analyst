import { methodNotAllowed, parseUrl, readJsonBody, sendJson, wrapRoute } from "./http.js";
import { buildLiveSnapshot, generateMemoFromDeal, sendDiscordAlert } from "./quant-engine.js";

async function bootstrapRoute(req, res) {
  if (req.method !== "GET") {
    methodNotAllowed(res, ["GET"]);
    return;
  }

  const url = parseUrl(req);
  const thesis = url.searchParams.get("thesis") || "";
  const geoFilter = url.searchParams.get("geoFilter") || "Global";
  let sources = {};

  try {
    sources = JSON.parse(url.searchParams.get("sources") || "{}");
  } catch {
    sources = {};
  }

  const snapshot = await buildLiveSnapshot({ thesis, geoFilter, sources });
  sendJson(res, 200, snapshot);
}

async function runAgentRoute(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readJsonBody(req);
  const snapshot = await buildLiveSnapshot({
    thesis: body.thesis || "",
    geoFilter: body.geoFilter || "Global",
    sources: body.sources || {},
  });

  sendJson(res, 200, snapshot);
}

async function memoRoute(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readJsonBody(req);
  if (!body.deal) {
    sendJson(res, 400, { ok: false, error: "Missing deal payload" });
    return;
  }

  const result = await generateMemoFromDeal(body.deal);
  sendJson(res, 200, result);
}

async function discordRoute(req, res) {
  if (req.method !== "POST") {
    methodNotAllowed(res, ["POST"]);
    return;
  }

  const body = await readJsonBody(req);
  if (!body.deal) {
    sendJson(res, 400, { ok: false, error: "Missing deal payload" });
    return;
  }

  const result = await sendDiscordAlert({
    deal: body.deal,
    webhookUrl: body.webhookUrl || "",
  });
  sendJson(res, 200, result);
}

export const handleBootstrap = wrapRoute(bootstrapRoute);
export const handleRunAgent = wrapRoute(runAgentRoute);
export const handleMemo = wrapRoute(memoRoute);
export const handleDiscord = wrapRoute(discordRoute);
