import { describe, expect, it } from 'vitest';

import { createChatMessage, formatClockTime } from './messages.js';

describe('createChatMessage', () => {
  it('creates deterministic message objects when dependencies are injected', () => {
    const message = createChatMessage(
      {
        role: 'user',
        text: 'Help me with this challenge.',
      },
      {
        createId: () => 'msg-fixed-id',
        now: () => new Date('2026-04-02T12:30:00.000Z'),
      },
    );

    expect(message).toEqual({
      id: 'msg-fixed-id',
      role: 'user',
      text: 'Help me with this challenge.',
      createdAt: '2026-04-02T12:30:00.000Z',
    });
  });
});

describe('formatClockTime', () => {
  it('formats timestamps as HH:MM and handles invalid values', () => {
    expect(formatClockTime('2026-04-02T03:07:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    expect(formatClockTime('not-a-date')).toBe('--:--');
  });
});
