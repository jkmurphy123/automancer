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

## Extension points for Milestone 4

- Add user/session-aware data partitioning and persisted preferences.
- Add telemetry spans for panel render latency and interaction success/failure.
- Add role-aware feature flags per panel (agent vs coach vs reviewer views).
