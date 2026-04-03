import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it } from 'vitest';

process.env.OPENCLAW_INSTALLED_SKILLS = 'plan_writer,repo_search,qa_handoff';
const { startServer } = (await import('../index.js')) as {
  startServer: (port?: number) => import('node:http').Server;
};

interface RuntimeSessionCreatedResponse {
  sessionId: string;
  runtimeMode: 'mock' | 'live';
  startedAt: string;
  skillSource: string;
}

interface RuntimeApiErrorResponse {
  error: string;
}

interface RuntimeMessageResponse {
  requestId: string;
  durationMs: number;
  responseText: string;
  systemNote?: string;
  runtimeSource: 'mock' | 'live_bridge' | 'live_fallback';
}

interface RuntimeSkillResponse {
  requestId: string;
  durationMs: number;
  result: {
    summary: string;
    chatResponse: string;
    systemNote?: string;
  };
}

interface RuntimeEventsResponse {
  sessionId: string;
  events: Array<{
    id: string;
    type: string;
    requestId: string;
  }>;
}

interface RuntimeSkillsResponse {
  detectedAt: string;
  source: string;
  skills: Array<{ id: string; displayName: string; enabled: boolean; installed: boolean }>;
}

interface TestServerHandle {
  baseUrl: string;
  close: () => Promise<void>;
}

async function createTestServer(): Promise<TestServerHandle> {
  const server = startServer(0);

  await new Promise<void>((resolve) => {
    server.once('listening', () => {
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    close: async () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

const serverHandles: TestServerHandle[] = [];

afterEach(async () => {
  while (serverHandles.length > 0) {
    const handle = serverHandles.pop();
    if (handle) {
      await handle.close();
    }
  }
});

describe('runtime API contract', () => {
  it('returns runtime skills inventory', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const response = await fetch(`${server.baseUrl}/api/runtime/skills`);
    const payload = await readJson<RuntimeSkillsResponse>(response);

    expect(response.status).toBe(200);
    expect(payload.detectedAt).toEqual(expect.any(String));
    expect(payload.source).toEqual(expect.any(String));
    expect(payload.skills.length).toBeGreaterThan(0);
    expect(payload.skills[0]).toMatchObject({
      id: expect.any(String),
      displayName: expect.any(String),
      enabled: expect.any(Boolean),
      installed: expect.any(Boolean),
    });
  });

  it('creates a runtime session in mock mode by default and supports live mode explicitly', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const defaultResponse = await fetch(`${server.baseUrl}/api/runtime/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const defaultPayload = await readJson<RuntimeSessionCreatedResponse>(defaultResponse);

    expect(defaultResponse.status).toBe(201);
    expect(defaultPayload.runtimeMode).toBe('mock');
    expect(defaultPayload.sessionId).toEqual(expect.any(String));

    const liveResponse = await fetch(`${server.baseUrl}/api/runtime/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        runtimeMode: 'live',
      }),
    });
    const livePayload = await readJson<RuntimeSessionCreatedResponse>(liveResponse);

    expect(liveResponse.status).toBe(201);
    expect(livePayload.runtimeMode).toBe('live');
    expect(livePayload.sessionId).toEqual(expect.any(String));
  });

  it('returns 400 when creating a session with invalid JSON body', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const response = await fetch(`${server.baseUrl}/api/runtime/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: '{"runtimeMode"',
    });
    const payload = await readJson<RuntimeApiErrorResponse>(response);

    expect(response.status).toBe(400);
    expect(payload.error).toContain('valid JSON');
  });

  it('sends messages and validates required fields', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const sessionResponse = await fetch(`${server.baseUrl}/api/runtime/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const session = await readJson<RuntimeSessionCreatedResponse>(sessionResponse);

    const successResponse = await fetch(`${server.baseUrl}/api/runtime/sessions/${session.sessionId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        presetId: 'tutor',
        text: 'Break this down',
      }),
    });
    const successPayload = await readJson<RuntimeMessageResponse>(successResponse);
    expect(successResponse.status).toBe(200);
    expect(successPayload).toMatchObject({
      requestId: expect.any(String),
      durationMs: expect.any(Number),
      responseText: expect.any(String),
      runtimeSource: expect.any(String),
    });

    const invalidBodyResponse = await fetch(`${server.baseUrl}/api/runtime/sessions/${session.sessionId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        presetId: 'tutor',
      }),
    });
    const invalidBodyPayload = await readJson<RuntimeApiErrorResponse>(invalidBodyResponse);
    expect(invalidBodyResponse.status).toBe(400);
    expect(invalidBodyPayload.error).toContain('required');
  });

  it('returns 404 when posting messages to a missing session', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const response = await fetch(`${server.baseUrl}/api/runtime/sessions/missing-session/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        presetId: 'tutor',
        text: 'hello',
      }),
    });
    const payload = await readJson<RuntimeApiErrorResponse>(response);

    expect(response.status).toBe(404);
    expect(payload.error).toContain('Session not found');
  });

  it('executes skills and handles missing-session and disabled-skill failures', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const sessionResponse = await fetch(`${server.baseUrl}/api/runtime/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const session = await readJson<RuntimeSessionCreatedResponse>(sessionResponse);

    const successResponse = await fetch(
      `${server.baseUrl}/api/runtime/sessions/${session.sessionId}/skills/skill-plan-writer/execute`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          parameters: {
            objective: 'Ship runtime coverage',
          },
          activeChallengeId: 'AUT-7',
        }),
      },
    );
    const successPayload = await readJson<RuntimeSkillResponse>(successResponse);
    expect(successResponse.status).toBe(200);
    expect(successPayload.result.summary).toContain('AUT-7');

    const disabledSkillResponse = await fetch(
      `${server.baseUrl}/api/runtime/sessions/${session.sessionId}/skills/skill-qa-handoff/execute`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          parameters: {},
          activeChallengeId: null,
        }),
      },
    );
    const disabledSkillPayload = await readJson<RuntimeApiErrorResponse>(disabledSkillResponse);
    expect(disabledSkillResponse.status).toBe(400);
    expect(disabledSkillPayload.error).toContain('disabled');

    const missingSessionResponse = await fetch(
      `${server.baseUrl}/api/runtime/sessions/missing-session/skills/skill-plan-writer/execute`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          parameters: {},
        }),
      },
    );
    const missingSessionPayload = await readJson<RuntimeApiErrorResponse>(missingSessionResponse);
    expect(missingSessionResponse.status).toBe(404);
    expect(missingSessionPayload.error).toContain('Session not found');
  });

  it('returns session events and missing-session errors for events route', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const sessionResponse = await fetch(`${server.baseUrl}/api/runtime/sessions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const session = await readJson<RuntimeSessionCreatedResponse>(sessionResponse);

    await fetch(`${server.baseUrl}/api/runtime/sessions/${session.sessionId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        presetId: 'tutor',
        text: 'Collect event telemetry',
      }),
    });

    const successResponse = await fetch(`${server.baseUrl}/api/runtime/sessions/${session.sessionId}/events?limit=5`);
    const successPayload = await readJson<RuntimeEventsResponse>(successResponse);
    expect(successResponse.status).toBe(200);
    expect(successPayload.sessionId).toBe(session.sessionId);
    expect(successPayload.events.length).toBeGreaterThan(0);
    expect(successPayload.events[0]).toMatchObject({
      id: expect.any(String),
      type: expect.any(String),
      requestId: expect.any(String),
    });

    const missingSessionResponse = await fetch(`${server.baseUrl}/api/runtime/sessions/does-not-exist/events`);
    const missingSessionPayload = await readJson<RuntimeApiErrorResponse>(missingSessionResponse);
    expect(missingSessionResponse.status).toBe(404);
    expect(missingSessionPayload.error).toContain('Session not found');
  });

  it('returns 404 for unknown runtime routes', async () => {
    const server = await createTestServer();
    serverHandles.push(server);

    const response = await fetch(`${server.baseUrl}/api/runtime/does-not-exist`);
    const payload = await readJson<RuntimeApiErrorResponse>(response);

    expect(response.status).toBe(404);
    expect(payload.error).toContain('not found');
  });
});
