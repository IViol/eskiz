import { promptRequestSchema } from "@eskiz/spec";
import type { Request, Response } from "express";
import { logger } from "../logger.js";
import { generateDesignSpec } from "../spec/generator.js";

export async function handleSpecRequest(req: Request, res: Response): Promise<void> {
  const requestId = crypto.randomUUID();
  const dryRun = req.query.dryRun === "true";

  try {
    const validationResult = promptRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      logger.warn({ requestId, errors: validationResult.error.errors }, "Invalid request body");
      res.status(400).json({
        error: "Invalid request",
        details: validationResult.error.errors,
      });
      return;
    }

    const spec = await generateDesignSpec(validationResult.data, dryRun);

    res.json(spec);
  } catch (error) {
    logger.error({ requestId, error }, "Error handling spec request");
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
