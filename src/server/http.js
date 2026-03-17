const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function sendJson(res, status, payload, headers = {}) {
  res.statusCode = status;
  for (const [key, value] of Object.entries({ ...JSON_HEADERS, ...headers })) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(payload));
}

export function sendError(res, status, message, details) {
  sendJson(res, status, {
    ok: false,
    error: message,
    ...(details ? { details } : {}),
  });
}

export function parseUrl(req) {
  return new URL(req.url || "/", "http://localhost");
}

export function methodNotAllowed(res, allowed = ["GET"]) {
  res.setHeader("Allow", allowed.join(", "));
  sendError(res, 405, `Method not allowed. Use ${allowed.join(" or ")}.`);
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

export function wrapRoute(handler) {
  return async function wrappedHandler(req, res) {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, 500, error.message || "Unexpected server error");
    }
  };
}
