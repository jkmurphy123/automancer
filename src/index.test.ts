import { describe, expect, it } from 'vitest';

import { getSampleAppState, renderAppShellHtml } from './index.js';

describe('getSampleAppState', () => {
  it('provides placeholder records for all modules', () => {
    const state = getSampleAppState();

    expect(state.agents.length).toBeGreaterThan(0);
    expect(state.challenge.id).toBe('AUT-22');
    expect(state.chatAndSkills.controls.length).toBeGreaterThan(0);
  });
});

describe('renderAppShellHtml', () => {
  it('renders all three milestone panels and module markers', () => {
    const html = renderAppShellHtml();

    expect(html).toContain('Agent Dock');
    expect(html).toContain('Chat + Skills');
    expect(html).toContain('Tutor UI Milestone 2 Readiness');
    expect(html).toContain('data-module="ui"');
    expect(html).toContain('data-module="agents"');
    expect(html).toContain('data-module="challenges"');
    expect(html).toContain('data-module="skills"');
  });
});
