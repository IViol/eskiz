// Type definitions (inline to avoid module system)
type DesignSpecLayout = "vertical" | "horizontal";

interface DesignSpecBorder {
  color: string;
  width: number;
}

interface DesignSpecFrame {
  name: string;
  width: number;
  height?: number;
  layout: DesignSpecLayout;
  gap: number;
  padding: number;
  background?: string;
  borderRadius?: number;
  border?: DesignSpecBorder;
}

interface DesignSpecTextNode {
  type: "text";
  content: string;
  fontSize?: number;
  color?: string;
}

interface DesignSpecButtonNode {
  type: "button";
  label: string;
  background?: string;
  textColor?: string;
  borderRadius?: number;
}

interface DesignSpecContainerNode {
  type: "container";
  layout: DesignSpecLayout;
  gap: number;
  padding: number;
  children: DesignSpecNode[];
  background?: string;
  borderRadius?: number;
  border?: DesignSpecBorder;
}

type DesignSpecNode = DesignSpecTextNode | DesignSpecButtonNode | DesignSpecContainerNode;

interface DesignSpec {
  page: string;
  frame: DesignSpecFrame;
  nodes: DesignSpecNode[];
}

const pluginHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Eskiz Executor</title>
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      body {
        font-family: Inter, sans-serif;
        font-size: 12px;
        padding: 16px;
        color: #333;
      }

      .container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      label {
        font-weight: 500;
        display: block;
        margin-bottom: 4px;
      }

      textarea {
        width: 100%;
        min-height: 200px;
        padding: 8px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        font-family: "Courier New", monospace;
        font-size: 11px;
        resize: vertical;
      }

      textarea:focus {
        outline: none;
        border-color: #18a0fb;
      }

      button {
        width: 100%;
        padding: 8px 16px;
        background: #18a0fb;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }

      button:hover {
        background: #1592e6;
      }

      button:active {
        background: #0f7fc7;
      }

      button:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .error {
        padding: 8px;
        background: #ffebee;
        border: 1px solid #f44336;
        border-radius: 4px;
        color: #c62828;
        font-size: 11px;
        display: none;
      }

      .error.visible {
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div>
        <label for="spec-input">DesignSpec JSON:</label>
        <textarea id="spec-input" placeholder='{"page": "Login", "frame": {...}, "nodes": [...]}'></textarea>
      </div>
      <button id="apply-btn">Apply</button>
      <div id="error" class="error"></div>
    </div>

    <script>
      const specInput = document.getElementById("spec-input");
      const applyBtn = document.getElementById("apply-btn");
      const errorDiv = document.getElementById("error");

      function showError(message) {
        errorDiv.textContent = message;
        errorDiv.classList.add("visible");
      }

      function hideError() {
        errorDiv.classList.remove("visible");
      }

      applyBtn.addEventListener("click", () => {
        hideError();
        const jsonText = specInput.value.trim();

        if (!jsonText) {
          showError("Please enter a DesignSpec JSON");
          return;
        }

        let spec;
        try {
          spec = JSON.parse(jsonText);
        } catch (e) {
          showError("Invalid JSON: " + e.message);
          return;
        }

        applyBtn.disabled = true;
        applyBtn.textContent = "Applying...";

        parent.postMessage({ pluginMessage: { type: "apply", spec } }, "*");
      });

      window.onmessage = (event) => {
        const msg = event.data.pluginMessage;
        if (msg.type === "error") {
          showError(msg.message);
          applyBtn.disabled = false;
          applyBtn.textContent = "Apply";
        } else if (msg.type === "success") {
          // Plugin will close automatically
        }
      };
    </script>
  </body>
</html>`;

const DEFAULT_FONT = { family: "Inter", style: "Regular" };
const DEFAULT_FONT_SIZE = 16;

// Visual defaults for readability - MUST use fills property
const TEXT_COLOR_DEFAULT = { r: 0.07, g: 0.07, b: 0.07 }; // Dark text color
const BUTTON_BACKGROUND = { r: 0.145, g: 0.388, b: 0.922 }; // Blue button background
const BUTTON_TEXT_COLOR = { r: 1, g: 1, b: 1 }; // White button text
const BUTTON_PADDING = 12;
const BUTTON_CORNER_RADIUS = 8;
const CONTAINER_BACKGROUND = { r: 1, g: 1, b: 1 }; // White container background
const CONTAINER_CORNER_RADIUS = 12;

/**
 * Converts hex color string to RGB color object.
 * Supports formats: "#RGB", "#RRGGBB"
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 3) {
    // Expand shorthand: #RGB -> #RRGGBB
    const r = Number.parseInt(cleaned[0] + cleaned[0], 16) / 255;
    const g = Number.parseInt(cleaned[1] + cleaned[1], 16) / 255;
    const b = Number.parseInt(cleaned[2] + cleaned[2], 16) / 255;
    return { r, g, b };
  }
  // Full format: #RRGGBB
  const r = Number.parseInt(cleaned.substring(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.substring(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.substring(4, 6), 16) / 255;
  return { r, g, b };
}

/**
 * Applies border to a frame using correct Figma API: strokes, strokeWeight, strokeAlign
 */
function applyBorder(frame: FrameNode, border: DesignSpecBorder): void {
  const rgb = hexToRgb(border.color);
  frame.strokes = [{ type: "SOLID", color: rgb }];
  frame.strokeWeight = border.width;
  frame.strokeAlign = "INSIDE"; // Standard for input borders
}

async function loadFont(family: string, style: string): Promise<FontName> {
  const fontName: FontName = { family, style };
  await figma.loadFontAsync(fontName);
  return fontName;
}

async function createTextNode(
  content: string,
  fontSize?: number,
  color?: string,
): Promise<TextNode> {
  const fontName = await loadFont(DEFAULT_FONT.family, DEFAULT_FONT.style);
  const textNode = figma.createText();
  textNode.fontName = fontName;
  textNode.fontSize = fontSize ?? DEFAULT_FONT_SIZE;
  textNode.characters = content;
  // Apply text color from spec or default - MUST use fills property
  const textColor = color ? hexToRgb(color) : TEXT_COLOR_DEFAULT;
  textNode.fills = [{ type: "SOLID", color: textColor }];
  return textNode;
}

async function createButtonNode(
  label: string,
  background?: string,
  textColor?: string,
  borderRadius?: number,
): Promise<FrameNode> {
  const buttonFrame = figma.createFrame();
  buttonFrame.name = label;
  buttonFrame.layoutMode = "HORIZONTAL";
  buttonFrame.primaryAxisSizingMode = "AUTO";
  buttonFrame.counterAxisSizingMode = "AUTO";
  buttonFrame.paddingLeft = BUTTON_PADDING;
  buttonFrame.paddingRight = BUTTON_PADDING;
  buttonFrame.paddingTop = BUTTON_PADDING;
  buttonFrame.paddingBottom = BUTTON_PADDING;
  buttonFrame.cornerRadius = borderRadius ?? BUTTON_CORNER_RADIUS;
  // Apply background fill from spec or default - MUST use fills property
  const bgColor = background ? hexToRgb(background) : BUTTON_BACKGROUND;
  buttonFrame.fills = [{ type: "SOLID", color: bgColor }];

  const btnTextColor = textColor ? hexToRgb(textColor) : BUTTON_TEXT_COLOR;
  const textNode = await createTextNode(label, undefined, textColor);
  // Apply button text color - MUST use fills property
  textNode.fills = [{ type: "SOLID", color: btnTextColor }];
  buttonFrame.appendChild(textNode);

  return buttonFrame;
}

async function createContainerNode(container: DesignSpecContainerNode): Promise<FrameNode> {
  const containerFrame = figma.createFrame();
  containerFrame.name = "Container";
  containerFrame.layoutMode = container.layout === "vertical" ? "VERTICAL" : "HORIZONTAL";
  containerFrame.primaryAxisSizingMode = "AUTO";
  containerFrame.counterAxisSizingMode = "AUTO";
  containerFrame.itemSpacing = container.gap;
  containerFrame.paddingLeft = container.padding;
  containerFrame.paddingRight = container.padding;
  containerFrame.paddingTop = container.padding;
  containerFrame.paddingBottom = container.padding;
  containerFrame.cornerRadius = container.borderRadius ?? CONTAINER_CORNER_RADIUS;
  // Apply background fill from spec or default - MUST use fills property
  const bgColor = container.background ? hexToRgb(container.background) : CONTAINER_BACKGROUND;
  containerFrame.fills = [{ type: "SOLID", color: bgColor }];

  // Apply border using correct Figma API: strokes, strokeWeight, strokeAlign
  if (container.border) {
    applyBorder(containerFrame, container.border);
  }

  for (const childNode of container.children) {
    const node = await createNode(childNode);
    containerFrame.appendChild(node);
  }

  return containerFrame;
}

async function createNode(node: DesignSpecNode): Promise<SceneNode> {
  if (node.type === "text") {
    return await createTextNode(node.content, node.fontSize, node.color);
  }
  if (node.type === "button") {
    return await createButtonNode(node.label, node.background, node.textColor, node.borderRadius);
  }
  if (node.type === "container") {
    return await createContainerNode(node);
  }
  throw new Error(`Unknown node type: ${(node as DesignSpecNode).type}`);
}

async function executeSpec(spec: DesignSpec): Promise<void> {
  try {
    // Create page
    const page = figma.createPage();
    page.name = spec.page;

    // Create root frame
    const frame = figma.createFrame();
    frame.name = spec.frame.name;
    frame.layoutMode = spec.frame.layout === "vertical" ? "VERTICAL" : "HORIZONTAL";
    
    // Set sizing modes based on whether height is specified
    const hasFixedHeight = spec.frame.height !== undefined;
    if (spec.frame.layout === "vertical") {
      // Vertical layout: primary axis is vertical
      frame.primaryAxisSizingMode = hasFixedHeight ? "FIXED" : "AUTO";
      frame.counterAxisSizingMode = "FIXED"; // Width is always fixed
    } else {
      // Horizontal layout: primary axis is horizontal
      frame.primaryAxisSizingMode = "FIXED"; // Width is always fixed
      frame.counterAxisSizingMode = hasFixedHeight ? "FIXED" : "AUTO";
    }
    
    // Set dimensions using resize() - required when using FIXED sizing modes
    const frameHeight = spec.frame.height ?? 0; // 0 means auto-calculate
    frame.resize(spec.frame.width, frameHeight);
    
    frame.itemSpacing = spec.frame.gap;
    frame.paddingLeft = spec.frame.padding;
    frame.paddingRight = spec.frame.padding;
    frame.paddingTop = spec.frame.padding;
    frame.paddingBottom = spec.frame.padding;
    frame.cornerRadius = spec.frame.borderRadius ?? CONTAINER_CORNER_RADIUS;
    
    // Apply background fill from spec or default - MUST use fills property
    const bgColor = spec.frame.background ? hexToRgb(spec.frame.background) : CONTAINER_BACKGROUND;
    frame.fills = [{ type: "SOLID", color: bgColor }];

    // Apply border using correct Figma API: strokes, strokeWeight, strokeAlign
    if (spec.frame.border) {
      applyBorder(frame, spec.frame.border);
    }

    // Create child nodes
    for (const nodeSpec of spec.nodes) {
      const node = await createNode(nodeSpec);
      frame.appendChild(node);
    }

    // Add frame to page
    page.appendChild(frame);

    // Set as current page and scroll to frame
    figma.currentPage = page;
    figma.viewport.scrollAndZoomIntoView([frame]);
  } catch (error) {
    // Re-throw with context for better error messages
    if (error instanceof Error) {
      throw new Error(`Execution failed: ${error.message}`);
    }
    throw error;
  }
}

// Check if we're in read-only mode before showing UI
function checkReadOnlyMode(): boolean {
  try {
    // Try to create a test frame - if it fails, we're in read-only mode
    const testFrame = figma.createFrame();
    testFrame.remove();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes("read-only");
  }
}

if (checkReadOnlyMode()) {
  figma.notify(
    "This plugin cannot run in read-only mode (dev handoff panel).\n\n" +
      "Please:\n" +
      "1. Close the dev handoff panel\n" +
      "2. Open a regular Figma file\n" +
      "3. Run the plugin from: Plugins → eskiz executor",
    { error: true, timeout: 10000 },
  );
  figma.closePlugin();
} else {
  figma.showUI(pluginHtml, { width: 400, height: 400 });
}

function validateSpecStructure(spec: unknown): spec is DesignSpec {
  if (typeof spec !== "object" || spec === null) {
    throw new Error("Invalid DesignSpec: must be an object");
  }

  const s = spec as Record<string, unknown>;

  if (typeof s.page !== "string" || s.page.length === 0) {
    throw new Error("Invalid DesignSpec: missing or invalid 'page' field");
  }

  if (typeof s.frame !== "object" || s.frame === null) {
    throw new Error("Invalid DesignSpec: missing 'frame' field");
  }

  if (!Array.isArray(s.nodes)) {
    throw new Error("Invalid DesignSpec: 'nodes' must be an array");
  }

  return true;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "apply") {
    try {
      const spec = msg.spec as unknown;

      // Structural validation
      validateSpecStructure(spec);

      // Type assertion after validation
      const validatedSpec = spec as DesignSpec;

      // Execute with error handling
      await executeSpec(validatedSpec);
      figma.ui.postMessage({ type: "success" });
      figma.closePlugin();
    } catch (error) {
      console.error("Plugin error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      figma.ui.postMessage({ type: "error", message: errorMessage });
      figma.notify(`Error: ${errorMessage}`, { error: true });
    }
  }
};
