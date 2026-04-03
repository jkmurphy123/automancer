import { configuredAgents, type AgentStatus } from './config.js';

export interface DockAgent {
  id: string;
  presetId: string;
  name: string;
  description: string;
  status: AgentStatus;
  specialty: string;
  queueDepth: number;
  teachingStyle: string;
  avatar: string;
  challengeBias: string;
  recommendedSkills: string[];
}

export const sampleAgents: DockAgent[] = configuredAgents.map((agent, index) => ({
  id: `agent-${String(index + 1).padStart(2, '0')}`,
  presetId: agent.id,
  name: agent.name,
  description: agent.description,
  status: agent.dock.status,
  specialty: agent.dock.specialty,
  queueDepth: agent.dock.queueDepth,
  teachingStyle: agent.teachingStyle,
  avatar: agent.avatar,
  challengeBias: agent.challengeBias,
  recommendedSkills: [...agent.recommendedSkills],
}));
