import { designSpecSchema } from "@eskiz/spec";
import type { DesignSpec, GenerationContext, PromptRequest } from "@eskiz/spec";
import OpenAI from "openai";
import { getEnv } from "../config/env.js";
import { createChildSpan, getTracingContext } from "../context/tracing.js";
import { checkBudgetAlerts } from "../utils/budgetAlerts.js";
import { computeHash, computeObjectHash } from "../utils/hash.js";
import { getContextLogger } from "../utils/logger.js";
import { makeOpenAIRequestWithRetry } from "../utils/openaiRetry.js";
import { analyzeSpec } from "../utils/specAnalysis.js";
import { aggregateWarnings } from "../utils/warningsAggregation.js";
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
    (child: DesignSpec["nodes"][number]) =>
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
  const defaultDimensions: Record<
    GenerationContext["targetLayout"],
    { width: number; height: number }
  > = {
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
  const context = getTracingContext();
  if (!context) {
    throw new Error("Tracing context not found");
  }

  // Create span for generation
  const generationSpan = createChildSpan(context);
  const log = getContextLogger().child({ spanId: generationSpan.spanId });

  const generationContext = request.generationContext ?? DEFAULT_GENERATION_CONTEXT;
  const promptLength = request.prompt.length;
  const promptHash = computeHash(request.prompt);

  log.info(
    {
      event: "designspec.generation.start",
      spanId: generationSpan.spanId,
      prompt_length_chars: promptLength,
      prompt_hash: promptHash,
      generationContext,
      dryRun,
    },
    "Generating DesignSpec",
  );

  if (dryRun) {
    log.info({ spanId: generationSpan.spanId }, "Dry run mode - returning mock spec");
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
    const finalMockSpec = applyVisualDefaults(mockSpec, generationContext.targetLayout);
    const specHash = computeObjectHash(finalMockSpec);
    const analysis = analyzeSpec(finalMockSpec);

    log.info(
      {
        event: "designspec.generation.success",
        spanId: generationSpan.spanId,
        spec_hash: specHash,
        spec_length_chars: JSON.stringify(finalMockSpec).length,
        ...analysis,
        dryRun: true,
      },
      "DesignSpec generated successfully (dry run)",
    );

    return finalMockSpec;
  }

  try {
    const systemPrompt = buildSystemPrompt(generationContext, request.prompt);
    const model = "gpt-5-nano";

    // Compute final prompt hash (system + assistant + user)
    const finalPrompt = [systemPrompt, ASSISTANT_PROMPT, request.prompt].join("\n");
    const finalPromptHash = computeHash(finalPrompt);

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
    const totalPromptLength = messages.reduce(
      (sum, msg) => sum + (typeof msg.content === "string" ? msg.content.length : 0),
      0,
    );
    const requestStartTime = Date.now();

    // Create span for OpenAI request
    const openaiSpan = createChildSpan(generationSpan);
    const openaiLog = log.child({ spanId: openaiSpan.spanId });

    // Make request with retry logic
    const retryResult = await makeOpenAIRequestWithRetry(openai, requestOptions);
    const requestEndTime = Date.now();
    const durationMs = requestEndTime - requestStartTime;

    if (retryResult.outcome !== "success" || !retryResult.completion) {
      openaiLog.error(
        {
          event: "openai.request",
          spanId: openaiSpan.spanId,
          model: requestOptions.model,
          duration_ms: durationMs,
          retry_count: retryResult.retryCount,
          outcome: retryResult.outcome,
          openai_request_id: retryResult.openaiRequestId,
          prompt_hash: finalPromptHash,
          prompt_length_chars: totalPromptLength,
        },
        "OpenAI request failed",
      );
      throw new Error(`OpenAI request failed: ${retryResult.outcome}`);
    }

    const completion = retryResult.completion;

    // Extract token usage from response
    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? 0;

    // Log successful request
    openaiLog.info(
      {
        event: "openai.request",
        spanId: openaiSpan.spanId,
        model: requestOptions.model,
        duration_ms: durationMs,
        retry_count: retryResult.retryCount,
        outcome: retryResult.outcome,
        openai_request_id: retryResult.openaiRequestId,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
        prompt_hash: finalPromptHash,
        prompt_length_chars: totalPromptLength,
      },
      "OpenAI request completed",
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      openaiLog.error(
        {
          event: "openai.response.empty",
          spanId: openaiSpan.spanId,
          model: requestOptions.model,
          duration_ms: durationMs,
        },
        "Empty response from OpenAI",
      );
      throw new Error("Empty response from OpenAI");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      openaiLog.error(
        {
          event: "openai.response.parse_error",
          spanId: openaiSpan.spanId,
          error_message: error instanceof Error ? error.message : String(error),
          response_length_chars: content.length,
        },
        "Failed to parse JSON from OpenAI",
      );
      throw new Error("Invalid JSON response from OpenAI");
    }

    const validationResult = designSpecSchema.safeParse(parsed);
    if (!validationResult.success) {
      log.error(
        {
          event: "designspec.validation_error",
          spanId: generationSpan.spanId,
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

    // Compute spec hash
    const specHash = computeObjectHash(fixedSpec);
    const specLength = JSON.stringify(fixedSpec).length;

    // Analyze spec structure
    const analysis = analyzeSpec(fixedSpec);

    // Validate visual usage (layout vs surface containers)
    const visualWarnings = validateVisualUsage(fixedSpec);
    const warningsAggregated = aggregateWarnings(visualWarnings);

    // Create validation span
    const validationSpan = createChildSpan(generationSpan);
    const validationLog = log.child({ spanId: validationSpan.spanId });

    if (visualWarnings.length > 0) {
      const env = getEnv();
      if (env.LOG_DEBUG_PAYLOADS) {
        // Log detailed warnings in debug mode
        validationLog.warn(
          {
            event: "designspec.validation",
            spanId: validationSpan.spanId,
            warnings: visualWarnings,
            ...warningsAggregated,
          },
          "Visual styling detected on layout containers",
        );
      } else {
        // Log only aggregated warnings in production
        validationLog.warn(
          {
            event: "designspec.validation",
            spanId: validationSpan.spanId,
            ...warningsAggregated,
          },
          "Visual styling detected on layout containers",
        );
      }
    } else {
      validationLog.info(
        {
          event: "designspec.validation",
          spanId: validationSpan.spanId,
          ...warningsAggregated,
        },
        "DesignSpec validation passed",
      );
    }

    // Check budget alerts
    checkBudgetAlerts({
      total_tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      duration_ms: durationMs,
      model: requestOptions.model,
      prompt_hash: finalPromptHash,
      spec_hash: specHash,
    });

    // Log success with all metrics
    const env = getEnv();
    const successLogData: Record<string, unknown> = {
      event: "designspec.generation.success",
      spanId: generationSpan.spanId,
      spec_hash: specHash,
      spec_length_chars: specLength,
      prompt_hash: finalPromptHash,
      prompt_length_chars: totalPromptLength,
      ...analysis,
      ...warningsAggregated,
      openai_request_id: retryResult.openaiRequestId,
      model: requestOptions.model,
      duration_ms: durationMs,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      retry_count: retryResult.retryCount,
    };

    // Include full spec only in debug mode
    if (env.LOG_DEBUG_PAYLOADS) {
      successLogData.spec = fixedSpec;
    }

    log.info(successLogData, "DesignSpec generated successfully");

    return fixedSpec;
  } catch (error) {
    log.error(
      {
        event: "designspec.generation.fail",
        spanId: generationSpan.spanId,
        error_message: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.constructor.name : "UnknownError",
      },
      "Error generating DesignSpec",
    );
    throw error;
  }
}
