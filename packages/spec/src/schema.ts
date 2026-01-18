import { z } from "zod";
import type { DesignSpec, Frame, Node } from "./types.js";

const layoutSchema = z.enum(["vertical", "horizontal"]);

const frameSchema: z.ZodType<Frame> = z.object({
  name: z.string().min(1),
  width: z.number().int().positive(),
  layout: layoutSchema,
  gap: z.number().int().nonnegative(),
  padding: z.number().int().nonnegative(),
});

const textNodeSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
  fontSize: z.number().int().positive().optional(),
});

const buttonNodeSchema = z.object({
  type: z.literal("button"),
  label: z.string().min(1),
});

// Define nodeSchema recursively using z.lazy
const nodeSchema: z.ZodType<Node> = z.lazy(() =>
  z.discriminatedUnion("type", [
    textNodeSchema,
    buttonNodeSchema,
    z.object({
      type: z.literal("container"),
      layout: layoutSchema,
      gap: z.number().int().nonnegative(),
      padding: z.number().int().nonnegative(),
      children: z.array(nodeSchema).min(1),
    }),
  ]),
) as z.ZodType<Node>;

export const designSpecSchema: z.ZodType<DesignSpec> = z.object({
  page: z.string().min(1),
  frame: frameSchema,
  nodes: z.array(nodeSchema).min(1),
});

const targetLayoutSchema = z.enum(["mobile", "tablet", "desktop"]);

const uiStrictnessSchema = z.enum(["strict", "balanced"]);

const uxPatternsSchema = z.object({
  groupElements: z.boolean(),
  formContainer: z.boolean(),
  helperText: z.boolean(),
});

const generationContextSchema = z.object({
  targetLayout: targetLayoutSchema,
  uiStrictness: uiStrictnessSchema,
  uxPatterns: uxPatternsSchema,
});

export const promptRequestSchema = z.object({
  prompt: z.string().min(1),
  generationContext: generationContextSchema.optional(),
});

export type PromptRequest = z.infer<typeof promptRequestSchema>;
