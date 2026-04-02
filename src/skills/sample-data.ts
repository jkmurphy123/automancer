import type { ChallengeDefinition } from '../challenges/types.js';

export type SkillCategory = 'planning' | 'research' | 'quality' | 'orchestration';
export type SkillRiskLevel = 'low' | 'medium' | 'high';
export type SkillParameterType = 'text' | 'textarea' | 'select' | 'boolean';

export interface SkillParameterOption {
  value: string;
  label: string;
}

export interface SkillParameterDefinition {
  key: string;
  label: string;
  description: string;
  type: SkillParameterType;
  required: boolean;
  defaultValue?: string | boolean;
  placeholder?: string;
  options?: SkillParameterOption[];
}

export interface SkillExample {
  title: string;
  input: Record<string, string | boolean>;
  outputPreview: string;
}

export interface SkillRelevanceRule {
  keywords: string[];
  hint: string;
}

export interface SkillMetadata {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: SkillCategory;
  parameters: SkillParameterDefinition[];
  examples: SkillExample[];
  risk: SkillRiskLevel;
  installed: boolean;
  enabled: boolean;
  relevanceRules: SkillRelevanceRule[];
}

interface RawSkillMetadata {
  id: string;
  name?: string;
  displayName?: string;
  description?: string;
  category?: SkillCategory;
  parameters?: SkillParameterDefinition[];
  examples?: SkillExample[];
  risk?: SkillRiskLevel;
  installed?: boolean;
  enabled?: boolean;
  relevanceRules?: SkillRelevanceRule[];
}

export interface SkillRailState {
  threadTitle: string;
  skills: SkillMetadata[];
}

function normalizeSkill(raw: RawSkillMetadata): SkillMetadata {
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    displayName: raw.displayName ?? raw.name ?? raw.id,
    description: raw.description ?? 'No description provided.',
    category: raw.category ?? 'orchestration',
    parameters: raw.parameters ?? [],
    examples: raw.examples ?? [],
    risk: raw.risk ?? 'low',
    installed: raw.installed ?? false,
    enabled: raw.enabled ?? false,
    relevanceRules: raw.relevanceRules ?? [],
  };
}

function normalizeSkillCatalog(rawSkills: RawSkillMetadata[]): SkillMetadata[] {
  return rawSkills.map((rawSkill) => normalizeSkill(rawSkill));
}

export function resolveSkillRelevanceHint(skill: SkillMetadata, challenge: ChallengeDefinition): string | null {
  const challengeText = `${challenge.title} ${challenge.summary} ${challenge.category}`.toLowerCase();

  for (const rule of skill.relevanceRules) {
    if (rule.keywords.some((keyword) => challengeText.includes(keyword.toLowerCase()))) {
      return rule.hint;
    }
  }

  return null;
}

const rawSkillCatalog: RawSkillMetadata[] = [
  {
    id: 'skill-plan-writer',
    name: 'plan_writer',
    displayName: 'Plan Writer',
    description: 'Creates concise implementation plans and success checkpoints for the active task.',
    category: 'planning',
    risk: 'low',
    installed: true,
    enabled: true,
    parameters: [
      {
        key: 'objective',
        label: 'Objective',
        description: 'Main outcome the plan should achieve.',
        type: 'text',
        required: true,
        placeholder: 'Ship a minimal implementation this sprint',
      },
      {
        key: 'depth',
        label: 'Depth',
        description: 'How detailed the generated plan should be.',
        type: 'select',
        required: true,
        defaultValue: 'standard',
        options: [
          { value: 'quick', label: 'Quick' },
          { value: 'standard', label: 'Standard' },
          { value: 'deep', label: 'Deep' },
        ],
      },
    ],
    examples: [
      {
        title: 'Bugfix plan',
        input: { objective: 'Stabilize flaky chat tests', depth: 'standard' },
        outputPreview: 'Returns 3-step plan with validation checkpoints.',
      },
    ],
    relevanceRules: [
      {
        keywords: ['workflow', 'process', 'plan'],
        hint: 'Useful when the challenge asks for structured execution steps.',
      },
    ],
  },
  {
    id: 'skill-repo-search',
    name: 'repo_search',
    displayName: 'Repo Search',
    description: 'Searches source files for functions, patterns, and related usage examples.',
    category: 'research',
    risk: 'low',
    installed: true,
    enabled: true,
    parameters: [
      {
        key: 'query',
        label: 'Query',
        description: 'Symbol, keyword, or phrase to search in repository files.',
        type: 'text',
        required: true,
        placeholder: 'runtime adapter',
      },
      {
        key: 'includeTests',
        label: 'Include tests',
        description: 'Also search test files.',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    examples: [
      {
        title: 'Locate adapter hooks',
        input: { query: 'sendMessage', includeTests: true },
        outputPreview: 'Returns matching files and probable extension points.',
      },
    ],
    relevanceRules: [
      {
        keywords: ['debug', 'investigate', 'runtime', 'adapter', 'code'],
        hint: 'Good fit for evidence gathering before changing runtime behavior.',
      },
    ],
  },
  {
    id: 'skill-qa-handoff',
    name: 'qa_handoff',
    displayName: 'QA Handoff',
    description: 'Prepares release notes and verification checklist for QA review.',
    category: 'quality',
    risk: 'medium',
    installed: true,
    enabled: false,
    parameters: [
      {
        key: 'scope',
        label: 'Change scope',
        description: 'Summarize what was changed.',
        type: 'textarea',
        required: true,
        placeholder: 'Implemented challenge validation + runtime updates',
      },
      {
        key: 'includeRegression',
        label: 'Include regression checklist',
        description: 'Attach standard regression checklist to handoff.',
        type: 'boolean',
        required: false,
        defaultValue: true,
      },
    ],
    examples: [
      {
        title: 'Release candidate handoff',
        input: { scope: 'Milestone 4 dynamic controls', includeRegression: true },
        outputPreview: 'Generates QA ticket checklist and validation summary.',
      },
    ],
    relevanceRules: [
      {
        keywords: ['verify', 'test', 'quality', 'release'],
        hint: 'Relevant for challenges focused on verification and release readiness.',
      },
    ],
  },
];

export const sampleSkillRail: SkillRailState = {
  threadTitle: 'Challenge Coordination Thread',
  skills: normalizeSkillCatalog(rawSkillCatalog),
};
