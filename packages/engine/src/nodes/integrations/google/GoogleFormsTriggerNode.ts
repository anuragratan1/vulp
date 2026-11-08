import { Json, ParamField, PortName } from '../../../contracts.js';
import { TriggerNode } from '../../base/TriggerNode.js';

export class GoogleFormsTriggerNode extends TriggerNode {
  readonly type = 'google_forms.trigger';
  readonly label = 'Google Forms Trigger';
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly outputs: PortName[] = ['default'];

  readonly params: ParamField[] = [
    {
      name: 'formId',
      label: 'Google Form ID',
      kind: 'string',
      required: true,
      default: '',
    },
    {
      name: 'formTitle',
      label: 'Form Title',
      kind: 'string',
      required: false,
      default: '',
    },
    {
      name: 'responderUri',
      label: 'Form Responder URL',
      kind: 'string',
      required: false,
      default: '',
    },
    {
      name: 'samplePayload',
      label: 'Sample / Test Response Payload',
      kind: 'json',
      required: false,
      default: null,
    },
    {
      name: 'pollIntervalSeconds',
      label: 'Polling Interval (Seconds)',
      kind: 'number',
      required: false,
      default: 30,
    },
  ];

  protected getTriggerOutput(payload: Json, params: Record<string, Json>): Json {
    // 1. If runtime or test runner provided a trigger payload, return it
    if (payload !== null && payload !== undefined && typeof payload === 'object' && Object.keys(payload).length > 0) {
      return payload;
    }

    // 2. If node params has a saved sample payload, use it
    if (params.samplePayload !== null && params.samplePayload !== undefined) {
      let parsed = params.samplePayload;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // ignore
        }
      }
      if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }

    // 3. Fallback clean default response reflecting common form fields
    const formTitle =
      typeof params.formTitle === 'string' && params.formTitle.trim()
        ? params.formTitle.trim()
        : 'Customer Intake Form';
    const formId =
      typeof params.formId === 'string' && params.formId.trim()
        ? params.formId.trim()
        : 'form_sample_default';

    return {
      responseId: 'resp_sample_default',
      formId,
      formTitle,
      submittedAt: new Date().toISOString(),
      respondentEmail: 'sarah.c@sky.net',
      leadId: 'LEAD-101',
      name: 'Sarah Connor',
      email: 'sarah.c@sky.net',
      phone: '+1-555-0199',
      score: 95,
      source: 'Google Form',
      answers: {
        'Lead ID': 'LEAD-101',
        Name: 'Sarah Connor',
        Email: 'sarah.c@sky.net',
        Phone: '+1-555-0199',
        Score: 95,
        Source: 'Google Form',
      },
    };
  }
}
