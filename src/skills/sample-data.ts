export interface ChatMessage {
  id: string;
  author: 'system' | 'coach' | 'agent';
  body: string;
  at: string;
}

export interface SkillControl {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ChatAndSkills {
  threadTitle: string;
  messages: ChatMessage[];
  controls: SkillControl[];
}

export const sampleChatAndSkills: ChatAndSkills = {
  threadTitle: 'Challenge Coordination Thread',
  messages: [
    {
      id: 'msg-1',
      author: 'system',
      body: 'Challenge AUT-22 initialized with placeholder modules.',
      at: '09:10',
    },
    {
      id: 'msg-2',
      author: 'coach',
      body: 'Focus on shell cohesion first; defer backend adapters to Milestone 3.',
      at: '09:13',
    },
    {
      id: 'msg-3',
      author: 'agent',
      body: 'Agent Dock, Challenge Board, and Skills rail are now wired to static fixtures.',
      at: '09:16',
    },
  ],
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
