import type { CompletionLesson } from '../challenges/types.js';
import type { ChallengeCatalog, ChallengeDefinition } from '../challenges/types.js';
import { resolveSkillRelevanceHint, type SkillRailState } from '../skills/sample-data.js';

export interface TutorSkillSuggestion {
  skillId: string;
  displayName: string;
  reason: string;
}

export interface TutorGuidanceEntry {
  challengeId: string;
  conceptHints: string[];
  suggestedSkills: TutorSkillSuggestion[];
  lesson: CompletionLesson;
}

export interface TutorGuidanceCatalog {
  byChallengeId: Record<string, TutorGuidanceEntry>;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function buildConceptHints(challenge: ChallengeDefinition): string[] {
  return challenge.concepts.map((concept) => `Focus concept: ${concept}.`).slice(0, 3);
}

function buildSkillSet(challenge: ChallengeDefinition): Set<string> {
  return new Set(
    [...challenge.requiredSkills, ...challenge.optionalSkills]
      .map((skillName) => normalizeKey(skillName))
      .filter((skillName) => skillName.length > 0),
  );
}

function resolveChallengeSkills(challenge: ChallengeDefinition, skillRail: SkillRailState): TutorSkillSuggestion[] {
  const namedSkills = buildSkillSet(challenge);
  const suggestions: TutorSkillSuggestion[] = [];

  for (const skill of skillRail.skills) {
    const matchedByName =
      namedSkills.has(normalizeKey(skill.displayName)) || namedSkills.has(normalizeKey(skill.name));
    const relevanceHint = resolveSkillRelevanceHint(skill, challenge);

    if (!matchedByName && relevanceHint === null) {
      continue;
    }

    suggestions.push({
      skillId: skill.id,
      displayName: skill.displayName,
      reason: matchedByName
        ? 'Listed in challenge requirements or optional recommendations.'
        : relevanceHint ?? 'Relevant to this challenge context.',
    });
  }

  return suggestions.slice(0, 3);
}

function buildGuidanceEntry(challenge: ChallengeDefinition, skillRail: SkillRailState): TutorGuidanceEntry {
  return {
    challengeId: challenge.id,
    conceptHints: buildConceptHints(challenge),
    suggestedSkills: resolveChallengeSkills(challenge, skillRail),
    lesson: challenge.completionLesson,
  };
}

export function buildChallengeLessonMap(challengeCatalog: ChallengeCatalog): Record<string, CompletionLesson> {
  const byChallengeId: Record<string, CompletionLesson> = {};

  for (const challenge of challengeCatalog.challenges) {
    byChallengeId[challenge.id] = challenge.completionLesson;
  }

  return byChallengeId;
}

export function buildTutorGuidanceCatalog(
  challengeCatalog: ChallengeCatalog,
  skillRail: SkillRailState,
): TutorGuidanceCatalog {
  const byChallengeId: Record<string, TutorGuidanceEntry> = {};

  for (const challenge of challengeCatalog.challenges) {
    byChallengeId[challenge.id] = buildGuidanceEntry(challenge, skillRail);
  }

  return { byChallengeId };
}

export function buildPostFailureGuidance(challenge: ChallengeDefinition, validationFeedback: string): string {
  const firstHint = challenge.hints[0] ?? 'Review the challenge description and success criteria.';

  return `Attempt did not pass yet. ${validationFeedback} Next step: ${firstHint}`;
}
