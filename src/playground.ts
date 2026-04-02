export type PlaygroundTool = 'project_search' | 'docs_lookup';

export interface PlaygroundRequest {
  issueIdentifier: string;
  objective: string;
  availableTools: PlaygroundTool[];
}

export interface TelemetryEvent {
  event: 'slice_started' | 'tool_selected' | 'tool_executed' | 'response_generated' | 'slice_completed' | 'slice_failed';
  occurredAt: string;
  attributes: Record<string, string | number | boolean>;
}

export interface PlaygroundResponse {
  status: 'ok' | 'failed';
  transcript: string[];
  telemetry: TelemetryEvent[];
  finalResponse: string;
}

interface Clock {
  now(): Date;
}

class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

function event(
  clock: Clock,
  name: TelemetryEvent['event'],
  attributes: TelemetryEvent['attributes'],
): TelemetryEvent {
  return {
    event: name,
    occurredAt: clock.now().toISOString(),
    attributes,
  };
}

function chooseTool(availableTools: PlaygroundTool[]): PlaygroundTool {
  if (availableTools.includes('project_search')) {
    return 'project_search';
  }

  if (availableTools.includes('docs_lookup')) {
    return 'docs_lookup';
  }

  throw new Error('No supported tools available for the playground slice.');
}

function executeTool(tool: PlaygroundTool, issueIdentifier: string): string {
  if (tool === 'project_search') {
    return `Located active project context for ${issueIdentifier}.`;
  }

  return `Loaded onboarding docs linked to ${issueIdentifier}.`;
}

export function runPlaygroundSlice(request: PlaygroundRequest, clock: Clock = new SystemClock()): PlaygroundResponse {
  const telemetry: TelemetryEvent[] = [];
  const transcript: string[] = [];

  telemetry.push(
    event(clock, 'slice_started', {
      issueIdentifier: request.issueIdentifier,
      objectiveLength: request.objective.length,
      availableToolCount: request.availableTools.length,
    }),
  );

  try {
    const selectedTool = chooseTool(request.availableTools);

    telemetry.push(
      event(clock, 'tool_selected', {
        selectedTool,
      }),
    );

    const toolResult = executeTool(selectedTool, request.issueIdentifier);
    transcript.push(`[tool:${selectedTool}] ${toolResult}`);

    telemetry.push(
      event(clock, 'tool_executed', {
        selectedTool,
        outputLength: toolResult.length,
      }),
    );

    const finalResponse = `Proposed next action for ${request.issueIdentifier}: ${request.objective} (prepared with ${selectedTool}).`;
    transcript.push(`[assistant] ${finalResponse}`);

    telemetry.push(
      event(clock, 'response_generated', {
        responseLength: finalResponse.length,
      }),
    );

    telemetry.push(
      event(clock, 'slice_completed', {
        status: 'ok',
      }),
    );

    return {
      status: 'ok',
      transcript,
      telemetry,
      finalResponse,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown playground error';

    telemetry.push(
      event(clock, 'slice_failed', {
        error: message,
      }),
    );

    const finalResponse = `Failed to complete playground slice: ${message}`;
    transcript.push(`[assistant] ${finalResponse}`);

    return {
      status: 'failed',
      transcript,
      telemetry,
      finalResponse,
    };
  }
}

export function runDefaultSlice(): PlaygroundResponse {
  return runPlaygroundSlice({
    issueIdentifier: 'AUT-5',
    objective: 'deliver a demoable vertical slice with telemetry hooks',
    availableTools: ['project_search', 'docs_lookup'],
  });
}
