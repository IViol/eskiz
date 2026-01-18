# Eskiz

A monorepo for generating and executing structured DesignSpecs from text prompts. The system consists of three main components: an API server, a web UI, and a Figma plugin.

## Monorepo Structure

```
eskiz/
├── apps/
│   ├── api/          # Express backend for DesignSpec generation
│   ├── web/           # React UI for prompt → spec generation
│   └── figma-plugin/ # Figma plugin for executing DesignSpecs
├── packages/
│   └── spec/          # Shared DesignSpec contract (types + validation)
└── [root config files]
```

### Workspaces

- **`apps/api`**: Express server that accepts text prompts and generates DesignSpecs using OpenAI
- **`apps/web`**: React + Vite frontend for interacting with the API
- **`apps/figma-plugin`**: Figma plugin that consumes DesignSpecs and creates frames/nodes
- **`packages/spec`**: Shared TypeScript types and Zod schemas for DesignSpec validation

## Why a Figma Plugin is Required

The Figma REST API has significant limitations:
- **Cannot create frames programmatically**: The REST API is read-only for most design elements
- **No frame creation endpoints**: You cannot create frames, nodes, or layouts via REST
- **Plugin API is required**: Only the Figma Plugin API can create and manipulate design elements

Therefore, Eskiz generates a structured `DesignSpec` that a Figma plugin consumes to create frames, nodes, and layouts within Figma's plugin runtime.

## Flow: Prompt → Spec → Figma

1. **User enters prompt** (via web UI or API)
2. **API generates DesignSpec** using OpenAI
3. **DesignSpec is validated** with Zod
4. **User downloads/copies spec** (JSON)
5. **Figma plugin reads spec** and creates frames/nodes

```
┌─────────┐      ┌─────────┐      ┌──────────────┐
│  Prompt │ ───> │   API   │ ───> │ DesignSpec   │
└─────────┘      └─────────┘      └──────────────┘
                                              │
                                              v
                                    ┌─────────────────┐
                                    │  Figma Plugin   │
                                    │  (creates UI)   │
                                    └─────────────────┘
```

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- OpenAI API key (for API)
- Figma Desktop (for plugin development)

### Installation

```bash
npm install
```

This installs dependencies for all workspaces using npm workspaces.

### Configuration

Create a `.env` file in the root (see `.env.example`):

```bash
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
LOG_LEVEL=info
```

### Development

**Option 1: Local development (without Docker)**

Run all apps in development mode:
```bash
npm run dev
```

Run individual workspaces:
```bash
# API only
npm run dev --workspace=apps/api

# Web only
npm run dev --workspace=apps/web
```

**Option 2: Local development with Docker Compose**

1. Create `.env` file from example:
```bash
cp .env.example .env
```

2. Edit `.env` and set your `OPENAI_API_KEY`

3. Start services:
```bash
npm run dev:docker
```

Or manually:
```bash
docker-compose -f docker-compose.dev.yml up
```

4. Access the application:
- Web UI: http://localhost:3000
- API: http://localhost:4000

The Docker Compose development setup:
- Runs API on port 4000 (accessible as `http://api:4000` inside Docker network)
- Runs Web UI on port 3000 (accessible at http://localhost:3000)
- Supports hot reload via volume mounts
- Proxies `/api` requests from Web UI to API service

To stop services:
```bash
npm run dev:docker:down
```

Or manually:
```bash
docker-compose -f docker-compose.dev.yml down
```

To rebuild containers (e.g., after adding new dependencies):
```bash
npm run dev:docker:build
```

For a clean rebuild without cache:
```bash
npm run dev:docker:rebuild
```

**Build all workspaces:**
```bash
npm run build
```

**Run tests:**
```bash
npm test
```

**Lint and format:**
```bash
npm run lint
npm run format
```

## Using the Figma Plugin

The Figma plugin executes DesignSpecs by creating pages, frames, and nodes in Figma. It runs locally in development mode and does not require publishing or OAuth setup.

### Steps

1. Generate a DesignSpec via the web UI at http://localhost:3000
2. Copy the resulting JSON from the spec viewer
3. Open a Figma file in Figma Desktop
4. Go to: Menu → Plugins → Development → Import plugin from manifest
5. Select: `apps/figma-plugin/manifest.json`
6. Run the plugin via: Menu → Plugins → Development → eskiz executor
7. Paste the JSON into the plugin UI and click Apply
8. The generated design appears in Figma as a new page with frames and nodes

### Important: Figma Design Mode vs Dev Mode

The eskiz plugin creates and modifies design nodes (pages, frames, text, buttons). This functionality is only available when the Figma file is opened in **Design mode**.

**Dev Mode behavior:**

If Figma is in **Dev Mode**, the plugin will operate in **read-only mode**. In Dev Mode, plugins cannot create, update, or delete pages, frames, or layers. This is a Figma platform restriction, not a bug in eskiz. The plugin will detect read-only mode and display an error message if executed in Dev Mode.

**How to fix read-only behavior:**

1. Switch from Dev Mode to Design mode using the mode toggle in Figma's top toolbar
2. Ensure the file is editable (not view-only). Check file permissions in the file's share settings
3. If the file is a Community file or template, duplicate it to your drafts to make it editable

**Manifest configuration:**

The plugin manifest includes both Design and Dev Mode support (`"editorType": ["figma", "dev"]`) to allow import through Development menu. However, writing to the document (creating pages, frames, nodes) only occurs when executed in Design mode.

**Troubleshooting checklist:**

- Plugin does nothing → Check that you are in Design mode, not Dev Mode
- Plugin is read-only → You are likely in Dev Mode; switch to Design mode
- No changes appear → Check file permissions; ensure the file is editable, not view-only

### Notes

- Plugin runs locally in development mode
- No publishing or OAuth required
- Plugin always creates a new page (v0 behavior)
- Ensure the plugin is built before use: `cd apps/figma-plugin && npm run build`

## Apps

### apps/api

Express server that generates DesignSpecs from text prompts.

**Endpoints:**
- `POST /spec` - Generate a DesignSpec from a prompt
- `GET /health` - Health check

**Query Parameters:**
- `?dryRun=true` - Returns a mock DesignSpec without calling OpenAI

**Example:**
```bash
curl -X POST http://localhost:3000/spec \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Create a login form"}'
```

### apps/web

React + Vite frontend for generating DesignSpecs.

**Features:**
- Textarea for prompt input
- "Generate spec" button
- JSON result display
- Download spec.json button

**Development:**
```bash
cd apps/web
npm run dev
```

Access at `http://localhost:5173`. The Vite dev server proxies `/api/*` requests to the API server.

### apps/figma-plugin

Figma plugin for executing DesignSpecs.

**Status:** Minimal structure (execution logic coming soon)

**Development:**
1. Build the plugin:
   ```bash
   cd apps/figma-plugin
   npm run build
   ```

2. In Figma Desktop:
   - Plugins → Development → Import plugin from manifest
   - Select `apps/figma-plugin/manifest.json`

## Docker

### Development (Docker Compose)

See the [Development](#development) section above for Docker Compose setup with hot reload using `docker-compose.dev.yml`.

### Production

**Run API only:**
```bash
docker-compose up api
```

**Run API + Web:**
```bash
docker-compose up
```

Note: Production Docker setup (`docker-compose.yml`) uses optimized multi-stage builds. For local development with hot reload, use `docker-compose.dev.yml` as described in the Development section.

## DesignSpec Format (v0)

The DesignSpec is a JSON object with the following structure:

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
    | { type: "text"; content: string; fontSize?: number }
    | { type: "button"; label: string }
    | {
        type: "container";
        layout: "vertical" | "horizontal";
        gap: number;
        padding: number;
        children: Node[];
      }
  >;
}
```

**Example:**
```json
{
  "page": "Login",
  "frame": {
    "name": "Login Form",
    "width": 400,
    "layout": "vertical",
    "gap": 16,
    "padding": 24
  },
  "nodes": [
    { "type": "text", "content": "Login", "fontSize": 20 },
    {
      "type": "container",
      "layout": "vertical",
      "gap": 12,
      "padding": 16,
      "children": [
        { "type": "text", "content": "Email", "fontSize": 14 },
        { "type": "text", "content": "Password", "fontSize": 14 }
      ]
    },
    { "type": "button", "label": "Submit" }
  ]
}
```

## Limitations (v0)

1. **Node Types**: Currently supports `text`, `button`, and `container` nodes. Input fields, images, and other node types will be added in future versions.

2. **Layout Complexity**: Only supports simple vertical and horizontal layouts. Nested frames and complex layouts are not yet supported.

3. **Determinism**: While we use a low temperature (0.3) for consistency, OpenAI responses may still vary slightly between requests.

4. **Figma Plugin**: The plugin currently only receives and logs DesignSpecs. Frame/node creation logic will be implemented in a future version.

5. **Validation**: Invalid AI responses are rejected, but the service does not retry or attempt to fix malformed output.

## CI/CD

GitHub Actions runs on every push and PR:
1. Installs dependencies (all workspaces)
2. Runs Biome checks
3. Runs tests (all workspaces)
4. Builds all workspaces

## Tech Stack

- **Monorepo**: npm workspaces (no framework lock-in)
- **API**: Express, OpenAI, Zod, Pino
- **Web**: React, Vite, Radix UI
- **Plugin**: Figma Plugin API, TypeScript
- **Shared**: TypeScript, Zod, Vitest
- **Tooling**: Biome (lint/format), Vitest (testing)

## License

MIT License. See [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.
