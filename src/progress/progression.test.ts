import { describe, expect, it } from 'vitest';

import { createChallengeCatalog } from '../challenges/loader.js';
import {
  buildCompletedIdSet,
  challengeUnlockBlockedReason,
  collectLearnedConcepts,
  computeUnlockedTier,
  isChallengeUnlocked,
  parseLearnerProgressSnapshot,
} from './progression.js';

describe('computeUnlockedTier', () => {
  it('starts at tier 1 when no challenges are complete', () => {
    const catalog = createChallengeCatalog();

    expect(computeUnlockedTier(catalog, new Set())).toBe(1);
  });

  it('unlocks tier 2 after all tier 1 challenges are complete', () => {
    const catalog = createChallengeCatalog();
    const tier1Ids = catalog.challenges.filter((challenge) => challenge.difficulty === 'tier_1').map((challenge) => challenge.id);

    expect(computeUnlockedTier(catalog, new Set(tier1Ids))).toBe(2);
  });
});

describe('challenge unlock resolution', () => {
  it('blocks tier 2 challenge until tier 1 is complete', () => {
    const catalog = createChallengeCatalog();
    const challenge = catalog.byId['T2-SKL-05'];
    expect(challenge).toBeDefined();

    const blockedReason = challengeUnlockBlockedReason(challenge!, 1, new Set());
    expect(blockedReason).toContain('Tier 1');
    expect(isChallengeUnlocked(challenge!, 1, new Set())).toBe(false);
  });

  it('blocks challenge when unlock requirements are missing', () => {
    const catalog = createChallengeCatalog();
    const challenge = catalog.byId['T1-PLN-04'];
    expect(challenge).toBeDefined();

    const blockedReason = challengeUnlockBlockedReason(challenge!, 1, new Set());
    expect(blockedReason).toContain('T1-ASK-01');
  });
});

describe('concept tracking and persistence parsing', () => {
  it('collects learned concepts from completed challenges without duplicates', () => {
    const catalog = createChallengeCatalog();
    const concepts = collectLearnedConcepts(catalog, new Set(['T1-ASK-01', 'T1-OBS-02']));

    expect(concepts).toContain('prompt framing');
    expect(concepts).toContain('state observation');
    expect(concepts.length).toBe(new Set(concepts).size);
  });

  it('parses saved profile safely and ignores unknown challenge ids', () => {
    const catalog = createChallengeCatalog();
    const parsed = parseLearnerProgressSnapshot(
      catalog,
      JSON.stringify({
        completedById: {
          'T1-ASK-01': '2026-04-02T00:00:00.000Z',
          UNKNOWN: '2026-04-02T00:00:00.000Z',
        },
        activeChallengeId: 'UNKNOWN',
        profileName: '  Founding Learner  ',
      }),
    );

    expect(parsed.profileName).toBe('Founding Learner');
    expect(parsed.activeChallengeId).toBe(catalog.defaultChallengeId);

    const completedSet = buildCompletedIdSet(parsed);
    expect(completedSet.has('T1-ASK-01')).toBe(true);
    expect(completedSet.has('UNKNOWN')).toBe(false);
  });
});
