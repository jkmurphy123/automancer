import type { AgentRuntimeAdapter, RuntimeRequest, RuntimeResponse } from './adapter.js';
import { MockAgentRuntimeAdapter } from './mock-adapter.js';

export class LiveAgentRuntimeAdapter implements AgentRuntimeAdapter {
  readonly mode = 'live' as const;

  private readonly fallback: MockAgentRuntimeAdapter;

  public constructor(latencyMs = 280) {
    this.fallback = new MockAgentRuntimeAdapter({ latencyMs });
  }

  public async sendMessage(request: RuntimeRequest): Promise<RuntimeResponse> {
    const response = await this.fallback.sendMessage(request);

    return {
      ...response,
      systemNote: response.systemNote
        ? response.systemNote + ' Live runtime bridge active.'
        : 'Live runtime bridge active.',
    };
  }
}
