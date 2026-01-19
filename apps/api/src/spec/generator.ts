import { designSpecSchema } from "@eskiz/spec";
import type { DesignSpec, GenerationContext, PromptRequest } from "@eskiz/spec";
import OpenAI from "openai";
import { getEnv } from "../config/env.js";
import { logger } from "../logger.js";
import { assembleSystemPrompt } from "./prompt/assembleSystemPrompt.js";
import { validateVisualUsage } from "./validation/validateVisualUsage.js";

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
          node.borderRadius ?? (isInput ? undefined : VISUAL_DEFAULTS.containerBorderRadius),
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
    {
      requestId,
      event: "designspec.generation.start",
      prompt_length_chars: request.prompt.length,
      generationContext,
      dryRun,
    },
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

    // Calculate request characteristics for logging
    const messages = requestOptions.messages;
    const promptLength = messages.reduce(
      (sum, msg) => sum + (typeof msg.content === "string" ? msg.content.length : 0),
      0,
    );
    const requestStartTime = Date.now();

    // Log request start
    logger.debug(
      {
        requestId,
        event: "openai.request.start",
        model: requestOptions.model,
        messages_count: messages.length,
        prompt_length_chars: promptLength,
        temperature: "temperature" in requestOptions ? requestOptions.temperature : undefined,
        max_tokens: "max_tokens" in requestOptions ? requestOptions.max_tokens : undefined,
      },
      "Starting OpenAI API request",
    );

    let completion: Awaited<ReturnType<typeof openai.chat.completions.create>>;
    let requestEndTime: number;
    let durationMs: number;

    try {
      completion = await openai.chat.completions.create(requestOptions);
      requestEndTime = Date.now();
      durationMs = requestEndTime - requestStartTime;

      // Extract token usage from response
      const usage = completion.usage;
      const tokenInfo = usage
        ? {
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
          }
        : {};

      // Log successful request
      const logData = {
        requestId,
        event: "openai.request",
        model: requestOptions.model,
        duration_ms: durationMs,
        request_start_time: requestStartTime,
        request_end_time: requestEndTime,
        messages_count: messages.length,
        prompt_length_chars: promptLength,
        temperature: "temperature" in requestOptions ? requestOptions.temperature : undefined,
        max_tokens: "max_tokens" in requestOptions ? requestOptions.max_tokens : undefined,
        ...tokenInfo,
      };

      // Log as warning if slow, otherwise info
      if (durationMs > 3000) {
        logger.warn(
          {
            ...logData,
            slow_request: true,
            threshold_ms: 3000,
          },
          "Slow OpenAI request detected",
        );
      } else {
        logger.info(logData, "OpenAI request completed");
      }
    } catch (openaiError: unknown) {
      requestEndTime = Date.now();
      durationMs = requestEndTime - requestStartTime;

      // Extract error information
      const errorInfo: {
        error_message: string;
        error_type: string;
        http_status?: number;
        retryable?: boolean;
      } = {
        error_message: openaiError instanceof Error ? openaiError.message : String(openaiError),
        error_type: openaiError instanceof Error ? openaiError.constructor.name : "UnknownError",
      };

      // Check if it's an OpenAI API error with status
      if (
        openaiError &&
        typeof openaiError === "object" &&
        "status" in openaiError &&
        typeof openaiError.status === "number"
      ) {
        errorInfo.http_status = openaiError.status;
        // 429, 500, 502, 503, 504 are typically retryable
        errorInfo.retryable = [429, 500, 502, 503, 504].includes(openaiError.status);
      }

      logger.error(
        {
          requestId,
          event: "openai.request.error",
          model: requestOptions.model,
          duration_ms: durationMs,
          request_start_time: requestStartTime,
          request_end_time: requestEndTime,
          messages_count: messages.length,
          prompt_length_chars: promptLength,
          temperature: "temperature" in requestOptions ? requestOptions.temperature : undefined,
          max_tokens: "max_tokens" in requestOptions ? requestOptions.max_tokens : undefined,
          ...errorInfo,
        },
        "OpenAI API request failed",
      );

      // Re-throw the error to preserve existing error behavior
      throw openaiError;
    }

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      logger.error(
        {
          requestId,
          event: "openai.response.empty",
          model: requestOptions.model,
          duration_ms: durationMs,
        },
        "Empty response from OpenAI",
      );
      throw new Error("Empty response from OpenAI");
    }

    // Log response received (without content)
    logger.debug(
      {
        requestId,
        event: "openai.response.received",
        model: requestOptions.model,
        response_length_chars: content.length,
        duration_ms: durationMs,
      },
      "Received OpenAI response",
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      logger.error(
        {
          requestId,
          event: "openai.response.parse_error",
          error_message: error instanceof Error ? error.message : String(error),
          response_length_chars: content.length,
        },
        "Failed to parse JSON from OpenAI",
      );
      throw new Error("Invalid JSON response from OpenAI");
    }

    const validationResult = designSpecSchema.safeParse(parsed);
    if (!validationResult.success) {
      logger.error(
        {
          requestId,
          event: "designspec.validation_error",
          error_count: validationResult.error.errors.length,
          errors: validationResult.error.errors,
        },
        "DesignSpec validation failed",
      );
      throw new Error(`Invalid DesignSpec: ${validationResult.error.message}`);
    }

    // Ensure all text nodes have non-empty content to prevent Auto Layout collapse
    let fixedSpec = ensureNonEmptyTextContent(validationResult.data);

    // Apply visual defaults to ensure wireframe-level presentation
    fixedSpec = applyVisualDefaults(fixedSpec, generationContext.targetLayout);

    // Validate visual usage (layout vs surface containers)
    const visualWarnings = validateVisualUsage(fixedSpec);
    if (visualWarnings.length > 0) {
      logger.warn(
        { requestId, warnings: visualWarnings },
        "Visual styling detected on layout containers",
      );
      // Log individual warnings for better debuggability
      for (const warning of visualWarnings) {
        logger.debug(
          {
            requestId,
            path: warning.path,
            properties: warning.properties,
            reason: warning.reason,
          },
          "Visual usage warning",
        );
      }
    }

    logger.info({ requestId, spec: fixedSpec }, "DesignSpec generated successfully");
    return fixedSpec;
  } catch (error) {
    logger.error({ requestId, error }, "Error generating DesignSpec");
    throw error;
  }
}
