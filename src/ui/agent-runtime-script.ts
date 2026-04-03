import type { AgentPreset } from '../agents/presets.js';
import type { DockAgent } from '../agents/sample-data.js';
import type { ChatSessionConfig } from '../runtime/index.js';
import type { ChatMessage } from '../runtime/messages.js';
import type { SkillRailState } from '../skills/sample-data.js';
import { serializeForInlineScript } from './inline-script.js';

export type SystemMessageType = 'confirmation' | 'warning' | 'error';

export interface SystemMessage {
  id: string;
  type: SystemMessageType;
  text: string;
}

export function renderAgentInteractionScript(
  chatSession: ChatSessionConfig,
  presets: AgentPreset[],
  skillRail: SkillRailState,
  runtimeBridgeBasePath: string,
  dockAgents: DockAgent[],
  initialSystemMessages: SystemMessage[],
): string {
  return `
    (() => {
      const runtimeMode = ${serializeForInlineScript(chatSession.runtimeMode)};
      const defaultPresetId = ${serializeForInlineScript(chatSession.defaultPresetId)};
      const presets = ${serializeForInlineScript(presets)};
      const runtimeBridgeBasePath = ${serializeForInlineScript(runtimeBridgeBasePath)};
      const state = {
        selectedPresetId: defaultPresetId,
        sessionId: null,
        messages: ${serializeForInlineScript(chatSession.initialMessages as ChatMessage[])},
        pending: false,
        skills: ${serializeForInlineScript(skillRail.skills)},
        agents: ${serializeForInlineScript(dockAgents)},
        selectedAgentId: ${serializeForInlineScript(dockAgents[0]?.id ?? null)},
        activeChallenge: null,
        activity: [],
        runtimeEvents: [],
        systemMessages: ${serializeForInlineScript(initialSystemMessages)},
      };

      const elements = {
        systemMessages: document.querySelector('[data-system-messages]'),
        thread: document.querySelector('[data-chat-thread]'),
        presetSelect: document.querySelector('[data-agent-preset-select]'),
        chatInput: document.querySelector('[data-chat-input]'),
        sendButton: document.querySelector('[data-chat-send]'),
        status: document.querySelector('[data-chat-runtime-status]'),
        skillCards: document.querySelectorAll('[data-skill-id]'),
        activity: document.querySelector('[data-skill-activity]'),
        runtimeEvents: document.querySelector('[data-runtime-events]'),
        runtimeRefresh: document.querySelector('[data-runtime-refresh]'),
        dockCards: document.querySelectorAll('[data-dock-card]'),
        dockTestButtons: document.querySelectorAll('[data-agent-test]'),
        agentForm: document.querySelector('[data-agent-form]'),
        agentSaveButton: document.querySelector('[data-agent-save]'),
        agentSaveStatus: document.querySelector('[data-agent-save-status]'),
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
        elements.runtimeRefresh.disabled = pending;
        elements.status.textContent = label;
        elements.status.classList.toggle('feedback-failed', !pending && label.toLowerCase().includes('failed'));
      };

      const getPreset = () => presets.find((preset) => preset.id === state.selectedPresetId) ?? presets[0];

      const toApiUrl = (path) => runtimeBridgeBasePath + path;

      const normalizeText = (value) => String(value ?? '').trim();

      const getDockCardByAgentId = (agentId) =>
        Array.from(elements.dockCards).find((candidate) => candidate.getAttribute('data-agent-id') === agentId) ?? null;

      const getDockTestStatusElement = (agentId) =>
        getDockCardByAgentId(agentId)?.querySelector('[data-agent-test-status]') ?? null;

      const setDockTestStatus = (agentId, text, failed = false) => {
        const target = getDockTestStatusElement(agentId);
        if (!target) {
          return;
        }

        target.textContent = text;
        target.classList.toggle('feedback-failed', failed);
      };

      const getPresetForAgent = (agent) => {
        if (agent?.presetId) {
          const matched = presets.find((preset) => preset.id === agent.presetId);
          if (matched) {
            return matched;
          }
        }

        return presets.find((preset) => preset.id === state.selectedPresetId) ?? presets[0];
      };

      const updateDockCard = (agent) => {
        const card = Array.from(elements.dockCards).find((candidate) => candidate.getAttribute('data-agent-id') === agent.id);
        if (!card) {
          return;
        }

        const name = card.querySelector('[data-agent-name]');
        const specialty = card.querySelector('[data-agent-specialty]');
        const queueDepth = card.querySelector('[data-agent-queue-depth]');

        if (name) {
          name.textContent = agent.name;
        }
        if (specialty) {
          specialty.textContent = agent.specialty;
        }
        if (queueDepth) {
          queueDepth.textContent = String(agent.queueDepth);
        }
      };

      const syncDockSelection = () => {
        elements.dockCards.forEach((card) => {
          const isSelected = card.getAttribute('data-agent-id') === state.selectedAgentId;
          card.classList.toggle('is-selected', isSelected);
          card.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
      };

      const setInternalValue = (key, value) => {
        const target = document.querySelector('[data-agent-internal-value="' + key + '"]');
        if (target) {
          target.textContent = value;
        }
      };

      const populateAgentForm = () => {
        const agent = state.agents.find((candidate) => candidate.id === state.selectedAgentId) ?? null;
        if (!agent || !elements.agentForm) {
          return;
        }

        const nameField = elements.agentForm.elements.namedItem('name');
        const descriptionField = elements.agentForm.elements.namedItem('description');
        const specialtyField = elements.agentForm.elements.namedItem('specialty');

        if (nameField) {
          nameField.value = agent.name;
        }
        if (descriptionField) {
          descriptionField.value = agent.description;
        }
        if (specialtyField) {
          specialtyField.value = agent.specialty;
        }

        setInternalValue('id', agent.id);
        setInternalValue('status', agent.status);
        setInternalValue('queueDepth', String(agent.queueDepth));
        setInternalValue('avatar', agent.avatar);
        setInternalValue('teachingStyle', agent.teachingStyle);
        setInternalValue('challengeBias', agent.challengeBias);
        setInternalValue('recommendedSkills', agent.recommendedSkills.join(', ') || 'none');

        elements.agentSaveStatus.textContent = 'Editing ' + agent.name + '.';
      };

      const requestJson = async (path, options = {}) => {
        const response = await fetch(toApiUrl(path), {
          ...options,
          headers: {
            'content-type': 'application/json',
            ...(options.headers ?? {}),
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message = typeof payload.error === 'string' ? payload.error : 'Runtime request failed.';
          throw new Error(message);
        }

        return payload;
      };

      const renderSystemMessages = () => {
        if (!elements.systemMessages) {
          return;
        }

        elements.systemMessages.innerHTML = '';

        state.systemMessages.forEach((message) => {
          const item = document.createElement('li');
          item.className = 'system-message system-message-' + message.type;
          item.setAttribute('data-system-message-id', message.id);

          const text = document.createElement('p');
          text.className = 'system-message-text';
          text.textContent = message.text;

          const close = document.createElement('button');
          close.type = 'button';
          close.className = 'system-message-close';
          close.setAttribute('data-system-message-close', '');
          close.setAttribute('data-system-message-id', message.id);
          close.setAttribute('aria-label', 'Dismiss system message');
          close.textContent = 'X';

          item.appendChild(text);
          item.appendChild(close);
          elements.systemMessages.appendChild(item);
        });
      };

      const pushSystemMessage = (type, text) => {
        const trimmed = String(text ?? '').trim();
        if (trimmed.length === 0) {
          return;
        }

        state.systemMessages.push({
          id: nextId(),
          type,
          text: trimmed,
        });

        renderSystemMessages();
      };

      const ensureSession = async () => {
        if (state.sessionId) {
          return state.sessionId;
        }

        const payload = await requestJson('/sessions', {
          method: 'POST',
          body: JSON.stringify({
            runtimeMode,
          }),
        });

        state.sessionId = payload.sessionId;
        return state.sessionId;
      };

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

      const renderRuntimeEvents = () => {
        if (state.runtimeEvents.length === 0) {
          elements.runtimeEvents.innerHTML = '<li class="card"><p class="meta">No runtime events yet.</p></li>';
          return;
        }

        elements.runtimeEvents.innerHTML = '';
        state.runtimeEvents.forEach((entry) => {
          const item = document.createElement('li');
          item.className = 'card';

          const requestLabel = entry.requestId ? ' (' + String(entry.requestId).slice(0, 8) + ')' : '';
          const detailPreview = Object.entries(entry.details ?? {})
            .slice(0, 3)
            .map(([key, value]) => key + '=' + String(value))
            .join(' · ');

          item.innerHTML =
            '<p class="row-between"><span class="badge tone-neutral">' +
            entry.type +
            requestLabel +
            '</span><span class="meta">' +
            formatTime(entry.createdAt) +
            '</span></p><p class="meta">' +
            detailPreview +
            '</p>';
          elements.runtimeEvents.appendChild(item);
        });
      };

      const refreshRuntimeEvents = async () => {
        if (!state.sessionId) {
          return;
        }

        try {
          const payload = await requestJson('/sessions/' + state.sessionId + '/events?limit=20', {
            method: 'GET',
            headers: {},
          });
          state.runtimeEvents = Array.isArray(payload.events) ? payload.events : [];
          renderRuntimeEvents();
        } catch {
          // Ignore refresh failures and keep last successful list.
        }
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

      const applySkillStateToCard = (card, skill) => {
        const installedBadge = card.querySelector('[data-skill-installed-badge]');
        const enabledBadge = card.querySelector('[data-skill-enabled-badge]');
        const runButton = card.querySelector('[data-skill-run]');
        const form = card ? card.querySelector('[data-skill-form]') : null;

        if (installedBadge) {
          installedBadge.textContent = skill.installed ? 'installed' : 'not installed';
          installedBadge.className = 'badge ' + (skill.installed ? 'tone-ready' : 'tone-blocked');
        }

        if (enabledBadge) {
          enabledBadge.textContent = skill.enabled ? 'enabled' : 'disabled';
          enabledBadge.className = 'badge ' + (skill.enabled ? 'tone-ready' : 'tone-blocked');
        }

        if (runButton) {
          runButton.disabled = !skill.installed || !skill.enabled || state.pending;
        }

        if (form) {
          form.querySelectorAll('input, textarea, select, button').forEach((control) => {
            if (control.hasAttribute('data-skill-run')) {
              return;
            }
            control.disabled = !skill.installed || !skill.enabled || state.pending;
          });
        }
      };

      const refreshSkillRelevance = () => {
        elements.skillCards.forEach((card) => {
          const skillId = card.getAttribute('data-skill-id');
          const skill = state.skills.find((candidate) => candidate.id === skillId);
          const hintTarget = card.querySelector('[data-skill-relevance]');

          if (!skill || !hintTarget) {
            return;
          }

          hintTarget.textContent = computeRelevanceHint(skill);
          applySkillStateToCard(card, skill);
        });
      };

      const refreshSkillsFromRuntime = async () => {
        try {
          const payload = await requestJson('/skills', {
            method: 'GET',
            headers: {},
          });

          if (!Array.isArray(payload.skills)) {
            return;
          }

          state.skills = payload.skills;
          refreshSkillRelevance();
        } catch {
          // Keep existing skill state if runtime skill inventory cannot be loaded.
        }
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
        const skill = state.skills.find((candidate) => candidate.id === skillId);
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
          const sessionId = await ensureSession();
          const payload = await requestJson('/sessions/' + sessionId + '/skills/' + skill.id + '/execute', {
            method: 'POST',
            body: JSON.stringify({
              parameters,
              activeChallengeId: state.activeChallenge?.id ?? null,
            }),
          });

          state.activity.push({
            id: nextId(),
            createdAt: new Date().toISOString(),
            summary:
              payload.result.summary +
              ' [request ' +
              String(payload.requestId).slice(0, 8) +
              ', ' +
              String(payload.durationMs) +
              'ms]',
          });
          state.messages.push(createMessage({ role: 'agent', text: payload.result.chatResponse, agentPresetId: state.selectedPresetId }));

          if (payload.result.systemNote) {
            state.messages.push(createMessage({ role: 'system', text: payload.result.systemNote }));
          }

          renderActivity();
          renderMessages();
          await refreshRuntimeEvents();
          setPending(false, skill.displayName + ' completed.');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown skill execution failure.';
          pushSystemMessage('error', skill.displayName + ' failed: ' + message);
          state.messages.push(
            createMessage({
              role: 'system',
              text: skill.displayName + ' failed: ' + message,
            }),
          );
          renderMessages();
          setPending(false, skill.displayName + ' failed. See system message for details.');
        } finally {
          refreshSkillRelevance();
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
          const sessionId = await ensureSession();
          const runtimeResponse = await requestJson('/sessions/' + sessionId + '/messages', {
            method: 'POST',
            body: JSON.stringify({
              presetId: preset.id,
              text: userMessage.text,
            }),
          });

          state.messages.push(
            createMessage({
              role: 'agent',
              text: runtimeResponse.responseText,
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
          await refreshRuntimeEvents();
          setPending(false, 'Response received from ' + preset.name + ' via ' + runtimeMode.toUpperCase() + ' runtime.');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown runtime failure.';
          pushSystemMessage('error', 'Runtime failed: ' + message);
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

      const runAgentConnectionTest = async (card, triggerButton) => {
        const agentId = card.getAttribute('data-agent-id');
        if (!agentId) {
          return;
        }

        const agent = state.agents.find((candidate) => candidate.id === agentId) ?? null;
        const preset = getPresetForAgent(agent);
        if (!preset) {
          setDockTestStatus(agentId, 'Test failed: no preset is configured.', true);
          return;
        }

        triggerButton.disabled = true;
        setDockTestStatus(agentId, 'Testing connection...');

        try {
          const sessionId = await ensureSession();
          const runtimeResponse = await requestJson('/sessions/' + sessionId + '/messages', {
            method: 'POST',
            body: JSON.stringify({
              presetId: preset.id,
              text: 'Connection test: reply with one short confirmation sentence.',
            }),
          });

          const responseText = normalizeText(runtimeResponse?.responseText);
          if (responseText.length === 0) {
            throw new Error('empty response');
          }

          setDockTestStatus(agentId, 'Connected at ' + formatTime(new Date().toISOString()) + '.');
          await refreshRuntimeEvents();
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown runtime failure';
          setDockTestStatus(agentId, 'Test failed: ' + message + '.', true);
        } finally {
          triggerButton.disabled = false;
        }
      };

      elements.presetSelect.addEventListener('change', (event) => {
        const selectedId = event.target.value;
        if (presets.some((preset) => preset.id === selectedId)) {
          state.selectedPresetId = selectedId;
        }
      });
      elements.runtimeRefresh.addEventListener('click', () => {
        void refreshRuntimeEvents();
      });
      elements.systemMessages?.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-system-message-close]') : null;
        if (!target) {
          return;
        }

        const messageId = target.getAttribute('data-system-message-id');
        if (!messageId) {
          return;
        }

        state.systemMessages = state.systemMessages.filter((message) => message.id !== messageId);
        renderSystemMessages();
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

      elements.dockCards.forEach((card) => {
        const selectCard = () => {
          const agentId = card.getAttribute('data-agent-id');
          if (!agentId || agentId === state.selectedAgentId) {
            return;
          }

          state.selectedAgentId = agentId;
          syncDockSelection();
          populateAgentForm();
        };

        card.addEventListener('click', selectCard);
        card.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            selectCard();
          }
        });
      });

      elements.dockTestButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();

          const card = button.closest('[data-dock-card]');
          if (!card) {
            return;
          }

          void runAgentConnectionTest(card, button);
        });
      });

      elements.agentSaveButton?.addEventListener('click', () => {
        const agent = state.agents.find((candidate) => candidate.id === state.selectedAgentId) ?? null;
        if (!agent || !elements.agentForm) {
          return;
        }

        const nameField = elements.agentForm.elements.namedItem('name');
        const descriptionField = elements.agentForm.elements.namedItem('description');
        const specialtyField = elements.agentForm.elements.namedItem('specialty');

        const nextName = normalizeText(nameField ? nameField.value : agent.name);
        const nextDescription = normalizeText(descriptionField ? descriptionField.value : agent.description);
        const nextSpecialty = normalizeText(specialtyField ? specialtyField.value : agent.specialty);

        agent.name = nextName.length > 0 ? nextName : agent.name;
        agent.description = nextDescription;
        agent.specialty = nextSpecialty.length > 0 ? nextSpecialty : agent.specialty;

        updateDockCard(agent);
        populateAgentForm();
        elements.agentSaveStatus.textContent = 'Saved changes for ' + agent.name + '.';
      });

      window.addEventListener('challenge:changed', (event) => {
        state.activeChallenge = event.detail ?? null;
        refreshSkillRelevance();
      });

      renderMessages();
      renderSystemMessages();
      renderActivity();
      renderRuntimeEvents();
      syncDockSelection();
      populateAgentForm();
      refreshSkillRelevance();
      void refreshSkillsFromRuntime();
      setPending(false, 'Runtime idle.');
    })();
  `;
}
