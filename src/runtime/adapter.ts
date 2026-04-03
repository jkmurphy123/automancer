import type { AgentPreset } from '../agents/presets.js';
import type { ChatMessage } from './messages.js';

export type RuntimeMode = 'mock' | 'live';
export type RuntimeSource = 'mock' | 'live_bridge' | 'live_fallback';

export interface RuntimeSkillDescriptor {
  id: string;
  name: string;
  displayName: string;
  installed: boolean;
  enabled: boolean;
}

export interface RuntimeRequest {
  preset: AgentPreset;
  userMessage: ChatMessage;
  conversation: ChatMessage[];
  availableSkills: RuntimeSkillDescriptor[];
}

export interface RuntimeResponse {
  text: string;
  systemNote?: string;
  runtimeSource: RuntimeSource;
}

export interface AgentRuntimeAdapter {
  readonly mode: RuntimeMode;
  sendMessage(request: RuntimeRequest): Promise<RuntimeResponse>;
}
