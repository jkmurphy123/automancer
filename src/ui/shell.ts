import type { AgentPreset } from '../agents/presets.js';
import type { DockAgent } from '../agents/sample-data.js';
import { difficultyLabel } from '../challenges/loader.js';
import type { ChallengeCatalog, ChallengeDefinition } from '../challenges/types.js';
import type { ChatSessionConfig } from '../runtime/index.js';
import { formatClockTime, type ChatMessage } from '../runtime/messages.js';
import { resolveSkillRelevanceHint, type SkillMetadata, type SkillRailState } from '../skills/sample-data.js';
import type { TutorGuidanceCatalog } from '../tutor/guidance.js';
import { escapeHtml } from './escape.js';

export interface AppShellState {
  agents: DockAgent[];
  agentPresets: AgentPreset[];
  challengeCatalog: ChallengeCatalog;
  chatSession: ChatSessionConfig;
  skillRail: SkillRailState;
  tutorGuidance: TutorGuidanceCatalog;
  lessonMap: Record<string, { whatYouLearned: string; nextMission: string }>;
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

          <section class="guidance-panel">
            <h4>Tutor Guidance</h4>
            <p class="meta">Concept hints</p>
            <ul class="criteria" data-guidance-concepts>
              <li>Focus concept guidance will appear here.</li>
            </ul>
            <p class="meta">Suggested skills</p>
            <ul class="criteria" data-guidance-skills>
              <li>No skill suggestions available yet.</li>
            </ul>
            <p class="meta" data-guidance-lesson-map>Lesson mapping will appear after challenge selection.</p>
            <p class="hint-output" data-guidance-failure>No failed attempts yet. Guidance will appear here if validation fails.</p>
          </section>

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

function renderSkillParameters(skill: SkillMetadata): string {
  if (skill.parameters.length === 0) {
    return '<p class="meta">This skill has no configurable parameters.</p>';
  }

  return skill.parameters
    .map((parameter) => {
      if (parameter.type === 'select') {
        const options = (parameter.options ?? [])
          .map((option) => {
            const isSelected = String(parameter.defaultValue ?? '') === option.value ? 'selected' : '';
            return `<option value="${escapeHtml(option.value)}" ${isSelected}>${escapeHtml(option.label)}</option>`;
          })
          .join('');

        return `
          <label class="skill-field">
            <span class="meta">${escapeHtml(parameter.label)}</span>
            <select class="input-control" name="${escapeHtml(parameter.key)}">${options}</select>
          </label>
        `;
      }

      if (parameter.type === 'boolean') {
        const checked = parameter.defaultValue === true ? 'checked' : '';
        return `
          <label class="skill-field checkbox-field">
            <input type="checkbox" name="${escapeHtml(parameter.key)}" ${checked} />
            <span class="meta">${escapeHtml(parameter.label)}</span>
          </label>
        `;
      }

      if (parameter.type === 'textarea') {
        return `
          <label class="skill-field">
            <span class="meta">${escapeHtml(parameter.label)}</span>
            <textarea class="submission-box skill-textarea" name="${escapeHtml(parameter.key)}" rows="3" placeholder="${escapeHtml(
              parameter.placeholder ?? '',
            )}"></textarea>
          </label>
        `;
      }

      return `
        <label class="skill-field">
          <span class="meta">${escapeHtml(parameter.label)}</span>
          <input class="input-control" type="text" name="${escapeHtml(parameter.key)}" placeholder="${escapeHtml(parameter.placeholder ?? '')}" />
        </label>
      `;
    })
    .join('');
}

function renderChatAndSkills(
  chatSession: ChatSessionConfig,
  presets: AgentPreset[],
  skillRail: SkillRailState,
  activeChallenge: ChallengeDefinition,
): string {
  const messages = chatSession.initialMessages
    .map(
      (message) => `
      <li class="card message">
        <p class="row-between">
          <span class="badge tone-neutral">${escapeHtml(message.role)}</span>
          <span class="meta">${escapeHtml(formatClockTime(message.createdAt))}</span>
        </p>
        <p>${escapeHtml(message.text)}</p>
      </li>
    `,
    )
    .join('');

  const controls = skillRail.skills
    .map(
      (skill) => `
      <li class="card skill-card" data-skill-id="${escapeHtml(skill.id)}">
        <div>
          <p class="step-label">${escapeHtml(skill.displayName)}</p>
          <p class="muted">${escapeHtml(skill.description)}</p>
          <p class="meta skill-relevance" data-skill-relevance>
            ${escapeHtml(resolveSkillRelevanceHint(skill, activeChallenge) ?? 'No challenge-specific hint yet.')}
          </p>
          <p class="meta">Risk: ${escapeHtml(skill.risk.toUpperCase())} · Category: ${escapeHtml(skill.category)}</p>
        </div>
        <div class="skill-actions">
          <span class="badge ${skill.enabled ? 'tone-ready' : 'tone-blocked'}">${skill.enabled ? 'enabled' : 'disabled'}</span>
          <form class="skill-form stack" data-skill-form>
            ${renderSkillParameters(skill)}
            <button class="button button-secondary" type="button" data-skill-run ${skill.enabled ? '' : 'disabled'}>
              Run Skill
            </button>
          </form>
        </div>
      </li>
    `,
    )
    .join('');

  const options = presets
    .map(
      (preset) => `
        <option value="${escapeHtml(preset.id)}" ${preset.id === chatSession.defaultPresetId ? 'selected' : ''}>
          ${escapeHtml(preset.name)} - ${escapeHtml(preset.teachingStyle)}
        </option>
      `,
    )
    .join('');

  return `
    <section class="panel panel-chat" data-module="skills">
      <header class="panel-header">
        <h2>Chat + Skills</h2>
        <p>${escapeHtml(skillRail.threadTitle)}</p>
      </header>
      <div class="chat-controls">
        <label class="meta" for="agent-preset-select">Agent preset</label>
        <select id="agent-preset-select" class="input-control" data-agent-preset-select>
          ${options}
        </select>
      </div>
      <h3>Conversation</h3>
      <ul class="stack" data-chat-thread>${messages}</ul>
      <label class="sr-only" for="chat-input">Chat input</label>
      <textarea id="chat-input" class="submission-box chat-input" data-chat-input rows="4" placeholder="Ask the active agent for your next step..."></textarea>
      <p class="controls-row">
        <button class="button" type="button" data-chat-send>Send Message</button>
      </p>
      <p class="feedback" data-chat-runtime-status>Runtime idle.</p>
      <h3>Skill Controls</h3>
      <ul class="stack">${controls}</ul>
      <h3>Skill Activity</h3>
      <ul class="stack" data-skill-activity>
        <li class="card"><p class="meta">No skill executions yet.</p></li>
      </ul>
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

    .chat-controls {
      display: grid;
      gap: 0.35rem;
      margin-top: 0.55rem;
    }

    .input-control {
      width: 100%;
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 0.45rem 0.55rem;
      background: rgba(255, 255, 255, 0.85);
      font: inherit;
      color: var(--text);
    }

    .chat-input {
      min-height: 5.2rem;
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

    .guidance-panel {
      margin-top: 0.75rem;
      border: 1px solid rgba(62, 79, 106, 0.25);
      border-radius: 10px;
      padding: 0.6rem;
      background: rgba(255, 255, 255, 0.82);
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

    .message-role-user {
      color: #2157a5;
    }

    .message-role-agent {
      color: var(--ready);
    }

    .message-role-system {
      color: var(--neutral);
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

    .skill-card {
      display: grid;
      gap: 0.65rem;
    }

    .skill-actions {
      display: grid;
      gap: 0.5rem;
      justify-items: start;
    }

    .skill-form {
      gap: 0.45rem;
      width: 100%;
    }

    .skill-field {
      display: grid;
      gap: 0.25rem;
    }

    .checkbox-field {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .skill-textarea {
      min-height: 4.2rem;
    }

    .skill-relevance {
      font-style: italic;
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

function renderChallengeRuntimeScript(
  catalog: ChallengeCatalog,
  tutorGuidance: TutorGuidanceCatalog,
  lessonMap: Record<string, { whatYouLearned: string; nextMission: string }>,
): string {
  return `
    (() => {
      const catalog = ${serializeForInlineScript(catalog)};
      const guidanceByChallengeId = ${serializeForInlineScript(tutorGuidance.byChallengeId)};
      const lessonMap = ${serializeForInlineScript(lessonMap)};
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
        guidanceConcepts: document.querySelector('[data-guidance-concepts]'),
        guidanceSkills: document.querySelector('[data-guidance-skills]'),
        guidanceLessonMap: document.querySelector('[data-guidance-lesson-map]'),
        guidanceFailure: document.querySelector('[data-guidance-failure]'),
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

      const emitChallengeChanged = () => {
        const challenge = getActiveChallenge();

        window.dispatchEvent(
          new CustomEvent('challenge:changed', {
            detail: {
              id: challenge.id,
              title: challenge.title,
              summary: challenge.summary,
              category: challenge.category,
            },
          }),
        );
      };

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

      const renderList = (target, values, emptyLabel) => {
        target.innerHTML = '';

        if (!Array.isArray(values) || values.length === 0) {
          const item = document.createElement('li');
          item.textContent = emptyLabel;
          target.appendChild(item);
          return;
        }

        values.forEach((value) => {
          const item = document.createElement('li');
          item.textContent = value;
          target.appendChild(item);
        });
      };

      const buildPostFailureGuidance = (challenge, validationFeedback) => {
        const firstHint = challenge.hints[0] ?? 'Review the challenge details and try one smaller step.';
        return 'Attempt did not pass yet. ' + validationFeedback + ' Next step: ' + firstHint;
      };

      const renderGuidance = (challenge) => {
        const guidance = guidanceByChallengeId[challenge.id];
        const lesson = lessonMap[challenge.id];
        const conceptHints = guidance?.conceptHints ?? [];
        const skillHints = (guidance?.suggestedSkills ?? []).map(
          (suggestion) => suggestion.displayName + ': ' + suggestion.reason,
        );

        renderList(elements.guidanceConcepts, conceptHints, 'No concept hints available.');
        renderList(elements.guidanceSkills, skillHints, 'No skill suggestions available.');
        if (lesson) {
          elements.guidanceLessonMap.textContent = challenge.id + ' maps to lesson: ' + lesson.whatYouLearned;
        } else {
          elements.guidanceLessonMap.textContent = challenge.id + ' has no lesson mapping.';
        }
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
        elements.guidanceFailure.textContent = 'No failed attempts yet. Guidance will appear here if validation fails.';
        state.shownHints = 0;
        renderCriteria(challenge.successCriteria);
        renderGuidance(challenge);
        setLessonVisible(false);
        renderListState();
        emitChallengeChanged();
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
          elements.guidanceFailure.textContent = buildPostFailureGuidance(challenge, result.feedback);
          setLessonVisible(false);
          return;
        }

        state.completed[challenge.id] = true;
        elements.guidanceFailure.textContent = 'Latest submission passed validation.';
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

function renderAgentInteractionScript(chatSession: ChatSessionConfig, presets: AgentPreset[], skillRail: SkillRailState): string {
  return `
    (() => {
      const runtimeMode = ${serializeForInlineScript(chatSession.runtimeMode)};
      const defaultPresetId = ${serializeForInlineScript(chatSession.defaultPresetId)};
      const presets = ${serializeForInlineScript(presets)};
      const skills = ${serializeForInlineScript(skillRail.skills)};
      const state = {
        selectedPresetId: defaultPresetId,
        messages: ${serializeForInlineScript(chatSession.initialMessages as ChatMessage[])},
        pending: false,
        activeChallenge: null,
        activity: [],
      };

      const elements = {
        thread: document.querySelector('[data-chat-thread]'),
        presetSelect: document.querySelector('[data-agent-preset-select]'),
        chatInput: document.querySelector('[data-chat-input]'),
        sendButton: document.querySelector('[data-chat-send]'),
        status: document.querySelector('[data-chat-runtime-status]'),
        skillCards: document.querySelectorAll('[data-skill-id]'),
        activity: document.querySelector('[data-skill-activity]'),
      };

      const formatTime = (isoValue) => {
        const date = new Date(isoValue);

        if (Number.isNaN(date.getTime())) {
          return '--:--';
        }

        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');

        return hh + ':' + mm;
      };

      const nextId = () => {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
          return crypto.randomUUID();
        }

        return 'msg-' + String(Date.now()) + '-' + String(Math.random()).slice(2);
      };

      const createMessage = (payload) => ({
        id: nextId(),
        createdAt: new Date().toISOString(),
        ...payload,
      });

      const setPending = (pending, label) => {
        state.pending = pending;
        elements.sendButton.disabled = pending;
        elements.presetSelect.disabled = pending;
        elements.status.textContent = label;
        elements.status.classList.toggle('feedback-failed', !pending && label.toLowerCase().includes('failed'));
      };

      const getPreset = () => presets.find((preset) => preset.id === state.selectedPresetId) ?? presets[0];

      const renderMessages = () => {
        elements.thread.innerHTML = '';

        state.messages.forEach((message) => {
          const item = document.createElement('li');
          item.className = 'card message';

          const header = document.createElement('p');
          header.className = 'row-between';

          const role = document.createElement('span');
          role.className = 'badge tone-neutral message-role-' + message.role;
          role.textContent = message.role;

          const clock = document.createElement('span');
          clock.className = 'meta';
          clock.textContent = formatTime(message.createdAt);

          header.appendChild(role);
          header.appendChild(clock);

          const text = document.createElement('p');
          text.textContent = message.text;

          item.appendChild(header);
          item.appendChild(text);
          elements.thread.appendChild(item);
        });
      };

      const renderActivity = () => {
        if (state.activity.length === 0) {
          elements.activity.innerHTML = '<li class="card"><p class="meta">No skill executions yet.</p></li>';
          return;
        }

        elements.activity.innerHTML = '';
        state.activity
          .slice()
          .reverse()
          .forEach((entry) => {
            const item = document.createElement('li');
            item.className = 'card';
            item.innerHTML =
              '<p class="row-between"><span class="badge tone-neutral">skill</span><span class="meta">' +
              formatTime(entry.createdAt) +
              '</span></p><p>' +
              entry.summary +
              '</p>';
            elements.activity.appendChild(item);
          });
      };

      const computeRelevanceHint = (skill) => {
        if (!state.activeChallenge) {
          return 'Select a challenge to view relevance hints.';
        }

        const challengeText =
          (state.activeChallenge.title + ' ' + state.activeChallenge.summary + ' ' + state.activeChallenge.category).toLowerCase();

        for (const rule of skill.relevanceRules) {
          if (rule.keywords.some((keyword) => challengeText.includes(String(keyword).toLowerCase()))) {
            return rule.hint;
          }
        }

        return 'No challenge-specific hint yet.';
      };

      const refreshSkillRelevance = () => {
        elements.skillCards.forEach((card) => {
          const skillId = card.getAttribute('data-skill-id');
          const skill = skills.find((candidate) => candidate.id === skillId);
          const hintTarget = card.querySelector('[data-skill-relevance]');

          if (!skill || !hintTarget) {
            return;
          }

          hintTarget.textContent = computeRelevanceHint(skill);
        });
      };

      const mockRuntimeSend = async (preset, userMessage) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 220);
        });

        const normalized = userMessage.text.trim().toLowerCase();

        if (normalized.includes('__mock_error__')) {
          throw new Error('Simulated mock runtime failure triggered by __mock_error__.');
        }

        if (preset.id === 'tutor') {
          return {
            text:
              'Start with one small step: ' +
              userMessage.text +
              '. Then verify against the challenge success criteria before moving on.',
            systemNote: 'Tutor mode suggested a step-by-step coaching response.',
          };
        }

        if (preset.id === 'researcher') {
          return {
            text:
              'Evidence-first summary: identify two concrete facts about "' +
              userMessage.text +
              '" and note one unknown to verify.',
            systemNote: 'Researcher mode prioritized factual grounding.',
          };
        }

        return {
          text:
            'Debug pass: reproduce the issue described in "' +
            userMessage.text +
            '", capture one root cause, then apply the smallest safe fix.',
          systemNote: 'Mechanic mode generated a diagnosis-first response.',
        };
      };

      const mockRuntimeSkill = async (skill, parameters) => {
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });

        if (!skill.enabled) {
          throw new Error('Skill is disabled and cannot be executed.');
        }

        const challengeId = state.activeChallenge ? state.activeChallenge.id : 'no-active-challenge';
        const parameterSummary = Object.entries(parameters)
          .map(([key, value]) => key + '=' + String(value))
          .join(', ');

        if (skill.id === 'skill-plan-writer') {
          return {
            activity:
              'Generated execution checklist for ' +
              challengeId +
              ': scope, checkpoints, and completion criteria ready.',
            chatResponse:
              'Plan Writer created a focused plan for ' +
              challengeId +
              '. Start with a thin vertical slice, then validate against success criteria.',
            systemNote: 'Plan generated with inputs: ' + parameterSummary,
          };
        }

        if (skill.id === 'skill-repo-search') {
          return {
            activity:
              'Repo Search scanned references related to ' +
              challengeId +
              ' and returned likely extension points.',
            chatResponse:
              'Repo Search found candidate implementation anchors. Review runtime adapter and UI wiring first.',
            systemNote: 'Search inputs: ' + parameterSummary,
          };
        }

        return {
          activity: 'Prepared QA handoff checklist for ' + challengeId + '.',
          chatResponse: 'QA Handoff staged a verification checklist and release-risk summary for review.',
          systemNote: 'QA handoff inputs: ' + parameterSummary,
        };
      };

      const collectSkillParameters = (form, skill) => {
        const values = {};

        skill.parameters.forEach((parameter) => {
          const field = form.elements.namedItem(parameter.key);

          if (!field) {
            return;
          }

          if (parameter.type === 'boolean') {
            values[parameter.key] = Boolean(field.checked);
            return;
          }

          values[parameter.key] = String(field.value ?? '').trim();
        });

        return values;
      };

      const executeSkill = async (skillId, triggerButton) => {
        const skill = skills.find((candidate) => candidate.id === skillId);
        if (!skill) {
          return;
        }

        const card = triggerButton.closest('[data-skill-id]');
        const form = card ? card.querySelector('[data-skill-form]') : null;
        if (!form) {
          return;
        }

        const parameters = collectSkillParameters(form, skill);
        triggerButton.disabled = true;
        setPending(true, 'Running ' + skill.displayName + '...');

        try {
          const result = await mockRuntimeSkill(skill, parameters);
          state.activity.push({
            id: nextId(),
            createdAt: new Date().toISOString(),
            summary: result.activity,
          });

          state.messages.push(
            createMessage({
              role: 'agent',
              text: result.chatResponse,
              agentPresetId: state.selectedPresetId,
            }),
          );

          if (result.systemNote) {
            state.messages.push(
              createMessage({
                role: 'system',
                text: result.systemNote,
              }),
            );
          }

          renderActivity();
          renderMessages();
          setPending(false, skill.displayName + ' completed.');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown skill execution failure.';
          state.messages.push(
            createMessage({
              role: 'system',
              text: skill.displayName + ' failed: ' + message,
            }),
          );
          renderMessages();
          setPending(false, skill.displayName + ' failed. See system message for details.');
        } finally {
          triggerButton.disabled = !skill.enabled;
        }
      };

      const sendMessage = async () => {
        if (state.pending) {
          return;
        }

        const value = elements.chatInput.value.trim();
        if (value.length === 0) {
          setPending(false, 'Message not sent. Enter text first.');
          return;
        }

        const preset = getPreset();
        const userMessage = createMessage({
          role: 'user',
          text: value,
          agentPresetId: preset.id,
        });
        state.messages.push(userMessage);
        elements.chatInput.value = '';
        renderMessages();
        setPending(true, runtimeMode.toUpperCase() + ' runtime processing...');

        try {
          const runtimeResponse = await mockRuntimeSend(preset, userMessage);
          state.messages.push(
            createMessage({
              role: 'agent',
              text: runtimeResponse.text,
              agentPresetId: preset.id,
            }),
          );

          if (runtimeResponse.systemNote) {
            state.messages.push(
              createMessage({
                role: 'system',
                text: runtimeResponse.systemNote,
              }),
            );
          }

          renderMessages();
          setPending(false, 'Response received from ' + preset.name + ' via ' + runtimeMode.toUpperCase() + ' runtime.');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown runtime failure.';
          state.messages.push(
            createMessage({
              role: 'system',
              text: 'Runtime failed: ' + message,
            }),
          );
          renderMessages();
          setPending(false, 'Runtime request failed. See system message for details.');
        }
      };

      elements.presetSelect.addEventListener('change', (event) => {
        const selectedId = event.target.value;
        if (presets.some((preset) => preset.id === selectedId)) {
          state.selectedPresetId = selectedId;
        }
      });

      elements.sendButton.addEventListener('click', sendMessage);
      elements.chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          void sendMessage();
        }
      });

      elements.skillCards.forEach((card) => {
        const runButton = card.querySelector('[data-skill-run]');
        if (!runButton) {
          return;
        }

        runButton.addEventListener('click', () => {
          const skillId = card.getAttribute('data-skill-id');
          if (!skillId) {
            return;
          }

          void executeSkill(skillId, runButton);
        });
      });

      window.addEventListener('challenge:changed', (event) => {
        state.activeChallenge = event.detail ?? null;
        refreshSkillRelevance();
      });

      renderMessages();
      renderActivity();
      refreshSkillRelevance();
      setPending(false, 'Runtime idle.');
    })();
  `;
}

export function renderAppShell(state: AppShellState): string {
  const dock = renderAgentDock(state.agents);
  const board = renderChallengeBoard(state.challengeCatalog);
  const activeChallenge = state.challengeCatalog.byId[state.challengeCatalog.defaultChallengeId];
  if (activeChallenge === undefined) {
    throw new Error(`Challenge ${state.challengeCatalog.defaultChallengeId} was not found in catalog.`);
  }
  const chat = renderChatAndSkills(state.chatSession, state.agentPresets, state.skillRail, activeChallenge);

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
    <script>${renderChallengeRuntimeScript(state.challengeCatalog, state.tutorGuidance, state.lessonMap)}</script>
    <script>${renderAgentInteractionScript(state.chatSession, state.agentPresets, state.skillRail)}</script>
  </body>
</html>`;
}
