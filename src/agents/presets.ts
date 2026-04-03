import { configuredAgents } from './config.js';

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

export const agentPresets: AgentPreset[] = configuredAgents.map((agent) => ({
  id: agent.id,
  name: agent.name,
  avatar: agent.avatar,
  description: agent.description,
  personalityPrompt: agent.personalityPrompt,
  teachingStyle: agent.teachingStyle,
  recommendedSkills: [...agent.recommendedSkills],
  challengeBias: agent.challengeBias,
  ...(agent.uiThemeAccent ? { uiThemeAccent: agent.uiThemeAccent } : {}),
}));

const defaultPreset = configuredAgents.find((agent) => agent.isDefault) ?? configuredAgents[0];

if (!defaultPreset) {
  throw new Error('At least one configured agent is required.');
}

export const defaultAgentPresetId = defaultPreset.id;

export function getAgentPresetById(id: string): AgentPreset | undefined {
  return agentPresets.find((preset) => preset.id === id);
}
