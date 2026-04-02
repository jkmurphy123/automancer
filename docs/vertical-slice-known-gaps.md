# Vertical Slice Known Gaps

This list tracks intentional limits for the first `AUT-5` vertical slice.

- Tool execution is simulated with deterministic stubbed outputs instead of real adapters.
- Telemetry is in-memory only; no persistence, export, or dashboard wiring yet.
- The flow is CLI-only and has no browser UI.
- No authentication/authorization model is implemented for requesting or viewing runs.
- Replay/debug tooling (run history, diffing, event timelines) is not implemented yet.
