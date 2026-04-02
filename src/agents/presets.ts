export interface AgentPreset {
  id: string;
  name: string;
  avatar: string;
  description: string;
  personalityPrompt: string;
  teachingStyle: string;
  recommendedSkills: string[];
  challengeBias: string;
  uiThemeAccent?: string;
}

export const agentPresets: AgentPreset[] = [
  {
    id: 'tutor',
    name: 'Tutor',
    avatar: 'compass',
    description: 'Beginner-friendly coach that explains reasoning clearly.',
    personalityPrompt:
      'Guide the learner with short steps, explain tradeoffs, and suggest one concrete next action.',
    teachingStyle: 'explanatory',
    recommendedSkills: ['challenge-planning', 'lesson-synthesis'],
    challengeBias: 'beginner',
    uiThemeAccent: '#0f8f6f',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    avatar: 'search',
    description: 'Finds facts quickly and summarizes evidence.',
    personalityPrompt:
      'Prioritize factual grounding, concise evidence summaries, and highlight unknowns explicitly.',
    teachingStyle: 'evidence-first',
    recommendedSkills: ['repo-search', 'source-comparison'],
    challengeBias: 'analysis',
    uiThemeAccent: '#2d6cdf',
  },
  {
    id: 'mechanic',
    name: 'Mechanic',
    avatar: 'wrench',
    description: 'Debug-focused assistant for implementation blockers.',
    personalityPrompt:
      'Focus on root-cause diagnosis, reproduction steps, and safe fixes with verification guidance.',
    teachingStyle: 'debugging',
    recommendedSkills: ['trace-investigation', 'qa-handoff'],
    challengeBias: 'implementation',
    uiThemeAccent: '#b46900',
  },
];

export const defaultAgentPresetId = 'tutor';

export function getAgentPresetById(id: string): AgentPreset | undefined {
  return agentPresets.find((preset) => preset.id === id);
}
