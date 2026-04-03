import { randomUUID } from 'node:crypto';

import { WebSocket as NodeWebSocket } from 'ws';

import type { AgentRuntimeAdapter, RuntimeRequest, RuntimeResponse } from './adapter.js';
import { MockAgentRuntimeAdapter } from './mock-adapter.js';

interface LiveRuntimeConfig {
  endpoint?: string;
  token?: string;
  password?: string;
  origin?: string;
  sessionKey?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  latencyMs?: number;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string, options?: { origin?: string }) => GatewaySocket;
}

interface LiveRuntimeBridgeResponse {
  text: string;
  systemNote?: string;
}

interface BridgeDispatchResult {
  response: RuntimeResponse;
  usedFallback: boolean;
}

interface GatewaySocketMessageEvent {
  data?: unknown;
}

interface GatewaySocketCloseEvent {
  code?: number;
  reason?: string;
}

interface GatewaySocket {
  readonly readyState: number;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: GatewaySocketMessageEvent) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: GatewaySocketCloseEvent) => void): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

interface GatewayResponseFrame {
  type?: unknown;
  id?: unknown;
  ok?: unknown;
  payload?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
}

interface GatewayEventFrame {
  type?: unknown;
  event?: unknown;
  payload?: unknown;
}

interface GatewayChatEventPayload {
  sessionKey?: unknown;
  runId?: unknown;
  state?: unknown;
  message?: unknown;
}

interface GatewayAgentEventPayload {
  sessionKey?: unknown;
  runId?: unknown;
  stream?: unknown;
  data?: unknown;
}

interface GatewayHistoryMessage {
  role?: unknown;
  content?: unknown;
}

interface GatewayHistoryResponse {
  messages?: unknown;
}

function summarizeValueShape(value: unknown): string {
  if (typeof value === 'string') {
    return 'string';
  }

  if (Array.isArray(value)) {
    return `array(${value.length})`;
  }

  if (!isRecord(value)) {
    return typeof value;
  }

  return 'object{' + Object.keys(value).slice(0, 6).join(',') + '}';
}

function extractLatestAssistantTextFromHistory(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const messages = Array.isArray((value as GatewayHistoryResponse).messages)
    ? ((value as GatewayHistoryResponse).messages as GatewayHistoryMessage[])
    : null;
  if (!messages) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || message.role !== 'assistant') {
      continue;
    }

    const text = extractMessageText(message.content);
    if (text) {
      return text;
    }
  }

  return null;
}

const GATEWAY_CLIENT_SCOPES = [
  'operator.admin',
  'operator.read',
  'operator.write',
  'operator.approvals',
  'operator.pairing',
];

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

function isWebSocketEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('ws://') || endpoint.startsWith('wss://');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractMessageText(value: unknown, preserveWhitespace = false): string | null {
  if (typeof value === 'string') {
    if (preserveWhitespace) {
      return value.length > 0 && value.trim().length > 0 ? value : null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    const text = value
      .map((entry) => extractMessageText(entry, preserveWhitespace))
      .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      .join('\n');

    if (preserveWhitespace) {
      return text.length > 0 && text.trim().length > 0 ? text : null;
    }

    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const directKeys = ['text', 'responseText', 'message', 'content'];

  for (const key of directKeys) {
    const candidate = extractMessageText(value[key], preserveWhitespace);
    if (candidate) {
      return candidate;
    }
  }

  if (typeof value.type === 'string' && value.type === 'text' && typeof value.text === 'string') {
    return preserveWhitespace
      ? value.text.length > 0 && value.text.trim().length > 0
        ? value.text
        : null
      : value.text.trim();
  }

  return null;
}

function normalizeBridgeResponse(value: unknown): LiveRuntimeBridgeResponse | null {
  if (!isRecord(value)) {
    return null;
  }

  const text = extractMessageText(value.text) ?? extractMessageText(value.responseText) ?? extractMessageText(value.message);

  if (!text) {
    return null;
  }

  const systemNote =
    typeof value.systemNote === 'string'
      ? value.systemNote
      : typeof value.note === 'string'
        ? value.note
        : typeof value.status === 'string'
          ? value.status
          : undefined;

  return {
    text,
    ...(systemNote ? { systemNote } : {}),
  };
}

export class LiveAgentRuntimeAdapter implements AgentRuntimeAdapter {
  readonly mode = 'live' as const;

  private readonly endpoint: string | undefined;

  private readonly token: string | undefined;

  private readonly password: string | undefined;

  private readonly origin: string | undefined;

  private readonly sessionKey: string;

  private readonly timeoutMs: number;

  private readonly maxAttempts: number;

  private readonly retryDelayMs: number;

  private readonly fetchImpl: typeof fetch;

  private readonly webSocketFactory: (url: string, options?: { origin?: string }) => GatewaySocket;

  private readonly fallback: MockAgentRuntimeAdapter;

  public constructor(config: LiveRuntimeConfig = {}) {
    this.endpoint = config.endpoint ?? process.env.TUTOR_RUNTIME_LIVE_ENDPOINT;
    this.token = config.token ?? process.env.TUTOR_RUNTIME_LIVE_TOKEN;
    this.password = config.password ?? process.env.TUTOR_RUNTIME_LIVE_PASSWORD;
    this.origin = config.origin ?? process.env.TUTOR_RUNTIME_LIVE_ORIGIN;
    this.sessionKey = config.sessionKey ?? process.env.TUTOR_RUNTIME_LIVE_SESSION_KEY ?? 'main';
    this.timeoutMs = config.timeoutMs ?? parsePositiveInteger(process.env.TUTOR_RUNTIME_LIVE_TIMEOUT_MS, 1500);
    this.maxAttempts = config.maxAttempts ?? parsePositiveInteger(process.env.TUTOR_RUNTIME_LIVE_MAX_ATTEMPTS, 2);
    this.retryDelayMs = config.retryDelayMs ?? parsePositiveInteger(process.env.TUTOR_RUNTIME_LIVE_RETRY_DELAY_MS, 150);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.webSocketFactory =
      config.webSocketFactory ??
      ((url, options) => new NodeWebSocket(url, options?.origin ? { origin: options.origin } : {}) as GatewaySocket);
    this.fallback = new MockAgentRuntimeAdapter({ latencyMs: config.latencyMs ?? 280 });
  }

  private async buildFallbackResponse(request: RuntimeRequest, reason: string): Promise<RuntimeResponse> {
    const response = await this.fallback.sendMessage(request);

    return {
      ...response,
      runtimeSource: 'live_fallback',
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
        const payload = isWebSocketEndpoint(this.endpoint)
          ? await this.sendThroughGatewaySocket(this.endpoint, request, controller.signal)
          : await this.sendThroughHttpBridge(this.endpoint, request, controller.signal);

        return {
          response: {
            ...payload,
            runtimeSource: 'live_bridge',
          },
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

  private buildBridgeRequestBody(request: RuntimeRequest): string {
    return JSON.stringify({
      presetId: request.preset.id,
      presetName: request.preset.name,
      presetDescription: request.preset.description,
      personalityPrompt: request.preset.personalityPrompt,
      teachingStyle: request.preset.teachingStyle,
      recommendedSkills: request.preset.recommendedSkills,
      availableSkills: request.availableSkills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        displayName: skill.displayName,
      })),
      userMessage: request.userMessage.text,
      conversation: request.conversation.map((message) => ({
        role: message.role,
        text: message.text,
        agentPresetId: message.agentPresetId,
      })),
    });
  }

  private buildHttpHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    const bearerValue = this.token?.trim() || this.password?.trim();
    if (bearerValue) {
      headers.authorization = `Bearer ${bearerValue}`;
    }

    return headers;
  }

  private async sendThroughHttpBridge(
    endpoint: string,
    request: RuntimeRequest,
    signal: AbortSignal,
  ): Promise<LiveRuntimeBridgeResponse> {
    const response = await this.fetchImpl(endpoint, {
      method: 'POST',
      headers: this.buildHttpHeaders(),
      body: this.buildBridgeRequestBody(request),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Live runtime bridge returned ${response.status}.`);
    }

    const payload = normalizeBridgeResponse((await response.json()) as unknown);

    if (!payload) {
      throw new Error('Live runtime bridge returned an invalid payload shape.');
    }

    return payload;
  }

  private async sendThroughGatewaySocket(
    endpoint: string,
    request: RuntimeRequest,
    signal: AbortSignal,
  ): Promise<LiveRuntimeBridgeResponse> {
    const socket = this.webSocketFactory(endpoint, this.origin ? { origin: this.origin } : undefined);
    const pending = new Map<
      string,
      {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }
    >();
    const runId = randomUUID();
    let streamedText = '';
    let chatSendResponse: LiveRuntimeBridgeResponse | null = null;
    let settled = false;
    let observedSessionKey: string | null = null;

    const cleanup = (closeCode?: number, closeReason?: string): void => {
      if (socket.readyState < 2) {
        socket.close(closeCode, closeReason);
      }
    };

    const rejectPending = (error: Error): void => {
      for (const entry of pending.values()) {
        entry.reject(error);
      }

      pending.clear();
    };

    const gatewayRequest = async <T>(
      method: string,
      params: unknown,
      onResponse?: (value: unknown) => void,
    ): Promise<T> =>
      await new Promise<T>((resolve, reject) => {
        if (settled) {
          reject(new Error('Gateway socket already settled.'));
          return;
        }

        const id = randomUUID();
        pending.set(id, {
          resolve: (value) => {
            onResponse?.(value);
            resolve(value as T);
          },
          reject,
        });

        socket.send(
          JSON.stringify({
            type: 'req',
            id,
            method,
            params,
          }),
        );
      });

    return await new Promise<LiveRuntimeBridgeResponse>((resolve, reject) => {
      const settleSuccess = (value: LiveRuntimeBridgeResponse): void => {
        if (settled) {
          return;
        }

        settled = true;
        rejectPending(new Error('Gateway socket request completed.'));
        cleanup(1000, 'completed');
        resolve(value);
      };

      const settleFailure = (error: Error): void => {
        if (settled) {
          return;
        }

        settled = true;
        rejectPending(error);
        cleanup(4008, 'failed');
        reject(error);
      };

      signal.addEventListener('abort', () => {
        settleFailure(new Error('Live runtime bridge request timed out.'));
      });

      socket.addEventListener('open', () => {
        void (async () => {
          try {
            await gatewayRequest('connect', {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'openclaw-control-ui',
                version: 'control-ui',
                platform: 'node',
                mode: 'webchat',
              },
              role: 'operator',
              scopes: GATEWAY_CLIENT_SCOPES,
              caps: ['tool-events'],
              ...(this.token?.trim() || this.password?.trim()
                ? {
                    auth: {
                      ...(this.token?.trim() ? { token: this.token.trim() } : {}),
                      ...(this.password?.trim() ? { password: this.password.trim() } : {}),
                    },
                  }
                : {}),
              userAgent: 'automancer-live-adapter',
              locale: 'en-US',
            });

            await gatewayRequest('chat.send', {
              sessionKey: this.sessionKey,
              message: request.userMessage.text,
              deliver: true,
              idempotencyKey: runId,
            }, (payload) => {
              chatSendResponse = normalizeBridgeResponse(payload);
            });
          } catch (error) {
            settleFailure(error instanceof Error ? error : new Error('Gateway connect failed.'));
          }
        })();
      });

      socket.addEventListener('message', (event) => {
        if (settled) {
          return;
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(String(event.data ?? ''));
        } catch {
          return;
        }

        const responseFrame = parsed as GatewayResponseFrame;
        if (responseFrame.type === 'res' && typeof responseFrame.id === 'string') {
          const entry = pending.get(responseFrame.id);
          if (!entry) {
            return;
          }

          pending.delete(responseFrame.id);

          if (responseFrame.ok) {
            entry.resolve(responseFrame.payload);
          } else {
            const message =
              typeof responseFrame.error?.message === 'string'
                ? responseFrame.error.message
                : 'Gateway request failed.';
            entry.reject(new Error(message));
          }

          return;
        }

        const eventFrame = parsed as GatewayEventFrame;
        if (eventFrame.type !== 'event' || !isRecord(eventFrame.payload)) {
          return;
        }

        if (eventFrame.event === 'agent') {
          const payload = eventFrame.payload as GatewayAgentEventPayload;
          const payloadRunId = typeof payload.runId === 'string' ? payload.runId : null;
          const payloadStream = typeof payload.stream === 'string' ? payload.stream : null;

          if (payloadRunId !== runId || payloadStream !== 'assistant') {
            return;
          }

          const nextChunk =
            (isRecord(payload.data) ? extractMessageText(payload.data.delta, true) : null) ??
            (isRecord(payload.data) ? extractMessageText(payload.data.text, true) : null);
          if (nextChunk) {
            streamedText += nextChunk;
          }
          return;
        }

        if (eventFrame.event !== 'chat') {
          return;
        }

        const payload = eventFrame.payload as GatewayChatEventPayload;
        const payloadSessionKey = typeof payload.sessionKey === 'string' ? payload.sessionKey : null;
        const payloadRunId = typeof payload.runId === 'string' ? payload.runId : null;
        const payloadState = typeof payload.state === 'string' ? payload.state : null;

        if (payloadRunId && payloadRunId !== runId) {
          return;
        }

        if (payloadSessionKey) {
          observedSessionKey ??= payloadSessionKey;
        }

        if (!payloadRunId) {
          const matchesRequestedSession =
            payloadSessionKey === this.sessionKey ||
            payloadSessionKey === observedSessionKey ||
            (typeof payloadSessionKey === 'string' && payloadSessionKey.endsWith(`:${this.sessionKey}`));
          if (!matchesRequestedSession) {
            return;
          }
        }

        if (payloadState === 'delta') {
          const nextChunk = extractMessageText(payload.message, true);
          if (nextChunk) {
            streamedText += nextChunk;
          }
          return;
        }

        if (payloadState === 'final') {
          const text =
            extractMessageText(payload.message) ??
            (streamedText.trim() || chatSendResponse?.text);
          if (!text) {
            void (async () => {
              try {
                const history = await gatewayRequest('chat.history', {
                  sessionKey: observedSessionKey ?? this.sessionKey,
                  limit: 10,
                });
                const historyText = extractLatestAssistantTextFromHistory(history);
                if (historyText) {
                  const sessionNote = `OpenClaw gateway session ${this.sessionKey}.`;
                  settleSuccess({
                    text: historyText,
                    systemNote: chatSendResponse?.systemNote
                      ? `${chatSendResponse.systemNote} ${sessionNote}`
                      : sessionNote,
                  });
                  return;
                }
              } catch {
                // Fall through to the detailed failure below.
              }

              const finalShape = summarizeValueShape(payload.message);
              const responseShape = summarizeValueShape(chatSendResponse);
              settleFailure(
                new Error(
                  `Gateway chat completed without a text response. finalMessage=${finalShape}; chatSendResponse=${responseShape}; runId=${runId}`,
                ),
              );
            })();
            return;
          }

          const sessionNote = `OpenClaw gateway session ${this.sessionKey}.`;

          settleSuccess({
            text,
            systemNote: chatSendResponse?.systemNote
              ? `${chatSendResponse.systemNote} ${sessionNote}`
              : sessionNote,
          });
          return;
        }

        if (payloadState === 'aborted') {
          settleFailure(new Error('Gateway chat run was aborted.'));
        }
      });

      socket.addEventListener('error', () => {
        settleFailure(new Error('Gateway socket error.'));
      });

      socket.addEventListener('close', (event) => {
        if (settled) {
          return;
        }

        const reason = typeof event.reason === 'string' && event.reason.length > 0 ? event.reason : 'no reason';
        const code = typeof event.code === 'number' ? event.code : 1006;
        settleFailure(new Error(`Gateway closed (${code}): ${reason}`));
      });
    });
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
