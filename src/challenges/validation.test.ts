import { describe, expect, it } from 'vitest';

import { createChallengeCatalog } from './loader.js';
import { evaluateSubmission } from './validation.js';

describe('evaluateSubmission', () => {
  const catalog = createChallengeCatalog();
  const getChallenge = (challengeId: string) => {
    const challenge = catalog.byId[challengeId];

    expect(challenge).toBeDefined();

    return challenge!;
  };

  it('passes keyword validation when all required keywords are present', () => {
    const challenge = getChallenge('T1-ASK-01');
    const result = evaluateSubmission(challenge, 'Goal: learn. Audience: beginner. Constraint: 3 bullets max.');

    expect(result.passed).toBe(true);
  });

  it('fails json validation when expected value does not match', () => {
    const challenge = getChallenge('T2-RSR-06');
    const result = evaluateSubmission(
      challenge,
      JSON.stringify({ tool: 'docs_lookup', query: 'validation', reason: 'find matcher' }),
    );

    expect(result.passed).toBe(false);
    expect(result.feedback).toContain('must equal');
  });

  it('passes json validation when required keys and expected value are correct', () => {
    const challenge = getChallenge('T2-RSR-06');
    const result = evaluateSubmission(
      challenge,
      JSON.stringify({ tool: 'repo_search', query: 'validation rules', reason: 'locate challenge checks' }),
    );

    expect(result.passed).toBe(true);
  });
});
