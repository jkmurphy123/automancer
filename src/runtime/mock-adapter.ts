import type { AgentRuntimeAdapter, RuntimeRequest, RuntimeResponse } from './adapter.js';

interface MockRuntimeConfig {
  latencyMs?: number;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function buildReply(request: RuntimeRequest): RuntimeResponse {
  const prompt = normalizeText(request.userMessage.text);

  if (prompt.includes('__mock_error__')) {
    throw new Error('Simulated mock runtime failure triggered by __mock_error__.');
  }

  return {
    text: `Start with one small step: ${request.userMessage.text}. Then verify against the challenge success criteria before moving on.`,
    systemNote: 'Tutor mode suggested a step-by-step coaching response.',
  };
}

export class MockAgentRuntimeAdapter implements AgentRuntimeAdapter {
  readonly mode = 'mock' as const;

  private readonly latencyMs: number;

  public constructor(config: MockRuntimeConfig = {}) {
    this.latencyMs = config.latencyMs ?? 220;
  }

  public async sendMessage(request: RuntimeRequest): Promise<RuntimeResponse> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, this.latencyMs);
    });

    return buildReply(request);
  }
}
