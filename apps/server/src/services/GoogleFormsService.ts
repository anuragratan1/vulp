import { eq } from 'drizzle-orm';
import { WorkflowGraph } from '@workflow/engine';
import { db } from '../db/index.js';
import { workflows, Workflow } from '../db/schema.js';
import { credentialVault } from '../security/CredentialVault.js';
import { runManager } from '../execution/RunManager.js';

export interface FormQuestion {
  id: string;
  itemId?: string;
  title: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface FormDetails {
  id: string;
  title: string;
  description: string;
  responderUri: string;
  webViewLink: string;
  questions: FormQuestion[];
}

export interface FormListItem {
  id: string;
  name: string;
  modifiedTime?: string;
  responderUri?: string;
  webViewLink?: string;
}

export function normalizeQuestionKey(title: string): string {
  if (!title) return 'field';
  const clean = title.replace(/[^\w\s-]/g, '').trim();
  if (!clean) return 'field';

  const lower = clean.toLowerCase();
  if (lower === 'lead id' || lower === 'leadid' || lower === 'id') return 'leadId';
  if (
    lower === 'name' ||
    lower === 'full name' ||
    lower === 'your name' ||
    lower === 'customer name' ||
    lower === 'first name'
  )
    return 'name';
  if (
    lower === 'email' ||
    lower === 'email address' ||
    lower === 'your email' ||
    lower === 'work email'
  )
    return 'email';
  if (
    lower === 'phone' ||
    lower === 'phone number' ||
    lower === 'mobile' ||
    lower === 'contact number'
  )
    return 'phone';
  if (lower === 'score' || lower === 'lead score' || lower === 'rating') return 'score';
  if (lower === 'source' || lower === 'lead source' || lower === 'channel') return 'source';
  if (lower === 'company' || lower === 'organization' || lower === 'company name') return 'company';
  if (lower === 'message' || lower === 'notes' || lower === 'comments') return 'message';

  const parts = clean.split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return 'field';
  return (
    parts[0].toLowerCase() +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join('')
  );
}

export function synthesizeQuestionValue(key: string, title: string): any {
  const lowerKey = key.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (lowerKey === 'leadid' || lowerTitle.includes('lead id')) return 'LEAD-101';
  if (
    lowerKey === 'name' ||
    lowerTitle.includes('name') ||
    lowerKey.includes('name')
  )
    return 'Sarah Connor';
  if (
    lowerKey === 'email' ||
    lowerTitle.includes('email') ||
    lowerKey.includes('email')
  )
    return 'sarah.c@sky.net';
  if (
    lowerKey === 'phone' ||
    lowerTitle.includes('phone') ||
    lowerKey.includes('phone') ||
    lowerTitle.includes('mobile')
  )
    return '+1-555-0199';
  if (
    lowerKey === 'score' ||
    lowerTitle.includes('score') ||
    lowerKey.includes('score') ||
    lowerTitle.includes('rating')
  )
    return 95;
  if (
    lowerKey === 'source' ||
    lowerTitle.includes('source') ||
    lowerKey.includes('source') ||
    lowerTitle.includes('channel')
  )
    return 'Website Intake';
  if (
    lowerKey === 'company' ||
    lowerTitle.includes('company') ||
    lowerKey.includes('company')
  )
    return 'Cyberdyne Systems';
  if (lowerTitle.includes('date') || lowerKey.includes('date'))
    return new Date().toISOString().split('T')[0];

  return `Sample ${title}`;
}

interface ActivePollJob {
  workflowId: string;
  nodeKey: string;
  credentialId: string;
  formId: string;
  timer: NodeJS.Timeout | null;
  lastCheckTimestamp: number;
  processedResponseIds: Set<string>;
}

export class GoogleFormsService {
  private pollJobs = new Map<string, ActivePollJob>();
  private initialized = false;

  private async getAuthToken(credentialId: string): Promise<string> {
    const secrets = await credentialVault.get(credentialId);
    const token = secrets.accessToken || secrets.token;
    if (!token) {
      throw new Error(`No access token available for Google credential '${credentialId}'`);
    }
    return token;
  }

  /**
   * List Google Forms from Drive API
   */
  public async listForms(credentialId: string, query?: string): Promise<FormListItem[]> {
    const token = await this.getAuthToken(credentialId);
    let q = "trashed = false and mimeType = 'application/vnd.google-apps.form'";
    if (query && query.trim()) {
      const sanitized = query.trim().replace(/'/g, "\\'");
      q += ` and name contains '${sanitized}'`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id,name,mimeType,modifiedTime,webViewLink)&orderBy=modifiedTime%20desc&q=${encodeURIComponent(
      q
    )}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API error: ${errText}`);
    }

    const data: any = await res.json();
    const files = Array.isArray(data.files) ? data.files : [];

    return files.map((f: any) => ({
      id: f.id,
      name: f.name || 'Untitled Form',
      modifiedTime: f.modifiedTime,
      responderUri: `https://docs.google.com/forms/d/e/${f.id}/viewform`,
      webViewLink: f.webViewLink || `https://docs.google.com/forms/d/${f.id}/edit`,
    }));
  }

  /**
   * Get Form Metadata and Questions from Google Forms API
   */
  public async getForm(credentialId: string, formId: string): Promise<FormDetails> {
    const token = await this.getAuthToken(credentialId);
    const url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Forms API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const questions: FormQuestion[] = [];

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item.questionItem?.question) {
          const q = item.questionItem.question;
          let qType = 'TEXT';
          if (q.textQuestion?.paragraph) {
            qType = 'PARAGRAPH';
          } else if (q.choiceQuestion?.type) {
            qType = q.choiceQuestion.type;
          } else if (q.scaleQuestion) {
            qType = 'SCALE';
          } else if (q.dateQuestion) {
            qType = 'DATE';
          }

          questions.push({
            id: q.questionId,
            itemId: item.itemId,
            title: item.title || 'Untitled Question',
            description: item.description || '',
            required: Boolean(q.required),
            type: qType,
          });
        }
      }
    }

    return {
      id: data.formId,
      title: data.info?.title || data.info?.documentTitle || 'Untitled Form',
      description: data.info?.description || '',
      responderUri: data.responderUri || `https://docs.google.com/forms/d/e/${data.formId}/viewform`,
      webViewLink: `https://docs.google.com/forms/d/${data.formId}/edit`,
      questions,
    };
  }

  /**
   * Fetch Form Responses from Google Forms API
   */
  public async getFormResponses(
    credentialId: string,
    formId: string,
    afterTimestamp?: string
  ): Promise<any[]> {
    const token = await this.getAuthToken(credentialId);
    let url = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`;
    if (afterTimestamp) {
      url += `?filter=timestamp%20%3E%3D%20${encodeURIComponent(afterTimestamp)}`;
    }

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Forms API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    return Array.isArray(data.responses) ? data.responses : [];
  }

  /**
   * Format a raw Google Forms response into a rich, structured trigger payload
   */
  public formatFormResponse(form: FormDetails, rawResponse: any): Record<string, any> {
    const responseId = rawResponse.responseId || `resp_${Date.now()}`;
    const submittedAt =
      rawResponse.lastSubmittedTime || rawResponse.createTime || new Date().toISOString();
    const respondentEmail = rawResponse.respondentEmail || '';

    const answersMap: Record<string, any> = {};
    const topLevelProps: Record<string, any> = {};

    const rawAnswers = rawResponse.answers || {};

    for (const q of form.questions) {
      const ansObj = rawAnswers[q.id];
      let val: any = '';

      if (ansObj?.textAnswers?.answers && Array.isArray(ansObj.textAnswers.answers)) {
        const textVals = ansObj.textAnswers.answers.map((a: any) => a.value);
        val = textVals.length > 1 ? textVals : textVals[0] ?? '';
      }

      answersMap[q.title] = val;

      const normKey = normalizeQuestionKey(q.title);
      topLevelProps[normKey] = val;
      // Also provide exact question title key if different
      if (topLevelProps[q.title] === undefined) {
        topLevelProps[q.title] = val;
      }
    }

    // Ensure standard keys exist if matched
    if (respondentEmail && !topLevelProps.email) {
      topLevelProps.email = respondentEmail;
    }

    return {
      responseId,
      formId: form.id,
      formTitle: form.title,
      submittedAt,
      respondentEmail,
      ...topLevelProps,
      answers: answersMap,
    };
  }

  /**
   * Create a new Google Form natively via Google Forms API
   */
  public async createForm(
    credentialId: string,
    title: string,
    questions?: Array<{ title: string; required?: boolean; type?: string }>
  ): Promise<FormDetails> {
    const token = await this.getAuthToken(credentialId);
    const cleanTitle = (title || '').trim() || 'Untitled Form';

    // 1. Create empty form
    const createUrl = 'https://forms.googleapis.com/v1/forms';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        info: {
          title: cleanTitle,
          documentTitle: cleanTitle,
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      if (createRes.status === 403 && errText.includes('SERVICE_DISABLED')) {
        throw new Error(
          'Google Forms API is not enabled in your Google Cloud Project. Please enable "Google Forms API" in Google Cloud Console or select an existing form.'
        );
      }
      throw new Error(`Failed to create Google Form (${createRes.status}): ${errText}`);
    }

    const created: any = await createRes.json();
    const formId = created.formId;

    // 2. Add question items if provided
    const targetQuestions =
      questions && questions.length > 0
        ? questions
        : [
            { title: 'Lead ID', required: true, type: 'TEXT' },
            { title: 'Name', required: true, type: 'TEXT' },
            { title: 'Email', required: true, type: 'TEXT' },
            { title: 'Phone', required: false, type: 'TEXT' },
            { title: 'Score', required: false, type: 'TEXT' },
            { title: 'Source', required: false, type: 'TEXT' },
          ];

    const requests = targetQuestions.map((q, idx) => ({
      createItem: {
        item: {
          title: q.title.trim(),
          questionItem: {
            question: {
              required: Boolean(q.required),
              textQuestion: {
                paragraph: q.type === 'PARAGRAPH',
              },
            },
          },
        },
        location: {
          index: idx,
        },
      },
    }));

    if (requests.length > 0) {
      const batchUrl = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(
        formId
      )}:batchUpdate`;
      const batchRes = await fetch(batchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      if (!batchRes.ok) {
        const batchErr = await batchRes.text();
        console.warn(`[GoogleFormsService] Failed to add questions to form ${formId}: ${batchErr}`);
      }
    }

    // 3. Return full details of newly created form
    return this.getForm(credentialId, formId);
  }

  /**
   * Test Trigger: Fetch latest response or synthesize sample schema from form structure
   */
  public async testTrigger(
    credentialId: string,
    formId: string
  ): Promise<{
    success: boolean;
    isLive: boolean;
    sample: Record<string, any>;
    form: FormDetails;
    message?: string;
  }> {
    const form = await this.getForm(credentialId, formId);
    let latestResponses: any[] = [];

    try {
      latestResponses = await this.getFormResponses(credentialId, formId);
    } catch (err: any) {
      console.warn(`[GoogleFormsService] Could not fetch responses for test: ${err.message}`);
    }

    if (latestResponses.length > 0) {
      const latest = latestResponses[latestResponses.length - 1];
      const formatted = this.formatFormResponse(form, latest);
      return {
        success: true,
        isLive: true,
        sample: formatted,
        form,
        message: 'Loaded latest submitted response from Google Form',
      };
    }

    // Synthesize sample response using the form's real questions
    const answersMap: Record<string, any> = {};
    const topLevelProps: Record<string, any> = {};

    for (const q of form.questions) {
      const normKey = normalizeQuestionKey(q.title);
      const synthVal = synthesizeQuestionValue(normKey, q.title);
      answersMap[q.title] = synthVal;
      topLevelProps[normKey] = synthVal;
      if (topLevelProps[q.title] === undefined) {
        topLevelProps[q.title] = synthVal;
      }
    }

    // Ensure standard keys exist
    if (!topLevelProps.leadId) topLevelProps.leadId = 'LEAD-101';
    if (!topLevelProps.name) topLevelProps.name = 'Sarah Connor';
    if (!topLevelProps.email) topLevelProps.email = 'sarah.c@sky.net';
    if (!topLevelProps.phone) topLevelProps.phone = '+1-555-0199';
    if (!topLevelProps.score) topLevelProps.score = 95;
    if (!topLevelProps.source) topLevelProps.source = 'Website Intake';

    const syntheticSample: Record<string, any> = {
      responseId: `sample_resp_${Date.now()}`,
      formId: form.id,
      formTitle: form.title,
      submittedAt: new Date().toISOString(),
      respondentEmail: 'sarah.c@sky.net',
      ...topLevelProps,
      answers: answersMap,
    };

    return {
      success: true,
      isLive: false,
      sample: syntheticSample,
      form,
      message: 'Synthesized sample fields from form structure (waiting for live submission)',
    };
  }

  // ==========================================================================
  // Managed Polling Lifecycle for Active Workflows
  // ==========================================================================

  /**
   * Synchronize active polling jobs for a workflow
   */
  public syncWorkflow(workflow: Workflow): void {
    if (!workflow.active) {
      this.unregisterWorkflow(workflow.id);
      return;
    }

    const graph = (typeof workflow.graph === 'string'
      ? JSON.parse(workflow.graph)
      : workflow.graph) as WorkflowGraph;

    const formNodes = (graph?.nodes || []).filter(
      (n) => n.type === 'google_forms.trigger' || n.type === 'forms.trigger'
    );

    if (formNodes.length === 0) {
      this.unregisterWorkflow(workflow.id);
      return;
    }

    // Remove any orphaned jobs for this workflow
    const activeJobKeys = new Set(formNodes.map((n) => `${workflow.id}:${n.key}`));
    for (const [key, job] of this.pollJobs.entries()) {
      if (job.workflowId === workflow.id && !activeJobKeys.has(key)) {
        if (job.timer) clearInterval(job.timer);
        this.pollJobs.delete(key);
      }
    }

    // Register active polling for each form node
    for (const node of formNodes) {
      const jobKey = `${workflow.id}:${node.key}`;
      const credentialId = node.credentialId || (node.params?.credentialId as string);
      const formId = (node.params?.formId as string) || '';
      const intervalSec = Math.max(10, Number(node.params?.pollIntervalSeconds || 30));

      if (!credentialId || !formId) {
        console.warn(
          `[GoogleForms] Skipping form trigger for node '${node.key}' in workflow '${workflow.id}': missing credentialId or formId`
        );
        continue;
      }

      const existing = this.pollJobs.get(jobKey);
      if (existing && existing.credentialId === credentialId && existing.formId === formId) {
        // Already active with same configuration
        continue;
      }

      if (existing && existing.timer) {
        clearInterval(existing.timer);
      }

      const job: ActivePollJob = {
        workflowId: workflow.id,
        nodeKey: node.key,
        credentialId,
        formId,
        timer: null,
        lastCheckTimestamp: Date.now(),
        processedResponseIds: new Set<string>(),
      };

      // Set up recurring poll interval
      job.timer = setInterval(() => {
        this.pollFormJob(jobKey).catch((err) => {
          console.error(`[GoogleForms] Error polling job '${jobKey}':`, err);
        });
      }, intervalSec * 1000);

      this.pollJobs.set(jobKey, job);
      console.log(
        `[GoogleForms] Started managed polling for workflow '${workflow.name}' node '${node.key}' (form: ${formId}, interval: ${intervalSec}s)`
      );
    }
  }

  /**
   * Stop all polling jobs across all workflows.
   */
  public stopAll(): void {
    for (const job of this.pollJobs.values()) {
      if (job.timer) clearInterval(job.timer);
    }
    this.pollJobs.clear();
    console.log('[GoogleForms] All form polling jobs stopped.');
  }

  /**
   * Stop all polling jobs for a workflow
   */
  public unregisterWorkflow(workflowId: string): void {
    for (const [key, job] of this.pollJobs.entries()) {
      if (job.workflowId === workflowId) {
        if (job.timer) clearInterval(job.timer);
        this.pollJobs.delete(key);
        console.log(`[GoogleForms] Stopped polling job '${key}'`);
      }
    }
  }

  /**
   * Poll a specific form job and trigger workflow executions for newly detected responses
   */
  public async pollFormJob(jobKey: string): Promise<number> {
    const job = this.pollJobs.get(jobKey);
    if (!job) return 0;

    const wf = db.select().from(workflows).where(eq(workflows.id, job.workflowId)).get();
    if (!wf || !wf.active) {
      this.unregisterWorkflow(job.workflowId);
      return 0;
    }

    try {
      const form = await this.getForm(job.credentialId, job.formId);
      // Fetch responses after last check timestamp (ISO)
      const afterIso = new Date(job.lastCheckTimestamp - 5000).toISOString();
      const rawResponses = await this.getFormResponses(job.credentialId, job.formId, afterIso);

      let triggeredCount = 0;
      for (const raw of rawResponses) {
        const respId = raw.responseId;
        if (!respId || job.processedResponseIds.has(respId)) {
          continue;
        }

        // Deduplication safeguard
        job.processedResponseIds.add(respId);
        // Keep memory bounded to 2000 IDs
        if (job.processedResponseIds.size > 2000) {
          const first = job.processedResponseIds.values().next().value;
          if (first) job.processedResponseIds.delete(first);
        }

        const formatted = this.formatFormResponse(form, raw);
        console.log(
          `[GoogleForms] New submission detected (response: ${respId}) on form '${form.title}'! Starting workflow run '${wf.name}'...`
        );

        await runManager.startRun(wf, {
          triggerKey: job.nodeKey,
          triggerPayload: formatted,
        });

        triggeredCount++;
      }

      job.lastCheckTimestamp = Date.now();
      return triggeredCount;
    } catch (err: any) {
      console.warn(`[GoogleForms] Poll check failed for '${jobKey}': ${err.message || err}`);
      return 0;
    }
  }

  /**
   * Handle incoming push notification (webhook or Pub/Sub)
   */
  public async handlePushNotification(
    workflowId: string,
    nodeKey: string,
    rawPayload: any
  ): Promise<any> {
    const wf = db.select().from(workflows).where(eq(workflows.id, workflowId)).get();
    if (!wf || !wf.active) {
      throw new Error(`Workflow '${workflowId}' not found or inactive`);
    }

    const jobKey = `${workflowId}:${nodeKey}`;
    const job = this.pollJobs.get(jobKey);

    const respId = rawPayload?.responseId || rawPayload?.id;
    if (respId && job?.processedResponseIds.has(respId)) {
      return { duplicate: true, message: `Response '${respId}' already processed` };
    }

    if (respId && job) {
      job.processedResponseIds.add(respId);
    }

    return runManager.startRun(wf, {
      triggerKey: nodeKey,
      triggerPayload: rawPayload,
    });
  }

  /**
   * Initialize service on server boot: register all active workflows with forms triggers
   */
  public initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const activeWorkflows = db.select().from(workflows).where(eq(workflows.active, true)).all();
      for (const wf of activeWorkflows) {
        this.syncWorkflow(wf);
      }
      console.log(`[GoogleForms] Initialized with ${this.pollJobs.size} active form triggers`);
    } catch (err) {
      console.error('[GoogleForms] Failed to initialize active form workflows:', err);
    }
  }
}

export const googleFormsService = new GoogleFormsService();
