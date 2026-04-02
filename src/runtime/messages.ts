import { randomUUID } from 'node:crypto';

export type ChatRole = 'user' | 'agent' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  createdAt: string;
  agentPresetId?: string;
}

interface MessageDeps {
  createId: () => string;
  now: () => Date;
}

const defaultDeps: MessageDeps = {
  createId: () => randomUUID(),
  now: () => new Date(),
};

export function createChatMessage(
  input: Omit<ChatMessage, 'id' | 'createdAt'>,
  deps: Partial<MessageDeps> = {},
): ChatMessage {
  const resolvedDeps: MessageDeps = {
    ...defaultDeps,
    ...deps,
  };

  return {
    id: resolvedDeps.createId(),
    createdAt: resolvedDeps.now().toISOString(),
    ...input,
  };
}

export function formatClockTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}
