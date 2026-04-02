export type DifficultyTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'tier_5';

export interface CompletionLesson {
  whatYouLearned: string;
  nextMission: string;
}

export interface ExactValidationRule {
  type: 'exact';
  expected: string;
}

export interface KeywordValidationRule {
  type: 'keyword';
  keywords: string[];
  mode: 'all' | 'any';
}

export interface JsonValidationRule {
  type: 'json';
  requiredKeys: string[];
  expectedValues?: Record<string, string>;
}

export type DeterministicValidationRule = ExactValidationRule | KeywordValidationRule | JsonValidationRule;

export interface ChallengeDefinition {
  id: string;
  title: string;
  category: string;
  difficulty: DifficultyTier;
  summary: string;
  fullDescription: string;
  learningGoals: string[];
  recommendedAgentTypes: string[];
  requiredSkills: string[];
  optionalSkills: string[];
  inputAssets: string[];
  hints: string[];
  successCriteria: string[];
  validation: DeterministicValidationRule;
  completionLesson: CompletionLesson;
  unlockRequirements: string[];
}

export interface ChallengeCatalog {
  challenges: ChallengeDefinition[];
  byId: Record<string, ChallengeDefinition>;
  defaultChallengeId: string;
}

export interface CompletionResult {
  passed: boolean;
  feedback: string;
  matchedCriteria: string[];
}
