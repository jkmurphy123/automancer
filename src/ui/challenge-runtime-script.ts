import type { ChallengeCatalog } from '../challenges/types.js';
import type { TutorGuidanceCatalog } from '../tutor/guidance.js';
import { serializeForInlineScript } from './inline-script.js';

export function renderChallengeRuntimeScript(
  catalog: ChallengeCatalog,
  tutorGuidance: TutorGuidanceCatalog,
  lessonMap: Record<string, { whatYouLearned: string; nextMission: string }>,
): string {
  return `
    (() => {
      const catalog = ${serializeForInlineScript(catalog)};
      const guidanceByChallengeId = ${serializeForInlineScript(tutorGuidance.byChallengeId)};
      const lessonMap = ${serializeForInlineScript(lessonMap)};
      const byId = catalog.byId;
      const profileStorageKey = 'openclawTutorProfile.v1';
      const state = {
        activeId: catalog.defaultChallengeId,
        shownHints: 0,
        completedById: {},
        unlockedTier: 1,
        profileName: 'Learner',
      };

      const elements = {
        challengeList: document.querySelector('[data-challenge-list]'),
        activeId: document.querySelector('[data-active-id]'),
        activeTitle: document.querySelector('[data-active-title]'),
        activeSummary: document.querySelector('[data-active-summary]'),
        activeCategory: document.querySelector('[data-active-category]'),
        activeDifficulty: document.querySelector('[data-active-difficulty]'),
        activeDescription: document.querySelector('[data-active-description]'),
        successCriteria: document.querySelector('[data-success-criteria]'),
        hintOutput: document.querySelector('[data-hint-output]'),
        hintButton: document.querySelector('[data-hint-button]'),
        hintProgress: document.querySelector('[data-hint-progress]'),
        submissionInput: document.querySelector('[data-submission-input]'),
        submitButton: document.querySelector('[data-submit-button]'),
        resetButton: document.querySelector('[data-reset-button]'),
        feedback: document.querySelector('[data-validation-feedback]'),
        lessonPanel: document.querySelector('[data-lesson-panel]'),
        lessonSummary: document.querySelector('[data-lesson-summary]'),
        nextMission: document.querySelector('[data-next-mission]'),
        guidanceConcepts: document.querySelector('[data-guidance-concepts]'),
        guidanceSkills: document.querySelector('[data-guidance-skills]'),
        guidanceLessonMap: document.querySelector('[data-guidance-lesson-map]'),
        guidanceFailure: document.querySelector('[data-guidance-failure]'),
        profileName: document.querySelector('[data-profile-name]'),
        profileSave: document.querySelector('[data-profile-save]'),
        profileStatus: document.querySelector('[data-profile-status]'),
        progressCompleted: document.querySelector('[data-progress-completed]'),
        progressTier: document.querySelector('[data-progress-tier]'),
        progressConceptsCount: document.querySelector('[data-progress-concepts-count]'),
        learnedConcepts: document.querySelector('[data-learned-concepts]'),
      };

      const normalizeText = (value) => value.trim().toLowerCase().replace(/ +/g, ' ');
      const challengeCount = catalog.challenges.length;

      const toTierNumber = (difficulty) => {
        const parsed = Number(String(difficulty).replace('tier_', ''));
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
          return 1;
        }
        return parsed;
      };

      const hasChallenge = (challengeId) => Object.prototype.hasOwnProperty.call(byId, challengeId);

      const completedIds = () => new Set(Object.keys(state.completedById));

      const computeUnlockedTier = () => {
        let unlockedTier = 1;

        for (let targetTier = 2; targetTier <= 5; targetTier += 1) {
          const previousTier = targetTier - 1;
          const previousTierChallenges = catalog.challenges.filter(
            (challenge) => toTierNumber(challenge.difficulty) === previousTier,
          );

          if (previousTierChallenges.length === 0) {
            break;
          }

          const previousTierCleared = previousTierChallenges.every((challenge) =>
            Object.prototype.hasOwnProperty.call(state.completedById, challenge.id),
          );

          if (!previousTierCleared) {
            break;
          }

          unlockedTier = targetTier;
        }

        return unlockedTier;
      };

      const blockedReason = (challenge) => {
        const challengeTier = toTierNumber(challenge.difficulty);
        if (challengeTier > state.unlockedTier) {
          return 'Locked until Tier ' + String(challengeTier - 1) + ' is complete.';
        }

        const unmetRequirement = challenge.unlockRequirements.find(
          (requiredId) => !Object.prototype.hasOwnProperty.call(state.completedById, requiredId),
        );
        if (unmetRequirement) {
          return 'Locked until prerequisite ' + unmetRequirement + ' is complete.';
        }

        return null;
      };

      const isUnlocked = (challenge) => blockedReason(challenge) === null;

      const findFirstUnlockedChallengeId = () => {
        const firstUnlocked = catalog.challenges.find((challenge) => isUnlocked(challenge));
        return firstUnlocked ? firstUnlocked.id : catalog.defaultChallengeId;
      };

      const ensureActiveChallengeUnlocked = () => {
        const activeChallenge = byId[state.activeId];
        if (activeChallenge && isUnlocked(activeChallenge)) {
          return;
        }
        state.activeId = findFirstUnlockedChallengeId();
      };

      const collectLearnedConcepts = () => {
        const concepts = [];
        const seen = new Set();

        catalog.challenges.forEach((challenge) => {
          if (!Object.prototype.hasOwnProperty.call(state.completedById, challenge.id)) {
            return;
          }

          challenge.concepts.forEach((concept) => {
            const normalized = String(concept).trim();
            if (normalized.length === 0 || seen.has(normalized)) {
              return;
            }
            seen.add(normalized);
            concepts.push(normalized);
          });
        });

        return concepts;
      };

      const persistProfile = () => {
        if (typeof window === 'undefined' || !window.localStorage) {
          return;
        }

        try {
          window.localStorage.setItem(
            profileStorageKey,
            JSON.stringify({
              profileName: state.profileName,
              activeChallengeId: state.activeId,
              completedById: state.completedById,
              savedAt: new Date().toISOString(),
            }),
          );
        } catch {
          // Ignore localStorage write failures (e.g., private mode).
        }
      };

      const loadProfile = () => {
        if (typeof window === 'undefined' || !window.localStorage) {
          return;
        }

        try {
          const raw = window.localStorage.getItem(profileStorageKey);
          if (!raw) {
            return;
          }
          const parsed = JSON.parse(raw);
          const profileName = typeof parsed.profileName === 'string' ? parsed.profileName.trim() : '';
          state.profileName = profileName.length > 0 ? profileName.slice(0, 60) : 'Learner';

          if (typeof parsed.completedById === 'object' && parsed.completedById !== null && !Array.isArray(parsed.completedById)) {
            const parsedCompleted = {};
            Object.entries(parsed.completedById).forEach(([challengeId, completedAt]) => {
              if (!hasChallenge(challengeId)) {
                return;
              }
              if (typeof completedAt === 'string' && completedAt.trim().length > 0) {
                parsedCompleted[challengeId] = completedAt;
              }
            });
            state.completedById = parsedCompleted;
          }

          if (typeof parsed.activeChallengeId === 'string' && hasChallenge(parsed.activeChallengeId)) {
            state.activeId = parsed.activeChallengeId;
          }
        } catch {
          // Ignore corrupt local storage payloads.
        }
      };

      const syncProgressState = () => {
        state.unlockedTier = computeUnlockedTier();
        ensureActiveChallengeUnlocked();
      };

      const evaluateKeyword = (rule, submission) => {
        const normalized = normalizeText(submission);
        const matches = rule.keywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
        const passed = rule.mode === 'all' ? matches.length === rule.keywords.length : matches.length > 0;
        return {
          passed,
          feedback: passed
            ? 'Challenge completed. Keyword criteria satisfied.'
            : 'Not complete yet. Matched ' + matches.length + '/' + rule.keywords.length + ' keyword criteria.',
        };
      };

      const evaluateJson = (rule, submission) => {
        let parsed;

        try {
          parsed = JSON.parse(submission);
        } catch {
          return { passed: false, feedback: 'Not complete yet. Response must be valid JSON.' };
        }

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          return { passed: false, feedback: 'Not complete yet. JSON must be an object.' };
        }

        const keys = rule.requiredKeys.filter((key) => key in parsed);

        if (keys.length !== rule.requiredKeys.length) {
          return {
            passed: false,
            feedback:
              'Not complete yet. Required keys found ' + keys.length + '/' + rule.requiredKeys.length + '.',
          };
        }

        if (rule.expectedValues) {
          for (const [key, expected] of Object.entries(rule.expectedValues)) {
            if (normalizeText(String(parsed[key] ?? '')) !== normalizeText(expected)) {
              return {
                passed: false,
                feedback: 'Not complete yet. Field ' + key + ' must equal "' + expected + '".',
              };
            }
          }
        }

        return { passed: true, feedback: 'Challenge completed. JSON validation passed.' };
      };

      const evaluate = (challenge, submission) => {
        if (submission.trim().length === 0) {
          return { passed: false, feedback: 'Submission cannot be empty.' };
        }

        if (challenge.validation.type === 'exact') {
          const passed = normalizeText(submission) === normalizeText(challenge.validation.expected);
          return {
            passed,
            feedback: passed
              ? 'Challenge completed. Exact answer matched.'
              : 'Not complete yet. Exact answer did not match.',
          };
        }

        if (challenge.validation.type === 'keyword') {
          return evaluateKeyword(challenge.validation, submission);
        }

        return evaluateJson(challenge.validation, submission);
      };

      const getActiveChallenge = () => byId[state.activeId];

      const emitChallengeChanged = () => {
        const challenge = getActiveChallenge();

        window.dispatchEvent(
          new CustomEvent('challenge:changed', {
            detail: {
              id: challenge.id,
              title: challenge.title,
              summary: challenge.summary,
              category: challenge.category,
            },
          }),
        );
      };

      const setLessonVisible = (visible) => {
        if (visible) {
          elements.lessonPanel.classList.remove('hidden');
          return;
        }

        elements.lessonPanel.classList.add('hidden');
      };

      const renderCriteria = (criteria) => {
        elements.successCriteria.innerHTML = '';

        criteria.forEach((criterion) => {
          const item = document.createElement('li');
          item.textContent = criterion;
          elements.successCriteria.appendChild(item);
        });
      };

      const renderList = (target, values, emptyLabel) => {
        target.innerHTML = '';

        if (!Array.isArray(values) || values.length === 0) {
          const item = document.createElement('li');
          item.textContent = emptyLabel;
          target.appendChild(item);
          return;
        }

        values.forEach((value) => {
          const item = document.createElement('li');
          item.textContent = value;
          target.appendChild(item);
        });
      };

      const buildPostFailureGuidance = (challenge, validationFeedback) => {
        const firstHint = challenge.hints[0] ?? 'Review the challenge details and try one smaller step.';
        return 'Attempt did not pass yet. ' + validationFeedback + ' Next step: ' + firstHint;
      };

      const renderGuidance = (challenge) => {
        const guidance = guidanceByChallengeId[challenge.id];
        const lesson = lessonMap[challenge.id];
        const conceptHints = guidance?.conceptHints ?? [];
        const skillHints = (guidance?.suggestedSkills ?? []).map(
          (suggestion) => suggestion.displayName + ': ' + suggestion.reason,
        );

        renderList(elements.guidanceConcepts, conceptHints, 'No concept hints available.');
        renderList(elements.guidanceSkills, skillHints, 'No skill suggestions available.');
        if (lesson) {
          elements.guidanceLessonMap.textContent = challenge.id + ' maps to lesson: ' + lesson.whatYouLearned;
        } else {
          elements.guidanceLessonMap.textContent = challenge.id + ' has no lesson mapping.';
        }
      };

      const renderProgress = () => {
        const learnedConcepts = collectLearnedConcepts();
        const completedCount = Object.keys(state.completedById).length;

        elements.progressCompleted.textContent = 'Completed: ' + completedCount + '/' + challengeCount;
        elements.progressTier.textContent = 'Unlocked tier: TIER ' + state.unlockedTier;
        elements.progressConceptsCount.textContent = 'Learned concepts: ' + learnedConcepts.length;

        renderList(
          elements.learnedConcepts,
          learnedConcepts,
          'Complete challenges to unlock concept summaries.',
        );
      };

      const renderListState = () => {
        elements.challengeList
          .querySelectorAll('button[data-challenge-id]')
          .forEach((button) => {
            const challengeId = button.getAttribute('data-challenge-id');
            const challenge = challengeId ? byId[challengeId] : undefined;

            if (!challenge) {
              return;
            }

            const lockHint = button.querySelector('[data-lock-hint]');
            const challengeBlockedReason = blockedReason(challenge);
            const challengeIsUnlocked = challengeBlockedReason === null;
            button.disabled = !challengeIsUnlocked;
            button.classList.toggle('is-locked', !challengeIsUnlocked);
            button.classList.toggle('is-active', challengeId === state.activeId && challengeIsUnlocked);
            button.classList.toggle('is-complete', Boolean(state.completedById[challengeId]));

            if (lockHint) {
              lockHint.textContent = challengeBlockedReason ?? 'Unlocked';
            }
          });
      };

      const renderChallenge = () => {
        syncProgressState();
        const challenge = getActiveChallenge();

        elements.activeId.textContent = challenge.id;
        elements.activeTitle.textContent = challenge.title;
        elements.activeSummary.textContent = challenge.summary;
        elements.activeCategory.textContent = challenge.category;
        elements.activeDifficulty.textContent = challenge.difficulty.replace('_', ' ').toUpperCase();
        elements.activeDescription.textContent = challenge.fullDescription;
        elements.hintOutput.textContent = 'No hints revealed yet.';
        elements.hintProgress.textContent = '0/' + challenge.hints.length + ' shown';
        elements.submissionInput.value = '';
        elements.feedback.textContent = 'Awaiting submission.';
        elements.feedback.classList.remove('feedback-success', 'feedback-failed');
        elements.guidanceFailure.textContent = 'No failed attempts yet. Guidance will appear here if validation fails.';
        state.shownHints = 0;
        renderCriteria(challenge.successCriteria);
        renderGuidance(challenge);
        renderProgress();
        setLessonVisible(false);
        renderListState();
        emitChallengeChanged();
        persistProfile();
      };

      elements.challengeList.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-challenge-id]');

        if (!button) {
          return;
        }

        const challengeId = button.getAttribute('data-challenge-id');

        if (!challengeId || !byId[challengeId]) {
          return;
        }

        if (button.disabled) {
          const challenge = byId[challengeId];
          const reason = blockedReason(challenge);
          if (reason) {
            elements.feedback.textContent = reason;
            elements.feedback.classList.remove('feedback-success');
            elements.feedback.classList.add('feedback-failed');
          }
          return;
        }

        state.activeId = challengeId;
        renderChallenge();
      });

      elements.hintButton.addEventListener('click', () => {
        const challenge = getActiveChallenge();

        if (state.shownHints >= challenge.hints.length) {
          elements.hintOutput.textContent = 'All hints are already visible for this challenge.';
          return;
        }

        elements.hintOutput.textContent = challenge.hints[state.shownHints];
        state.shownHints += 1;
        elements.hintProgress.textContent = state.shownHints + '/' + challenge.hints.length + ' shown';
      });

      elements.submitButton.addEventListener('click', () => {
        const challenge = getActiveChallenge();
        const result = evaluate(challenge, elements.submissionInput.value);

        elements.feedback.textContent = result.feedback;
        elements.feedback.classList.toggle('feedback-success', result.passed);
        elements.feedback.classList.toggle('feedback-failed', !result.passed);

        if (!result.passed) {
          elements.guidanceFailure.textContent = buildPostFailureGuidance(challenge, result.feedback);
          setLessonVisible(false);
          return;
        }

        if (!state.completedById[challenge.id]) {
          state.completedById[challenge.id] = new Date().toISOString();
        }
        syncProgressState();
        elements.guidanceFailure.textContent = 'Latest submission passed validation.';
        elements.lessonSummary.textContent = challenge.completionLesson.whatYouLearned;
        elements.nextMission.textContent = challenge.completionLesson.nextMission;
        setLessonVisible(true);
        renderProgress();
        renderListState();
        persistProfile();
      });

      elements.resetButton.addEventListener('click', renderChallenge);

      elements.profileSave.addEventListener('click', () => {
        const nextName = String(elements.profileName.value ?? '').trim();
        state.profileName = nextName.length > 0 ? nextName.slice(0, 60) : 'Learner';
        elements.profileName.value = state.profileName;
        elements.profileStatus.textContent = 'Saved profile for ' + state.profileName + '.';
        persistProfile();
      });

      loadProfile();
      elements.profileName.value = state.profileName;
      elements.profileStatus.textContent = 'Loaded profile for ' + state.profileName + '.';
      syncProgressState();
      renderChallenge();
    })();
  `;
}
