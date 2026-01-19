import type { ContainerNode, DesignSpec, Node } from "@eskiz/spec";

export interface SpecAnalysis {
  nodes_count: number;
  depth: number;
  surface_nodes_count: number;
}

/**
 * Determines if a node is "layout-only" (not a surface node)
 * A node is layout-only if:
 * - type is "container"
 * - has layout properties (layout/gap/padding)
 * - lacks visual styling (background/border/borderRadius)
 * - lacks text content or interactive elements
 */
function isLayoutOnlyNode(node: Node): boolean {
  if (node.type !== "container") {
    return false;
  }

  const container = node as ContainerNode;

  // Must have layout properties
  const hasLayoutProperties = container.layout !== undefined && container.gap !== undefined;

  // Must NOT have visual styling
  const hasVisualStyling = !!(container.background || container.borderRadius || container.border);

  // Check if has text content or interactive elements
  const hasTextOrInteractive = container.children.some(
    (child) => child.type === "text" || child.type === "button",
  );

  // Layout-only: has layout properties, no visual styling, no text/interactive
  return hasLayoutProperties && !hasVisualStyling && !hasTextOrInteractive;
}

/**
 * Determines if a node is a "surface" node
 * A node is surface if:
 * - It has visual styling (background, border, borderRadius)
 * - AND it's not layout-only
 */
function isSurfaceNode(node: Node): boolean {
  if (node.type === "container") {
    const container = node as ContainerNode;
    const hasVisualStyling = !!(container.background || container.borderRadius || container.border);
    return hasVisualStyling && !isLayoutOnlyNode(node);
  }

  // Text and button nodes are always surface nodes
  return node.type === "text" || node.type === "button";
}

/**
 * Analyzes a DesignSpec and returns metrics
 */
export function analyzeSpec(spec: DesignSpec): SpecAnalysis {
  let nodesCount = 0;
  let maxDepth = 0;
  let surfaceNodesCount = 0;

  function traverseNode(node: Node, currentDepth: number): void {
    nodesCount++;
    maxDepth = Math.max(maxDepth, currentDepth);

    if (isSurfaceNode(node)) {
      surfaceNodesCount++;
    }

    if (node.type === "container") {
      const container = node as ContainerNode;
      for (const child of container.children) {
        traverseNode(child, currentDepth + 1);
      }
    }
  }

  // Traverse all root nodes
  for (const node of spec.nodes) {
    traverseNode(node, 1);
  }

  return {
    nodes_count: nodesCount,
    depth: maxDepth,
    surface_nodes_count: surfaceNodesCount,
  };
}
