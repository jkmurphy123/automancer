import { describe, expect, it, vi } from 'vitest';

import { getAgentPresetById } from '../agents/presets.js';
import type { ChatMessage } from './messages.js';
import { LiveAgentRuntimeAdapter } from './live-adapter.js';

function makeUserMessage(text: string): ChatMessage {
  return {
    id: 'user-1',
    role: 'user',
    text,
    createdAt: '2026-04-02T12:00:00.000Z',
  };
}

class FakeGatewaySocket {
  public readyState = 0;

  private readonly listeners: {
    open: Array<() => void>;
    message: Array<(event: { data?: unknown }) => void>;
    error: Array<() => void>;
    close: Array<(event: { code?: number; reason?: string }) => void>;
  } = {
    open: [],
    message: [],
    error: [],
    close: [],
  };

  public sentFrames: string[] = [];

  public addEventListener(type: 'open', listener: () => void): void;
  public addEventListener(type: 'message', listener: (event: { data?: unknown }) => void): void;
  public addEventListener(type: 'error', listener: () => void): void;
  public addEventListener(type: 'close', listener: (event: { code?: number; reason?: string }) => void): void;
  public addEventListener(
    type: 'open' | 'message' | 'error' | 'close',
    listener:
      | (() => void)
      | ((event: { data?: unknown }) => void)
      | ((event: { code?: number; reason?: string }) => void),
  ): void {
    if (type === 'open' || type === 'error') {
      this.listeners[type].push(listener as () => void);
      return;
    }

    if (type === 'message') {
      this.listeners[type].push(listener as (event: { data?: unknown }) => void);
      return;
    }

    this.listeners[type].push(listener as (event: { code?: number; reason?: string }) => void);
  }

  public send(data: string): void {
    this.sentFrames.push(data);

    const frame = JSON.parse(data) as { id?: string; method?: string };
    if (!frame.id || !frame.method) {
      return;
    }

    if (frame.method === 'connect') {
      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: {
            type: 'hello-ok',
          },
        }),
      });
      return;
    }

    if (frame.method === 'chat.send') {
      const payload = JSON.parse(data) as {
        id: string;
        params?: {
          idempotencyKey?: string;
          sessionKey?: string;
        };
      };

      this.emit('message', {
        data: JSON.stringify({
          type: 'res',
          id: payload.id,
          ok: true,
          payload: {
            accepted: true,
          },
        }),
      });
      this.emit('message', {
        data: JSON.stringify({
          type: 'event',
          event: 'chat',
          payload: {
            sessionKey: payload.params?.sessionKey,
            runId: payload.params?.idempotencyKey,
            state: 'final',
            message: {
              content: [
                {
                  type: 'text',
                  text: 'openclaw gateway reply',
                },
              ],
            },
          },
        }),
      });
    }
  }

  public close(): void {
    this.readyState = 3;
  }

  public emit(type: 'open'): void;
  public emit(type: 'message', event: { data?: unknown }): void;
  public emit(type: 'error'): void;
  public emit(type: 'close', event: { code?: number; reason?: string }): void;
  public emit(type: 'open' | 'message' | 'error' | 'close', event?: unknown): void {
    if (type === 'open') {
      this.readyState = 1;
    }

    if (type === 'open' || type === 'error') {
      for (const listener of this.listeners[type]) {
        listener();
      }

      return;
    }

    if (type === 'message') {
      for (const listener of this.listeners[type]) {
        listener(event as { data?: unknown });
      }

      return;
    }

    for (const listener of this.listeners[type]) {
      listener(event as { code?: number; reason?: string });
    }
  }
}

describe('LiveAgentRuntimeAdapter', () => {
  it('uses live bridge response when configured and available', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: 'live bridge response',
          systemNote: 'Bridge handled request.',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'http://bridge.local/runtime',
      fetchImpl: fetchMock,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [
        {
          id: 'skill-plan-writer',
          name: 'plan_writer',
          displayName: 'Plan Writer',
          installed: true,
          enabled: true,
        },
      ],
    });

    expect(result.text).toBe('live bridge response');
    expect(result.runtimeSource).toBe('live_bridge');
    expect(result.systemNote).toContain('Bridge handled request.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://bridge.local/runtime');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('availableSkills');
  });

  it('adds bearer auth to HTTP bridge requests when token is configured', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          text: 'live bridge response',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'http://bridge.local/runtime',
      token: 'test-token',
      fetchImpl: fetchMock,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      authorization: 'Bearer test-token',
      'content-type': 'application/json',
    });
  });

  it('accepts richer HTTP payload shapes from the gateway', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            content: [
              {
                type: 'text',
                text: 'gateway nested response',
              },
            ],
          },
          note: 'nested note',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'http://bridge.local/runtime',
      fetchImpl: fetchMock,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    expect(result.text).toBe('gateway nested response');
    expect(result.systemNote).toContain('nested note');
    expect(result.runtimeSource).toBe('live_bridge');
  });

  it('uses native OpenClaw gateway websocket mode for ws endpoints', async () => {
    const socket = new FakeGatewaySocket();
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'ws://127.0.0.1:18789',
      token: 'gateway-token',
      origin: 'http://localhost:4173',
      sessionKey: 'main',
      webSocketFactory: (_url, options) => {
        expect(options).toEqual({ origin: 'http://localhost:4173' });
        return socket;
      },
      timeoutMs: 200,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const responsePromise = adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    socket.emit('open');

    const result = await responsePromise;

    expect(result.text).toBe('openclaw gateway reply');
    expect(result.runtimeSource).toBe('live_bridge');
    expect(result.systemNote).toContain('OpenClaw gateway session main.');
    expect(socket.sentFrames).toHaveLength(2);
    expect(socket.sentFrames[0]).toContain('"method":"connect"');
    expect(socket.sentFrames[0]).toContain('"token":"gateway-token"');
    expect(socket.sentFrames[1]).toContain('"method":"chat.send"');
    expect(socket.sentFrames[1]).toContain('"deliver":true');
    expect(socket.sentFrames[1]).toContain('"sessionKey":"main"');
  });

  it('accepts streamed gateway text when final event omits message content', async () => {
    const socket = new FakeGatewaySocket();
    socket.send = function send(data: string): void {
      this.sentFrames.push(data);

      const frame = JSON.parse(data) as { id?: string; method?: string };
      if (!frame.id || !frame.method) {
        return;
      }

      if (frame.method === 'connect') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.send') {
        const payload = JSON.parse(data) as {
          id: string;
          params?: {
            idempotencyKey?: string;
            sessionKey?: string;
          };
        };

        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: payload.id,
            ok: true,
            payload: {
              accepted: true,
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              sessionKey: payload.params?.sessionKey,
              runId: payload.params?.idempotencyKey,
              state: 'delta',
              message: {
                content: [
                  {
                    type: 'text',
                    text: 'openclaw ',
                  },
                ],
              },
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              sessionKey: payload.params?.sessionKey,
              runId: payload.params?.idempotencyKey,
              state: 'delta',
              message: {
                content: [
                  {
                    type: 'text',
                    text: 'gateway reply',
                  },
                ],
              },
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              sessionKey: payload.params?.sessionKey,
              runId: payload.params?.idempotencyKey,
              state: 'final',
            },
          }),
        });
      }
    };
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'ws://127.0.0.1:18789',
      sessionKey: 'main',
      webSocketFactory: () => socket,
      timeoutMs: 200,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const responsePromise = adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    socket.emit('open');

    const result = await responsePromise;

    expect(result.text).toBe('openclaw gateway reply');
    expect(result.runtimeSource).toBe('live_bridge');
  });

  it('uses chat.send response text when final event omits message and no deltas were streamed', async () => {
    const socket = new FakeGatewaySocket();
    socket.send = function send(data: string): void {
      this.sentFrames.push(data);

      const frame = JSON.parse(data) as { id?: string; method?: string };
      if (!frame.id || !frame.method) {
        return;
      }

      if (frame.method === 'connect') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.send') {
        const payload = JSON.parse(data) as {
          id: string;
          params?: {
            idempotencyKey?: string;
            sessionKey?: string;
          };
        };

        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: payload.id,
            ok: true,
            payload: {
              message: {
                content: [
                  {
                    type: 'text',
                    text: 'gateway response payload text',
                  },
                ],
              },
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              sessionKey: payload.params?.sessionKey,
              runId: payload.params?.idempotencyKey,
              state: 'final',
            },
          }),
        });
      }
    };
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'ws://127.0.0.1:18789',
      sessionKey: 'main',
      webSocketFactory: () => socket,
      timeoutMs: 200,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const responsePromise = adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    socket.emit('open');

    const result = await responsePromise;

    expect(result.text).toBe('gateway response payload text');
    expect(result.runtimeSource).toBe('live_bridge');
  });

  it('accepts native gateway canonical session keys and agent assistant deltas', async () => {
    const socket = new FakeGatewaySocket();
    socket.send = function send(data: string): void {
      this.sentFrames.push(data);

      const frame = JSON.parse(data) as { id?: string; method?: string };
      if (!frame.id || !frame.method) {
        return;
      }

      if (frame.method === 'connect') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.send') {
        const payload = JSON.parse(data) as {
          id: string;
          params?: {
            idempotencyKey?: string;
          };
        };

        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: payload.id,
            ok: true,
            payload: {
              accepted: true,
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'agent',
            payload: {
              runId: payload.params?.idempotencyKey,
              sessionKey: 'agent:main:main',
              stream: 'assistant',
              data: {
                text: 'P',
                delta: 'P',
              },
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'agent',
            payload: {
              runId: payload.params?.idempotencyKey,
              sessionKey: 'agent:main:main',
              stream: 'assistant',
              data: {
                text: 'PINEAPPLE',
                delta: 'INEAPPLE',
              },
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              runId: payload.params?.idempotencyKey,
              sessionKey: 'agent:main:main',
              state: 'final',
              message: {
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: 'PINEAPPLE',
                  },
                ],
              },
            },
          }),
        });
      }
    };
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'ws://127.0.0.1:18789',
      sessionKey: 'main',
      webSocketFactory: () => socket,
      timeoutMs: 200,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const responsePromise = adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    socket.emit('open');

    const result = await responsePromise;

    expect(result.text).toBe('PINEAPPLE');
    expect(result.runtimeSource).toBe('live_bridge');
  });

  it('falls back to chat history when final event has no text and no stream text was captured', async () => {
    const socket = new FakeGatewaySocket();
    socket.send = function send(data: string): void {
      this.sentFrames.push(data);

      const frame = JSON.parse(data) as { id?: string; method?: string; params?: { idempotencyKey?: string } };
      if (!frame.id || !frame.method) {
        return;
      }

      if (frame.method === 'connect') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.send') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              runId: frame.params?.idempotencyKey,
              status: 'started',
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              runId: frame.params?.idempotencyKey,
              sessionKey: 'agent:main:main',
              state: 'final',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.history') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              messages: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'older prompt',
                    },
                  ],
                },
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: 'older response',
                    },
                  ],
                },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'what should I do next?',
                    },
                  ],
                },
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'text',
                      text: 'history fallback response',
                    },
                  ],
                },
              ],
            },
          }),
        });
      }
    };
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'ws://127.0.0.1:18789',
      sessionKey: 'main',
      webSocketFactory: () => socket,
      timeoutMs: 200,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const responsePromise = adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    socket.emit('open');

    const result = await responsePromise;

    expect(result.text).toBe('history fallback response');
    expect(result.runtimeSource).toBe('live_bridge');
    expect(socket.sentFrames.some((frame) => frame.includes('"method":"chat.history"'))).toBe(true);
  });

  it('waits for the matching assistant reply instead of returning the previous history turn', async () => {
    const socket = new FakeGatewaySocket();
    let historyRequestCount = 0;
    socket.send = function send(data: string): void {
      this.sentFrames.push(data);

      const frame = JSON.parse(data) as { id?: string; method?: string; params?: { idempotencyKey?: string } };
      if (!frame.id || !frame.method) {
        return;
      }

      if (frame.method === 'connect') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              type: 'hello-ok',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.send') {
        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: {
              runId: frame.params?.idempotencyKey,
              status: 'started',
            },
          }),
        });
        this.emit('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'chat',
            payload: {
              runId: frame.params?.idempotencyKey,
              sessionKey: 'agent:main:main',
              state: 'final',
            },
          }),
        });
        return;
      }

      if (frame.method === 'chat.history') {
        historyRequestCount += 1;
        const messages =
          historyRequestCount === 1
            ? [
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'older prompt' }],
                },
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'older response' }],
                },
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'what should I do next?' }],
                },
              ]
            : [
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'older prompt' }],
                },
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'older response' }],
                },
                {
                  role: 'user',
                  content: [{ type: 'text', text: 'what should I do next?' }],
                },
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'current response' }],
                },
              ];

        this.emit('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: true,
            payload: { messages },
          }),
        });
      }
    };
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'ws://127.0.0.1:18789',
      sessionKey: 'main',
      webSocketFactory: () => socket,
      timeoutMs: 400,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const responsePromise = adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('what should I do next?'),
      conversation: [],
      availableSkills: [],
    });

    socket.emit('open');

    const result = await responsePromise;

    expect(result.text).toBe('current response');
    expect(historyRequestCount).toBe(2);
  });

  it('falls back deterministically when endpoint is not configured', async () => {
    const adapter = new LiveAgentRuntimeAdapter({ latencyMs: 0 });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
      availableSkills: [],
    });

    expect(result.text).toContain('small step');
    expect(result.runtimeSource).toBe('live_fallback');
    expect(result.systemNote).toContain('not configured');
    expect(result.systemNote).toContain('fallback mode active');
  });

  it('retries bridge request and falls back when bridge is unavailable', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('connection refused'));
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'http://bridge.local/runtime',
      fetchImpl: fetchMock,
      maxAttempts: 2,
      retryDelayMs: 0,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
      availableSkills: [],
    });

    expect(result.text).toContain('small step');
    expect(result.runtimeSource).toBe('live_fallback');
    expect(result.systemNote).toContain('unavailable after 2 attempt(s)');
    expect(result.systemNote).toContain('fallback mode active');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back after timeout and includes timeout reason in system note', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      await new Promise<void>((resolve, reject) => {
        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });

      return new Response();
    });
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'http://bridge.local/runtime',
      fetchImpl: fetchMock,
      timeoutMs: 10,
      maxAttempts: 1,
      retryDelayMs: 0,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
      availableSkills: [],
    });

    expect(result.text).toContain('small step');
    expect(result.runtimeSource).toBe('live_fallback');
    expect(result.systemNote).toContain('timed out');
    expect(result.systemNote).toContain('fallback mode active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back when live bridge returns invalid payload shape', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: {
            unsupported: true,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    const adapter = new LiveAgentRuntimeAdapter({
      endpoint: 'http://bridge.local/runtime',
      fetchImpl: fetchMock,
      maxAttempts: 1,
      retryDelayMs: 0,
      latencyMs: 0,
    });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
      availableSkills: [],
    });

    expect(result.text).toContain('small step');
    expect(result.runtimeSource).toBe('live_fallback');
    expect(result.systemNote).toContain('invalid payload shape');
    expect(result.systemNote).toContain('fallback mode active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
