# OpenClaw Tutor UI Playground

Milestone 7 runtime integration refinement layered on top of tutor guidance, skill registry, challenge validation, and runtime chat flows.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:4173` in a browser.

To persist local runtime settings across launches, copy `.env.example` to `.env.local` and fill in your OpenClaw values. The server automatically loads `.env` first and `.env.local` second on startup.

For OpenClaw native gateway mode, set `TUTOR_RUNTIME_LIVE_ORIGIN` to the tutor app origin and add the same value to OpenClaw `gateway.controlUi.allowedOrigins`.

## Scripts

- `npm run dev`: start local shell server
- `npm run lint`: run ESLint
- `npm run test`: run unit tests once
- `npm run build`: compile TypeScript to `dist/`
- `npm run check`: lint + test + build

## Runtime Mode

Use `TUTOR_RUNTIME_MODE` to select runtime behavior.

- `mock` (default): deterministic local adapter responses
- `live`: runtime bridge mode that routes chat/skill calls through server APIs with observability events

Example:

```bash
TUTOR_RUNTIME_MODE=mock npm run dev
```

Set `debug_mode` to control debug-only UI behavior (default `false`):

- `false`: hides Runtime Observability and suppresses `system` chat responses
- `true`: shows Runtime Observability and full `user` / `agent` / `system` transcript

Live mode bridge controls:

- `TUTOR_RUNTIME_LIVE_ENDPOINT`: HTTP endpoint for live runtime message execution (POST JSON).
- `TUTOR_RUNTIME_LIVE_ORIGIN`: origin to present to the OpenClaw native gateway when using a `ws://` or `wss://` endpoint.
- `TUTOR_RUNTIME_LIVE_TIMEOUT_MS`: per-attempt timeout in milliseconds (default `1500`).
- `TUTOR_RUNTIME_LIVE_MAX_ATTEMPTS`: number of live bridge attempts before fallback (default `2`).
- `TUTOR_RUNTIME_LIVE_RETRY_DELAY_MS`: delay between retries in milliseconds (default `150`).

Rollback path for live mode:

- Set `TUTOR_RUNTIME_MODE=mock` to force deterministic local behavior.
- Or unset `TUTOR_RUNTIME_LIVE_ENDPOINT` while keeping `TUTOR_RUNTIME_MODE=live`; live mode will degrade to deterministic fallback with system notes and runtime events preserved.

## Milestone 7 Scope

The app now includes a runtime session bridge and observability wiring:

- Session bridge endpoints for chat requests and skill execution (`/api/runtime/sessions/*`)
- Installed skill detection via environment (`OPENCLAW_INSTALLED_SKILLS`) or local skills directory scan
- Tool execution feedback surfaced with request IDs and runtime durations in skill activity UI
- Runtime event feed panel with refreshable observability timeline

Milestone 5 tutor guidance behavior remains active:

The app now supports contextual tutor guidance layered on top of Milestone 4 skill and Milestone 3 runtime behavior:

- Concept hints tied to each challenge definition (`concepts` metadata)
- Relevant skill suggestions mapped from challenge requirements plus relevance rules
- Post-failure guidance that explains next step and points back to deterministic hints
- Challenge-to-lesson mapping surfaced directly in the challenge panel
- End-to-end flow from challenge selection -> hint reveal -> failed submission guidance -> success lesson

Milestone 4 functionality remains active:

- Normalized skill schema with stable fields for id/name/display name/description/category/parameters/examples/risk/installed/enabled
- Skill registry adapter that converts raw/sample skill definitions into the normalized schema
- Dynamic skill control rendering with metadata-driven form fields (`text`, `textarea`, `select`, `boolean`)
- Sample end-to-end skill execution flow that writes updates to both chat transcript and skill activity feed
- Challenge-context relevance hints that react to active challenge changes

Milestone 3 interaction behavior remains active:

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
- `src/runtime/live-adapter.ts`: runtime bridge-aware live adapter behavior
- `src/runtime/mock-adapter.ts`: deterministic mock runtime implementation
- `src/runtime/messages.ts`: chat message model utilities
- `src/runtime/session-bridge.ts`: in-memory session bridge, tool execution, and runtime event logging
- `src/runtime/skill-inventory.ts`: installed skill detection and normalization for runtime UI state
- `src/skills/sample-data.ts`: normalized skill schema, registry adapter, and relevance rules
- `src/tutor/guidance.ts`: challenge lesson map and tutor guidance catalog helpers
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
