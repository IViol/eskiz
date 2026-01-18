import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Home } from "../app/routes/Home";

vi.mock("../lib/api", () => ({
  generateSpec: vi.fn(),
}));

vi.mock("../lib/clipboard", () => ({
  copySpecToClipboard: vi.fn(),
}));

vi.mock("../lib/download", () => ({
  downloadSpec: vi.fn(),
}));

import * as apiModule from "../lib/api";
import * as clipboardModule from "../lib/clipboard";
import * as downloadModule from "../lib/download";

const mockGenerateSpec = vi.mocked(apiModule.generateSpec);
const mockCopySpecToClipboard = vi.mocked(clipboardModule.copySpecToClipboard);
const mockDownloadSpec = vi.mocked(downloadModule.downloadSpec);

const renderHome = (width = 1024) => {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: 768,
  });
  return render(
    <BrowserRouter>
      <Home />
    </BrowserRouter>,
  );
};

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders", () => {
    renderHome();
    expect(screen.getByText("Generate DesignSpecs")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your design prompt/)).toBeInTheDocument();
  });

  it("allows entering a prompt", async () => {
    const user = userEvent.setup();
    renderHome();

    const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
    await user.type(textarea, "Create a login form");

    expect(textarea).toHaveValue("Create a login form");
  });

  it("triggers API call when generate button is clicked", async () => {
    const user = userEvent.setup();
    const mockSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };

    mockGenerateSpec.mockResolvedValue(mockSpec);
    renderHome();

    const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
    await user.type(textarea, "Create a login form");

    const generateButton = screen.getByRole("button", {
      name: /Generate Spec/i,
    });
    await user.click(generateButton);

    expect(mockGenerateSpec).toHaveBeenCalledWith(
      "Create a login form",
      expect.objectContaining({
        targetLayout: "mobile",
        uiStrictness: "strict",
        uxPatterns: expect.objectContaining({
          groupElements: true,
          formContainer: true,
          helperText: false,
        }),
      }),
    );
  });

  it("shows loading state while generating", async () => {
    const user = userEvent.setup();
    const mockSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };

    let resolvePromise: ((value: typeof mockSpec) => void) | undefined;
    const promise = new Promise<typeof mockSpec>((resolve) => {
      resolvePromise = resolve;
    });

    mockGenerateSpec.mockReturnValue(promise);
    renderHome();

    const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
    await user.type(textarea, "Test prompt");

    const generateButton = screen.getByRole("button", {
      name: /Generate Spec/i,
    });
    await user.click(generateButton);

    expect(screen.getByText(/Generating/i)).toBeInTheDocument();
    expect(generateButton).toBeDisabled();

    if (resolvePromise) resolvePromise(mockSpec);
    await waitFor(() => {
      expect(screen.queryByText(/Generating/i)).not.toBeInTheDocument();
    });
  });

  it("renders JSON result after generation", async () => {
    const user = userEvent.setup();
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

    mockGenerateSpec.mockResolvedValue(mockSpec);
    renderHome();

    const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
    await user.type(textarea, "Test prompt");

    const generateButton = screen.getByRole("button", {
      name: /Generate Spec/i,
    });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText("Generated DesignSpec")).toBeInTheDocument();
    });

    const jsonOutput = screen.getByText(/Test Page/);
    expect(jsonOutput).toBeInTheDocument();
  });

  it("calls copy utility when copy button is clicked", async () => {
    const user = userEvent.setup();
    const mockSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };

    mockGenerateSpec.mockResolvedValue(mockSpec);
    mockCopySpecToClipboard.mockResolvedValue(undefined);
    renderHome();

    const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
    await user.type(textarea, "Test prompt");

    const generateButton = screen.getByRole("button", {
      name: /Generate Spec/i,
    });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText("Generated DesignSpec")).toBeInTheDocument();
    });

    // Find the copy button by title to avoid collapsible trigger
    const copyButtons = screen.getAllByRole("button", { name: /Copy/i });
    const copyButton = copyButtons.find((btn) => btn.getAttribute("title") === "Copy to clipboard");
    expect(copyButton).toBeInTheDocument();
    if (copyButton) {
      await user.click(copyButton);
    }

    expect(mockCopySpecToClipboard).toHaveBeenCalledWith(mockSpec);
  });

  it("calls download utility when download button is clicked", async () => {
    const user = userEvent.setup();
    const mockSpec = {
      page: "Test",
      frame: {
        name: "Test Frame",
        width: 400,
        layout: "vertical" as const,
        gap: 16,
        padding: 24,
      },
      nodes: [{ type: "text" as const, content: "Test" }],
    };

    mockGenerateSpec.mockResolvedValue(mockSpec);
    renderHome();

    const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
    await user.type(textarea, "Test prompt");

    const generateButton = screen.getByRole("button", {
      name: /Generate Spec/i,
    });
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText("Generated DesignSpec")).toBeInTheDocument();
    });

    const downloadButtons = screen.getAllByRole("button", { name: /Download/i });
    const actualDownloadButton = downloadButtons.find(
      (btn) => btn.getAttribute("title") === "Download spec.json",
    );
    if (actualDownloadButton) {
      await user.click(actualDownloadButton);
    } else {
      const downloadButton = screen.getByRole("button", { name: /Download/i });
      await user.click(downloadButton);
    }

    expect(mockDownloadSpec).toHaveBeenCalledWith(mockSpec);
  });

  describe("mobile layout", () => {
    it("renders at mobile width without errors", () => {
      renderHome(360);
      expect(screen.getByText("Generate DesignSpecs")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your design prompt/)).toBeInTheDocument();
    });

    it("shows all key UI elements at mobile width", () => {
      renderHome(360);
      expect(screen.getByText("Generate DesignSpecs")).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your design prompt/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Generate Spec/i })).toBeInTheDocument();
    });

    it("allows interaction with form elements at mobile width", async () => {
      const user = userEvent.setup();
      renderHome(360);

      const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
      await user.type(textarea, "Mobile test");

      expect(textarea).toHaveValue("Mobile test");

      const generateButton = screen.getByRole("button", {
        name: /Generate Spec/i,
      });
      expect(generateButton).not.toBeDisabled();
    });

    it("renders generated spec at mobile width", async () => {
      const user = userEvent.setup();
      const mockSpec = {
        page: "Mobile Test",
        frame: {
          name: "Test Frame",
          width: 400,
          layout: "vertical" as const,
          gap: 16,
          padding: 24,
        },
        nodes: [{ type: "text" as const, content: "Test" }],
      };

      mockGenerateSpec.mockResolvedValue(mockSpec);
      renderHome(360);

      const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
      await user.type(textarea, "Test");

      const generateButton = screen.getByRole("button", {
        name: /Generate Spec/i,
      });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText("Generated DesignSpec")).toBeInTheDocument();
      });

      expect(screen.getByText(/Mobile Test/)).toBeInTheDocument();
    });

    it("shows error message when API call fails", async () => {
      const user = userEvent.setup();
      mockGenerateSpec.mockRejectedValue(new Error("API error occurred"));

      renderHome();

      const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
      await user.type(textarea, "Test prompt");

      const generateButton = screen.getByRole("button", {
        name: /Generate Spec/i,
      });
      await user.click(generateButton);

      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument();
        expect(screen.getByText(/API error occurred/i)).toBeInTheDocument();
      });
    });

    it("clears error when new generation succeeds", async () => {
      const user = userEvent.setup();
      const mockSpec = {
        page: "Test",
        frame: {
          name: "Test Frame",
          width: 400,
          layout: "vertical" as const,
          gap: 16,
          padding: 24,
        },
        nodes: [{ type: "text" as const, content: "Test" }],
      };

      mockGenerateSpec.mockRejectedValueOnce(new Error("First error"));
      mockGenerateSpec.mockResolvedValueOnce(mockSpec);

      renderHome();

      const textarea = screen.getByPlaceholderText(/Enter your design prompt/);
      await user.type(textarea, "Test");

      const generateButton = screen.getByRole("button", {
        name: /Generate Spec/i,
      });

      await user.click(generateButton);
      await waitFor(() => {
        expect(screen.getByText(/Error:/i)).toBeInTheDocument();
      });

      await user.click(generateButton);
      await waitFor(() => {
        expect(screen.queryByText(/Error:/i)).not.toBeInTheDocument();
        expect(screen.getByText("Generated DesignSpec")).toBeInTheDocument();
      });
    });
  });
});
