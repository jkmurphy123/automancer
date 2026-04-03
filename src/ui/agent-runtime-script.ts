import type { AgentPreset } from '../agents/presets.js';
import type { ChatSessionConfig } from '../runtime/index.js';
import type { ChatMessage } from '../runtime/messages.js';
import type { SkillRailState } from '../skills/sample-data.js';
import { serializeForInlineScript } from './inline-script.js';

export function renderAgentInteractionScript(
  chatSession: ChatSessionConfig,
  presets: AgentPreset[],
  skillRail: SkillRailState,
  runtimeBridgeBasePath: string,
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
        activeChallenge: null,
        activity: [],
        runtimeEvents: [],
      };

      const elements = {
        thread: document.querySelector('[data-chat-thread]'),
        presetSelect: document.querySelector('[data-agent-preset-select]'),
        chatInput: document.querySelector('[data-chat-input]'),
        sendButton: document.querySelector('[data-chat-send]'),
        status: document.querySelector('[data-chat-runtime-status]'),
        skillCards: document.querySelectorAll('[data-skill-id]'),
        activity: document.querySelector('[data-skill-activity]'),
        runtimeEvents: document.querySelector('[data-runtime-events]'),
        runtimeRefresh: document.querySelector('[data-runtime-refresh]'),
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
      elements.runtimeRefresh.addEventListener('click', () => {
        void refreshRuntimeEvents();
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
      renderRuntimeEvents();
      refreshSkillRelevance();
      void refreshSkillsFromRuntime();
      setPending(false, 'Runtime idle.');
    })();
  `;
}
