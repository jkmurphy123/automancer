# OpenClaw Tutor UI Playground

Milestone 1 app shell for the Tutor UI project.

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

## Milestone 1 Scope

The shell renders three desktop-style panels with static placeholder data:

- Agent Dock (module: `src/agents`)
- Challenge Board (module: `src/challenges`)
- Chat + Skills panel (module: `src/skills`)

UI composition and layout live in `src/ui/shell.ts`.

## Architecture Notes

- [Milestone architecture and extension points](docs/app-shell-architecture.md)
- [Runbook](docs/runbook.md)

## Hiring Docs

- [Founding engineer hiring process](docs/founding-engineer-hiring-process.md)
- [Founding engineer candidate evaluation template](docs/founding-engineer-candidate-evaluation-template.md)
