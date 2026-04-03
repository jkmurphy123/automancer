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
    });

    expect(result.text).toBe('live bridge response');
    expect(result.systemNote).toContain('Bridge handled request.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://bridge.local/runtime');
  });

  it('falls back deterministically when endpoint is not configured', async () => {
    const adapter = new LiveAgentRuntimeAdapter({ latencyMs: 0 });
    const tutor = getAgentPresetById('tutor');

    expect(tutor).toBeDefined();

    const result = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
    });

    expect(result.text).toContain('small step');
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
    });

    expect(result.text).toContain('small step');
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
    });

    expect(result.text).toContain('small step');
    expect(result.systemNote).toContain('timed out');
    expect(result.systemNote).toContain('fallback mode active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back when live bridge returns invalid payload shape', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'missing text',
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
    });

    expect(result.text).toContain('small step');
    expect(result.systemNote).toContain('invalid payload shape');
    expect(result.systemNote).toContain('fallback mode active');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
