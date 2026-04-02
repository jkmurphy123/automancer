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

  if (request.preset.id === 'tutor') {
    return {
      text: `Start with one small step: ${request.userMessage.text}. Then verify against the challenge success criteria before moving on.`,
      systemNote: 'Tutor mode suggested a step-by-step coaching response.',
    };
  }

  if (request.preset.id === 'researcher') {
    return {
      text: `Evidence-first summary: identify two concrete facts about "${request.userMessage.text}" and note one unknown to verify.`,
      systemNote: 'Researcher mode prioritized factual grounding.',
    };
  }

  return {
    text: `Debug pass: reproduce the issue described in "${request.userMessage.text}", capture one root cause, then apply the smallest safe fix.`,
    systemNote: 'Mechanic mode generated a diagnosis-first response.',
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
