import type { DesignSpec, GenerationContext } from "@eskiz/spec";
import { useState } from "react";
import { PromptForm } from "../../components/PromptForm";
import { SpecViewer } from "../../components/SpecViewer";
import { generateSpec } from "../../lib/api";
import "./Home.css";

export function Home() {
  const [loading, setLoading] = useState(false);
  const [spec, setSpec] = useState<DesignSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleGenerate = async (prompt: string, generationContext: GenerationContext) => {
    setLoading(true);
    setError(null);
    setSpec(null);
    setCopySuccess(false);

    try {
      const result = await generateSpec(prompt, generationContext);
      setSpec(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="home">
      <div className="home-container">
        <div className="home-header">
          <h1>Generate DesignSpecs</h1>
          <p className="home-description">
            Enter a design prompt to generate a structured DesignSpec JSON for use with the Figma
            plugin.
          </p>
        </div>

        <PromptForm onSubmit={handleGenerate} loading={loading} />

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {copySuccess && <div className="success-message">Copied to clipboard</div>}

        {spec && <SpecViewer spec={spec} onCopy={handleCopy} />}
      </div>
    </div>
  );
}
