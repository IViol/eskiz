import type { ContainerNode, DesignSpec, Node } from "@eskiz/spec";

/**
 * Warning about visual styling applied to a layout container
 */
export interface VisualUsageWarning {
  /**
   * Path to the problematic node (e.g., "nodes[0].children[2]")
   */
  path: string;
  /**
   * Which visual properties are present
   */
  properties: string[];
  /**
   * Explanation of why this is likely a violation
   */
  reason: string;
}

/**
 * Checks if a container appears to be an input-like container
 * (has border and contains placeholder-like text)
 */
function isInputLikeContainer(node: ContainerNode): boolean {
  if (!node.border) {
    return false;
  }
  // Check if container has placeholder-like text children
  const hasPlaceholderText = node.children.some(
    (child: Node) =>
      child.type === "text" &&
      (child.content.toLowerCase().includes("enter") ||
        child.content.toLowerCase().includes("placeholder") ||
        child.content.toLowerCase().includes("hint")),
  );
  return hasPlaceholderText;
}

/**
 * Checks if a container appears to be a card-like container
 * (has background + borderRadius and contains substantial content)
 */
function isCardLikeContainer(node: ContainerNode): boolean {
  if (!node.background || !node.borderRadius) {
    return false;
  }
  // Card-like containers typically have padding (form cards, content cards)
  if (node.padding >= 16) {
    return true;
  }
  // Or contain multiple children (indicating it's a content container)
  // But only if it has some padding (even small)
  if (node.padding > 0 && node.children.length >= 2) {
    return true;
  }
  // Containers with no padding and few children are likely layout containers
  return false;
}

/**
 * Checks if a container has visual styling
 */
function hasVisualStyling(node: ContainerNode): boolean {
  return !!(node.background || node.borderRadius || node.border);
}

/**
 * Builds a path string for a node (e.g., "nodes[0].children[2]")
 */
function buildPath(segments: (string | number)[]): string {
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (typeof segment === "number") {
      const prev = segments[i - 1];
      if (prev === "nodes" || prev === "children") {
        parts.push(`${prev}[${segment}]`);
      } else {
        parts.push(`[${segment}]`);
      }
    } else if (segment !== "nodes" && segment !== "children") {
      parts.push(segment);
    }
  }
  return parts.join(".");
}

/**
 * Traverses a DesignSpec and detects containers with visual styling
 * that appear to be layout-only containers
 */
export function validateVisualUsage(spec: DesignSpec): VisualUsageWarning[] {
  const warnings: VisualUsageWarning[] = [];

  function traverseNode(node: Node, pathSegments: (string | number)[]): void {
    if (node.type !== "container") {
      return;
    }

    const container = node as ContainerNode;

    // Skip if container has no visual styling
    if (!hasVisualStyling(container)) {
      // Continue traversing children
      container.children.forEach((child, index) => {
        traverseNode(child, [...pathSegments, "children", index]);
      });
      return;
    }

    // Container has visual styling - check if it's legitimate
    const isInput = isInputLikeContainer(container);
    const isCard = isCardLikeContainer(container);

    if (!isInput && !isCard) {
      // This appears to be a layout container with visual styling
      const properties: string[] = [];
      if (container.background) {
        properties.push(`background="${container.background}"`);
      }
      if (container.borderRadius !== undefined) {
        properties.push(`borderRadius=${container.borderRadius}`);
      }
      if (container.border) {
        properties.push("border");
      }

      const path = buildPath(pathSegments);
      const reason =
        "Container appears to be layout-only (grouping/alignment) but has visual styling. " +
        "Layout containers should not have background, borderRadius, or border properties. " +
        "Only surface containers (cards, inputs) should have visual styling.";

      warnings.push({
        path,
        properties,
        reason,
      });
    }

    // Continue traversing children
    container.children.forEach((child: Node, index: number) => {
      traverseNode(child, [...pathSegments, "children", index]);
    });
  }

  // Traverse all nodes
  spec.nodes.forEach((node: Node, index: number) => {
    traverseNode(node, ["nodes", index]);
  });

  return warnings;
}
