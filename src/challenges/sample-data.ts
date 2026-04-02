export interface ChallengeStep {
  id: string;
  label: string;
  owner: string;
  state: 'done' | 'active' | 'queued';
}

export interface ActiveChallenge {
  id: string;
  title: string;
  summary: string;
  dueBy: string;
  confidence: 'high' | 'medium' | 'low';
  steps: ChallengeStep[];
}

export const sampleChallenge: ActiveChallenge = {
  id: 'AUT-22',
  title: 'Tutor UI Milestone 2 Readiness',
  summary: 'Ship shell-level wiring for challenge orchestration and mock review loop.',
  dueBy: '2026-04-05',
  confidence: 'medium',
  steps: [
    {
      id: 'step-1',
      label: 'Render app shell and static data lanes',
      owner: 'Builder',
      state: 'done',
    },
    {
      id: 'step-2',
      label: 'Draft challenge progression events',
      owner: 'Scout',
      state: 'active',
    },
    {
      id: 'step-3',
      label: 'Define QA gates for live tool calls',
      owner: 'Verifier',
      state: 'queued',
    },
  ],
};
