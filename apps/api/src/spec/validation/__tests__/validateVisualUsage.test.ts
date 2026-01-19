import type { DesignSpec } from "@eskiz/spec";
import { describe, expect, it } from "vitest";
import { validateVisualUsage } from "../validateVisualUsage.js";

describe("validateVisualUsage", () => {
  it("returns no warnings for spec without visual styling on layout containers", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 16,
          padding: 0,
          children: [
            { type: "text", content: "Email" },
            { type: "text", content: "Password" },
          ],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(0);
  });

  it("detects borderRadius on layout container", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 16,
          padding: 0,
          borderRadius: 12,
          children: [
            { type: "text", content: "Email" },
            { type: "text", content: "Password" },
          ],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toBe("nodes[0]");
    expect(warnings[0].properties).toContain("borderRadius=12");
    expect(warnings[0].reason).toContain("layout-only");
  });

  it("detects background on layout container", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 16,
          padding: 0,
          background: "#FFFFFF",
          children: [
            { type: "text", content: "Email" },
            { type: "text", content: "Password" },
          ],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].properties).toContain('background="#FFFFFF"');
  });

  it("does not flag input-like containers", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 0,
          padding: 12,
          background: "#FFFFFF",
          border: { color: "#D1D5DB", width: 1 },
          children: [{ type: "text", content: "Enter your email" }],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(0);
  });

  it("does not flag card-like containers", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 24,
          padding: 24,
          background: "#FFFFFF",
          borderRadius: 12,
          children: [
            { type: "text", content: "Title" },
            { type: "text", content: "Content" },
            {
              type: "container",
              layout: "vertical",
              gap: 16,
              padding: 0,
              children: [{ type: "text", content: "Field 1" }],
            },
          ],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(0);
  });

  it("detects nested layout containers with visual styling", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 24,
          padding: 24,
          background: "#FFFFFF",
          borderRadius: 12,
          children: [
            {
              type: "container",
              layout: "vertical",
              gap: 16,
              padding: 0,
              borderRadius: 8,
              children: [
                { type: "text", content: "Field 1" },
                { type: "text", content: "Field 2" },
              ],
            },
          ],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toBe("nodes[0].children[0]");
    expect(warnings[0].properties).toContain("borderRadius=8");
  });

  it("builds correct paths for nested containers", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        { type: "text", content: "Title" },
        {
          type: "container",
          layout: "vertical",
          gap: 16,
          padding: 0,
          background: "#F9FAFB",
          children: [
            {
              type: "container",
              layout: "vertical",
              gap: 8,
              padding: 0,
              borderRadius: 4,
              children: [{ type: "text", content: "Nested" }],
            },
          ],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    // Both containers are layout-only with visual styling
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    // Outer container (nodes[1]) should be flagged
    expect(warnings.some((w) => w.path === "nodes[1]")).toBe(true);
    // Inner container should also be flagged
    expect(warnings.some((w) => w.path === "nodes[1].children[0]")).toBe(true);
  });

  it("detects multiple visual properties", () => {
    const spec: DesignSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical",
        gap: 16,
        padding: 24,
      },
      nodes: [
        {
          type: "container",
          layout: "vertical",
          gap: 16,
          padding: 0,
          background: "#FFFFFF",
          borderRadius: 12,
          border: { color: "#D1D5DB", width: 1 },
          children: [{ type: "text", content: "Content" }],
        },
      ],
    };

    const warnings = validateVisualUsage(spec);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].properties.length).toBe(3);
    expect(warnings[0].properties).toContain('background="#FFFFFF"');
    expect(warnings[0].properties).toContain("borderRadius=12");
    expect(warnings[0].properties).toContain("border");
  });
});
