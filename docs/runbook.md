# Local Runbook

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
npm install
```

## Day-to-day commands

```bash
npm run dev
npm run test:watch
```

## Quality gate before pushing

```bash
npm run check
```

## CI expectations

CI executes the same quality gate:

```bash
npm ci
npm run check
```

Any failure in lint, tests, or TypeScript build blocks merge.
