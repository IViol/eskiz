export type Layout = "vertical" | "horizontal";

export interface Border {
  color: string;
  width: number;
}

export interface Frame {
  name: string;
  width: number;
  height?: number;
  layout: Layout;
  gap: number;
  padding: number;
  background?: string;
  borderRadius?: number;
  border?: Border;
}

export interface TextNode {
  type: "text";
  content: string;
  fontSize?: number;
  color?: string;
}

export interface ButtonNode {
  type: "button";
  label: string;
  background?: string;
  textColor?: string;
  borderRadius?: number;
}

export interface ContainerNode {
  type: "container";
  layout: Layout;
  gap: number;
  padding: number;
  children: Node[];
  background?: string;
  borderRadius?: number;
  border?: Border;
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
  visualBaseline?: boolean;
  strictLayout?: boolean;
}
