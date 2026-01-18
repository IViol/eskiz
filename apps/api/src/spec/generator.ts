import { designSpecSchema } from "@eskiz/spec";
import type { DesignSpec, GenerationContext, PromptRequest } from "@eskiz/spec";
import OpenAI from "openai";
import { getEnv } from "../config/env.js";
import { logger } from "../logger.js";
import { assembleSystemPrompt } from "./prompt/assembleSystemPrompt.js";

const env = getEnv();
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const DEFAULT_GENERATION_CONTEXT: GenerationContext = {
  targetLayout: "mobile",
  uiStrictness: "strict",
  uxPatterns: {
    groupElements: true,
    formContainer: true,
    helperText: false,
  },
  visualBaseline: true,
  strictLayout: false,
};

/**
 * Builds the system prompt using the rule-based assembly system
 */
function buildSystemPrompt(context: GenerationContext, userPrompt: string): string {
  return assembleSystemPrompt({
    userPrompt,
    targetLayout: context.targetLayout,
    uiStrictness: context.uiStrictness,
    visualBaseline: context.visualBaseline ?? true,
    strictLayout: context.strictLayout ?? false,
    uxPatterns: context.uxPatterns,
  });
}

/**
 * Visual defaults for wireframe-level presentation
 */
const VISUAL_DEFAULTS = {
  containerBackground: "#FFFFFF",
  containerBorderRadius: 12,
  inputBorder: { color: "#D1D5DB", width: 1 },
  buttonBackground: "#2563EB",
  buttonTextColor: "#FFFFFF",
  buttonBorderRadius: 8,
  primaryTextColor: "#111111",
  placeholderTextColor: "#6B7280",
} as const;

/**
 * Determines if a container represents an input field based on its structure.
 * Input containers typically have border and contain placeholder text.
 */
function isInputContainer(node: DesignSpec["nodes"][number]): boolean {
  if (node.type !== "container") return false;
  // Check if container has border (indicates input)
  if (node.border) return true;
  // Check if container has placeholder-like text children
  const hasPlaceholderText = node.children.some(
    (child) =>
      child.type === "text" &&
      (child.content.toLowerCase().includes("enter") ||
        child.content.toLowerCase().includes("placeholder")),
  );
  return hasPlaceholderText;
}

/**
 * Determines if text is placeholder/helper text based on content.
 */
function isPlaceholderText(node: DesignSpec["nodes"][number]): boolean {
  if (node.type !== "text") return false;
  const content = node.content.toLowerCase();
  return (
    content.includes("enter") ||
    content.includes("placeholder") ||
    content.includes("hint") ||
    content.includes("helper")
  );
}

/**
 * Ensures all text nodes have non-empty content.
 * Replaces empty text content with placeholder text to prevent Auto Layout collapse.
 */
function ensureNonEmptyTextContent(spec: DesignSpec): DesignSpec {
  const placeholderTexts = [
    "Enter your email",
    "Enter password",
    "Enter value",
    "Enter text",
    "Placeholder",
  ];
  let placeholderIndex = 0;

  function fixNode(node: DesignSpec["nodes"][number]): DesignSpec["nodes"][number] {
    if (node.type === "text") {
      // Replace empty content with placeholder
      if (!node.content || node.content.trim() === "") {
        const placeholder = placeholderTexts[placeholderIndex % placeholderTexts.length];
        placeholderIndex++;
        return { ...node, content: placeholder };
      }
      return node;
    }
    if (node.type === "container") {
      return {
        ...node,
        children: node.children.map(fixNode),
      };
    }
    return node;
  }

  return {
    ...spec,
    nodes: spec.nodes.map(fixNode),
  };
}

/**
 * Applies visual defaults to DesignSpec if properties are missing.
 * Ensures wireframe-level presentation is always visible.
 */
function applyVisualDefaults(
  spec: DesignSpec,
  targetLayout: GenerationContext["targetLayout"],
): DesignSpec {
  // Default dimensions based on target layout
  const defaultDimensions = {
    mobile: { width: 400, height: 800 },
    tablet: { width: 768, height: 900 },
    desktop: { width: 1200, height: 900 },
  };
  const dimensions = defaultDimensions[targetLayout];

  // Apply defaults to root frame
  const frame: DesignSpec["frame"] = {
    ...spec.frame,
    height: spec.frame.height ?? dimensions.height,
    background: spec.frame.background ?? VISUAL_DEFAULTS.containerBackground,
    borderRadius: spec.frame.borderRadius ?? VISUAL_DEFAULTS.containerBorderRadius,
  };

  function applyNodeDefaults(node: DesignSpec["nodes"][number]): DesignSpec["nodes"][number] {
    if (node.type === "text") {
      // Apply text color defaults
      const color =
        node.color ??
        (isPlaceholderText(node)
          ? VISUAL_DEFAULTS.placeholderTextColor
          : VISUAL_DEFAULTS.primaryTextColor);
      return { ...node, color };
    }

    if (node.type === "button") {
      // Apply button defaults
      return {
        ...node,
        background: node.background ?? VISUAL_DEFAULTS.buttonBackground,
        textColor: node.textColor ?? VISUAL_DEFAULTS.buttonTextColor,
        borderRadius: node.borderRadius ?? VISUAL_DEFAULTS.buttonBorderRadius,
      };
    }

    if (node.type === "container") {
      const isInput = isInputContainer(node);
      // Apply container defaults
      const container: DesignSpec["nodes"][number] = {
        ...node,
        background: node.background ?? VISUAL_DEFAULTS.containerBackground,
        borderRadius:
          node.borderRadius ??
          (isInput ? undefined : VISUAL_DEFAULTS.containerBorderRadius),
        border: node.border ?? (isInput ? VISUAL_DEFAULTS.inputBorder : undefined),
        children: node.children.map(applyNodeDefaults),
      };
      return container;
    }

    return node;
  }

  return {
    ...spec,
    frame,
    nodes: spec.nodes.map(applyNodeDefaults),
  };
}

const ASSISTANT_PROMPT = `The DesignSpec JSON structure:

{
  "page": "string (page name)",
  "frame": {
    "name": "string (frame name)",
    "width": number (positive integer, typically 360-400 for mobile-first),
    "height": number (positive integer, REQUIRED - 800 for mobile, 900 for tablet/desktop),
    "layout": "vertical" | "horizontal",
    "gap": number (non-negative integer, spacing between nodes, typically 12-16),
    "padding": number (non-negative integer, internal padding, typically 16-24),
    "background": "string (hex color, optional, default: "#FFFFFF" for containers)",
    "borderRadius": number (non-negative integer, optional, default: 12 for containers)",
    "border": { "color": "string (hex color)", "width": number } (optional, for input containers)
  },
  "nodes": [
    {
      "type": "text",
      "content": "string",
      "fontSize": number (optional, typically 14-20),
      "color": "string (hex color, optional, default: "#111111" for primary, "#6B7280" for placeholder)"
    },
    {
      "type": "button",
      "label": "string",
      "background": "string (hex color, optional, default: "#2563EB")",
      "textColor": "string (hex color, optional, default: "#FFFFFF")",
      "borderRadius": number (optional, default: 8)
    },
    {
      "type": "container",
      "layout": "vertical" | "horizontal",
      "gap": number (spacing between children),
      "padding": number (internal padding),
      "background": "string (hex color, optional, default: "#FFFFFF")",
      "borderRadius": number (optional, default: 12 for form/card containers)",
      "border": { "color": "string (hex color)", "width": number } (optional, for input containers: color "#D1D5DB", width 1),
      "children": [Node...] (array of child nodes, can be nested)
    }
  ]
}

Example for a login form (centered layout with proper rhythm):
{
  "page": "Login",
  "frame": {
    "name": "Login Screen",
    "width": 400,
    "height": 800,
    "layout": "vertical",
    "gap": 0,
    "padding": 0,
    "background": "#F9FAFB"
  },
  "nodes": [
    {
      "type": "container",
      "layout": "vertical",
      "gap": 0,
      "padding": 24,
      "background": "#F9FAFB",
      "children": [
        {
          "type": "container",
          "layout": "vertical",
          "gap": 32,
          "padding": 24,
          "background": "#FFFFFF",
          "borderRadius": 12,
          "children": [
            { "type": "text", "content": "Login", "fontSize": 24, "color": "#111111" },
            {
              "type": "container",
              "layout": "vertical",
              "gap": 20,
              "padding": 0,
              "children": [
                {
                  "type": "container",
                  "layout": "vertical",
                  "gap": 8,
                  "padding": 0,
                  "children": [
                    { "type": "text", "content": "Email", "fontSize": 14, "color": "#111111" },
                    {
                      "type": "container",
                      "layout": "vertical",
                      "gap": 0,
                      "padding": 12,
                      "background": "#FFFFFF",
                      "border": { "color": "#D1D5DB", "width": 1 },
                      "borderRadius": 8,
                      "children": [
                        { "type": "text", "content": "Enter your email", "fontSize": 14, "color": "#6B7280" }
                      ]
                    }
                  ]
                },
                {
                  "type": "container",
                  "layout": "vertical",
                  "gap": 8,
                  "padding": 0,
                  "children": [
                    { "type": "text", "content": "Password", "fontSize": 14, "color": "#111111" },
                    {
                      "type": "container",
                      "layout": "vertical",
                      "gap": 0,
                      "padding": 12,
                      "background": "#FFFFFF",
                      "border": { "color": "#D1D5DB", "width": 1 },
                      "borderRadius": 8,
                      "children": [
                        { "type": "text", "content": "Enter password", "fontSize": 14, "color": "#6B7280" }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "type": "container",
              "layout": "vertical",
              "gap": 0,
              "padding": 0,
              "children": [
                { "type": "button", "label": "Sign In", "background": "#2563EB", "textColor": "#FFFFFF", "borderRadius": 8 }
              ]
            }
          ]
        }
      ]
    }
  ]
}

Note: This example shows:
- Root frame with light background (#F9FAFB)
- Centered form card (white background, rounded corners)
- Title with larger fontSize (24) and spacing (32px gap after title)
- Field group with consistent rhythm (label→input gap: 8px, between fields: 20px)
- Actions container separated from fields (32px gap before actions)
- Inputs fill the form width
- Button in separate actions container`;

export async function generateDesignSpec(
  request: PromptRequest,
  dryRun: boolean,
): Promise<DesignSpec> {
  const requestId = crypto.randomUUID();
  const generationContext = request.generationContext ?? DEFAULT_GENERATION_CONTEXT;
  logger.info(
    { requestId, prompt: request.prompt, generationContext, dryRun },
    "Generating DesignSpec",
  );

  if (dryRun) {
    logger.info({ requestId }, "Dry run mode - returning mock spec");
    const mockSpec: DesignSpec = {
      page: "Mock Page",
      frame: {
        name: "Mock Frame",
        width: 400,
        height: 800,
        layout: "vertical",
        gap: 16,
        padding: 24,
        background: "#FFFFFF",
        borderRadius: 12,
      },
      nodes: [
        { type: "text", content: "Mock content", fontSize: 16, color: "#111111" },
        {
          type: "container",
          layout: "vertical",
          gap: 12,
          padding: 16,
          background: "#FFFFFF",
          borderRadius: 12,
          children: [{ type: "text", content: "Nested text", fontSize: 14, color: "#111111" }],
        },
        {
          type: "button",
          label: "Mock Button",
          background: "#2563EB",
          textColor: "#FFFFFF",
          borderRadius: 8,
        },
      ],
    };
    return applyVisualDefaults(mockSpec, generationContext.targetLayout);
  }

  try {
    const systemPrompt = buildSystemPrompt(generationContext, request.prompt);
    const model = "gpt-5-nano";

    // Some models (like gpt-5-nano) don't support custom temperature values
    // Only include temperature if the model supports it
    const modelsWithoutTemperature = ["gpt-5-nano"];
    const modelSupportsTemperature = !modelsWithoutTemperature.includes(model);

    const baseRequestOptions = {
      model,
      messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "assistant" as const, content: ASSISTANT_PROMPT },
        { role: "user" as const, content: request.prompt },
      ],
      response_format: { type: "json_object" as const },
    };

    // Only add temperature if model supports it
    const requestOptions = modelSupportsTemperature
      ? { ...baseRequestOptions, temperature: 0.3 }
      : baseRequestOptions;

    const completion = await openai.chat.completions.create(requestOptions);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    logger.debug({ requestId, content }, "Received OpenAI response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      logger.error({ requestId, content, error }, "Failed to parse JSON from OpenAI");
      throw new Error("Invalid JSON response from OpenAI");
    }

    const validationResult = designSpecSchema.safeParse(parsed);
    if (!validationResult.success) {
      logger.error(
        { requestId, errors: validationResult.error.errors },
        "DesignSpec validation failed",
      );
      throw new Error(`Invalid DesignSpec: ${validationResult.error.message}`);
    }

    // Ensure all text nodes have non-empty content to prevent Auto Layout collapse
    let fixedSpec = ensureNonEmptyTextContent(validationResult.data);

    // Apply visual defaults to ensure wireframe-level presentation
    fixedSpec = applyVisualDefaults(fixedSpec, generationContext.targetLayout);

    logger.info({ requestId, spec: fixedSpec }, "DesignSpec generated successfully");
    return fixedSpec;
  } catch (error) {
    logger.error({ requestId, error }, "Error generating DesignSpec");
    throw error;
  }
}
