import type { AgentPreset } from '../agents/presets.js';
import type { ChatMessage } from './messages.js';

export type RuntimeMode = 'mock' | 'live';

export interface RuntimeRequest {
  preset: AgentPreset;
  userMessage: ChatMessage;
  conversation: ChatMessage[];
}

export interface RuntimeResponse {
  text: string;
  systemNote?: string;
}

export interface AgentRuntimeAdapter {
  readonly mode: RuntimeMode;
  sendMessage(request: RuntimeRequest): Promise<RuntimeResponse>;
}
