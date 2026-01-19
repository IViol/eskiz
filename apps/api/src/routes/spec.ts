import { promptRequestSchema } from "@eskiz/spec";
import type { Request, Response } from "express";
import { generateDesignSpec } from "../spec/generator.js";
import { getContextLogger } from "../utils/logger.js";

export async function handleSpecRequest(req: Request, res: Response): Promise<void> {
  const log = getContextLogger();
  const dryRun = req.query.dryRun === "true";

  try {
    const validationResult = promptRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      log.warn(
        {
          event: "request.validation.fail",
          errors: validationResult.error.errors,
        },
        "Invalid request body",
      );
      res.status(400).json({
        error: "Invalid request",
        details: validationResult.error.errors,
      });
      return;
    }

    const spec = await generateDesignSpec(validationResult.data, dryRun);

    res.json(spec);
  } catch (error) {
    log.error(
      {
        event: "request.error",
        error_message: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.constructor.name : "UnknownError",
      },
      "Error handling spec request",
    );
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
