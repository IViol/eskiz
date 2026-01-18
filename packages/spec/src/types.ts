export type Layout = "vertical" | "horizontal";

export interface Frame {
  name: string;
  width: number;
  layout: Layout;
  gap: number;
  padding: number;
}

export interface TextNode {
  type: "text";
  content: string;
  fontSize?: number;
}

export interface ButtonNode {
  type: "button";
  label: string;
}

export interface ContainerNode {
  type: "container";
  layout: Layout;
  gap: number;
  padding: number;
  children: Node[];
}

export type Node = TextNode | ButtonNode | ContainerNode;

export interface DesignSpec {
  page: string;
  frame: Frame;
  nodes: Node[];
}

export type TargetLayout = "mobile" | "tablet" | "desktop";

export type UIStrictness = "strict" | "balanced";

export interface UXPatterns {
  groupElements: boolean;
  formContainer: boolean;
  helperText: boolean;
}

export interface GenerationContext {
  targetLayout: TargetLayout;
  uiStrictness: UIStrictness;
  uxPatterns: UXPatterns;
}
