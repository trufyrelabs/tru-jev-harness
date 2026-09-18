import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createApiHandler } from "./server/api";

function jevApiPlugin(): Plugin {
  return {
    name: "jev-harness-api",
    configureServer(server) {
      const handler = createApiHandler();
      server.middlewares.use((req, res, next) => {
        void handle(req, res, next);
      });

      async function handle(
        req: IncomingMessage,
        res: ServerResponse,
        next: (error?: unknown) => void,
      ): Promise<void> {
        try {
          const handled = await handler(req, res);
          if (!handled) {
            next();
          }
        } catch (error) {
          next(error);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), jevApiPlugin()],
  server: {
    port: 5173,
  },
});
