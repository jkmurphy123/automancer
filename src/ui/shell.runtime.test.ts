import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { getSampleAppState } from '../index.js';
import { createChatSessionConfig } from '../runtime/index.js';
import { renderAppShell } from './shell.js';

interface DomHarness {
  calls: string[];
  messageBodies: Array<{ presetId?: string; text?: string }>;
  dom: JSDOM;
}

const openWindows: Array<{ close: () => void }> = [];

function jsonResponse(payload: unknown): { ok: true; json: () => Promise<unknown> } {
  return {
    ok: true,
    json: async () => payload,
  };
}

function createDom(preloadedProfile?: string): DomHarness {
  const appState = getSampleAppState();
  appState.chatSession = createChatSessionConfig('mock', true);
  const runtimeSkills = appState.skillRail.skills.map((skill) =>
    skill.id === 'skill-plan-writer' ? { ...skill, installed: true, enabled: true } : skill,
  );
  const html = renderAppShell(appState);
  const calls: string[] = [];
  const messageBodies: Array<{ presetId?: string; text?: string }> = [];
  const sessionId = 'session-1';

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
    beforeParse(window: { localStorage: { setItem: (k: string, v: string) => void }; fetch?: unknown }): void {
      if (preloadedProfile) {
        window.localStorage.setItem('openclawTutorProfile.v1', preloadedProfile);
      }

      window.fetch = async (input: unknown, init?: { method?: string; body?: string }): Promise<unknown> => {
        const method = init?.method ?? 'GET';
        const url = String(input);
        calls.push(`${method} ${url}`);

        if (url.endsWith('/api/runtime/skills') && method === 'GET') {
          return jsonResponse({ skills: runtimeSkills });
        }

        if (url.endsWith('/api/runtime/sessions') && method === 'POST') {
          return jsonResponse({ sessionId });
        }

        if (url.endsWith(`/api/runtime/sessions/${sessionId}/messages`) && method === 'POST') {
          const payload = typeof init?.body === 'string' ? (JSON.parse(init.body) as { presetId?: string; text?: string }) : {};
          messageBodies.push(payload);
          return jsonResponse({
            responseText: 'Assistant says hi',
            systemNote: 'mock system note',
          });
        }

        if (url.endsWith(`/api/runtime/sessions/${sessionId}/skills/skill-plan-writer/execute`) && method === 'POST') {
          return jsonResponse({
            requestId: 'req-12345678',
            durationMs: 12,
            result: {
              summary: 'Plan created',
              chatResponse: 'Plan Writer result',
              systemNote: 'skill system note',
            },
          });
        }

        if (url.includes(`/api/runtime/sessions/${sessionId}/events?limit=20`) && method === 'GET') {
          return jsonResponse({
            events: [
              {
                type: 'runtime_message',
                createdAt: '2026-04-03T12:00:00.000Z',
                requestId: 'req-12345678',
                details: {
                  status: 'ok',
                },
              },
            ],
          });
        }

        return jsonResponse({});
      };
    },
  });

  openWindows.push(dom.window as unknown as { close: () => void });
  return { calls, messageBodies, dom };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  while (openWindows.length > 0) {
    const next = openWindows.pop();
    next?.close();
  }
});

describe('renderAppShell runtime behaviors', () => {
  it('shows initial runtime mode system message and allows dismissing it', async () => {
    const { dom } = createDom();
    const { document } = dom.window;

    await flush();

    const systemMessages = document.querySelector('[data-system-messages]');
    const closeButton = document.querySelector('[data-system-message-close]') as (Element & { click: () => void }) | null;

    expect(systemMessages?.textContent).toContain('App running in MOCK mode');
    expect(closeButton).toBeTruthy();

    closeButton!.click();
    await flush();

    expect(systemMessages?.textContent?.trim()).toBe('');
  });

  it('switches selected dock agent and saves editable agent fields', async () => {
    const { dom } = createDom();
    const { document } = dom.window;

    await flush();

    const dockCard = document.querySelector('[data-dock-card][data-agent-id="agent-01"]') as
      | (Element & { click: () => void })
      | null;
    const nameField = document.querySelector('[data-agent-field="name"]') as (Element & { value: string }) | null;
    const descriptionField = document.querySelector('[data-agent-field="description"]') as (Element & { value: string }) | null;
    const specialtyField = document.querySelector('[data-agent-field="specialty"]') as (Element & { value: string }) | null;
    const saveButton = document.querySelector('[data-agent-save]') as (Element & { click: () => void }) | null;

    expect(dockCard).toBeTruthy();
    expect(nameField).toBeTruthy();
    expect(descriptionField).toBeTruthy();
    expect(specialtyField).toBeTruthy();
    expect(saveButton).toBeTruthy();

    dockCard!.click();
    nameField!.value = 'Workflow Coach';
    descriptionField!.value = 'Coordinates practical next steps.';
    specialtyField!.value = 'Execution planning';
    saveButton!.click();

    expect((document.querySelector('[data-agent-name]') as { textContent?: string } | null)?.textContent).toContain('Workflow Coach');
    expect((document.querySelector('[data-agent-specialty]') as { textContent?: string } | null)?.textContent).toContain(
      'Execution planning',
    );
    expect((document.querySelector('[data-agent-field="description"]') as { value?: string } | null)?.value).toContain(
      'Coordinates practical next steps.',
    );
    expect(document.querySelector('[data-agent-save-status]')?.textContent).toContain('Saved changes for Workflow Coach.');
  });

  it('progresses challenge completion, unlocks prerequisite challenge, and restores profile state', async () => {
    const { dom } = createDom();
    const { document, localStorage } = dom.window;

    await flush();

    const prerequisiteLockedOption = document.querySelector('option[data-challenge-id="T1-PLN-04"]') as
      | (Element & { disabled: boolean })
      | null;
    expect(prerequisiteLockedOption?.disabled).toBe(true);

    const submissionInput = document.querySelector('[data-submission-input]') as (Element & { value: string }) | null;
    const submitButton = document.querySelector('[data-submit-button]') as (Element & { click: () => void }) | null;
    const profileName = document.querySelector('[data-profile-name]') as (Element & { value: string }) | null;
    const profileSave = document.querySelector('[data-profile-save]') as (Element & { click: () => void }) | null;

    expect(submissionInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
    expect(profileName).toBeTruthy();
    expect(profileSave).toBeTruthy();

    submissionInput!.value = 'Goal: improve answer quality. Audience: a new learner. Constraint: keep it short.';
    submitButton!.click();

    const feedback = document.querySelector('[data-validation-feedback]');
    const progressCompleted = document.querySelector('[data-progress-completed]');

    expect(feedback?.textContent).toContain('Challenge completed. Keyword criteria satisfied.');
    expect(progressCompleted?.textContent).toContain('1/8');
    const prerequisiteUnlockedOption = document.querySelector('option[data-challenge-id="T1-PLN-04"]') as
      | (Element & { disabled: boolean })
      | null;
    expect(prerequisiteUnlockedOption?.disabled).toBe(false);

    profileName!.value = 'Alex';
    profileSave!.click();

    const storedProfile = localStorage.getItem('openclawTutorProfile.v1');
    expect(storedProfile).toBeTruthy();

    const { dom: restoredDom } = createDom(storedProfile!);
    await flush();

    const restoredDocument = restoredDom.window.document;
    expect((restoredDocument.querySelector('[data-profile-name]') as { value?: string } | null)?.value).toBe('Alex');
    expect(restoredDocument.querySelector('[data-progress-completed]')?.textContent).toContain('1/8');
  });

  it('sends a chat message and refreshes runtime events', async () => {
    const { calls, messageBodies, dom } = createDom();
    const { document } = dom.window;

    await flush();

    const chatInput = document.querySelector('[data-chat-input]') as (Element & { value: string }) | null;
    const sendButton = document.querySelector('[data-chat-send]') as (Element & { click: () => void }) | null;
    const refreshButton = document.querySelector('[data-runtime-refresh]') as (Element & { click: () => void }) | null;

    expect(chatInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
    expect(refreshButton).toBeTruthy();

    chatInput!.value = 'Hello runtime';
    sendButton!.click();

    await flush();
    await flush();

    const thread = document.querySelector('[data-chat-thread]');
    const status = document.querySelector('[data-chat-runtime-status]');

    expect(thread?.textContent).toContain('Assistant says hi');
    expect(status?.textContent).toContain('Response received');

    refreshButton!.click();
    await flush();

    const runtimeEvents = document.querySelector('[data-runtime-events]');
    expect(runtimeEvents?.textContent).toContain('runtime_message');

    expect(calls.some((entry) => entry === 'POST /api/runtime/sessions')).toBe(true);
    expect(calls.some((entry) => entry === 'POST /api/runtime/sessions/session-1/messages')).toBe(true);
    expect(calls.some((entry) => entry === 'GET /api/runtime/sessions/session-1/events?limit=20')).toBe(true);
    const runtimeMessagePayload = messageBodies.at(-1);
    expect(runtimeMessagePayload?.text).toContain('Use the active challenge context below to ground your response.');
    expect(runtimeMessagePayload?.text).toContain('Challenge ID:');
    expect(runtimeMessagePayload?.text).toContain('Learner message:\nHello runtime');
  });

  it('executes a skill and appends activity + chat output', async () => {
    const { calls, dom } = createDom();
    const { document } = dom.window;

    await flush();

    const runButton = document.querySelector('[data-skill-id="skill-plan-writer"] [data-skill-run]') as
      | (Element & { click: () => void })
      | null;
    expect(runButton).toBeTruthy();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await flush();
      if (!(runButton as { disabled?: boolean }).disabled) {
        break;
      }
    }
    expect((runButton as { disabled?: boolean } | null)?.disabled).toBe(false);

    runButton!.click();

    let activityText = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await flush();
      activityText = document.querySelector('[data-skill-activity]')?.textContent ?? '';
      if (activityText.includes('Plan created')) {
        break;
      }
    }

    const activity = document.querySelector('[data-skill-activity]');
    const thread = document.querySelector('[data-chat-thread]');
    const status = document.querySelector('[data-chat-runtime-status]');

    expect(calls).toContain('POST /api/runtime/sessions/session-1/skills/skill-plan-writer/execute');
    expect(activity?.textContent).toContain('Plan created');
    expect(thread?.textContent).toContain('Plan Writer result');
    expect(status?.textContent).toContain('completed');
  });

  it('runs an agent dock connection test and reports connected status', async () => {
    const { calls, dom } = createDom();
    const { document } = dom.window;

    await flush();

    const testButton = document.querySelector('[data-dock-card][data-agent-id="agent-01"] [data-agent-test]') as
      | (Element & { click: () => void })
      | null;
    const testStatus = document.querySelector('[data-dock-card][data-agent-id="agent-01"] [data-agent-test-status]');

    expect(testButton).toBeTruthy();
    expect(testStatus?.textContent).toContain('Not tested yet.');

    testButton!.click();

    await flush();
    await flush();

    expect(calls.filter((entry) => entry === 'POST /api/runtime/sessions/session-1/messages').length).toBeGreaterThan(0);
    expect(testStatus?.textContent).toContain('Connected at');
  });
});
