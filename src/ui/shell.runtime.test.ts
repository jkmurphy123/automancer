import { afterEach, describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';

import { getSampleAppState } from '../index.js';
import { renderAppShell } from './shell.js';

interface DomHarness {
  calls: string[];
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
  const runtimeSkills = appState.skillRail.skills.map((skill) =>
    skill.id === 'skill-plan-writer' ? { ...skill, installed: true, enabled: true } : skill,
  );
  const html = renderAppShell(appState);
  const calls: string[] = [];
  const sessionId = 'session-1';

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/',
    pretendToBeVisual: true,
    beforeParse(window: { localStorage: { setItem: (k: string, v: string) => void }; fetch?: unknown }): void {
      if (preloadedProfile) {
        window.localStorage.setItem('openclawTutorProfile.v1', preloadedProfile);
      }

      window.fetch = async (input: unknown, init?: { method?: string }): Promise<unknown> => {
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
  return { calls, dom };
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
  it('progresses challenge completion, unlocks prerequisite challenge, and restores profile state', async () => {
    const { dom } = createDom();
    const { document, localStorage } = dom.window;

    await flush();

    const prerequisiteLockedButton = document.querySelector('button[data-challenge-id="T1-PLN-04"]') as
      | (Element & { disabled: boolean })
      | null;
    expect(prerequisiteLockedButton?.disabled).toBe(true);

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
    expect(prerequisiteLockedButton?.disabled).toBe(false);

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
    const { calls, dom } = createDom();
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
});
