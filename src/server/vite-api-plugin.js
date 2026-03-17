import { handleBootstrap, handleDiscord, handleMemo, handleRunAgent } from "./handlers.js";

const ROUTES = {
  "/api/bootstrap": handleBootstrap,
  "/api/run-agent": handleRunAgent,
  "/api/memo": handleMemo,
  "/api/discord": handleDiscord,
};

export function quantApiPlugin() {
  return {
    name: "quant-api-plugin",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        const handler = ROUTES[url.pathname];

        if (!handler) {
          next();
          return;
        }

        await handler(req, res);
      });
    },
  };
}
