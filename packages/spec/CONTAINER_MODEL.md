# Container Model: Layout vs Surface

This document defines the conceptual model for containers in DesignSpecs. This model is **normative**: all generators, rules, and validators must follow it.

## Two Container Types

DesignSpec containers fall into two distinct categories:

### 1. Layout Container

A **Layout Container** exists only to organize, group, or align other elements.

**Characteristics:**
- Has layout properties: `layout` (vertical/horizontal), `gap`, `padding`
- **MUST NOT** have visual styling properties
- **MUST NOT** have `background`, `borderRadius`, or `border`/`stroke`
- Used for structural organization only

**Examples:**
- Field group containers (grouping form inputs together)
- Actions containers (grouping buttons)
- Wrapper containers (centering, spacing, alignment)
- Nested layout containers (organizing sections)

**Rule:** If a container exists only to organize or position other elements, it should have **NO visual styling**.

### 2. Surface Container

A **Surface Container** represents a visible UI surface that users interact with or perceive as a distinct element.

**Characteristics:**
- Represents a tangible UI element (card, input field, panel)
- **MAY** have visual styling: `background`, `borderRadius`, `border`/`stroke`
- Used intentionally and sparingly

**Examples:**
- Form card containers (the main form wrapper with background and rounded corners)
- Input containers (input fields with borders)
- Content cards (panels with backgrounds)
- Button containers (though buttons are typically their own node type)

**Rule:** Visual properties should only be applied to containers that represent actual UI surfaces.

## Principles

1. **Most containers are layout containers.** Layout containers are the default, not the exception.

2. **Surface containers are the exception.** Only apply visual styling when a container represents a distinct UI surface.

3. **Visual properties must never "leak" to layout containers.** This is a critical constraint that prevents visual pollution.

4. **The distinction is semantic, not structural.** Both types use the same `container` node type in the schema. The difference is in their purpose and styling.

## Correct Usage

### ✅ Correct: Layout container without styling

```json
{
  "type": "container",
  "layout": "vertical",
  "gap": 16,
  "padding": 0,
  "children": [
    { "type": "text", "content": "Email" },
    { "type": "text", "content": "Password" }
  ]
}
```

This container groups form fields but has no visual styling—it's purely for organization.

### ✅ Correct: Surface container (form card) with styling

```json
{
  "type": "container",
  "layout": "vertical",
  "gap": 24,
  "padding": 24,
  "background": "#FFFFFF",
  "borderRadius": 12,
  "children": [
    { "type": "text", "content": "Login" },
    {
      "type": "container",
      "layout": "vertical",
      "gap": 16,
      "padding": 0,
      "children": [
        { "type": "text", "content": "Email" }
      ]
    }
  ]
}
```

The outer container is a form card (surface) with styling. The inner container is a layout container (field group) without styling.

### ✅ Correct: Input container (surface) with border

```json
{
  "type": "container",
  "layout": "vertical",
  "gap": 0,
  "padding": 12,
  "background": "#FFFFFF",
  "border": { "color": "#D1D5DB", "width": 1 },
  "children": [
    { "type": "text", "content": "Enter your email" }
  ]
}
```

This container represents an input field (surface) and appropriately has visual styling.

## Incorrect Usage

### ❌ Incorrect: Layout container with borderRadius

```json
{
  "type": "container",
  "layout": "vertical",
  "gap": 16,
  "padding": 0,
  "borderRadius": 12,
  "children": [
    { "type": "text", "content": "Email" },
    { "type": "text", "content": "Password" }
  ]
}
```

**Problem:** This is a field group container (layout-only) but has `borderRadius`. Visual styling has leaked to a layout container.

### ❌ Incorrect: Nested white boxes

```json
{
  "type": "container",
  "layout": "vertical",
  "gap": 0,
  "padding": 24,
  "background": "#FFFFFF",
  "borderRadius": 12,
  "children": [
    {
      "type": "container",
      "layout": "vertical",
      "gap": 16,
      "padding": 16,
      "background": "#FFFFFF",
      "borderRadius": 8,
      "children": [
        { "type": "text", "content": "Content" }
      ]
    }
  ]
}
```

**Problem:** Both containers have backgrounds and borderRadius, creating nested white boxes. The inner container is likely a layout container and should not have visual styling.

### ❌ Incorrect: Wrapper container with background

```json
{
  "type": "container",
  "layout": "vertical",
  "gap": 0,
  "padding": 0,
  "background": "#F9FAFB",
  "children": [
    {
      "type": "container",
      "layout": "vertical",
      "gap": 24,
      "padding": 24,
      "background": "#FFFFFF",
      "borderRadius": 12,
      "children": [
        { "type": "text", "content": "Form" }
      ]
    }
  ]
}
```

**Problem:** The outer container is a wrapper (layout-only) but has a background. Only the inner form card should have styling.

## Detection Heuristics

When validating DesignSpecs, a container should be flagged as a potential layout container with visual leaks if:

1. It has type `"container"`
2. It has any visual styling (`background`, `borderRadius`, or `border`)
3. It does NOT appear to be:
   - An input-like container (has border and contains placeholder text)
   - A card-like container (has background + borderRadius, contains substantial content)
   - A button (though buttons should use the `button` node type)

## Impact on Generation Rules

All generation rules must respect this distinction:

- **Visual baseline rules** should explicitly state when NOT to apply styling
- **Layout rules** should emphasize that layout containers are visually neutral
- **Pattern rules** (e.g., auth-form) should distinguish between form cards (surface) and field groups (layout)

See `spec-rules/visual-baseline.json` and `spec-rules/base.json` for rule implementations.

## Validator

A lightweight validator (`apps/api/src/spec/validation/validateVisualUsage.ts`) detects visual leaks to layout containers and emits warnings. This is a safety net, not a formal proof system.
