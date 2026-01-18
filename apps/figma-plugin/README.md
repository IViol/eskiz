# Eskiz Figma Plugin

A minimal executor plugin that creates Figma nodes from DesignSpec JSON.

## Overview

The Eskiz Figma Plugin is an executor that takes a structured DesignSpec JSON and creates corresponding Figma nodes (pages, frames, text, buttons). It does not make design decisions or validate business logic—it executes the spec as provided.

## What it does

- Accepts DesignSpec JSON via plugin UI
- Creates a new Page in Figma
- Creates a root Frame with Auto Layout based on spec
- Creates child nodes (text and button) according to the spec
- Closes automatically after successful execution

## What it does NOT do

- **No validation beyond basic structure**: Does not validate DesignSpec schema or business rules
- **No updates or diffs**: Always creates new nodes; does not modify existing ones
- **No network calls**: Operates entirely offline
- **No design decisions**: Executes the spec exactly as provided

## Input contract

The plugin expects a DesignSpec JSON matching the contract defined in `packages/spec`:

```typescript
{
  page: string;           // Page name
  frame: {
    name: string;         // Frame name
    width: number;        // Frame width (positive integer)
    layout: "vertical" | "horizontal";
    gap: number;         // Spacing between nodes (non-negative integer)
    padding: number;     // Internal padding (non-negative integer)
  };
  nodes: Array<
    | { type: "text"; content: string }
    | { type: "button"; label: string }
  >;
}
```

The plugin performs minimal structural validation:
- Ensures `page` exists and is a non-empty string
- Ensures `frame` exists and is an object
- Ensures `nodes` exists and is an array

It does not validate:
- Frame property types or ranges
- Node structure beyond basic type checking
- Business logic constraints

## Usage flow

1. **Generate DesignSpec**: Use the web UI or API to generate a DesignSpec from a text prompt
2. **Copy JSON**: Copy the generated DesignSpec JSON
3. **Open plugin**: Run the Eskiz plugin in Figma Desktop
4. **Paste JSON**: Paste the DesignSpec JSON into the plugin UI
5. **Apply**: Click "Apply" to execute
6. **Result**: Plugin creates nodes and closes automatically

## Common errors

### Invalid JSON

**Error**: "Invalid JSON: [message]"

**Cause**: The input is not valid JSON syntax.

**Fix**: Check for syntax errors (missing quotes, commas, brackets). Use a JSON validator if needed.

### Missing required fields

**Error**: "Invalid DesignSpec: missing or invalid 'page' field"

**Cause**: The `page` field is missing, not a string, or empty.

**Fix**: Ensure the DesignSpec includes a non-empty `page` string field.

**Error**: "Invalid DesignSpec: missing 'frame' field"

**Cause**: The `frame` field is missing or not an object.

**Fix**: Ensure the DesignSpec includes a `frame` object with required properties.

**Error**: "Invalid DesignSpec: 'nodes' must be an array"

**Cause**: The `nodes` field is missing or not an array.

**Fix**: Ensure the DesignSpec includes a `nodes` array with at least one node.

### Execution errors

**Error**: "Execution failed: [message]"

**Cause**: An error occurred during node creation (e.g., font loading failure, invalid node type).

**Fix**: Check the console for detailed error information. Ensure all node types are supported (currently: `text`, `button`).

## Technical details

- **Font**: Uses Inter Regular (falls back if unavailable)
- **Button styling**: Blue background (#18a0fb), white text, 8px corner radius, 12px padding
- **Text styling**: 16px font size, default color
- **Frame layout**: Auto Layout with spacing and padding from spec

## Limitations

- Only supports `text` and `button` node types
- Does not handle nested frames or complex layouts
- No error recovery or partial execution
- Requires Figma Desktop (plugin API not available in browser)
