import { describe, expect, it } from 'vitest';

import { getSampleAppState, renderAppShellHtml } from './index.js';

describe('getSampleAppState', () => {
  it('provides milestone 4 skill registry config alongside challenge fixtures', () => {
    const state = getSampleAppState();

    expect(state.agents.length).toBeGreaterThan(0);
    expect(state.agentPresets.length).toBeGreaterThanOrEqual(2);
    expect(state.challengeCatalog.challenges.length).toBeGreaterThanOrEqual(8);
    expect(state.challengeCatalog.byId[state.challengeCatalog.defaultChallengeId]).toBeDefined();
    expect(state.chatSession.initialMessages.length).toBeGreaterThan(0);
    expect(state.skillRail.skills.length).toBeGreaterThan(0);
    expect(state.skillRail.skills[0]).toMatchObject({
      id: expect.any(String),
      displayName: expect.any(String),
      parameters: expect.any(Array),
    });
  });
});

describe('renderAppShellHtml', () => {
  it('renders challenge and chat interactions with module markers', () => {
    const html = renderAppShellHtml();

    expect(html).toContain('Agent Dock');
    expect(html).toContain('Chat + Skills');
    expect(html).toContain('Challenge Board');
    expect(html).toContain('Send Message');
    expect(html).toContain('Agent preset');
    expect(html).toContain('Run Skill');
    expect(html).toContain('Skill Activity');
    expect(html).toContain('data-module="ui"');
    expect(html).toContain('data-module="agents"');
    expect(html).toContain('data-module="challenges"');
    expect(html).toContain('data-module="skills"');
    expect(html).toContain('Reveal Next Hint');
    expect(html).toContain('Check Completion');
  });
});
