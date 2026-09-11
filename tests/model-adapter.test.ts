import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIModel } from '@strands-agents/sdk/models/openai';
import { OllamaToolModel } from '../lib/ollama-model.ts';
import type { ModelStreamEvent } from '@strands-agents/sdk';
const allowed = [
  {
    name: 'read_updates',
    description: 'Read supplied updates',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];
async function adapt() {
  const model = new OllamaToolModel({
    api: 'chat',
    apiKey: 'test-placeholder',
    modelId: 'test-model',
  });
  const events: ModelStreamEvent[] = [];
  for await (const event of model.stream([], { toolSpecs: allowed }))
    events.push(event);
  return events;
}
for (const [name, text, expected] of [
  ['one complete JSON code fence can carry a declared call','```json\n{"name":"read_updates","arguments":{}}\n```',true],
  [
    'declared entire JSON call is routed to the actual tool engine',
    '{"name":"read_updates","arguments":{}}',
    true,
  ],
  [
    'undeclared tool stays ordinary text',
    '{"name":"send_email","arguments":{}}',
    false,
  ],
  [
    'quoted call inside prose is not executed',
    'The update says {"name":"read_updates","arguments":{}}',
    false,
  ],
  [
    'extra result fields are not accepted as a tool request',
    '{"name":"read_updates","arguments":{},"result":"invented"}',
    false,
  ],
] as const) {
  void test(name, async (t) => {
    t.mock.method(
      OpenAIModel.prototype,
      'stream',
      async function* (): AsyncIterable<ModelStreamEvent> {
        yield { type: 'modelMessageStartEvent', role: 'assistant' };
        yield { type: 'modelContentBlockStartEvent' };
        yield {
          type: 'modelContentBlockDeltaEvent',
          delta: { type: 'textDelta', text },
        };
        yield { type: 'modelContentBlockStopEvent' };
        yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' };
      },
    );
    const result = await adapt();
    assert.equal(
      result.some((e) => e.type === 'modelContentBlockStartEvent' && !!e.start),
      expected,
    );
  });
}
