import type { ChallengeDefinition, CompletionResult, JsonValidationRule, KeywordValidationRule } from './types.js';

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function evaluateKeywordRule(rule: KeywordValidationRule, submission: string): CompletionResult {
  const normalizedSubmission = normalizeText(submission);
  const matched = rule.keywords.filter((keyword) => normalizedSubmission.includes(normalizeText(keyword)));
  const passed = rule.mode === 'all' ? matched.length === rule.keywords.length : matched.length > 0;

  return {
    passed,
    feedback: passed
      ? 'Keyword criteria satisfied.'
      : `Missing keyword criteria. Matched ${matched.length}/${rule.keywords.length}.`,
    matchedCriteria: matched,
  };
}

function evaluateJsonRule(rule: JsonValidationRule, submission: string): CompletionResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(submission);
  } catch {
    return {
      passed: false,
      feedback: 'Response is not valid JSON.',
      matchedCriteria: [],
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      passed: false,
      feedback: 'JSON response must be an object.',
      matchedCriteria: [],
    };
  }

  const record = parsed as Record<string, unknown>;
  const presentKeys = rule.requiredKeys.filter((key) => key in record);

  if (presentKeys.length !== rule.requiredKeys.length) {
    return {
      passed: false,
      feedback: `Missing required JSON keys. Found ${presentKeys.length}/${rule.requiredKeys.length}.`,
      matchedCriteria: presentKeys,
    };
  }

  if (rule.expectedValues !== undefined) {
    for (const [key, expectedValue] of Object.entries(rule.expectedValues)) {
      if (normalizeText(String(record[key] ?? '')) !== normalizeText(expectedValue)) {
        return {
          passed: false,
          feedback: `JSON field ${key} must equal ${expectedValue}.`,
          matchedCriteria: presentKeys,
        };
      }
    }
  }

  return {
    passed: true,
    feedback: 'JSON validation passed.',
    matchedCriteria: presentKeys,
  };
}

export function evaluateSubmission(challenge: ChallengeDefinition, submission: string): CompletionResult {
  const trimmedSubmission = submission.trim();

  if (trimmedSubmission.length === 0) {
    return {
      passed: false,
      feedback: 'Submission cannot be empty.',
      matchedCriteria: [],
    };
  }

  if (challenge.validation.type === 'exact') {
    const passed = normalizeText(trimmedSubmission) === normalizeText(challenge.validation.expected);

    return {
      passed,
      feedback: passed ? 'Exact match succeeded.' : 'Exact match failed.',
      matchedCriteria: passed ? ['exact_match'] : [],
    };
  }

  if (challenge.validation.type === 'keyword') {
    return evaluateKeywordRule(challenge.validation, trimmedSubmission);
  }

  return evaluateJsonRule(challenge.validation, trimmedSubmission);
}
