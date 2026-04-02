import { seededChallenges } from './seed-data.js';
import type { ChallengeCatalog, ChallengeDefinition } from './types.js';

function validateChallenge(challenge: ChallengeDefinition): void {
  if (challenge.hints.length < 2) {
    throw new Error(`Challenge ${challenge.id} must include at least 2 hints.`);
  }

  if (challenge.successCriteria.length === 0) {
    throw new Error(`Challenge ${challenge.id} must include success criteria.`);
  }
}

export function loadChallengeDefinitions(): ChallengeDefinition[] {
  return seededChallenges.map((challenge) => ({ ...challenge }));
}

export function createChallengeCatalog(challenges: ChallengeDefinition[] = loadChallengeDefinitions()): ChallengeCatalog {
  if (challenges.length === 0) {
    throw new Error('Challenge catalog requires at least one challenge.');
  }

  const byId: Record<string, ChallengeDefinition> = {};

  for (const challenge of challenges) {
    validateChallenge(challenge);

    if (byId[challenge.id] !== undefined) {
      throw new Error(`Duplicate challenge id: ${challenge.id}`);
    }

    byId[challenge.id] = challenge;
  }

  return {
    challenges,
    byId,
    defaultChallengeId: challenges[0]!.id,
  };
}

export function difficultyLabel(tier: ChallengeDefinition['difficulty']): string {
  return tier.replace('_', ' ').toUpperCase();
}
