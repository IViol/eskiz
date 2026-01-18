# Contributing to Eskiz

Thank you for your interest in contributing to Eskiz. This document outlines how to contribute effectively.

## Project Overview

Eskiz is a monorepo for generating and executing structured DesignSpecs from text prompts. It consists of:
- **API**: Express backend that generates DesignSpecs using OpenAI
- **Web UI**: React frontend for prompt → spec generation
- **Figma Plugin**: Executes DesignSpecs in Figma

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- OpenAI API key (for API development)

### Local Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/IViol/eskiz.git
   cd eskiz
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (see `.env.example`):
   ```bash
   OPENAI_API_KEY=your_key_here
   PORT=3000
   LOG_LEVEL=info
   ```

### Running Locally

**Development mode (all apps):**
```bash
npm run dev
```

**Individual workspaces:**
```bash
npm run dev --workspace=apps/api
npm run dev --workspace=apps/web
```

### Running Tests

**All tests:**
```bash
npm test
npm run test:e2e
```

**Individual workspaces:**
```bash
npm test --workspace=apps/api
npm test --workspace=apps/web
npm test --workspace=packages/spec
```

**Lint and format:**
```bash
npm run lint
npm run format
```

## Pull Request Requirements

Before submitting a PR, ensure:

1. **Lint passes**: `npm run lint` must pass without errors
2. **Tests pass**: All unit tests (`npm test`) and E2E tests (`npm run test:e2e`) must pass
3. **CI is green**: GitHub Actions must pass (lint, tests, build)
4. **Code is formatted**: Run `npm run format` before committing

### PR Process

1. Create a feature branch from `main`
2. Make your changes
3. Run lint, tests, and format
4. Commit with clear, descriptive messages
5. Push and create a PR
6. Ensure CI passes
7. Address review feedback

## Scope

### In Scope

- Bug fixes and improvements to existing functionality
- Performance optimizations
- Test coverage improvements
- Documentation updates
- DesignSpec format enhancements (with discussion)
- UI/UX improvements (keep minimal and engineering-focused)

### Out of Scope

- Major architectural changes without prior discussion
- Adding new dependencies without justification
- Marketing or promotional content
- Breaking changes to the DesignSpec format (v0) without migration path
- Features that require external services beyond OpenAI

## Code Style

- TypeScript strict mode
- Biome for formatting and linting
- Mobile-first CSS approach
- Minimal, readable code over cleverness
- Explicit over implicit

## Collaboration

- Be respectful and constructive in discussions
- Focus on technical merit
- Provide context for changes
- Ask questions if something is unclear
- Keep PRs focused and reasonably sized

Thank you for contributing to Eskiz.
