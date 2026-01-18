import type { DesignSpec } from "@eskiz/spec";
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, Copy, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { copySpecToClipboard } from "../lib/clipboard";
import { downloadSpec } from "../lib/download";
import "./SpecViewer.css";

interface SpecViewerProps {
  spec: DesignSpec;
  onCopy?: () => void;
  onDownload?: () => void;
}

export function SpecViewer({ spec, onCopy, onDownload }: SpecViewerProps) {
  const [open, setOpen] = useState(true);
  const prevSpecRef = useRef<DesignSpec | null>(null);

  // Expand when a new spec is generated
  useEffect(() => {
    if (prevSpecRef.current !== null && prevSpecRef.current !== spec) {
      setOpen(true);
    }
    prevSpecRef.current = spec;
  }, [spec]);

  const handleCopy = async () => {
    try {
      await copySpecToClipboard(spec);
      onCopy?.();
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleDownload = () => {
    downloadSpec(spec);
    onDownload?.();
  };

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="spec-viewer">
      <Collapsible.Trigger className="spec-viewer-header">
        <div className="spec-viewer-header-content">
          <h2>Generated DesignSpec</h2>
          <ChevronDown className={`spec-viewer-chevron ${open ? "open" : ""}`} size={20} />
        </div>
        <div
          className="spec-viewer-actions"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
            }
          }}
        >
          <button type="button" onClick={handleCopy} className="button" title="Copy to clipboard">
            <Copy />
            Copy
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="button"
            title="Download spec.json"
          >
            <Download />
            Download
          </button>
        </div>
      </Collapsible.Trigger>
      <Collapsible.Content className="spec-viewer-content-wrapper">
        <pre className="spec-viewer-content">{JSON.stringify(spec, null, 2)}</pre>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
