import type { AgentRuntimeAdapter, RuntimeRequest, RuntimeResponse } from './adapter.js';
import { MockAgentRuntimeAdapter } from './mock-adapter.js';

interface LiveRuntimeConfig {
  endpoint?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  latencyMs?: number;
  fetchImpl?: typeof fetch;
}

interface LiveRuntimeBridgeResponse {
  text: string;
  systemNote?: string;
}

interface BridgeDispatchResult {
  response: RuntimeResponse;
  usedFallback: boolean;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function isLiveRuntimeBridgeResponse(value: unknown): value is LiveRuntimeBridgeResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { text?: unknown; systemNote?: unknown };

  if (typeof candidate.text !== 'string') {
    return false;
  }

  return candidate.systemNote === undefined || typeof candidate.systemNote === 'string';
}

export class LiveAgentRuntimeAdapter implements AgentRuntimeAdapter {
  readonly mode = 'live' as const;

  private readonly endpoint: string | undefined;

  private readonly timeoutMs: number;

  private readonly maxAttempts: number;

  private readonly retryDelayMs: number;

  private readonly fetchImpl: typeof fetch;

  private readonly fallback: MockAgentRuntimeAdapter;

  public constructor(config: LiveRuntimeConfig = {}) {
    this.endpoint = config.endpoint ?? process.env.TUTOR_RUNTIME_LIVE_ENDPOINT;
    this.timeoutMs = config.timeoutMs ?? parsePositiveInteger(process.env.TUTOR_RUNTIME_LIVE_TIMEOUT_MS, 1500);
    this.maxAttempts = config.maxAttempts ?? parsePositiveInteger(process.env.TUTOR_RUNTIME_LIVE_MAX_ATTEMPTS, 2);
    this.retryDelayMs = config.retryDelayMs ?? parsePositiveInteger(process.env.TUTOR_RUNTIME_LIVE_RETRY_DELAY_MS, 150);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.fallback = new MockAgentRuntimeAdapter({ latencyMs: config.latencyMs ?? 280 });
  }

  private async buildFallbackResponse(request: RuntimeRequest, reason: string): Promise<RuntimeResponse> {
    const response = await this.fallback.sendMessage(request);

    return {
      ...response,
      systemNote: response.systemNote
        ? response.systemNote + ' ' + reason
        : reason,
    };
  }

  private async sendThroughBridge(request: RuntimeRequest): Promise<BridgeDispatchResult> {
    if (!this.endpoint) {
      return {
        response: await this.buildFallbackResponse(
          request,
          'Live runtime bridge not configured; using deterministic fallback.',
        ),
        usedFallback: true,
      };
    }

    let lastErrorMessage = 'Unknown live runtime failure';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            presetId: request.preset.id,
            presetName: request.preset.name,
            userMessage: request.userMessage.text,
            conversation: request.conversation.map((message) => ({
              role: message.role,
              text: message.text,
              agentPresetId: message.agentPresetId,
            })),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Live runtime bridge returned ${response.status}.`);
        }

        const payload = (await response.json()) as unknown;

        if (!isLiveRuntimeBridgeResponse(payload)) {
          throw new Error('Live runtime bridge returned an invalid payload shape.');
        }

        return {
          response: payload,
          usedFallback: false,
        };
      } catch (error) {
        const asError = error instanceof Error ? error : new Error('Unknown live runtime failure');
        lastErrorMessage = asError.name === 'AbortError' ? 'Live runtime bridge request timed out.' : asError.message;

        if (attempt < this.maxAttempts) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, this.retryDelayMs);
          });
        }
      } finally {
        clearTimeout(timeoutHandle);
      }
    }

    return {
      response: await this.buildFallbackResponse(
        request,
        `Live runtime bridge unavailable after ${this.maxAttempts} attempt(s); using deterministic fallback (${lastErrorMessage}).`,
      ),
      usedFallback: true,
    };
  }

  public async sendMessage(request: RuntimeRequest): Promise<RuntimeResponse> {
    const dispatch = await this.sendThroughBridge(request);
    const bridgeStatusNote = dispatch.usedFallback
      ? 'Live runtime bridge fallback mode active.'
      : 'Live runtime bridge active.';

    return {
      ...dispatch.response,
      systemNote: dispatch.response.systemNote
        ? dispatch.response.systemNote + ' ' + bridgeStatusNote
        : bridgeStatusNote,
    };
  }
}
