import type { ChallengeCatalog, ChallengeDefinition, DifficultyTier } from '../challenges/types.js';

export interface LearnerProgressSnapshot {
  completedById: Record<string, string>;
  activeChallengeId: string;
  profileName: string;
}

export const PROFILE_STORAGE_KEY = 'openclawTutorProfile.v1';
const DEFAULT_PROFILE_NAME = 'Learner';
const MAX_TIERS = 5;

function tierFromDifficulty(difficulty: DifficultyTier): number {
  const parsed = Number(difficulty.replace('tier_', ''));
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TIERS) {
    return 1;
  }

  return parsed;
}

function normalizeProfileName(value: unknown): string {
  if (typeof value !== 'string') {
    return DEFAULT_PROFILE_NAME;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return DEFAULT_PROFILE_NAME;
  }

  return trimmed.slice(0, 60);
}

function parseCompletedById(catalog: ChallengeCatalog, value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const allowedIds = new Set(catalog.challenges.map((challenge) => challenge.id));
  const parsed: Record<string, string> = {};

  for (const [challengeId, completedAt] of Object.entries(value as Record<string, unknown>)) {
    if (!allowedIds.has(challengeId)) {
      continue;
    }

    if (typeof completedAt === 'string' && completedAt.trim().length > 0) {
      parsed[challengeId] = completedAt;
    }
  }

  return parsed;
}

export function buildCompletedIdSet(progress: LearnerProgressSnapshot): Set<string> {
  return new Set(Object.keys(progress.completedById));
}

export function computeUnlockedTier(catalog: ChallengeCatalog, completedIds: Set<string>): number {
  let unlockedTier = 1;

  for (let targetTier = 2; targetTier <= MAX_TIERS; targetTier += 1) {
    const previousTier = targetTier - 1;
    const previousTierChallenges = catalog.challenges.filter(
      (challenge) => tierFromDifficulty(challenge.difficulty) === previousTier,
    );

    if (previousTierChallenges.length === 0) {
      break;
    }

    const previousTierCleared = previousTierChallenges.every((challenge) => completedIds.has(challenge.id));
    if (!previousTierCleared) {
      break;
    }

    unlockedTier = targetTier;
  }

  return unlockedTier;
}

export function challengeUnlockBlockedReason(
  challenge: ChallengeDefinition,
  unlockedTier: number,
  completedIds: Set<string>,
): string | null {
  const challengeTier = tierFromDifficulty(challenge.difficulty);
  if (challengeTier > unlockedTier) {
    return `Locked until Tier ${challengeTier - 1} is complete.`;
  }

  const unmetRequirements = challenge.unlockRequirements.filter((requiredId) => !completedIds.has(requiredId));
  if (unmetRequirements.length > 0) {
    return `Locked until prerequisite ${unmetRequirements[0]} is complete.`;
  }

  return null;
}

export function isChallengeUnlocked(
  challenge: ChallengeDefinition,
  unlockedTier: number,
  completedIds: Set<string>,
): boolean {
  return challengeUnlockBlockedReason(challenge, unlockedTier, completedIds) === null;
}

export function collectLearnedConcepts(catalog: ChallengeCatalog, completedIds: Set<string>): string[] {
  const ordered: string[] = [];
  const seen = new Set<string>();

  for (const challenge of catalog.challenges) {
    if (!completedIds.has(challenge.id)) {
      continue;
    }

    for (const concept of challenge.concepts) {
      const normalized = concept.trim();
      if (normalized.length === 0 || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      ordered.push(normalized);
    }
  }

  return ordered;
}

export function parseLearnerProgressSnapshot(catalog: ChallengeCatalog, rawStorageValue: string | null): LearnerProgressSnapshot {
  if (rawStorageValue === null) {
    return {
      completedById: {},
      activeChallengeId: catalog.defaultChallengeId,
      profileName: DEFAULT_PROFILE_NAME,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawStorageValue);
  } catch {
    return {
      completedById: {},
      activeChallengeId: catalog.defaultChallengeId,
      profileName: DEFAULT_PROFILE_NAME,
    };
  }

  const objectValue = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const completedById = parseCompletedById(catalog, objectValue.completedById);
  const profileName = normalizeProfileName(objectValue.profileName);
  const activeCandidate = typeof objectValue.activeChallengeId === 'string' ? objectValue.activeChallengeId : '';
  const activeChallengeId = catalog.byId[activeCandidate] ? activeCandidate : catalog.defaultChallengeId;

  return {
    completedById,
    activeChallengeId,
    profileName,
  };
}
