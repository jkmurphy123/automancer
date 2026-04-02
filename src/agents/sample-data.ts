export interface DockAgent {
  id: string;
  name: string;
  status: 'ready' | 'working' | 'blocked';
  specialty: string;
  queueDepth: number;
}

export const sampleAgents: DockAgent[] = [
  {
    id: 'agent-01',
    name: 'Scout',
    status: 'working',
    specialty: 'Research synthesis',
    queueDepth: 3,
  },
  {
    id: 'agent-02',
    name: 'Builder',
    status: 'ready',
    specialty: 'UI implementation',
    queueDepth: 1,
  },
  {
    id: 'agent-03',
    name: 'Verifier',
    status: 'blocked',
    specialty: 'QA and regression checks',
    queueDepth: 2,
  },
];
