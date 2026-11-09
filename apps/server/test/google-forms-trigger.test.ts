import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { createServer } from '../src/index.js';
import { db, initDatabase } from '../src/db/index.js';
import { credentials, workflows } from '../src/db/schema.js';
import { encrypt } from '../src/security/crypto.js';
import {
  googleFormsService,
  normalizeQuestionKey,
  synthesizeQuestionValue,
} from '../src/services/GoogleFormsService.js';
import { autoMapFields, SourceFieldDefinition } from '@workflow/engine';

describe('Google Forms Native Trigger Integration', () => {
  let server: FastifyInstance;
  const originalFetch = globalThis.fetch;
  const testCredId = 'test_google_cred_forms';

  beforeEach(async () => {
    vi.restoreAllMocks();
    initDatabase();

    // Setup mock Google credential in DB
    try {
      db.delete(credentials).where(eq(credentials.id, testCredId)).run();
    } catch {}

    db.insert(credentials).values({
      id: testCredId,
      name: 'Google (forms.tester@vulp.io)',
      type: 'google',
      dataEnc: encrypt(
        JSON.stringify({
          accessToken: 'ya29.mock_forms_token_valid',
          refreshToken: 'mock_forms_refresh_token',
          expiresAt: Date.now() + 3600 * 1000,
          email: 'forms.tester@vulp.io',
        })
      ),
      createdAt: Date.now(),
    }).run();

    server = await createServer();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    try {
      db.delete(credentials).where(eq(credentials.id, testCredId)).run();
    } catch {}
    await server.close();
  });

  describe('Question Title Normalization and Field Synthesis', () => {
    it('normalizes common Google Form questions to clean camelCase keys', () => {
      expect(normalizeQuestionKey('Lead ID')).toBe('leadId');
      expect(normalizeQuestionKey('Full Name')).toBe('name');
      expect(normalizeQuestionKey('Your Name')).toBe('name');
      expect(normalizeQuestionKey('Email Address')).toBe('email');
      expect(normalizeQuestionKey('Phone Number')).toBe('phone');
      expect(normalizeQuestionKey('Lead Score')).toBe('score');
      expect(normalizeQuestionKey('Lead Source')).toBe('source');
      expect(normalizeQuestionKey('Company Name')).toBe('company');
      expect(normalizeQuestionKey('What is your primary goal?')).toBe('whatIsYourPrimaryGoal');
    });

    it('synthesizes realistic sample values based on field keys and titles', () => {
      expect(synthesizeQuestionValue('leadId', 'Lead ID')).toBe('LEAD-101');
      expect(synthesizeQuestionValue('name', 'Full Name')).toBe('Sarah Connor');
      expect(synthesizeQuestionValue('email', 'Email Address')).toBe('sarah.c@sky.net');
      expect(synthesizeQuestionValue('phone', 'Phone Number')).toBe('+1-555-0199');
      expect(synthesizeQuestionValue('score', 'Score')).toBe(95);
      expect(synthesizeQuestionValue('source', 'Source')).toBe('Website Intake');
    });
  });

  describe('Form Discovery and Details API', () => {
    it('lists forms from Google Drive API', async () => {
      const mockDriveResponse = {
        files: [
          {
            id: 'form_lead_capture_123',
            name: 'Q4 Customer Intake Form',
            modifiedTime: '2026-11-08T18:00:00.000Z',
            webViewLink: 'https://docs.google.com/forms/d/form_lead_capture_123/edit',
          },
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('drive/v3/files')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockDriveResponse,
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      }) as any;

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/forms?credentialId=${testCredId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.forms).toHaveLength(1);
      expect(body.forms[0].id).toBe('form_lead_capture_123');
      expect(body.forms[0].name).toBe('Q4 Customer Intake Form');
    });

    it('retrieves form metadata and structure via Google Forms API', async () => {
      const mockFormApi = {
        formId: 'form_lead_capture_123',
        info: {
          title: 'Q4 Customer Intake Form',
          documentTitle: 'Q4 Customer Intake Form',
          description: 'Intake form for sales prospects',
        },
        responderUri: 'https://docs.google.com/forms/d/e/form_lead_capture_123/viewform',
        items: [
          {
            itemId: 'item_01',
            title: 'Lead ID',
            questionItem: {
              question: {
                questionId: 'q_01',
                required: true,
                textQuestion: { paragraph: false },
              },
            },
          },
          {
            itemId: 'item_02',
            title: 'Full Name',
            questionItem: {
              question: {
                questionId: 'q_02',
                required: true,
                textQuestion: { paragraph: false },
              },
            },
          },
          {
            itemId: 'item_03',
            title: 'Email Address',
            questionItem: {
              question: {
                questionId: 'q_03',
                required: true,
                textQuestion: { paragraph: false },
              },
            },
          },
        ],
      };

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/v1/forms/form_lead_capture_123')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockFormApi,
            text: async () => JSON.stringify(mockFormApi),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      }) as any;

      const res = await server.inject({
        method: 'GET',
        url: `/api/integrations/google/forms/form_lead_capture_123?credentialId=${testCredId}`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.form.id).toBe('form_lead_capture_123');
      expect(body.form.title).toBe('Q4 Customer Intake Form');
      expect(body.form.questions).toHaveLength(3);
      expect(body.form.questions[0].title).toBe('Lead ID');
    });
  });

  describe('Form Creation API', () => {
    it('creates a new Google Form natively with custom questions', async () => {
      let createdFormId = 'new_form_999';

      globalThis.fetch = vi.fn().mockImplementation(async (url: string, options: any) => {
        if (url === 'https://forms.googleapis.com/v1/forms' && options?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              formId: createdFormId,
              info: JSON.parse(options.body).info,
              responderUri: `https://docs.google.com/forms/d/e/${createdFormId}/viewform`,
            }),
          };
        }
        if (url.includes(':batchUpdate') && options?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ replies: [] }),
          };
        }
        if (url.includes(`/v1/forms/${createdFormId}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              formId: createdFormId,
              info: { title: 'Vulp Lead Intake Form' },
              items: [
                {
                  itemId: 'i1',
                  title: 'Lead ID',
                  questionItem: { question: { questionId: 'q1', required: true } },
                },
                {
                  itemId: 'i2',
                  title: 'Name',
                  questionItem: { question: { questionId: 'q2', required: true } },
                },
                {
                  itemId: 'i3',
                  title: 'Email',
                  questionItem: { question: { questionId: 'q3', required: true } },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      }) as any;

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/forms',
        payload: {
          credentialId: testCredId,
          title: 'Vulp Lead Intake Form',
          questions: [
            { title: 'Lead ID', required: true },
            { title: 'Name', required: true },
            { title: 'Email', required: true },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.form.id).toBe('new_form_999');
      expect(body.form.title).toBe('Vulp Lead Intake Form');
      expect(body.form.questions).toHaveLength(3);
    });
  });

  describe('Trigger Testing and Schema Synthesis', () => {
    it('synthesizes rich sample payload when no responses have been submitted yet', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('responses')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ responses: [] }), // No responses yet
          };
        }
        if (url.includes('/v1/forms/test_form_synth')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              formId: 'test_form_synth',
              info: { title: 'Support & Inquiries' },
              items: [
                {
                  itemId: 'i_lead',
                  title: 'Lead ID',
                  questionItem: { question: { questionId: 'q_lead', required: true } },
                },
                {
                  itemId: 'i_name',
                  title: 'Name',
                  questionItem: { question: { questionId: 'q_name', required: true } },
                },
                {
                  itemId: 'i_email',
                  title: 'Email',
                  questionItem: { question: { questionId: 'q_email', required: true } },
                },
                {
                  itemId: 'i_score',
                  title: 'Score',
                  questionItem: { question: { questionId: 'q_score', required: false } },
                },
                {
                  itemId: 'i_source',
                  title: 'Source',
                  questionItem: { question: { questionId: 'q_source', required: false } },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      }) as any;

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/forms/test_form_synth/test',
        payload: {
          credentialId: testCredId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.isLive).toBe(false);
      expect(body.sample).toBeDefined();
      expect(body.sample['Lead ID']).toBe('LEAD-101');
      expect(body.sample['Name']).toBe('Sarah Connor');
      expect(body.sample['Email']).toBe('sarah.c@sky.net');
      expect(body.sample['Score']).toBe(95);
      expect(body.sample['Source']).toBe('Website Intake');
      expect(body.sample.answers).toBeDefined();
      expect(body.sample.answers['Lead ID']).toBe('LEAD-101');
    });

    it('formats live submitted response correctly with answers map and normalized keys', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('responses')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              responses: [
                {
                  responseId: 'resp_live_001',
                  createTime: '2026-11-08T20:00:00.000Z',
                  lastSubmittedTime: '2026-11-08T20:00:00.000Z',
                  respondentEmail: 'alice@wonderland.io',
                  answers: {
                    q_lead: {
                      questionId: 'q_lead',
                      textAnswers: { answers: [{ value: 'LEAD-999' }] },
                    },
                    q_name: {
                      questionId: 'q_name',
                      textAnswers: { answers: [{ value: 'Alice Liddell' }] },
                    },
                    q_email: {
                      questionId: 'q_email',
                      textAnswers: { answers: [{ value: 'alice@wonderland.io' }] },
                    },
                    q_score: {
                      questionId: 'q_score',
                      textAnswers: { answers: [{ value: '88' }] },
                    },
                    q_source: {
                      questionId: 'q_source',
                      textAnswers: { answers: [{ value: 'Rabbit Hole Form' }] },
                    },
                  },
                },
              ],
            }),
          };
        }
        if (url.includes('/v1/forms/test_form_live')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              formId: 'test_form_live',
              info: { title: 'Live Customer Form' },
              items: [
                {
                  title: 'Lead ID',
                  questionItem: { question: { questionId: 'q_lead' } },
                },
                {
                  title: 'Full Name',
                  questionItem: { question: { questionId: 'q_name' } },
                },
                {
                  title: 'Email Address',
                  questionItem: { question: { questionId: 'q_email' } },
                },
                {
                  title: 'Score',
                  questionItem: { question: { questionId: 'q_score' } },
                },
                {
                  title: 'Source',
                  questionItem: { question: { questionId: 'q_source' } },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      }) as any;

      const res = await server.inject({
        method: 'POST',
        url: '/api/integrations/google/forms/test_form_live/test',
        payload: {
          credentialId: testCredId,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.isLive).toBe(true);
      expect(body.sample.responseId).toBe('resp_live_001');
      expect(body.sample.respondentEmail).toBe('alice@wonderland.io');
      expect(body.sample['Lead ID']).toBe('LEAD-999');
      expect(body.sample['Full Name']).toBe('Alice Liddell');
      expect(body.sample['Email Address']).toBe('alice@wonderland.io');
      expect(body.sample['Score']).toBe('88');
      expect(body.sample['Source']).toBe('Rabbit Hole Form');
      expect(body.sample.answers['Lead ID']).toBe('LEAD-999');
      expect(body.sample.answers['Full Name']).toBe('Alice Liddell');
    });
  });

  describe('Google Sheets Auto-Map Compatibility', () => {
    it('achieves 100% confidence matching between Form fields and Google Sheets columns', () => {
      // Form fields discovered from trigger output
      const triggerOutput = {
        responseId: 'resp_live_101',
        formId: 'form_sales_intake',
        formTitle: 'Sales Leads',
        submittedAt: '2026-11-08T20:00:00Z',
        respondentEmail: 'lead@example.com',
        leadId: 'LEAD-101',
        name: 'John Connor',
        email: 'john@example.com',
        phone: '+1-555-0100',
        score: 95,
        source: 'Google Form',
      };

      const sources: SourceFieldDefinition[] = [
        {
          id: 'forms_trigger.leadId',
          rawExpression: '{{ forms_trigger.leadId }}',
          nodeKey: 'forms_trigger',
          stepName: 'Google Forms Trigger',
          path: 'leadId',
          label: 'Google Forms Trigger → Lead ID',
          type: 'string',
          sampleValue: triggerOutput.leadId,
        },
        {
          id: 'forms_trigger.name',
          rawExpression: '{{ forms_trigger.name }}',
          nodeKey: 'forms_trigger',
          stepName: 'Google Forms Trigger',
          path: 'name',
          label: 'Google Forms Trigger → Name',
          type: 'string',
          sampleValue: triggerOutput.name,
        },
        {
          id: 'forms_trigger.email',
          rawExpression: '{{ forms_trigger.email }}',
          nodeKey: 'forms_trigger',
          stepName: 'Google Forms Trigger',
          path: 'email',
          label: 'Google Forms Trigger → Email',
          type: 'string',
          sampleValue: triggerOutput.email,
        },
        {
          id: 'forms_trigger.phone',
          rawExpression: '{{ forms_trigger.phone }}',
          nodeKey: 'forms_trigger',
          stepName: 'Google Forms Trigger',
          path: 'phone',
          label: 'Google Forms Trigger → Phone',
          type: 'string',
          sampleValue: triggerOutput.phone,
        },
        {
          id: 'forms_trigger.score',
          rawExpression: '{{ forms_trigger.score }}',
          nodeKey: 'forms_trigger',
          stepName: 'Google Forms Trigger',
          path: 'score',
          label: 'Google Forms Trigger → Score',
          type: 'number',
          sampleValue: triggerOutput.score,
        },
        {
          id: 'forms_trigger.source',
          rawExpression: '{{ forms_trigger.source }}',
          nodeKey: 'forms_trigger',
          stepName: 'Google Forms Trigger',
          path: 'source',
          label: 'Google Forms Trigger → Source',
          type: 'string',
          sampleValue: triggerOutput.source,
        },
      ];

      // Google Sheet Column Headers to map into
      const sheetHeaders = ['Lead ID', 'Name', 'Email', 'Phone', 'Score', 'Source'];

      const autoMapResult = autoMapFields({
        targets: sheetHeaders,
        sources,
        forceRemap: true,
      });

      expect(autoMapResult.summary.total).toBe(6);
      expect(autoMapResult.summary.mapped).toBe(6);
      expect(autoMapResult.summary.unmapped).toBe(0);
      expect(autoMapResult.summary.percentageMapped).toBe(100);

      // Verify specific mapped expressions
      expect(autoMapResult.mappings['Lead ID']).toBe('{{ forms_trigger.leadId }}');
      expect(autoMapResult.mappings['Name']).toBe('{{ forms_trigger.name }}');
      expect(autoMapResult.mappings['Email']).toBe('{{ forms_trigger.email }}');
      expect(autoMapResult.mappings['Phone']).toBe('{{ forms_trigger.phone }}');
      expect(autoMapResult.mappings['Score']).toBe('{{ forms_trigger.score }}');
      expect(autoMapResult.mappings['Source']).toBe('{{ forms_trigger.source }}');
    });
  });

  describe('Workflow Activation Validation', () => {
    it('rejects activation if Google account or Form ID is missing', async () => {
      // Create workflow with forms trigger missing formId
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/workflows',
        payload: {
          name: 'Invalid Forms Workflow',
          active: false,
          graph: {
            nodes: [
              {
                id: 'n1',
                key: 'forms_trigger',
                name: 'Google Forms',
                type: 'google_forms.trigger',
                credentialId: testCredId,
                params: {
                  formId: '', // Empty formId
                },
              },
            ],
            edges: [],
          },
        },
      });

      expect(createRes.statusCode).toBe(201);
      const wf = createRes.json().workflow;

      // Attempt to activate with empty formId
      const activateRes = await server.inject({
        method: 'POST',
        url: `/api/workflows/${wf.id}/activate`,
      });

      expect(activateRes.statusCode).toBe(400);
      expect(activateRes.json().details).toMatch(/missing required parameter 'formId'|requires a selected Google Form/);

      // Attempt to activate with missing credential
      const noCredWfRes = await server.inject({
        method: 'POST',
        url: '/api/workflows',
        payload: {
          name: 'Forms Workflow Without Account',
          active: false,
          graph: {
            nodes: [
              {
                id: 'n2',
                key: 'forms_trigger_2',
                name: 'Google Forms',
                type: 'google_forms.trigger',
                credentialId: '', // Missing credential
                params: {
                  formId: 'form_12345',
                },
              },
            ],
            edges: [],
          },
        },
      });

      const noCredWf = noCredWfRes.json().workflow;
      const activateNoCredRes = await server.inject({
        method: 'POST',
        url: `/api/workflows/${noCredWf.id}/activate`,
      });

      expect(activateNoCredRes.statusCode).toBe(400);
      expect(activateNoCredRes.json().details).toContain('requires a connected Google account');

      // Cleanup
      await server.inject({ method: 'DELETE', url: `/api/workflows/${wf.id}` });
      await server.inject({ method: 'DELETE', url: `/api/workflows/${noCredWf.id}` });
    });
  });

  describe('Managed Polling Detection and Deduplication', () => {
    it('detects new responses, ignores duplicates by responseId, and starts workflow run', async () => {
      // 1. Create active workflow with google_forms.trigger
      const createRes = await server.inject({
        method: 'POST',
        url: '/api/workflows',
        payload: {
          name: 'Active Forms Automation',
          active: true,
          graph: {
            nodes: [
              {
                id: 'node_forms',
                key: 'forms_trigger',
                name: 'Google Forms',
                type: 'google_forms.trigger',
                credentialId: testCredId,
                params: {
                  formId: 'form_polling_test_1',
                  pollIntervalSeconds: 30,
                },
              },
            ],
            edges: [],
          },
        },
      });

      expect(createRes.statusCode).toBe(201);
      const wf = createRes.json().workflow;

      const mockResponses = [
        {
          responseId: 'resp_unique_101',
          lastSubmittedTime: new Date().toISOString(),
          answers: {
            q_email: { textAnswers: { answers: [{ value: 'new_lead@corp.com' }] } },
          },
        },
      ];

      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('responses')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ responses: mockResponses }),
          };
        }
        if (url.includes('/v1/forms/form_polling_test_1')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              formId: 'form_polling_test_1',
              info: { title: 'Polling Form' },
              items: [
                {
                  title: 'Email',
                  questionItem: { question: { questionId: 'q_email' } },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 404, text: async () => 'Not found' };
      }) as any;

      // 2. Poll once: should detect new response
      const jobKey = `${wf.id}:forms_trigger`;
      const triggeredFirst = await googleFormsService.pollFormJob(jobKey);
      expect(triggeredFirst).toBe(1);

      // 3. Poll again immediately with same responseId: must deduplicate and return 0 runs
      const triggeredSecond = await googleFormsService.pollFormJob(jobKey);
      expect(triggeredSecond).toBe(0);

      // Cleanup
      googleFormsService.unregisterWorkflow(wf.id);
      await server.inject({ method: 'DELETE', url: `/api/workflows/${wf.id}` });
    });
  });
});
