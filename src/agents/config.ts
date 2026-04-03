export type AgentStatus = 'ready' | 'working' | 'blocked';

export interface AgentDockProfile {
  status: AgentStatus;
  specialty: string;
  queueDepth: number;
}

export interface ConfiguredAgent {
  id: string;
  name: string;
  avatar: string;
  description: string;
  personalityPrompt: string;
  teachingStyle: string;
  recommendedSkills: string[];
  challengeBias: string;
  uiThemeAccent?: string;
  dock: AgentDockProfile;
  isDefault?: boolean;
}

// Single source of truth for agent definitions.
// Future create/edit/delete flows should update this structure.
export const configuredAgents: ConfiguredAgent[] = [
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
    dock: {
      status: 'blocked',
      specialty: 'Step-by-step coaching',
      queueDepth: 1,
    },
    isDefault: true,
  },
];

export function getConfiguredAgentById(id: string): ConfiguredAgent | undefined {
  return configuredAgents.find((agent) => agent.id === id);
}
