export interface SkillControl {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface SkillRailState {
  threadTitle: string;
  controls: SkillControl[];
}

export const sampleSkillRail: SkillRailState = {
  threadTitle: 'Challenge Coordination Thread',
  controls: [
    {
      id: 'skill-plan',
      name: 'Plan Writer',
      description: 'Creates and updates issue plan documents.',
      enabled: true,
    },
    {
      id: 'skill-search',
      name: 'Repo Search',
      description: 'Queries local code and docs for supporting context.',
      enabled: true,
    },
    {
      id: 'skill-qa',
      name: 'QA Handoff',
      description: 'Routes implementation review to QA with release checklist.',
      enabled: false,
    },
  ],
};
