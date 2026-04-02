import type { DockAgent } from '../agents/sample-data.js';
import type { ActiveChallenge } from '../challenges/sample-data.js';
import type { ChatAndSkills } from '../skills/sample-data.js';
import { escapeHtml } from './escape.js';

export interface AppShellState {
  agents: DockAgent[];
  challenge: ActiveChallenge;
  chatAndSkills: ChatAndSkills;
}

const statusTone: Record<DockAgent['status'], string> = {
  ready: 'tone-ready',
  working: 'tone-working',
  blocked: 'tone-blocked',
};

const stepTone: Record<ActiveChallenge['steps'][number]['state'], string> = {
  done: 'tone-ready',
  active: 'tone-working',
  queued: 'tone-neutral',
};

function renderAgentDock(agents: DockAgent[]): string {
  const cards = agents
    .map(
      (agent) => `
      <article class="card dock-card">
        <header class="row-between">
          <h3>${escapeHtml(agent.name)}</h3>
          <span class="badge ${statusTone[agent.status]}">${escapeHtml(agent.status)}</span>
        </header>
        <p class="muted">${escapeHtml(agent.specialty)}</p>
        <p class="meta">Queue depth: ${agent.queueDepth}</p>
      </article>
    `,
    )
    .join('');

  return `
    <section class="panel panel-dock" data-module="agents">
      <header class="panel-header">
        <h2>Agent Dock</h2>
        <p>Static fixtures from <code>agents/sample-data.ts</code></p>
      </header>
      <div class="stack">${cards}</div>
    </section>
  `;
}

function renderChallengeBoard(challenge: ActiveChallenge): string {
  const steps = challenge.steps
    .map(
      (step) => `
      <li class="card step-row">
        <span class="badge ${stepTone[step.state]}">${escapeHtml(step.state)}</span>
        <div>
          <p class="step-label">${escapeHtml(step.label)}</p>
          <p class="muted">Owner: ${escapeHtml(step.owner)}</p>
        </div>
      </li>
    `,
    )
    .join('');

  return `
    <section class="panel panel-board" data-module="challenges">
      <header class="panel-header">
        <p class="eyebrow">${escapeHtml(challenge.id)}</p>
        <h2>${escapeHtml(challenge.title)}</h2>
        <p>${escapeHtml(challenge.summary)}</p>
      </header>
      <div class="meta-grid">
        <div>
          <p class="meta-label">Due by</p>
          <p class="meta-value">${escapeHtml(challenge.dueBy)}</p>
        </div>
        <div>
          <p class="meta-label">Confidence</p>
          <p class="meta-value">${escapeHtml(challenge.confidence)}</p>
        </div>
      </div>
      <ol class="stack">${steps}</ol>
    </section>
  `;
}

function renderChatAndSkills(chatAndSkills: ChatAndSkills): string {
  const messages = chatAndSkills.messages
    .map(
      (message) => `
      <li class="card message">
        <p class="row-between">
          <span class="badge tone-neutral">${escapeHtml(message.author)}</span>
          <span class="meta">${escapeHtml(message.at)}</span>
        </p>
        <p>${escapeHtml(message.body)}</p>
      </li>
    `,
    )
    .join('');

  const controls = chatAndSkills.controls
    .map(
      (control) => `
      <li class="card control-row">
        <div>
          <p class="step-label">${escapeHtml(control.name)}</p>
          <p class="muted">${escapeHtml(control.description)}</p>
        </div>
        <span class="badge ${control.enabled ? 'tone-ready' : 'tone-blocked'}">${control.enabled ? 'enabled' : 'disabled'}</span>
      </li>
    `,
    )
    .join('');

  return `
    <section class="panel panel-chat" data-module="skills">
      <header class="panel-header">
        <h2>Chat + Skills</h2>
        <p>${escapeHtml(chatAndSkills.threadTitle)}</p>
      </header>
      <h3>Conversation</h3>
      <ul class="stack">${messages}</ul>
      <h3>Skill Controls</h3>
      <ul class="stack">${controls}</ul>
    </section>
  `;
}

function renderStyle(): string {
  return `
    :root {
      color-scheme: light;
      --bg: linear-gradient(130deg, #f7efe5 0%, #f8f5ea 55%, #e9f2ff 100%);
      --text: #1e222b;
      --muted: #59657a;
      --panel: rgba(255, 255, 255, 0.85);
      --panel-border: rgba(30, 34, 43, 0.1);
      --shadow: 0 20px 45px rgba(0, 0, 0, 0.08);
      --ready: #0f8f6f;
      --working: #b46900;
      --blocked: #ad2f45;
      --neutral: #3e4f6a;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 1.25rem;
    }

    .app {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(14rem, 0.95fr) minmax(20rem, 1.5fr) minmax(16rem, 1fr);
      align-items: start;
      max-width: 1400px;
      margin: 0 auto;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      padding: 1rem;
      box-shadow: var(--shadow);
      backdrop-filter: blur(4px);
    }

    .panel-header h2 {
      margin: 0;
      font-size: 1.1rem;
    }

    .panel-header p {
      margin: 0.35rem 0 0;
      color: var(--muted);
      font-size: 0.9rem;
    }

    .eyebrow {
      margin: 0;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 0.76rem;
      color: var(--muted);
    }

    .stack {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.65rem;
    }

    .card {
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.9);
    }

    .row-between {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      align-items: center;
      margin: 0;
    }

    .badge {
      display: inline-flex;
      border-radius: 999px;
      padding: 0.2rem 0.55rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border: 1px solid currentColor;
      font-weight: 600;
    }

    .tone-ready {
      color: var(--ready);
    }

    .tone-working {
      color: var(--working);
    }

    .tone-blocked {
      color: var(--blocked);
    }

    .tone-neutral {
      color: var(--neutral);
    }

    .muted,
    .meta {
      color: var(--muted);
      margin: 0.3rem 0 0;
      font-size: 0.86rem;
    }

    .step-label {
      margin: 0;
      font-weight: 600;
    }

    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      margin: 0.75rem 0;
      gap: 0.7rem;
    }

    .meta-label {
      margin: 0;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .meta-value {
      margin: 0.2rem 0 0;
      font-weight: 600;
    }

    h3 {
      margin: 0.85rem 0 0.5rem;
      font-size: 0.95rem;
    }

    .message p {
      margin-top: 0.45rem;
      margin-bottom: 0;
    }

    .control-row {
      display: flex;
      justify-content: space-between;
      gap: 0.6rem;
      align-items: flex-start;
    }

    @media (max-width: 1180px) {
      .app {
        grid-template-columns: 1fr;
      }
    }
  `;
}

export function renderAppShell(state: AppShellState): string {
  const dock = renderAgentDock(state.agents);
  const board = renderChallengeBoard(state.challenge);
  const chat = renderChatAndSkills(state.chatAndSkills);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenClaw Tutor UI Shell</title>
    <style>${renderStyle()}</style>
  </head>
  <body>
    <main class="app" data-module="ui">
      ${dock}
      ${board}
      ${chat}
    </main>
  </body>
</html>`;
}
