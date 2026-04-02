# OpenClaw Tutor UI Playground

Milestone 3 agent interaction layer for the Tutor UI project.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:4173` in a browser.

## Scripts

- `npm run dev`: start local shell server
- `npm run lint`: run ESLint
- `npm run test`: run unit tests once
- `npm run build`: compile TypeScript to `dist/`
- `npm run check`: lint + test + build

## Runtime Mode

Use `TUTOR_RUNTIME_MODE` to select runtime behavior.

- `mock` (default): deterministic local adapter responses
- `live`: reserved adapter mode, currently falls back to the deterministic mock adapter

Example:

```bash
TUTOR_RUNTIME_MODE=mock npm run dev
```

## Milestone 3 Scope

The app now supports a chat interaction layer on top of the Milestone 2 challenge engine:

- Chat message model (`user`, `agent`, `system`) with timestamped transcript state
- Agent preset abstraction (`Tutor`, `Researcher`, `Mechanic`) with per-preset response behavior
- Runtime adapter contract with deterministic mock adapter for local/test workflows
- Chat input flow with async loading and explicit runtime error handling
- Existing challenge board interactions preserved from Milestone 2

Milestone 2 challenge foundation remains in place:

- Challenge catalog loader with 8 seeded beginner challenges (Tier 1 and Tier 2)
- Challenge Board interactions for challenge selection, progressive hints, and response submission
- Deterministic completion validation (`exact`, `keyword`, and `json` checks)
- Post-completion lesson summary showing "What you learned" and suggested next mission

Key implementation paths:

- `src/challenges/types.ts`: challenge schema and validation rule types
- `src/challenges/seed-data.ts`: seeded challenge definitions
- `src/challenges/loader.ts`: challenge catalog construction/validation
- `src/challenges/validation.ts`: deterministic completion evaluation
- `src/agents/presets.ts`: preset abstraction model and metadata
- `src/runtime/adapter.ts`: runtime adapter interface
- `src/runtime/mock-adapter.ts`: deterministic mock runtime implementation
- `src/runtime/messages.ts`: chat message model utilities
- `src/ui/shell.ts`: challenge board rendering and browser-side interaction wiring

## Verification

Run all quality checks:

```bash
npm run check
```

## Architecture Notes

- [Milestone architecture and extension points](docs/app-shell-architecture.md)
- [Runbook](docs/runbook.md)

## Hiring Docs

- [Founding engineer hiring process](docs/founding-engineer-hiring-process.md)
- [Founding engineer candidate evaluation template](docs/founding-engineer-candidate-evaluation-template.md)
