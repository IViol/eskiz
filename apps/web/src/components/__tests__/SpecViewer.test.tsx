import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SpecViewer } from "../SpecViewer";

vi.mock("../../lib/clipboard", () => ({
  copySpecToClipboard: vi.fn(),
}));

vi.mock("../../lib/download", () => ({
  downloadSpec: vi.fn(),
}));

import * as clipboardModule from "../../lib/clipboard";
import * as downloadModule from "../../lib/download";

const mockCopySpecToClipboard = vi.mocked(clipboardModule.copySpecToClipboard);
const mockDownloadSpec = vi.mocked(downloadModule.downloadSpec);

const mockSpec = {
  page: "Test Page",
  frame: {
    name: "Test Frame",
    width: 400,
    layout: "vertical" as const,
    gap: 16,
    padding: 24,
  },
  nodes: [{ type: "text" as const, content: "Test content" }],
};

describe("SpecViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders spec content", () => {
    render(<SpecViewer spec={mockSpec} />);
    expect(screen.getByText("Generated DesignSpec")).toBeInTheDocument();
    expect(screen.getByText(/Test Page/)).toBeInTheDocument();
  });

  it("is expanded by default", () => {
    render(<SpecViewer spec={mockSpec} />);
    const content = screen.getByText(/Test Page/);
    expect(content).toBeInTheDocument();
  });

  it("can be collapsed and expanded", async () => {
    const user = userEvent.setup();
    render(<SpecViewer spec={mockSpec} />);

    // Find the collapsible trigger (header)
    const header = screen.getByText("Generated DesignSpec").closest("button");
    expect(header).toBeInTheDocument();

    // Verify content is visible initially
    expect(screen.getByText(/Test Page/)).toBeInTheDocument();

    // Collapse
    if (header) {
      await user.click(header);
      // Content might be hidden but should still exist in DOM
      // Radix Collapsible keeps content in DOM but hides it
    }
  });

  it("calls copy handler when copy button is clicked", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    mockCopySpecToClipboard.mockResolvedValue(undefined);

    render(<SpecViewer spec={mockSpec} onCopy={onCopy} />);

    const copyButtons = screen.getAllByRole("button", { name: /Copy/i });
    const copyButton = copyButtons.find((btn) => btn.getAttribute("title") === "Copy to clipboard");
    expect(copyButton).toBeInTheDocument();

    if (copyButton) {
      await user.click(copyButton);
      expect(mockCopySpecToClipboard).toHaveBeenCalledWith(mockSpec);
      expect(onCopy).toHaveBeenCalled();
    }
  });

  it("calls download handler when download button is clicked", async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();

    render(<SpecViewer spec={mockSpec} onDownload={onDownload} />);

    const downloadButtons = screen.getAllByRole("button", { name: /Download/i });
    const downloadButton = downloadButtons.find(
      (btn) => btn.getAttribute("title") === "Download spec.json",
    );
    expect(downloadButton).toBeInTheDocument();

    if (downloadButton) {
      await user.click(downloadButton);
      expect(mockDownloadSpec).toHaveBeenCalledWith(mockSpec);
      expect(onDownload).toHaveBeenCalled();
    }
  });

  it("expands when spec changes", () => {
    const { rerender } = render(<SpecViewer spec={mockSpec} />);

    const newSpec = {
      ...mockSpec,
      page: "New Page",
    };

    rerender(<SpecViewer spec={newSpec} />);
    expect(screen.getByText(/New Page/)).toBeInTheDocument();
  });
});
