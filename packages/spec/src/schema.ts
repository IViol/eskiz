import { z } from "zod";
import type { DesignSpec, Frame, Node } from "./types.js";

const layoutSchema = z.enum(["vertical", "horizontal"]);

const borderSchema = z.object({
  color: z.string(),
  width: z.number().int().nonnegative(),
});

const frameSchema: z.ZodType<Frame> = z.object({
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive().optional(),
  layout: layoutSchema,
  gap: z.number().int().nonnegative(),
  padding: z.number().int().nonnegative(),
  background: z.string().optional(),
  borderRadius: z.number().int().nonnegative().optional(),
  border: borderSchema.optional(),
});

const textNodeSchema = z.object({
  type: z.literal("text"),
  content: z.string(),
  fontSize: z.number().int().positive().optional(),
  color: z.string().optional(),
});

const buttonNodeSchema = z.object({
  type: z.literal("button"),
  label: z.string().min(1),
  background: z.string().optional(),
  textColor: z.string().optional(),
  borderRadius: z.number().int().nonnegative().optional(),
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
      background: z.string().optional(),
      borderRadius: z.number().int().nonnegative().optional(),
      border: borderSchema.optional(),
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
  visualBaseline: z.boolean().optional(),
  strictLayout: z.boolean().optional(),
});

export const promptRequestSchema = z.object({
  prompt: z.string().min(1),
  generationContext: generationContextSchema.optional(),
});

export type PromptRequest = z.infer<typeof promptRequestSchema>;
