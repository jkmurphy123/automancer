import { randomUUID } from 'node:crypto';

import { getAgentPresetById } from '../agents/presets.js';
import type { SkillMetadata } from '../skills/sample-data.js';
import type { RuntimeMode } from './adapter.js';
import { createServerRuntimeAdapter } from './index.js';
import type { ChatMessage } from './messages.js';
import { createChatMessage } from './messages.js';

interface RuntimeBridgeSession {
  id: string;
  runtimeMode: RuntimeMode;
  startedAt: string;
  messages: ChatMessage[];
  events: RuntimeEvent[];
}

export interface RuntimeEvent {
  id: string;
  type: 'session_started' | 'message_sent' | 'message_completed' | 'message_failed' | 'skill_started' | 'skill_completed' | 'skill_failed';
  runtimeMode: RuntimeMode;
  createdAt: string;
  requestId: string;
  details: Record<string, string | number | boolean>;
}

export interface RuntimeSkillResult {
  summary: string;
  chatResponse: string;
  systemNote?: string;
}

export interface RuntimeMessageResult {
  requestId: string;
  durationMs: number;
  responseText: string;
  systemNote?: string;
}

export interface RuntimeSkillExecutionResult {
  requestId: string;
  durationMs: number;
  result: RuntimeSkillResult;
}

interface BridgeConfig {
  maxEventsPerSession?: number;
  maxMessagesPerSession?: number;
}

export class RuntimeSessionBridge {
  private readonly sessions = new Map<string, RuntimeBridgeSession>();

  private readonly maxEventsPerSession: number;

  private readonly maxMessagesPerSession: number;

  private readonly skills: SkillMetadata[];

  public constructor(skills: SkillMetadata[], config: BridgeConfig = {}) {
    this.skills = skills;
    this.maxEventsPerSession = config.maxEventsPerSession ?? 80;
    this.maxMessagesPerSession = config.maxMessagesPerSession ?? 200;
  }

  public createSession(runtimeMode: RuntimeMode, initialMessages: ChatMessage[]): RuntimeBridgeSession {
    const session: RuntimeBridgeSession = {
      id: randomUUID(),
      runtimeMode,
      startedAt: new Date().toISOString(),
      messages: [...initialMessages],
      events: [],
    };

    this.sessions.set(session.id, session);
    this.pushEvent(session, {
      id: randomUUID(),
      type: 'session_started',
      runtimeMode: session.runtimeMode,
      createdAt: new Date().toISOString(),
      requestId: 'session-' + session.id,
      details: {
        initialMessageCount: initialMessages.length,
      },
    });

    return session;
  }

  public getSession(sessionId: string): RuntimeBridgeSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getSessionEvents(sessionId: string, limit = 25): RuntimeEvent[] {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return [];
    }

    return session.events.slice(-Math.max(1, Math.min(limit, this.maxEventsPerSession))).reverse();
  }

  public listSkills(): SkillMetadata[] {
    return this.skills.map((skill) => ({ ...skill }));
  }

  public async sendMessage(
    sessionId: string,
    presetId: string,
    text: string,
  ): Promise<RuntimeMessageResult> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found.');
    }

    const preset = getAgentPresetById(presetId);

    if (!preset) {
      throw new Error('Unknown preset id: ' + presetId);
    }

    const requestId = randomUUID();
    const startedAt = Date.now();
    const userMessage = createChatMessage({
      role: 'user',
      text,
      agentPresetId: preset.id,
    });

    this.pushMessage(session, userMessage);
    this.pushEvent(session, {
      id: randomUUID(),
      type: 'message_sent',
      runtimeMode: session.runtimeMode,
      createdAt: new Date().toISOString(),
      requestId,
      details: {
        presetId: preset.id,
        messageLength: text.length,
      },
    });

    try {
      const adapter = createServerRuntimeAdapter(session.runtimeMode);
      const response = await adapter.sendMessage({
        preset,
        userMessage,
        conversation: session.messages,
      });

      const agentMessage = createChatMessage({
        role: 'agent',
        text: response.text,
        agentPresetId: preset.id,
      });
      this.pushMessage(session, agentMessage);

      if (response.systemNote) {
        this.pushMessage(
          session,
          createChatMessage({
            role: 'system',
            text: response.systemNote,
          }),
        );
      }

      const durationMs = Date.now() - startedAt;
      this.pushEvent(session, {
        id: randomUUID(),
        type: 'message_completed',
        runtimeMode: session.runtimeMode,
        createdAt: new Date().toISOString(),
        requestId,
        details: {
          presetId: preset.id,
          durationMs,
        },
      });

      process.stdout.write(
        '[runtime] message_completed ' +
          JSON.stringify({
            sessionId,
            requestId,
            runtimeMode: session.runtimeMode,
            presetId: preset.id,
            durationMs,
          }) +
          '\n',
      );

      return {
        requestId,
        durationMs,
        responseText: response.text,
        ...(response.systemNote ? { systemNote: response.systemNote } : {}),
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : 'Unknown runtime failure';

      this.pushEvent(session, {
        id: randomUUID(),
        type: 'message_failed',
        runtimeMode: session.runtimeMode,
        createdAt: new Date().toISOString(),
        requestId,
        details: {
          presetId: preset.id,
          durationMs,
          error: message,
        },
      });

      process.stdout.write(
        '[runtime] message_failed ' +
          JSON.stringify({
            sessionId,
            requestId,
            runtimeMode: session.runtimeMode,
            presetId: preset.id,
            durationMs,
            error: message,
          }) +
          '\n',
      );

      throw error;
    }
  }

  public async executeSkill(
    sessionId: string,
    skillId: string,
    parameters: Record<string, string | boolean>,
    activeChallengeId: string | null,
  ): Promise<RuntimeSkillExecutionResult> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error('Session not found.');
    }

    const skill = this.skills.find((candidate) => candidate.id === skillId);

    if (!skill) {
      throw new Error('Unknown skill id: ' + skillId);
    }

    const requestId = randomUUID();
    const startedAt = Date.now();
    const challengeId = activeChallengeId ?? 'no-active-challenge';

    this.pushEvent(session, {
      id: randomUUID(),
      type: 'skill_started',
      runtimeMode: session.runtimeMode,
      createdAt: new Date().toISOString(),
      requestId,
      details: {
        skillId,
        challengeId,
      },
    });

    try {
      const result = await this.executeSkillLocally(skill, parameters, challengeId);

      const durationMs = Date.now() - startedAt;
      this.pushMessage(
        session,
        createChatMessage({
          role: 'agent',
          text: result.chatResponse,
        }),
      );
      if (result.systemNote) {
        this.pushMessage(
          session,
          createChatMessage({
            role: 'system',
            text: result.systemNote,
          }),
        );
      }

      this.pushEvent(session, {
        id: randomUUID(),
        type: 'skill_completed',
        runtimeMode: session.runtimeMode,
        createdAt: new Date().toISOString(),
        requestId,
        details: {
          skillId,
          challengeId,
          durationMs,
        },
      });

      process.stdout.write(
        '[runtime] skill_completed ' +
          JSON.stringify({
            sessionId,
            requestId,
            runtimeMode: session.runtimeMode,
            skillId,
            challengeId,
            durationMs,
          }) +
          '\n',
      );

      return {
        requestId,
        durationMs,
        result,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : 'Unknown skill execution failure';

      this.pushEvent(session, {
        id: randomUUID(),
        type: 'skill_failed',
        runtimeMode: session.runtimeMode,
        createdAt: new Date().toISOString(),
        requestId,
        details: {
          skillId,
          challengeId,
          durationMs,
          error: message,
        },
      });

      process.stdout.write(
        '[runtime] skill_failed ' +
          JSON.stringify({
            sessionId,
            requestId,
            runtimeMode: session.runtimeMode,
            skillId,
            challengeId,
            durationMs,
            error: message,
          }) +
          '\n',
      );

      throw error;
    }
  }

  private pushMessage(session: RuntimeBridgeSession, message: ChatMessage): void {
    session.messages.push(message);

    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages.splice(0, session.messages.length - this.maxMessagesPerSession);
    }
  }

  private pushEvent(session: RuntimeBridgeSession, event: RuntimeEvent): void {
    session.events.push(event);

    if (session.events.length > this.maxEventsPerSession) {
      session.events.splice(0, session.events.length - this.maxEventsPerSession);
    }
  }

  private async executeSkillLocally(
    skill: SkillMetadata,
    parameters: Record<string, string | boolean>,
    challengeId: string,
  ): Promise<RuntimeSkillResult> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 180);
    });

    if (!skill.installed) {
      throw new Error('Skill is not installed in the current runtime.');
    }

    if (!skill.enabled) {
      throw new Error('Skill is installed but disabled.');
    }

    const parameterSummary = Object.entries(parameters)
      .map(([key, value]) => key + '=' + String(value))
      .join(', ');

    if (skill.id === 'skill-plan-writer') {
      return {
        summary: 'Generated execution checklist for ' + challengeId + ': scope, checkpoints, and completion criteria ready.',
        chatResponse:
          'Plan Writer created a focused plan for ' +
          challengeId +
          '. Start with a thin vertical slice, then validate against success criteria.',
        systemNote: 'Plan generated with inputs: ' + parameterSummary,
      };
    }

    if (skill.id === 'skill-repo-search') {
      return {
        summary: 'Repo Search scanned references related to ' + challengeId + ' and returned likely extension points.',
        chatResponse: 'Repo Search found candidate implementation anchors. Review runtime adapter and UI wiring first.',
        systemNote: 'Search inputs: ' + parameterSummary,
      };
    }

    return {
      summary: 'Prepared QA handoff checklist for ' + challengeId + '.',
      chatResponse: 'QA Handoff staged a verification checklist and release-risk summary for review.',
      systemNote: 'QA handoff inputs: ' + parameterSummary,
    };
  }
}
