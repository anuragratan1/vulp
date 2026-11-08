import { Json, ParamField, PortName } from '../../contracts.js';
import { TriggerNode } from '../base/TriggerNode.js';

export class WebhookTriggerNode extends TriggerNode {
  readonly type = 'webhook.trigger';
  readonly label = 'Webhook Trigger';
  readonly outputs: PortName[] = ['default'];
  readonly params: ParamField[] = [
    {
      name: 'method',
      label: 'HTTP Method',
      kind: 'select',
      required: true,
      default: 'POST',
      options: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'ANY'],
    },
    {
      name: 'path',
      label: 'Webhook Path / Identifier',
      kind: 'string',
      required: false,
      default: '',
    },
  ];

  protected getTriggerOutput(payload: Json, params: Record<string, Json>): Json {
    // If webhook trigger payload was delivered by runtime, expose both root fields and nested body
    if (payload !== null && payload !== undefined && typeof payload === 'object') {
      const p = payload as Record<string, any>;
      if (p.body && typeof p.body === 'object' && !Array.isArray(p.body)) {
        return {
          ...p.body,
          body: p.body,
          headers: p.headers ?? {},
          query: p.query ?? {},
          method: p.method ?? params.method ?? 'POST',
          params: p.params ?? {},
          timestamp: p.timestamp ?? new Date().toISOString(),
        };
      }
      return {
        ...p,
        body: p,
        headers: p.headers ?? {},
        query: p.query ?? {},
        method: p.method ?? params.method ?? 'POST',
        params: p.params ?? {},
        timestamp: p.timestamp ?? new Date().toISOString(),
      };
    }
    // Default fallback mock output for editor test runs
    return {
      body: {},
      headers: {},
      query: {},
      method: params.method || 'POST',
      timestamp: new Date().toISOString(),
    };
  }
}

