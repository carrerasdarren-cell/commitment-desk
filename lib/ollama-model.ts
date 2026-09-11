import { OpenAIModel } from '@strands-agents/sdk/models/openai';
import type {
  Message,
  StreamOptions,
  ModelStreamEvent,
} from '@strands-agents/sdk';

/** Compatibility for local models that emit an entire function call as JSON text.
 * Only a declared tool can be normalized. Strands still validates its schema,
 * executes the real callback and emits the real tool hooks. No result is invented.
 */
export class OllamaToolModel extends OpenAIModel {
  override async *stream(
    messages: Message[],
    options?: StreamOptions,
  ): AsyncIterable<ModelStreamEvent> {
    const events: ModelStreamEvent[] = [];
    let text = '';
    let nativeTool = false;
    for await (const event of super.stream(messages, options)) {
      events.push(event);
      if (event.type === 'modelContentBlockStartEvent' && event.start)
        nativeTool = true;
      if (
        event.type === 'modelContentBlockDeltaEvent' &&
        event.delta.type === 'textDelta'
      )
        text += event.delta.text;
      if (text.length > 100000)
        throw new Error('Model response exceeded the supported size.');
    }
    let call: { name: string; arguments: Record<string, unknown> } | null =
      null;
    if (
      !nativeTool &&
      events.some(
        (e) => e.type === 'modelMessageStopEvent' && e.stopReason === 'endTurn',
      )
    ) {
      try {
        const trimmed=text.trim();
        const fenced=trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
        const data = JSON.parse(fenced?fenced[1]:trimmed);
        if (
          data &&
          typeof data.name === 'string' &&
          data.arguments &&
          typeof data.arguments === 'object' &&
          !Array.isArray(data.arguments) &&
          Object.keys(data).every((k) => k === 'name' || k === 'arguments') &&
          options?.toolSpecs?.some((t) => t.name === data.name)
        )
          call = data;
      } catch {
        /* Ordinary prose is not interpreted as an action. */
      }
    }
    if (!call) {
      yield* events;
      return;
    }
    yield { type: 'modelMessageStartEvent', role: 'assistant' };
    yield {
      type: 'modelContentBlockStartEvent',
      start: {
        type: 'toolUseStart',
        name: call.name,
        toolUseId: crypto.randomUUID(),
      },
    };
    yield {
      type: 'modelContentBlockDeltaEvent',
      delta: {
        type: 'toolUseInputDelta',
        input: JSON.stringify(call.arguments),
      },
    };
    yield { type: 'modelContentBlockStopEvent' };
    yield { type: 'modelMessageStopEvent', stopReason: 'toolUse' };
    for (const event of events)
      if (event.type === 'modelMetadataEvent') yield event;
  }
}
