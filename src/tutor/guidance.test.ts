import { describe, expect, it } from 'vitest';

import { createChallengeCatalog } from '../challenges/loader.js';
import { sampleSkillRail } from '../skills/sample-data.js';
import { buildChallengeLessonMap, buildPostFailureGuidance, buildTutorGuidanceCatalog } from './guidance.js';

describe('buildChallengeLessonMap', () => {
  it('maps each challenge id to its completion lesson', () => {
    const catalog = createChallengeCatalog();
    const lessonMap = buildChallengeLessonMap(catalog);
    const challenge = catalog.byId['T1-ASK-01'];

    expect(challenge).toBeDefined();
    if (challenge === undefined) {
      throw new Error('Expected seeded challenge.');
    }

    expect(lessonMap['T1-ASK-01']).toEqual(challenge.completionLesson);
  });
});

describe('buildTutorGuidanceCatalog', () => {
  it('returns guidance entries with concept hints and skill suggestions', () => {
    const catalog = createChallengeCatalog();
    const guidance = buildTutorGuidanceCatalog(catalog, sampleSkillRail);
    const entry = guidance.byChallengeId['T2-SKL-05'];

    expect(entry).toBeDefined();
    if (entry === undefined) {
      throw new Error('Expected guidance entry for seeded challenge.');
    }

    expect(entry.conceptHints.length).toBeGreaterThan(0);
    expect(entry.suggestedSkills.length).toBeGreaterThan(0);
    expect(entry.lesson.whatYouLearned).toBeTruthy();
  });
});

describe('buildPostFailureGuidance', () => {
  it('builds deterministic coaching text for failed attempts', () => {
    const catalog = createChallengeCatalog();
    const challenge = catalog.byId['T1-PLN-04'];
    expect(challenge).toBeDefined();
    if (challenge === undefined) {
      throw new Error('Expected seeded challenge.');
    }

    const guidance = buildPostFailureGuidance(challenge, 'Missing keyword criteria.');
    expect(guidance).toContain('Missing keyword criteria.');
    expect(guidance).toContain('Next step:');
  });
});
