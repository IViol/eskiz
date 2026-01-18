import { designSpecSchema } from "@eskiz/spec";
import type { DesignSpec, GenerationContext, PromptRequest } from "@eskiz/spec";
import OpenAI from "openai";
import { getEnv } from "../config/env.js";
import { logger } from "../logger.js";

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
};

function buildSystemPrompt(context: GenerationContext): string {
  const basePrompt = `You are a UI layout generator.

Your task is to generate a DesignSpec for UI layouts that follows basic UX and visual design principles.

ALWAYS apply the following rules:`;

  const layoutRules = [];
  if (context.targetLayout === "mobile") {
    layoutRules.push(
      "- Use mobile-first layout (width ~360–400px)",
      "- Prioritize vertical hierarchy with clear spacing",
      "- Use larger spacing between elements (16–24px)",
    );
  } else if (context.targetLayout === "tablet") {
    layoutRules.push(
      "- Use tablet layout (width ~600–800px)",
      "- Balance vertical and horizontal organization",
      "- Use medium spacing between elements (16–20px)",
    );
  } else {
    // desktop
    layoutRules.push(
      "- Use desktop layout (width ~800–1200px)",
      "- Support wider layouts but maintain structure",
      "- Use consistent spacing (16–24px)",
    );
  }

  const strictnessRules = [];
  if (context.uiStrictness === "strict") {
    strictnessRules.push(
      "- Use explicit containers for all grouped elements",
      "- Maintain clear visual hierarchy",
      "- Do not add extra decorative or supporting text unless explicitly requested",
    );
  } else {
    // balanced
    strictnessRules.push(
      "- Use containers for grouping",
      "- Allow headers or supporting text if relevant to the prompt",
      "- Balance structure with content needs",
    );
  }

  const uxPatternRules = [];
  if (context.uxPatterns.groupElements) {
    uxPatternRules.push(
      "- Group related elements in containers",
      "- Use logical grouping (e.g. form fields together)",
    );
  }
  if (context.uxPatterns.formContainer) {
    uxPatternRules.push(
      "- Wrap all form elements in a dedicated form container",
      "- Form containers must have clear padding and spacing",
    );
  }
  if (context.uxPatterns.helperText) {
    uxPatternRules.push(
      "- Include helper or hint text where appropriate",
      "- Helper text should be smaller and placed near relevant elements",
    );
  }

  return `${basePrompt}

1. Layout & hierarchy
- Every screen must have a single root container (frame)
- Content must be vertically structured with clear spacing
${layoutRules.map((r) => `- ${r}`).join("\n")}

2. Forms
- Inputs are NOT plain text
- Represent each input as:
  - a container (frame) with padding
  - a label text above or inside
${context.uxPatterns.formContainer ? "- Group form elements inside a form container" : "- Organize form elements logically"}

3. Spacing
- Use consistent vertical spacing between elements
- Minimum spacing between form fields: 12–16px
- Padding inside containers: at least 16–24px

4. Buttons
- Buttons must be visually distinguishable
- Represent buttons as a container with background and label
- Buttons must have padding and clear size

5. UI Strictness
${strictnessRules.map((r) => `- ${r}`).join("\n")}

6. UX Patterns
${uxPatternRules.length > 0 ? uxPatternRules.map((r) => `- ${r}`).join("\n") : "- Follow standard UX practices"}

7. Do NOT:
- Place raw text elements directly on the canvas without layout
- Create isolated elements without visual grouping
- Assume "designer intuition" — be explicit in structure

Your output must be a valid DesignSpec JSON only.
No explanations.
No markdown.`;
}

const ASSISTANT_PROMPT = `The DesignSpec JSON structure:

{
  "page": "string (page name)",
  "frame": {
    "name": "string (frame name)",
    "width": number (positive integer, typically 360-400 for mobile-first),
    "layout": "vertical" | "horizontal",
    "gap": number (non-negative integer, spacing between nodes, typically 12-16),
    "padding": number (non-negative integer, internal padding, typically 16-24)
  },
  "nodes": [
    { "type": "text", "content": "string", "fontSize": number (optional, typically 14-20) },
    { "type": "button", "label": "string" },
    {
      "type": "container",
      "layout": "vertical" | "horizontal",
      "gap": number (spacing between children),
      "padding": number (internal padding),
      "children": [Node...] (array of child nodes, can be nested)
    }
  ]
}

Example for a login form:
{
  "page": "Login",
  "frame": {
    "name": "Login Form",
    "width": 400,
    "layout": "vertical",
    "gap": 24,
    "padding": 24
  },
  "nodes": [
    { "type": "text", "content": "Login", "fontSize": 20 },
    {
      "type": "container",
      "layout": "vertical",
      "gap": 12,
      "padding": 16,
      "children": [
        { "type": "text", "content": "Email", "fontSize": 14 },
        { "type": "text", "content": "Password", "fontSize": 14 }
      ]
    },
    { "type": "button", "label": "Submit" }
  ]
}`;

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
    return {
      page: "Mock Page",
      frame: {
        name: "Mock Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        { type: "text", content: "Mock content", fontSize: 16 },
        {
          type: "container",
          layout: "vertical",
          gap: 12,
          padding: 16,
          children: [{ type: "text", content: "Nested text", fontSize: 14 }],
        },
        { type: "button", label: "Mock Button" },
      ],
    };
  }

  try {
    const systemPrompt = buildSystemPrompt(generationContext);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "assistant", content: ASSISTANT_PROMPT },
        { role: "user", content: request.prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

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

    logger.info({ requestId, spec: validationResult.data }, "DesignSpec generated successfully");
    return validationResult.data;
  } catch (error) {
    logger.error({ requestId, error }, "Error generating DesignSpec");
    throw error;
  }
}
