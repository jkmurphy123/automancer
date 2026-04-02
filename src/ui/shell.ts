import type { DockAgent } from '../agents/sample-data.js';
import { difficultyLabel } from '../challenges/loader.js';
import type { ChallengeCatalog, ChallengeDefinition } from '../challenges/types.js';
import type { ChatAndSkills } from '../skills/sample-data.js';
import { escapeHtml } from './escape.js';

export interface AppShellState {
  agents: DockAgent[];
  challengeCatalog: ChallengeCatalog;
  chatAndSkills: ChatAndSkills;
}

const statusTone: Record<DockAgent['status'], string> = {
  ready: 'tone-ready',
  working: 'tone-working',
  blocked: 'tone-blocked',
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
        <p>Live fixture lane for agent status context.</p>
      </header>
      <div class="stack">${cards}</div>
    </section>
  `;
}

function renderChallengePicker(challenge: ChallengeDefinition, isActive: boolean): string {
  const activeClass = isActive ? 'is-active' : '';

  return `
    <li>
      <button class="challenge-picker ${activeClass}" type="button" data-challenge-id="${escapeHtml(challenge.id)}">
        <span class="badge tone-neutral">${escapeHtml(difficultyLabel(challenge.difficulty))}</span>
        <strong>${escapeHtml(challenge.title)}</strong>
        <span class="muted">${escapeHtml(challenge.category)}</span>
      </button>
    </li>
  `;
}

function renderChallengeBoard(catalog: ChallengeCatalog): string {
  const activeChallenge = catalog.byId[catalog.defaultChallengeId];
  if (activeChallenge === undefined) {
    throw new Error(`Challenge ${catalog.defaultChallengeId} was not found in catalog.`);
  }
  const challengeOptions = catalog.challenges
    .map((challenge) => renderChallengePicker(challenge, challenge.id === activeChallenge.id))
    .join('');

  const criteria = activeChallenge.successCriteria
    .map((criterion) => `<li>${escapeHtml(criterion)}</li>`)
    .join('');

  return `
    <section class="panel panel-board" data-module="challenges">
      <header class="panel-header">
        <h2>Challenge Board</h2>
        <p>Data-driven Tier 1 + Tier 2 challenges with deterministic completion checks.</p>
      </header>
      <div class="challenge-grid">
        <aside class="card challenge-list-card">
          <h3>Challenge List</h3>
          <ul class="stack" data-challenge-list>${challengeOptions}</ul>
        </aside>

        <article class="card challenge-detail-card">
          <p class="eyebrow" data-active-id>${escapeHtml(activeChallenge.id)}</p>
          <h3 class="challenge-title" data-active-title>${escapeHtml(activeChallenge.title)}</h3>
          <p class="muted" data-active-summary>${escapeHtml(activeChallenge.summary)}</p>
          <p class="meta"><span data-active-category>${escapeHtml(activeChallenge.category)}</span> · <span data-active-difficulty>${escapeHtml(
            difficultyLabel(activeChallenge.difficulty),
          )}</span></p>

          <h4>Full Description</h4>
          <p data-active-description>${escapeHtml(activeChallenge.fullDescription)}</p>

          <h4>Success Criteria</h4>
          <ul class="criteria" data-success-criteria>${criteria}</ul>

          <h4>Hints</h4>
          <p class="hint-output" data-hint-output>No hints revealed yet.</p>
          <p class="row-between controls-row">
            <button class="button" type="button" data-hint-button>Reveal Next Hint</button>
            <span class="meta" data-hint-progress>0/${activeChallenge.hints.length} shown</span>
          </p>

          <h4>Submit Candidate Response</h4>
          <label class="sr-only" for="candidate-response">Candidate response</label>
          <textarea id="candidate-response" class="submission-box" data-submission-input rows="5" placeholder="Type your solution..."></textarea>
          <p class="controls-row">
            <button class="button" type="button" data-submit-button>Check Completion</button>
            <button class="button button-secondary" type="button" data-reset-button>Reset</button>
          </p>
          <p class="feedback" data-validation-feedback>Awaiting submission.</p>

          <section class="lesson hidden" data-lesson-panel>
            <h4>What you learned</h4>
            <p data-lesson-summary></p>
            <h4>Suggested next mission</h4>
            <p data-next-mission></p>
          </section>
        </article>
      </div>
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
      grid-template-columns: minmax(14rem, 0.95fr) minmax(24rem, 1.65fr) minmax(16rem, 1fr);
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

    h3,
    h4 {
      margin: 0.85rem 0 0.5rem;
      font-size: 0.95rem;
    }

    .challenge-grid {
      display: grid;
      grid-template-columns: minmax(13rem, 0.9fr) minmax(0, 1.4fr);
      gap: 0.8rem;
      align-items: start;
    }

    .challenge-picker {
      width: 100%;
      text-align: left;
      border: 1px solid var(--panel-border);
      background: #fff;
      border-radius: 10px;
      padding: 0.65rem;
      display: grid;
      gap: 0.25rem;
      cursor: pointer;
      color: var(--text);
      font: inherit;
    }

    .challenge-picker.is-active {
      border-color: var(--neutral);
      background: #f1f6ff;
    }

    .challenge-picker.is-complete {
      border-color: var(--ready);
      background: #ecfaf5;
    }

    .challenge-title {
      margin-top: 0.4rem;
      font-size: 1.05rem;
    }

    .criteria {
      margin: 0;
      padding-left: 1.2rem;
      display: grid;
      gap: 0.25rem;
    }

    .hint-output {
      border: 1px dashed var(--panel-border);
      border-radius: 10px;
      padding: 0.55rem;
      margin: 0;
      min-height: 3rem;
      background: rgba(255, 255, 255, 0.75);
    }

    .controls-row {
      display: flex;
      gap: 0.55rem;
      align-items: center;
      flex-wrap: wrap;
      margin: 0.6rem 0 0;
    }

    .button {
      border: 1px solid var(--neutral);
      background: #eef4ff;
      color: var(--text);
      border-radius: 10px;
      padding: 0.45rem 0.7rem;
      font: inherit;
      font-size: 0.88rem;
      cursor: pointer;
    }

    .button-secondary {
      border-color: var(--panel-border);
      background: rgba(255, 255, 255, 0.8);
    }

    .submission-box {
      width: 100%;
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 0.6rem;
      font: inherit;
      resize: vertical;
      min-height: 7.5rem;
    }

    .feedback {
      margin: 0.7rem 0 0;
      font-size: 0.88rem;
      color: var(--muted);
    }

    .feedback-success {
      color: var(--ready);
    }

    .feedback-failed {
      color: var(--blocked);
    }

    .lesson {
      margin-top: 0.7rem;
      border: 1px solid rgba(15, 143, 111, 0.4);
      border-radius: 10px;
      padding: 0.6rem;
      background: rgba(236, 250, 245, 0.92);
    }

    .hidden {
      display: none;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
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

    .step-label {
      margin: 0;
      font-weight: 600;
    }

    @media (max-width: 1180px) {
      .app {
        grid-template-columns: 1fr;
      }

      .challenge-grid {
        grid-template-columns: 1fr;
      }
    }
  `;
}

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderChallengeRuntimeScript(catalog: ChallengeCatalog): string {
  return `
    (() => {
      const catalog = ${serializeForInlineScript(catalog)};
      const byId = catalog.byId;
      const state = {
        activeId: catalog.defaultChallengeId,
        shownHints: 0,
        completed: {},
      };

      const elements = {
        challengeList: document.querySelector('[data-challenge-list]'),
        activeId: document.querySelector('[data-active-id]'),
        activeTitle: document.querySelector('[data-active-title]'),
        activeSummary: document.querySelector('[data-active-summary]'),
        activeCategory: document.querySelector('[data-active-category]'),
        activeDifficulty: document.querySelector('[data-active-difficulty]'),
        activeDescription: document.querySelector('[data-active-description]'),
        successCriteria: document.querySelector('[data-success-criteria]'),
        hintOutput: document.querySelector('[data-hint-output]'),
        hintButton: document.querySelector('[data-hint-button]'),
        hintProgress: document.querySelector('[data-hint-progress]'),
        submissionInput: document.querySelector('[data-submission-input]'),
        submitButton: document.querySelector('[data-submit-button]'),
        resetButton: document.querySelector('[data-reset-button]'),
        feedback: document.querySelector('[data-validation-feedback]'),
        lessonPanel: document.querySelector('[data-lesson-panel]'),
        lessonSummary: document.querySelector('[data-lesson-summary]'),
        nextMission: document.querySelector('[data-next-mission]'),
      };

      const normalizeText = (value) => value.trim().toLowerCase().replace(/\\s+/g, ' ');

      const evaluateKeyword = (rule, submission) => {
        const normalized = normalizeText(submission);
        const matches = rule.keywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
        const passed = rule.mode === 'all' ? matches.length === rule.keywords.length : matches.length > 0;
        return {
          passed,
          feedback: passed
            ? 'Challenge completed. Keyword criteria satisfied.'
            : 'Not complete yet. Matched ' + matches.length + '/' + rule.keywords.length + ' keyword criteria.',
        };
      };

      const evaluateJson = (rule, submission) => {
        let parsed;

        try {
          parsed = JSON.parse(submission);
        } catch {
          return { passed: false, feedback: 'Not complete yet. Response must be valid JSON.' };
        }

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { passed: false, feedback: 'Not complete yet. JSON must be an object.' };
        }

        const keys = rule.requiredKeys.filter((key) => key in parsed);

        if (keys.length !== rule.requiredKeys.length) {
          return {
            passed: false,
            feedback:
              'Not complete yet. Required keys found ' + keys.length + '/' + rule.requiredKeys.length + '.',
          };
        }

        if (rule.expectedValues) {
          for (const [key, expected] of Object.entries(rule.expectedValues)) {
            if (normalizeText(String(parsed[key] ?? '')) !== normalizeText(expected)) {
              return {
                passed: false,
                feedback: 'Not complete yet. Field ' + key + ' must equal "' + expected + '".',
              };
            }
          }
        }

        return { passed: true, feedback: 'Challenge completed. JSON validation passed.' };
      };

      const evaluate = (challenge, submission) => {
        if (submission.trim().length === 0) {
          return { passed: false, feedback: 'Submission cannot be empty.' };
        }

        if (challenge.validation.type === 'exact') {
          const passed = normalizeText(submission) === normalizeText(challenge.validation.expected);
          return {
            passed,
            feedback: passed
              ? 'Challenge completed. Exact answer matched.'
              : 'Not complete yet. Exact answer did not match.',
          };
        }

        if (challenge.validation.type === 'keyword') {
          return evaluateKeyword(challenge.validation, submission);
        }

        return evaluateJson(challenge.validation, submission);
      };

      const getActiveChallenge = () => byId[state.activeId];

      const setLessonVisible = (visible) => {
        if (visible) {
          elements.lessonPanel.classList.remove('hidden');
          return;
        }

        elements.lessonPanel.classList.add('hidden');
      };

      const renderCriteria = (criteria) => {
        elements.successCriteria.innerHTML = '';

        criteria.forEach((criterion) => {
          const item = document.createElement('li');
          item.textContent = criterion;
          elements.successCriteria.appendChild(item);
        });
      };

      const renderListState = () => {
        elements.challengeList
          .querySelectorAll('button[data-challenge-id]')
          .forEach((button) => {
            const challengeId = button.getAttribute('data-challenge-id');
            button.classList.toggle('is-active', challengeId === state.activeId);
            button.classList.toggle('is-complete', Boolean(state.completed[challengeId]));
          });
      };

      const renderChallenge = () => {
        const challenge = getActiveChallenge();

        elements.activeId.textContent = challenge.id;
        elements.activeTitle.textContent = challenge.title;
        elements.activeSummary.textContent = challenge.summary;
        elements.activeCategory.textContent = challenge.category;
        elements.activeDifficulty.textContent = challenge.difficulty.replace('_', ' ').toUpperCase();
        elements.activeDescription.textContent = challenge.fullDescription;
        elements.hintOutput.textContent = 'No hints revealed yet.';
        elements.hintProgress.textContent = '0/' + challenge.hints.length + ' shown';
        elements.submissionInput.value = '';
        elements.feedback.textContent = 'Awaiting submission.';
        elements.feedback.classList.remove('feedback-success', 'feedback-failed');
        state.shownHints = 0;
        renderCriteria(challenge.successCriteria);
        setLessonVisible(false);
        renderListState();
      };

      elements.challengeList.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-challenge-id]');

        if (!button) {
          return;
        }

        const challengeId = button.getAttribute('data-challenge-id');

        if (!challengeId || !byId[challengeId]) {
          return;
        }

        state.activeId = challengeId;
        renderChallenge();
      });

      elements.hintButton.addEventListener('click', () => {
        const challenge = getActiveChallenge();

        if (state.shownHints >= challenge.hints.length) {
          elements.hintOutput.textContent = 'All hints are already visible for this challenge.';
          return;
        }

        elements.hintOutput.textContent = challenge.hints[state.shownHints];
        state.shownHints += 1;
        elements.hintProgress.textContent = state.shownHints + '/' + challenge.hints.length + ' shown';
      });

      elements.submitButton.addEventListener('click', () => {
        const challenge = getActiveChallenge();
        const result = evaluate(challenge, elements.submissionInput.value);

        elements.feedback.textContent = result.feedback;
        elements.feedback.classList.toggle('feedback-success', result.passed);
        elements.feedback.classList.toggle('feedback-failed', !result.passed);

        if (!result.passed) {
          setLessonVisible(false);
          return;
        }

        state.completed[challenge.id] = true;
        elements.lessonSummary.textContent = challenge.completionLesson.whatYouLearned;
        elements.nextMission.textContent = challenge.completionLesson.nextMission;
        setLessonVisible(true);
        renderListState();
      });

      elements.resetButton.addEventListener('click', renderChallenge);

      renderChallenge();
    })();
  `;
}

export function renderAppShell(state: AppShellState): string {
  const dock = renderAgentDock(state.agents);
  const board = renderChallengeBoard(state.challengeCatalog);
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
    <script>${renderChallengeRuntimeScript(state.challengeCatalog)}</script>
  </body>
</html>`;
}
