import { describe, expect, it } from 'vitest';

import { createChallengeCatalog } from '../challenges/loader.js';
import { resolveSkillRelevanceHint, sampleSkillRail } from './sample-data.js';

describe('sampleSkillRail', () => {
  it('normalizes skill metadata into the milestone 4 schema', () => {
    expect(sampleSkillRail.skills.length).toBeGreaterThanOrEqual(3);

    const firstSkill = sampleSkillRail.skills[0];
    expect(firstSkill).toBeDefined();
    if (firstSkill === undefined) {
      throw new Error('Expected at least one sample skill.');
    }

    expect(firstSkill).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      displayName: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      risk: expect.any(String),
      installed: expect.any(Boolean),
      enabled: expect.any(Boolean),
    });
    expect(Array.isArray(firstSkill.parameters)).toBe(true);
    expect(Array.isArray(firstSkill.examples)).toBe(true);
  });
});

describe('resolveSkillRelevanceHint', () => {
  it('returns challenge-aware hints when keyword rules match', () => {
    const catalog = createChallengeCatalog();
    const baseChallenge = catalog.byId[catalog.defaultChallengeId];
    const skill = sampleSkillRail.skills.find((candidate) => candidate.id === 'skill-plan-writer');
    expect(baseChallenge).toBeDefined();
    if (baseChallenge === undefined) {
      throw new Error('Expected seeded default challenge.');
    }
    const challenge = {
      ...baseChallenge,
      title: 'Plan a release workflow',
      summary: 'Create a clear process for rollout.',
      category: 'Delivery',
    };

    expect(skill).toBeDefined();
    expect(resolveSkillRelevanceHint(skill!, challenge)).toBeTruthy();
  });

  it('returns null when no relevance rule matches challenge context', () => {
    const catalog = createChallengeCatalog();
    const baseChallenge = catalog.byId[catalog.defaultChallengeId];
    expect(baseChallenge).toBeDefined();
    if (baseChallenge === undefined) {
      throw new Error('Expected seeded default challenge.');
    }

    const baseSkill = sampleSkillRail.skills[0];
    expect(baseSkill).toBeDefined();
    if (baseSkill === undefined) {
      throw new Error('Expected at least one sample skill.');
    }

    const skill = {
      ...baseSkill,
      relevanceRules: [{ keywords: ['this-will-not-match'], hint: 'never returned' }],
    };
    const challenge = {
      ...baseChallenge,
      title: 'Runtime adapter validation',
      summary: 'Check runtime surfaces.',
      category: 'Runtime',
    };

    expect(resolveSkillRelevanceHint(skill, challenge)).toBeNull();
  });
});
