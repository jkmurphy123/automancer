import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { sampleAgents } from './agents/sample-data.js';
import { sampleChallenge } from './challenges/sample-data.js';
import { sampleChatAndSkills } from './skills/sample-data.js';
import { renderAppShell, type AppShellState } from './ui/shell.js';

export function getSampleAppState(): AppShellState {
  return {
    agents: sampleAgents,
    challenge: sampleChallenge,
    chatAndSkills: sampleChatAndSkills,
  };
}

export function renderAppShellHtml(): string {
  return renderAppShell(getSampleAppState());
}

function requestHandler(_request: IncomingMessage, response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });

  response.end(renderAppShellHtml());
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
