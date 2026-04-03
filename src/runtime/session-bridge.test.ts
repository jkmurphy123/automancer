import { describe, expect, it } from 'vitest';

import type { SkillMetadata } from '../skills/sample-data.js';
import { RuntimeSessionBridge } from './session-bridge.js';

const installedSkill: SkillMetadata = {
  id: 'skill-plan-writer',
  name: 'plan_writer',
  displayName: 'Plan Writer',
  description: 'Plan writer',
  category: 'planning',
  parameters: [],
  examples: [],
  risk: 'low',
  installed: true,
  enabled: true,
  relevanceRules: [],
};

describe('RuntimeSessionBridge', () => {
  it('creates sessions and returns runtime events for message flow', async () => {
    const bridge = new RuntimeSessionBridge([installedSkill]);
    const session = bridge.createSession('mock', []);

    const result = await bridge.sendMessage(session.id, 'tutor', 'break this into steps');

    expect(result.responseText).toContain('small step');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const events = bridge.getSessionEvents(session.id, 20);
    expect(events.some((event) => event.type === 'message_completed')).toBe(true);
  });

  it('executes installed skills and records completion', async () => {
    const bridge = new RuntimeSessionBridge([installedSkill]);
    const session = bridge.createSession('mock', []);

    const result = await bridge.executeSkill(session.id, 'skill-plan-writer', { objective: 'Ship milestone' }, 'AUT-19');

    expect(result.result.summary).toContain('AUT-19');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const events = bridge.getSessionEvents(session.id, 20);
    expect(events.some((event) => event.type === 'skill_completed')).toBe(true);
  });

  it('fails when executing a disabled skill', async () => {
    const bridge = new RuntimeSessionBridge([
      {
        ...installedSkill,
        id: 'skill-qa-handoff',
        name: 'qa_handoff',
        displayName: 'QA Handoff',
        enabled: false,
      },
    ]);
    const session = bridge.createSession('mock', []);

    await expect(bridge.executeSkill(session.id, 'skill-qa-handoff', {}, null)).rejects.toThrow('disabled');

    const events = bridge.getSessionEvents(session.id, 20);
    expect(events.some((event) => event.type === 'skill_failed')).toBe(true);
  });

  it('evicts old messages and events when session caps are exceeded', async () => {
    const bridge = new RuntimeSessionBridge([installedSkill], {
      maxEventsPerSession: 4,
      maxMessagesPerSession: 5,
    });
    const session = bridge.createSession('mock', []);

    for (let i = 0; i < 4; i += 1) {
      await bridge.sendMessage(session.id, 'tutor', `message-${i}`);
    }

    const persistedSession = bridge.getSession(session.id);
    expect(persistedSession).toBeDefined();
    expect(persistedSession?.messages.length).toBe(5);
    expect(persistedSession?.messages.some((message) => message.text === 'message-0')).toBe(false);

    const events = bridge.getSessionEvents(session.id, 20);
    expect(events.length).toBe(4);
    expect(events.every((event) => event.type !== 'session_started')).toBe(true);
  });
});
