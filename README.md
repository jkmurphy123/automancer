# OpenClaw Tutor UI Playground

Milestone 2 challenge engine for the Tutor UI project.

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

## Milestone 2 Scope

The app now supports a data-driven challenge flow:

- Challenge catalog loader with 8 seeded beginner challenges (Tier 1 and Tier 2)
- Challenge Board interactions for challenge selection, progressive hints, and response submission
- Deterministic completion validation (`exact`, `keyword`, and `json` checks)
- Post-completion lesson summary showing "What you learned" and suggested next mission

Challenge content and logic live in:

- `src/challenges/types.ts`: challenge schema and validation rule types
- `src/challenges/seed-data.ts`: seeded challenge definitions
- `src/challenges/loader.ts`: challenge catalog construction/validation
- `src/challenges/validation.ts`: deterministic completion evaluation
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
