# App Shell Architecture (Milestone 1)

Milestone 1 delivers a static, modular shell that is intentionally shaped for feature wiring in Milestones 2-4.

## Current module map

- `src/index.ts`
  - Starts the local HTTP server and renders one composed shell page.
- `src/ui/shell.ts`
  - Owns page structure, panel composition, and responsive CSS.
- `src/agents/sample-data.ts`
  - Placeholder data for Agent Dock.
- `src/challenges/sample-data.ts`
  - Placeholder data for active challenge board.
- `src/skills/sample-data.ts`
  - Placeholder chat thread and skill control toggles.

## Extension points for Milestone 2

- Replace static fixture imports with adapter-backed selectors.
- Add challenge progression actions in the center panel (step transitions, event timeline).
- Introduce panel-level state update hooks while preserving the same `AppShellState` shape.

## Extension points for Milestone 3

- Swap local in-memory state for API-backed fetch and mutation handlers.
- Add live chat stream updates and skill execution status in the right panel.
- Add optimistic update and error states for each panel module.

## Milestone 4 implementation notes

- Skill controls are now rendered from normalized metadata (`src/skills/sample-data.ts`) instead of fixed toggles.
- Challenge changes emit browser events so skill relevance hints update with active challenge context.
- Skill execution writes to both chat transcript and a dedicated activity feed in the right rail.

## Extension points after Milestone 4

- Replace sample registry input with installed skill ingestion from runtime adapters.
- Persist skill execution history and challenge/agent preferences across sessions.
- Add telemetry spans and role-aware feature flags to skill availability and execution.
