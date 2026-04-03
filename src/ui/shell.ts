import type { AgentPreset } from '../agents/presets.js';
import type { DockAgent } from '../agents/sample-data.js';
import { difficultyLabel } from '../challenges/loader.js';
import type { ChallengeCatalog, ChallengeDefinition } from '../challenges/types.js';
import type { ChatSessionConfig } from '../runtime/index.js';
import { formatClockTime } from '../runtime/messages.js';
import { resolveSkillRelevanceHint, type SkillMetadata, type SkillRailState } from '../skills/sample-data.js';
import type { TutorGuidanceCatalog } from '../tutor/guidance.js';
import {
  buildCompletedIdSet,
  challengeUnlockBlockedReason,
  computeUnlockedTier,
  isChallengeUnlocked,
} from '../progress/progression.js';
import { renderAgentInteractionScript, type SystemMessage } from './agent-runtime-script.js';
import { renderChallengeRuntimeScript } from './challenge-runtime-script.js';
import { escapeHtml } from './escape.js';

export interface AppShellState {
  agents: DockAgent[];
  agentPresets: AgentPreset[];
  challengeCatalog: ChallengeCatalog;
  chatSession: ChatSessionConfig;
  skillRail: SkillRailState;
  tutorGuidance: TutorGuidanceCatalog;
  lessonMap: Record<string, { whatYouLearned: string; nextMission: string }>;
  runtimeBridgeBasePath: string;
}

function buildInitialSystemMessages(chatSession: ChatSessionConfig): SystemMessage[] {
  if (chatSession.runtimeMode === 'live') {
    return [
      {
        id: 'runtime-mode-live',
        type: 'confirmation',
        text: 'App running in LIVE mode.',
      },
    ];
  }

  return [
    {
      id: 'runtime-mode-mock',
      type: 'warning',
      text: 'App running in MOCK mode (simulated runtime responses).',
    },
  ];
}

function renderSystemMessages(messages: SystemMessage[]): string {
  const items = messages
    .map(
      (message) => `
      <li class="system-message system-message-${escapeHtml(message.type)}" data-system-message-id="${escapeHtml(message.id)}">
        <p class="system-message-text">${escapeHtml(message.text)}</p>
        <button
          class="system-message-close"
          type="button"
          data-system-message-close
          data-system-message-id="${escapeHtml(message.id)}"
          aria-label="Dismiss system message"
        >
          X
        </button>
      </li>
    `,
    )
    .join('');

  return `
    <section class="system-message-panel" aria-label="System messages">
      <ul class="system-message-stack" data-system-messages>
        ${items}
      </ul>
    </section>
  `;
}

const statusTone: Record<DockAgent['status'], string> = {
  ready: 'tone-ready',
  working: 'tone-working',
  blocked: 'tone-blocked',
};

function renderAgentDock(agents: DockAgent[]): string {
  const selectedAgent = agents[0];
  if (selectedAgent === undefined) {
    throw new Error('At least one dock agent is required.');
  }

  const cards = agents
    .map(
      (agent) => `
      <article class="card dock-card ${agent.id === selectedAgent.id ? 'is-selected' : ''}" data-dock-card data-agent-id="${escapeHtml(agent.id)}" role="button" tabindex="0" aria-pressed="${agent.id === selectedAgent.id ? 'true' : 'false'}">
        <header class="row-between">
          <h3 data-agent-name>${escapeHtml(agent.name)}</h3>
          <span class="badge ${statusTone[agent.status]}" data-agent-status>${escapeHtml(agent.status)}</span>
        </header>
        <p class="controls-row">
          <button class="button button-secondary" type="button" data-agent-test>Test</button>
          <span class="meta" data-agent-test-status>Not tested yet.</span>
        </p>
        <p class="muted" data-agent-specialty>${escapeHtml(agent.specialty)}</p>
        <p class="meta">Queue depth: <span data-agent-queue-depth>${agent.queueDepth}</span></p>
      </article>
    `,
    )
    .join('');

  const internalAttributeRows = [
    { label: 'Agent ID', key: 'id', value: selectedAgent.id },
    { label: 'Status', key: 'status', value: selectedAgent.status },
    { label: 'Queue depth', key: 'queueDepth', value: String(selectedAgent.queueDepth) },
    { label: 'Avatar', key: 'avatar', value: selectedAgent.avatar },
    { label: 'Teaching style', key: 'teachingStyle', value: selectedAgent.teachingStyle },
    { label: 'Challenge bias', key: 'challengeBias', value: selectedAgent.challengeBias },
    { label: 'Recommended skills', key: 'recommendedSkills', value: selectedAgent.recommendedSkills.join(', ') || 'none' },
  ];
  const internalAttributes = internalAttributeRows
    .map(
      (row) => `
        <li class="attribute-row">
          <span class="meta">${escapeHtml(row.label)}</span>
          <strong data-agent-internal-value="${escapeHtml(row.key)}">${escapeHtml(row.value)}</strong>
        </li>
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
      <section class="card dock-attributes" data-agent-attributes>
        <h3>Agent Parameters</h3>
        <p class="meta">Editable text fields sync to the selected Agent Dock card when you save.</p>
        <ul class="attribute-list">${internalAttributes}</ul>
        <form class="stack" data-agent-form>
          <label class="skill-field">
            <span class="meta">Name</span>
            <input class="input-control" type="text" name="name" data-agent-field="name" value="${escapeHtml(selectedAgent.name)}" />
          </label>
          <label class="skill-field">
            <span class="meta">Description</span>
            <textarea class="submission-box skill-textarea" name="description" data-agent-field="description" rows="3">${escapeHtml(selectedAgent.description)}</textarea>
          </label>
          <label class="skill-field">
            <span class="meta">Specialty</span>
            <input class="input-control" type="text" name="specialty" data-agent-field="specialty" value="${escapeHtml(selectedAgent.specialty)}" />
          </label>
          <p class="controls-row">
            <button class="button button-secondary" type="button" data-agent-save>Save</button>
            <span class="meta" data-agent-save-status>Select an agent and save edits.</span>
          </p>
        </form>
      </section>
    </section>
  `;
}

function renderChallengePicker(
  challenge: ChallengeDefinition,
  isActive: boolean,
  unlockedTier: number,
  completedIds: Set<string>,
): string {
  const isUnlocked = isChallengeUnlocked(challenge, unlockedTier, completedIds);
  const activeClass = isActive && isUnlocked ? 'is-active' : '';
  const lockedClass = isUnlocked ? '' : 'is-locked';
  const disabledAttribute = isUnlocked ? '' : 'disabled';
  const lockLabel = challengeUnlockBlockedReason(challenge, unlockedTier, completedIds) ?? 'Unlocked';

  return `
    <li>
      <button class="challenge-picker ${activeClass} ${lockedClass}" type="button" data-challenge-id="${escapeHtml(challenge.id)}" ${disabledAttribute}>
        <span class="badge tone-neutral">${escapeHtml(difficultyLabel(challenge.difficulty))}</span>
        <strong>${escapeHtml(challenge.title)}</strong>
        <span class="muted">${escapeHtml(challenge.category)}</span>
        <span class="meta challenge-lock" data-lock-hint>${escapeHtml(lockLabel)}</span>
      </button>
    </li>
  `;
}

function renderChallengeBoard(catalog: ChallengeCatalog): string {
  const activeChallenge = catalog.byId[catalog.defaultChallengeId];
  if (activeChallenge === undefined) {
    throw new Error(`Challenge ${catalog.defaultChallengeId} was not found in catalog.`);
  }
  const initialProgress = {
    completedById: {},
    activeChallengeId: catalog.defaultChallengeId,
    profileName: 'Learner',
  };
  const completedIds = buildCompletedIdSet(initialProgress);
  const unlockedTier = computeUnlockedTier(catalog, completedIds);
  const challengeOptions = catalog.challenges
    .map((challenge) => renderChallengePicker(challenge, challenge.id === activeChallenge.id, unlockedTier, completedIds))
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

          <section class="guidance-panel">
            <h4>Profile + Progress</h4>
            <label class="skill-field">
              <span class="meta">Display name</span>
              <input class="input-control" type="text" data-profile-name maxlength="60" placeholder="Learner" />
            </label>
            <p class="controls-row">
              <button class="button button-secondary" type="button" data-profile-save>Save Profile</button>
              <span class="meta" data-profile-status>Profile not saved yet.</span>
            </p>
            <ul class="criteria">
              <li data-progress-completed>Completed: 0/${catalog.challenges.length}</li>
              <li data-progress-tier>Unlocked tier: TIER 1</li>
              <li data-progress-concepts-count>Learned concepts: 0</li>
            </ul>
            <h4>Learned Concepts</h4>
            <ul class="criteria" data-learned-concepts>
              <li>Complete challenges to unlock concept summaries.</li>
            </ul>
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
          <span class="badge ${skill.installed ? 'tone-ready' : 'tone-blocked'}" data-skill-installed-badge>${skill.installed ? 'installed' : 'not installed'}</span>
          <span class="badge ${skill.enabled ? 'tone-ready' : 'tone-blocked'}" data-skill-enabled-badge>${skill.enabled ? 'enabled' : 'disabled'}</span>
          <form class="skill-form stack" data-skill-form>
            ${renderSkillParameters(skill)}
            <button class="button button-secondary" type="button" data-skill-run ${skill.enabled && skill.installed ? '' : 'disabled'}>
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
      <h3>Runtime Observability</h3>
      <p class="controls-row">
        <button class="button button-secondary" type="button" data-runtime-refresh>Refresh Runtime Log</button>
      </p>
      <ul class="stack" data-runtime-events>
        <li class="card"><p class="meta">No runtime events yet.</p></li>
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
    }

    .app-shell {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      gap: 1rem;
    }

    .system-message-panel {
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      padding: 0.75rem;
      box-shadow: var(--shadow);
      backdrop-filter: blur(4px);
    }

    .system-message-stack {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.5rem;
    }

    .system-message {
      border: 2px solid var(--neutral);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.92);
      padding: 0.55rem 0.65rem;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.6rem;
    }

    .system-message-confirmation {
      border-color: #0f8f6f;
    }

    .system-message-warning {
      border-color: #b46900;
    }

    .system-message-error {
      border-color: #ad2f45;
    }

    .system-message-text {
      margin: 0;
      font-size: 0.88rem;
      line-height: 1.35;
    }

    .system-message-close {
      border: 1px solid var(--panel-border);
      border-radius: 999px;
      width: 1.55rem;
      height: 1.55rem;
      background: rgba(255, 255, 255, 0.9);
      color: var(--text);
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      line-height: 1;
      flex: 0 0 auto;
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

    .dock-card {
      cursor: pointer;
      transition: border-color 0.12s ease, box-shadow 0.12s ease, transform 0.12s ease;
    }

    .dock-card:hover {
      border-color: rgba(62, 79, 106, 0.35);
      transform: translateY(-1px);
    }

    .dock-card.is-selected {
      border-color: rgba(62, 79, 106, 0.55);
      box-shadow: inset 0 0 0 1px rgba(62, 79, 106, 0.28);
      background: #f2f7ff;
    }

    .dock-attributes {
      margin-top: 0.75rem;
      border-style: dashed;
      background: rgba(255, 255, 255, 0.94);
    }

    .attribute-list {
      margin: 0.6rem 0 0.4rem;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 0.35rem;
    }

    .attribute-row {
      display: flex;
      justify-content: space-between;
      gap: 0.6rem;
      align-items: center;
    }

    .attribute-row strong {
      font-size: 0.85rem;
      text-align: right;
      word-break: break-word;
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

    .challenge-picker.is-locked {
      opacity: 0.72;
      background: rgba(255, 255, 255, 0.65);
      cursor: not-allowed;
    }

    .challenge-title {
      margin-top: 0.4rem;
      font-size: 1.05rem;
    }

    .challenge-lock {
      margin-top: 0.2rem;
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

export function renderAppShell(state: AppShellState): string {
  const dock = renderAgentDock(state.agents);
  const board = renderChallengeBoard(state.challengeCatalog);
  const activeChallenge = state.challengeCatalog.byId[state.challengeCatalog.defaultChallengeId];
  if (activeChallenge === undefined) {
    throw new Error(`Challenge ${state.challengeCatalog.defaultChallengeId} was not found in catalog.`);
  }
  const chat = renderChatAndSkills(state.chatSession, state.agentPresets, state.skillRail, activeChallenge);
  const initialSystemMessages = buildInitialSystemMessages(state.chatSession);
  const systemMessages = renderSystemMessages(initialSystemMessages);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>OpenClaw Tutor UI Shell</title>
    <style>${renderStyle()}</style>
  </head>
  <body>
    <div class="app-shell" data-module="ui">
      ${systemMessages}
      <main class="app">
        ${dock}
        ${board}
        ${chat}
      </main>
    </div>
    <script>${renderChallengeRuntimeScript(state.challengeCatalog, state.tutorGuidance, state.lessonMap)}</script>
    <script>${renderAgentInteractionScript(
      state.chatSession,
      state.agentPresets,
      state.skillRail,
      state.runtimeBridgeBasePath,
      state.agents,
      initialSystemMessages,
    )}</script>
  </body>
</html>`;
}
