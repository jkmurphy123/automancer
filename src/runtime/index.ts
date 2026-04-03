import { defaultAgentPresetId, getAgentPresetById } from '../agents/presets.js';
import type { RuntimeMode } from './adapter.js';
import { createChatMessage, type ChatMessage } from './messages.js';
import { LiveAgentRuntimeAdapter } from './live-adapter.js';
import { MockAgentRuntimeAdapter } from './mock-adapter.js';

export interface ChatSessionConfig {
  runtimeMode: RuntimeMode;
  debugMode: boolean;
  defaultPresetId: string;
  initialMessages: ChatMessage[];
}

export function resolveRuntimeMode(envMode: string | undefined): RuntimeMode {
  return envMode === 'live' ? 'live' : 'mock';
}

export function resolveDebugMode(envMode: string | undefined): boolean {
  const normalized = envMode?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

export function createChatSessionConfig(runtimeMode: RuntimeMode, debugMode = false): ChatSessionConfig {
  const preset = getAgentPresetById(defaultAgentPresetId);

  if (preset === undefined) {
    throw new Error('Default preset is not configured.');
  }

  const initialMessages: ChatMessage[] = [
    createChatMessage({
      role: 'system',
      text: `Runtime initialized in ${runtimeMode.toUpperCase()} mode.`,
    }),
    createChatMessage({
      role: 'agent',
      text: `${preset.name} is ready. Share your current challenge and I will suggest the next step.`,
      agentPresetId: preset.id,
    }),
  ];

  return {
    runtimeMode,
    debugMode,
    defaultPresetId: preset.id,
    initialMessages,
  };
}

export function createServerRuntimeAdapter(runtimeMode: RuntimeMode): MockAgentRuntimeAdapter | LiveAgentRuntimeAdapter {
  if (runtimeMode === 'live') {
    return new LiveAgentRuntimeAdapter();
  }

  return new MockAgentRuntimeAdapter();
}
