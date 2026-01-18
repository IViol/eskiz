import express from "express";
import pinoHttp from "pino-http";
import { getEnv } from "./config/env.js";
import { logger } from "./logger.js";
import { handleSpecRequest } from "./routes/spec.js";

export function createServer(): express.Application {
  const app = express();

  app.use(express.json());
  app.use(
    pinoHttp({
      logger,
      genReqId: () => crypto.randomUUID(),
    }),
  );

  app.post("/spec", handleSpecRequest);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}

export function startServer(): void {
  const env = getEnv();
  const app = createServer();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Server started");
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    logger.info("SIGINT received, shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });
}
