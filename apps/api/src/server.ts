import express from "express";
import pinoHttp from "pino-http";
import { getEnv } from "./config/env.js";
import { logger } from "./logger.js";
import { tracingMiddleware } from "./middleware/tracing.js";
import { handleSpecRequest } from "./routes/spec.js";

export function createServer(): express.Application {
  const app = express();

  app.use(express.json());

  // Tracing middleware must come before pino-http to set up context
  app.use(tracingMiddleware);

  app.use(
    pinoHttp({
      logger,
      genReqId: () => crypto.randomUUID(),
      // Redact sensitive headers
      redact: {
        paths: [
          "req.headers.cookie",
          "req.headers.authorization",
          "req.headers['set-cookie']",
          "res.headers['set-cookie']",
          "req.headers['x-api-key']",
          "req.headers['api-key']",
          // Redact any field containing "token" or "secret"
          "req.headers[*token*]",
          "req.headers[*secret*]",
        ],
        remove: true,
      },
      // Custom serializers to include tracing context
      serializers: {
        req: (req: express.Request) => {
          const traceId = (req as express.Request & { traceId?: string }).traceId;
          return {
            method: req.method,
            url: req.url,
            headers: {
              ...req.headers,
              // Ensure cookie and authorization are removed
              cookie: undefined,
              authorization: undefined,
              "set-cookie": undefined,
            },
            traceId,
          };
        },
        res: (res: express.Response) => {
          return {
            statusCode: res.statusCode,
            headers: {
              ...res.getHeaders(),
              "set-cookie": undefined,
            },
          };
        },
      },
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
