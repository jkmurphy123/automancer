import { describe, expect, it } from 'vitest';

import { getAgentPresetById } from '../agents/presets.js';
import type { ChatMessage } from './messages.js';
import { MockAgentRuntimeAdapter } from './mock-adapter.js';

function makeUserMessage(text: string): ChatMessage {
  return {
    id: 'user-1',
    role: 'user',
    text,
    createdAt: '2026-04-02T12:00:00.000Z',
  };
}

describe('MockAgentRuntimeAdapter', () => {
  it('returns deterministic per-preset behavior', async () => {
    const adapter = new MockAgentRuntimeAdapter({ latencyMs: 0 });
    const tutor = getAgentPresetById('tutor');
    const researcher = getAgentPresetById('researcher');

    expect(tutor).toBeDefined();
    expect(researcher).toBeDefined();

    const tutorReply = await adapter.sendMessage({
      preset: tutor!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
    });

    const researcherReply = await adapter.sendMessage({
      preset: researcher!,
      userMessage: makeUserMessage('organize this challenge'),
      conversation: [],
    });

    expect(tutorReply.text).toContain('small step');
    expect(researcherReply.text).toContain('Evidence-first summary');
    expect(tutorReply.text).not.toEqual(researcherReply.text);
  });

  it('surfaces predictable error for failure state testing', async () => {
    const adapter = new MockAgentRuntimeAdapter({ latencyMs: 0 });
    const tutor = getAgentPresetById('tutor');

    await expect(
      adapter.sendMessage({
        preset: tutor!,
        userMessage: makeUserMessage('__mock_error__'),
        conversation: [],
      }),
    ).rejects.toThrow('__mock_error__');
  });
});
