import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { agentPresets } from './agents/presets.js';
import { sampleAgents } from './agents/sample-data.js';
import { createChallengeCatalog } from './challenges/loader.js';
import type { ChallengeCatalog } from './challenges/types.js';
import { createChatSessionConfig, resolveRuntimeMode } from './runtime/index.js';
import { RuntimeSessionBridge } from './runtime/session-bridge.js';
import { buildSkillInventory } from './runtime/skill-inventory.js';
import { sampleSkillRail } from './skills/sample-data.js';
import { buildChallengeLessonMap, buildTutorGuidanceCatalog } from './tutor/guidance.js';
import { renderAppShell, type AppShellState } from './ui/shell.js';

function parseEnvFile(filePath: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const source = readFileSync(filePath, 'utf8');

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\'')))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function loadProjectEnvFiles(): void {
  const projectRoot = resolve(process.cwd());

  for (const relativePath of ['.env', '.env.local']) {
    const filePath = resolve(projectRoot, relativePath);

    if (!existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvFile(filePath);

    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadProjectEnvFiles();

const runtimeMode = resolveRuntimeMode(process.env.TUTOR_RUNTIME_MODE);
const skillInventory = buildSkillInventory(sampleSkillRail.skills);
const runtimeSessionBridge = new RuntimeSessionBridge(skillInventory.skills);

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });

  response.end(JSON.stringify(payload));
}

function writeHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });

  response.end(html);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();

  if (raw.length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function parseLimit(searchParams: URLSearchParams): number {
  const raw = searchParams.get('limit');

  if (!raw) {
    return 25;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 25;
  }

  return Math.min(parsed, 100);
}

export function getSampleAppState(): AppShellState {
  const challengeCatalog: ChallengeCatalog = createChallengeCatalog();
  const chatSession = createChatSessionConfig(runtimeMode);
  const skillRail = {
    ...sampleSkillRail,
    skills: skillInventory.skills,
  };
  const tutorGuidance = buildTutorGuidanceCatalog(challengeCatalog, skillRail);
  const lessonMap = buildChallengeLessonMap(challengeCatalog);

  return {
    agents: sampleAgents,
    agentPresets,
    challengeCatalog,
    chatSession,
    skillRail,
    tutorGuidance,
    lessonMap,
    runtimeBridgeBasePath: '/api/runtime',
  };
}

export function renderAppShellHtml(): string {
  return renderAppShell(getSampleAppState());
}

async function handleRuntimeApi(request: IncomingMessage, response: ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith('/api/runtime')) {
    return false;
  }

  if (request.method === 'GET' && url.pathname === '/api/runtime/skills') {
    writeJson(response, 200, {
      detectedAt: skillInventory.detectedAt,
      source: skillInventory.source,
      skills: runtimeSessionBridge.listSkills(),
    });
    return true;
  }

  if (request.method === 'POST' && url.pathname === '/api/runtime/sessions') {
    const body = (await readJsonBody(request)) as {
      runtimeMode?: 'mock' | 'live';
    };

    const mode = body.runtimeMode === 'live' ? 'live' : 'mock';
    const initialMessages = getSampleAppState().chatSession.initialMessages;
    const session = runtimeSessionBridge.createSession(mode, initialMessages);

    writeJson(response, 201, {
      sessionId: session.id,
      runtimeMode: session.runtimeMode,
      startedAt: session.startedAt,
      skillSource: skillInventory.source,
    });
    return true;
  }

  const messageMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/messages$/);
  if (request.method === 'POST' && messageMatch) {
    const sessionId = messageMatch[1];
    if (!sessionId) {
      writeJson(response, 400, { error: 'Session id is required.' });
      return true;
    }

    const body = (await readJsonBody(request)) as {
      presetId?: string;
      text?: string;
    };

    const presetId = typeof body.presetId === 'string' ? body.presetId : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (presetId.length === 0 || text.length === 0) {
      writeJson(response, 400, {
        error: 'presetId and text are required.',
      });
      return true;
    }

    try {
      const result = await runtimeSessionBridge.sendMessage(sessionId, presetId, text);
      writeJson(response, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown runtime failure';
      const statusCode = message.toLowerCase().includes('not found') ? 404 : 400;
      writeJson(response, statusCode, { error: message });
    }

    return true;
  }

  const skillMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/skills\/([^/]+)\/execute$/);
  if (request.method === 'POST' && skillMatch) {
    const sessionId = skillMatch[1];
    const skillId = skillMatch[2];
    if (!sessionId || !skillId) {
      writeJson(response, 400, { error: 'Session id and skill id are required.' });
      return true;
    }

    const body = (await readJsonBody(request)) as {
      parameters?: unknown;
      activeChallengeId?: string | null;
    };

    const parameters =
      body.parameters && typeof body.parameters === 'object' && !Array.isArray(body.parameters)
        ? (body.parameters as Record<string, string | boolean>)
        : {};
    const activeChallengeId = typeof body.activeChallengeId === 'string' ? body.activeChallengeId : null;

    try {
      const result = await runtimeSessionBridge.executeSkill(sessionId, skillId, parameters, activeChallengeId);
      writeJson(response, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown skill execution failure';
      const statusCode = message.toLowerCase().includes('not found') ? 404 : 400;
      writeJson(response, statusCode, { error: message });
    }

    return true;
  }

  const eventsMatch = url.pathname.match(/^\/api\/runtime\/sessions\/([^/]+)\/events$/);
  if (request.method === 'GET' && eventsMatch) {
    const sessionId = eventsMatch[1];
    if (!sessionId) {
      writeJson(response, 400, { error: 'Session id is required.' });
      return true;
    }

    const session = runtimeSessionBridge.getSession(sessionId);

    if (!session) {
      writeJson(response, 404, {
        error: 'Session not found.',
      });
      return true;
    }

    writeJson(response, 200, {
      sessionId: session.id,
      events: runtimeSessionBridge.getSessionEvents(session.id, parseLimit(url.searchParams)),
    });
    return true;
  }

  writeJson(response, 404, {
    error: 'Runtime route not found.',
  });
  return true;
}

function requestHandler(request: IncomingMessage, response: ServerResponse): void {
  const url = new URL(request.url ?? '/', 'http://localhost');

  void (async () => {
    try {
      const handledByApi = await handleRuntimeApi(request, response, url);

      if (handledByApi) {
        return;
      }

      if (request.method === 'GET' && url.pathname === '/') {
        writeHtml(response, renderAppShellHtml());
        return;
      }

      response.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('Not found');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected server error.';
      writeJson(response, 400, {
        error: message,
      });
    }
  })();
}

export function startServer(port = 4173): ReturnType<typeof createServer> {
  const server = createServer(requestHandler);

  server.listen(port, () => {
    process.stdout.write(`Tutor UI shell running at http://localhost:${port}\n`);
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
