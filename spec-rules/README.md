# Spec Rules

This directory contains rule definitions that drive DesignSpec generation behavior.

## Structure

- **base.json**: General generation principles that ALWAYS apply
- **layout.json**: Layout intent rules (e.g. form rhythm, centering)
- **visual-baseline.json**: Default visual rules used when user does not specify styles
- **devices.json**: Screen geometry defaults for mobile / tablet / desktop
- **patterns/**: Pattern-specific rules (e.g. auth-form.json for authentication/form screens)

## Rule Format

Rules are stored as JSON files with:
- `name`: Identifier for the rule set
- `description`: Human-readable description
- `rules`: Array of rule strings that will be included in the system prompt

Some rule files may have additional structure:
- `devices.json` has device-specific sections (mobile, tablet, desktop)
- `layout.json` has `strictRules` and `balancedRules` for different strictness levels
- `patterns/*.json` may have `detectionKeywords` for pattern detection

## How Rules Are Applied

1. **Base rules** are always loaded
2. **Device rules** are selected based on `targetLayout` setting
3. **Pattern rules** are applied when the user prompt matches pattern keywords
4. **Visual baseline rules** are included when `visualBaseline` setting is enabled
5. **Layout rules** are selected based on `uiStrictness` setting (strict vs balanced)

The prompt assembly layer (`apps/api/src/spec/prompt/`) reads these rules and combines them into a single system prompt for the LLM.

## Modifying Rules

To modify generation behavior:
1. Edit the relevant JSON file in this directory
2. Rules are applied immediately (no code changes needed)
3. Keep rules human-readable and explicit
4. Do NOT invent a DSL - use plain text rule descriptions
