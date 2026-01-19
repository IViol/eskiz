import type { GenerationContext } from "@eskiz/spec";
import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import "./PromptForm.css";

interface PromptFormProps {
  onSubmit: (prompt: string, generationContext: GenerationContext) => void;
  loading: boolean;
}

const DEFAULT_GENERATION_CONTEXT: GenerationContext = {
  targetLayout: "mobile",
  uiStrictness: "strict",
  uxPatterns: {
    groupElements: true,
    formContainer: true,
    helperText: false,
  },
  visualBaseline: true,
  strictLayout: false,
};

export function PromptForm({ onSubmit, loading }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generationContext, setGenerationContext] = useState<GenerationContext>(
    DEFAULT_GENERATION_CONTEXT,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !loading) {
      onSubmit(prompt.trim(), generationContext);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="prompt-form">
      <label htmlFor="prompt" className="prompt-label">
        Design Prompt
      </label>
      <textarea
        id="prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your design prompt... (e.g., 'Create a login form with email field and submit button')"
        rows={4}
        disabled={loading}
        className="prompt-textarea"
      />

      <div className="advanced-settings">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="advanced-toggle"
          disabled={loading}
        >
          Advanced settings
          {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showAdvanced && (
          <div className="advanced-content">
            <div className="advanced-field">
              <label htmlFor="targetLayout" className="advanced-label">
                Target layout
              </label>
              <select
                id="targetLayout"
                value={generationContext.targetLayout}
                onChange={(e) =>
                  setGenerationContext({
                    ...generationContext,
                    targetLayout: e.target.value as GenerationContext["targetLayout"],
                  })
                }
                disabled={loading}
                className="advanced-select"
              >
                <option value="mobile">Mobile-first</option>
                <option value="tablet">Tablet</option>
                <option value="desktop">Desktop</option>
              </select>
            </div>

            <div className="advanced-field">
              <label htmlFor="uiStrictness" className="advanced-label">
                UI strictness
              </label>
              <select
                id="uiStrictness"
                value={generationContext.uiStrictness}
                onChange={(e) =>
                  setGenerationContext({
                    ...generationContext,
                    uiStrictness: e.target.value as GenerationContext["uiStrictness"],
                  })
                }
                disabled={loading}
                className="advanced-select"
              >
                <option value="strict">Strict</option>
                <option value="balanced">Balanced</option>
              </select>
            </div>

            <div className="advanced-field">
              <div className="advanced-label">UX patterns</div>
              <div className="advanced-checkboxes">
                <label className="advanced-checkbox-label">
                  <input
                    type="checkbox"
                    checked={generationContext.uxPatterns.groupElements}
                    onChange={(e) =>
                      setGenerationContext({
                        ...generationContext,
                        uxPatterns: {
                          ...generationContext.uxPatterns,
                          groupElements: e.target.checked,
                        },
                      })
                    }
                    disabled={loading}
                    className="advanced-checkbox"
                  />
                  Group related elements
                </label>
                <label className="advanced-checkbox-label">
                  <input
                    type="checkbox"
                    checked={generationContext.uxPatterns.formContainer}
                    onChange={(e) =>
                      setGenerationContext({
                        ...generationContext,
                        uxPatterns: {
                          ...generationContext.uxPatterns,
                          formContainer: e.target.checked,
                        },
                      })
                    }
                    disabled={loading}
                    className="advanced-checkbox"
                  />
                  Use form container
                </label>
                <label className="advanced-checkbox-label">
                  <input
                    type="checkbox"
                    checked={generationContext.uxPatterns.helperText}
                    onChange={(e) =>
                      setGenerationContext({
                        ...generationContext,
                        uxPatterns: {
                          ...generationContext.uxPatterns,
                          helperText: e.target.checked,
                        },
                      })
                    }
                    disabled={loading}
                    className="advanced-checkbox"
                  />
                  Add helper / hint text
                </label>
              </div>
            </div>

            <div className="advanced-field">
              <label className="advanced-checkbox-label">
                <input
                  type="checkbox"
                  checked={generationContext.visualBaseline ?? true}
                  onChange={(e) =>
                    setGenerationContext({
                      ...generationContext,
                      visualBaseline: e.target.checked,
                    })
                  }
                  disabled={loading}
                  className="advanced-checkbox"
                />
                Apply visual baseline defaults
              </label>
            </div>

            <div className="advanced-field">
              <label className="advanced-checkbox-label">
                <input
                  type="checkbox"
                  checked={generationContext.strictLayout ?? false}
                  onChange={(e) =>
                    setGenerationContext({
                      ...generationContext,
                      strictLayout: e.target.checked,
                    })
                  }
                  disabled={loading}
                  className="advanced-checkbox"
                />
                Strict layout mode
              </label>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!prompt.trim() || loading}
        className="button primary generate-button"
      >
        {loading ? (
          <>
            <Loader2 className="icon-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles />
            Generate Spec
          </>
        )}
      </button>
    </form>
  );
}
