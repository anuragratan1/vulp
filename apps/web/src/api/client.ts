import { WorkflowGraph, Json } from '@workflow/engine';

export interface NodeTypeMetadata {
  type: string;
  label: string;
  category: 'trigger' | 'action' | 'logic';
  outputs: string[];
  params: {
    name: string;
    label: string;
    required?: boolean;
    default?: Json;
    kind: 'string' | 'text' | 'number' | 'boolean' | 'select' | 'json';
    options?: string[];
  }[];
  credentialType?: string;
}

export interface WorkflowRecord {
  id: string;
  name: string;
  graph: WorkflowGraph;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CredentialRecord {
  id: string;
  name: string;
  type: string;
  createdAt: number;
}

export interface ConnectionRecord {
  id: string;
  name: string;
  type: string;
  accountIdentifier: string;
  createdAt: number;
  status: 'connected' | 'expired';
  workflowCount: number;
  workflows: Array<{ id: string; name: string }>;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  category: string;
  brandColor: string;
  description: string;
  authType: 'oauth2' | 'botToken' | 'webhookUrl' | 'apiKey';
  credentialType: string;
  setupUrl: string;
  requiredScopes?: string[];
  instructions: string[];
  operations: Array<{
    type: string;
    label: string;
    description: string;
  }>;
}

export interface WebhookRecord {
  token: string;
  workflowId: string;
  nodeKey: string;
  url: string;
}

export interface WorkflowTemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  graph: WorkflowGraph;
  requiredCredentials: {
    stepKey: string;
    stepName: string;
    credentialType: string;
    description: string;
  }[];
}

export interface RunRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  triggerPayload: Json;
  graphSnapshot: WorkflowGraph;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  queuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface NodeRunRecord {
  id: string;
  runId: string;
  seq: number;
  nodeKey: string;
  nodeName: string;
  nodeType: string;
  status: 'running' | 'succeeded' | 'failed' | 'skipped';
  attempts: number;
  paramsResolved: Json;
  output: Json;
  error: string | null;
  logs: string[];
  startedAt: number;
  finishedAt: number | null;
}

const API_BASE = ''; // uses relative path (vite proxy in dev or same host in prod)

interface CacheStore {
  workflows: WorkflowRecord[] | null;
  runs: RunRecord[] | null;
  connections: ConnectionRecord[] | null;
  credentials: CredentialRecord[] | null;
  templates: WorkflowTemplateRecord[] | null;
  nodeTypes: NodeTypeMetadata[] | null;
}

const dataCache: CacheStore = {
  workflows: null,
  runs: null,
  connections: null,
  credentials: null,
  templates: null,
  nodeTypes: null,
};

export const api = {
  // In-memory cache accessors for instant zero-flicker route transitions
  getCachedWorkflows(): WorkflowRecord[] | null {
    return dataCache.workflows;
  },
  setCachedWorkflows(list: WorkflowRecord[]) {
    dataCache.workflows = list;
  },

  getCachedRuns(): RunRecord[] | null {
    return dataCache.runs;
  },
  setCachedRuns(list: RunRecord[]) {
    dataCache.runs = list;
  },

  getCachedConnections(): ConnectionRecord[] | null {
    return dataCache.connections;
  },
  setCachedConnections(list: ConnectionRecord[]) {
    dataCache.connections = list;
  },

  getCachedCredentials(): CredentialRecord[] | null {
    return dataCache.credentials;
  },
  setCachedCredentials(list: CredentialRecord[]) {
    dataCache.credentials = list;
  },

  getCachedTemplates(): WorkflowTemplateRecord[] | null {
    return dataCache.templates;
  },
  setCachedTemplates(list: WorkflowTemplateRecord[]) {
    dataCache.templates = list;
  },

  getCachedNodeTypes(): NodeTypeMetadata[] | null {
    return dataCache.nodeTypes;
  },
  setCachedNodeTypes(list: NodeTypeMetadata[]) {
    dataCache.nodeTypes = list;
  },

  invalidateCache(key?: keyof CacheStore) {
    if (key) {
      dataCache[key] = null;
    } else {
      dataCache.workflows = null;
      dataCache.runs = null;
      dataCache.connections = null;
      dataCache.credentials = null;
      dataCache.templates = null;
      dataCache.nodeTypes = null;
    }
  },

  async getNodeTypes(): Promise<NodeTypeMetadata[]> {
    const res = await fetch(`${API_BASE}/api/node-types`);
    if (!res.ok) throw new Error('Failed to fetch node types');
    const data = await res.json();
    dataCache.nodeTypes = data.nodeTypes;
    return data.nodeTypes;
  },

  async getWorkflows(): Promise<WorkflowRecord[]> {
    const res = await fetch(`${API_BASE}/api/workflows`);
    if (!res.ok) throw new Error('Failed to fetch workflows');
    const data = await res.json();
    dataCache.workflows = data.workflows;
    return data.workflows;
  },

  async getWorkflow(id: string): Promise<WorkflowRecord> {
    const res = await fetch(`${API_BASE}/api/workflows/${id}`);
    if (!res.ok) throw new Error(`Workflow '${id}' not found`);
    const data = await res.json();
    if (dataCache.workflows) {
      const idx = dataCache.workflows.findIndex((w) => w.id === id);
      if (idx !== -1) {
        dataCache.workflows[idx] = data.workflow;
      }
    }
    return data.workflow;
  },

  async createWorkflow(params: {
    name?: string;
    graph?: WorkflowGraph;
    active?: boolean;
  }): Promise<WorkflowRecord> {
    const res = await fetch(`${API_BASE}/api/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to create workflow');
    }
    const data = await res.json();
    if (dataCache.workflows) {
      dataCache.workflows = [data.workflow, ...dataCache.workflows];
    }
    return data.workflow;
  },

  async updateWorkflow(
    id: string,
    params: {
      name?: string;
      graph?: WorkflowGraph;
      active?: boolean;
    }
  ): Promise<WorkflowRecord> {
    const res = await fetch(`${API_BASE}/api/workflows/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to update workflow');
    }
    const data = await res.json();
    if (dataCache.workflows) {
      dataCache.workflows = dataCache.workflows.map((w) =>
        w.id === id ? data.workflow : w
      );
    }
    return data.workflow;
  },

  async deleteWorkflow(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/workflows/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete workflow '${id}'`);
    if (dataCache.workflows) {
      dataCache.workflows = dataCache.workflows.filter((w) => w.id !== id);
    }
  },

  async activateWorkflow(id: string): Promise<{ workflow: WorkflowRecord }> {
    const res = await fetch(`${API_BASE}/api/workflows/${id}/activate`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to activate workflow');
    }
    const data = await res.json();
    if (dataCache.workflows) {
      dataCache.workflows = dataCache.workflows.map((w) =>
        w.id === id ? data.workflow : w
      );
    }
    return data;
  },

  async deactivateWorkflow(id: string): Promise<{ workflow: WorkflowRecord }> {
    const res = await fetch(`${API_BASE}/api/workflows/${id}/deactivate`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to deactivate workflow');
    }
    const data = await res.json();
    if (dataCache.workflows) {
      dataCache.workflows = dataCache.workflows.map((w) =>
        w.id === id ? data.workflow : w
      );
    }
    return data;
  },

  async getWorkflowWebhooks(workflowId: string): Promise<WebhookRecord[]> {
    const res = await fetch(`${API_BASE}/api/workflows/${workflowId}/webhooks`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.webhooks || [];
  },

  async getWebhookSample(
    workflowId: string,
    nodeKey: string
  ): Promise<{ samplePayload: any; lastPayload: any; lastReceivedAt: string | null }> {
    const res = await fetch(`${API_BASE}/api/workflows/${workflowId}/webhooks/${nodeKey}/sample`);
    if (!res.ok) {
      return { samplePayload: null, lastPayload: null, lastReceivedAt: null };
    }
    return res.json();
  },

  async setWebhookSample(
    workflowId: string,
    nodeKey: string,
    samplePayload: any
  ): Promise<{ success: boolean; samplePayload: any; lastReceivedAt: string }> {
    const res = await fetch(`${API_BASE}/api/workflows/${workflowId}/webhooks/${nodeKey}/sample`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ samplePayload }),
    });
    if (!res.ok) throw new Error('Failed to set webhook sample payload');
    return res.json();
  },

  // Credentials APIs
  async getCredentials(): Promise<CredentialRecord[]> {
    const res = await fetch(`${API_BASE}/api/credentials`);
    if (!res.ok) throw new Error('Failed to fetch credentials');
    const data = await res.json();
    dataCache.credentials = data.credentials;
    return data.credentials;
  },

  async createCredential(params: {
    name: string;
    type: string;
    data: Record<string, string>;
  }): Promise<CredentialRecord> {
    const res = await fetch(`${API_BASE}/api/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to save credential');
    }
    const data = await res.json();
    if (dataCache.credentials) {
      dataCache.credentials = [data.credential, ...dataCache.credentials];
    }
    return data.credential;
  },

  async updateCredential(
    id: string,
    params: {
      name?: string;
      type?: string;
      data?: Record<string, string>;
    }
  ): Promise<CredentialRecord> {
    const res = await fetch(`${API_BASE}/api/credentials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to update credential');
    }
    const data = await res.json();
    if (dataCache.credentials) {
      dataCache.credentials = dataCache.credentials.map((c) =>
        c.id === id ? data.credential : c
      );
    }
    return data.credential;
  },

  async deleteCredential(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/credentials/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete credential');
    if (dataCache.credentials) {
      dataCache.credentials = dataCache.credentials.filter((c) => c.id !== id);
    }
  },

  // Connections APIs (M6 Unified Experience)
  async getConnections(): Promise<ConnectionRecord[]> {
    const res = await fetch(`${API_BASE}/api/connections`);
    if (!res.ok) throw new Error('Failed to fetch connections');
    const data = await res.json();
    dataCache.connections = data.connections;
    return data.connections;
  },

  async validateConnection(
    type: string,
    secrets: Record<string, string>
  ): Promise<{ valid: boolean; identifier?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/api/connections/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, secrets }),
    });
    return res.json();
  },

  async refreshConnection(id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/api/connections/${id}/refresh`, {
      method: 'POST',
    });
    return res.json();
  },

  async disconnectConnection(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/connections/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to disconnect connection');
    if (dataCache.connections) {
      dataCache.connections = dataCache.connections.filter((c) => c.id !== id);
    }
  },

  // Integrations Registry & Google Discovery APIs
  async getIntegrations(): Promise<IntegrationDefinition[]> {
    const res = await fetch(`${API_BASE}/api/integrations`);
    if (!res.ok) throw new Error('Failed to fetch integrations');
    const data = await res.json();
    return data.integrations;
  },

  async getGoogleAuthUrl(origin?: string): Promise<{
    url: string;
    state: string;
    configured: boolean;
    clientId: string | null;
    redirectUri: string;
  }> {
    const url = new URL(`${API_BASE}/api/auth/google`, window.location.href);
    if (origin) url.searchParams.set('origin', origin);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Failed to generate OAuth URL');
    return res.json();
  },

  async saveDirectToken(data: {
    type: string;
    accessToken: string;
    refreshToken?: string;
    email?: string;
    name?: string;
  }): Promise<CredentialRecord> {
    const res = await fetch(`${API_BASE}/api/auth/direct-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to save token');
    }
    const resData = await res.json();
    if (dataCache.credentials) {
      dataCache.credentials = [
        resData.credential,
        ...dataCache.credentials.filter((c) => c.id !== resData.credential.id),
      ];
    }
    dataCache.connections = null;
    return resData.credential;
  },

  async getGoogleForms(
    credentialId: string,
    query?: string
  ): Promise<Array<{ id: string; name: string; modifiedTime?: string; responderUri?: string; webViewLink?: string }>> {
    const params = new URLSearchParams();
    params.set('credentialId', credentialId);
    if (query) params.set('query', query);
    const res = await fetch(`${API_BASE}/api/integrations/google/forms?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to list Google Forms');
    }
    return data.forms || [];
  },

  async getGoogleForm(
    formId: string,
    credentialId: string
  ): Promise<{
    id: string;
    title: string;
    description: string;
    responderUri: string;
    webViewLink: string;
    questions: Array<{
      id: string;
      itemId?: string;
      title: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  }> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/forms/${encodeURIComponent(
        formId
      )}?credentialId=${encodeURIComponent(credentialId)}`
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch Google Form details');
    }
    return data.form;
  },

  async createGoogleForm(params: {
    credentialId: string;
    title: string;
    questions?: Array<{ title: string; required?: boolean; type?: string }>;
  }): Promise<{
    id: string;
    title: string;
    description: string;
    responderUri: string;
    webViewLink: string;
    questions: Array<{
      id: string;
      itemId?: string;
      title: string;
      type: string;
      required: boolean;
      description?: string;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/api/integrations/google/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create Google Form');
    }
    return data.form;
  },

  async testGoogleFormTrigger(
    formId: string,
    credentialId: string,
    workflowId?: string,
    nodeKey?: string
  ): Promise<{
    success: boolean;
    isLive: boolean;
    sample: Record<string, any>;
    form: any;
    message?: string;
  }> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/forms/${encodeURIComponent(formId)}/test`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId, workflowId, nodeKey }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to test Google Form trigger');
    }
    return data;
  },

  async getGoogleSpreadsheets(
    credentialId: string,
    query?: string
  ): Promise<Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>> {
    const params = new URLSearchParams();
    params.set('credentialId', credentialId);
    if (query) params.set('query', query);
    const res = await fetch(`${API_BASE}/api/integrations/google/spreadsheets?${params.toString()}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to list spreadsheets');
    }
    return data.spreadsheets || [];
  },

  async getGoogleSpreadsheet(
    spreadsheetId: string,
    credentialId: string
  ): Promise<{
    valid: boolean;
    spreadsheetId: string;
    title: string;
    sheets: string[];
    spreadsheetUrl: string;
  }> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}?credentialId=${encodeURIComponent(credentialId)}`
    );
    const data = await res.json();
    if (!res.ok || !data.valid) {
      const err = new Error(data.error || 'Spreadsheet is inaccessible or was not found.');
      (err as any).status = res.status;
      (err as any).details = data.details;
      throw err;
    }
    return data;
  },

  async createGoogleSpreadsheet(params: {
    credentialId: string;
    title: string;
    sheetName?: string;
    headers?: string[];
  }): Promise<{
    success: boolean;
    spreadsheetId: string;
    spreadsheetUrl: string;
    title: string;
    sheetName: string;
    sheets: string[];
    headers: string[];
  }> {
    const res = await fetch(`${API_BASE}/api/integrations/google/spreadsheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create Google Spreadsheet');
    }
    return data;
  },

  async createGoogleSheetColumns(
    spreadsheetId: string,
    params: {
      credentialId: string;
      sheetName?: string;
      columns: string[];
    }
  ): Promise<{ success: boolean; headers: string[] }> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/spreadsheets/${encodeURIComponent(spreadsheetId)}/columns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to add column headers');
    }
    return data;
  },

  async getGoogleSheets(
    spreadsheetId: string,
    credentialId: string
  ): Promise<string[]> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/sheets?credentialId=${encodeURIComponent(credentialId)}`
    );
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Failed to list sheets');
      (err as any).status = res.status;
      throw err;
    }
    return data.sheets || ['Sheet1'];
  },

  async getGoogleSheetHeaders(
    spreadsheetId: string,
    sheetName: string,
    credentialId: string
  ): Promise<string[]> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/headers?credentialId=${encodeURIComponent(credentialId)}&sheetName=${encodeURIComponent(
        sheetName
      )}`
    );
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || 'Failed to load sheet headers');
      (err as any).status = res.status;
      throw err;
    }
    return data.headers || [];
  },

  async getGoogleCalendars(
    credentialId: string
  ): Promise<Array<{ id: string; summary: string }>> {
    const res = await fetch(
      `${API_BASE}/api/integrations/google/calendars?credentialId=${encodeURIComponent(
        credentialId
      )}`
    );
    if (!res.ok) return [{ id: 'primary', summary: 'Primary Calendar' }];
    const data = await res.json();
    return data.calendars || [{ id: 'primary', summary: 'Primary Calendar' }];
  },

  async getGoogleDriveFiles(
    credentialId: string,
    query?: string,
    type?: 'files' | 'folders' | 'spreadsheets' | 'all'
  ): Promise<Array<{ id: string; name: string; mimeType: string; size?: number; iconLink?: string }>> {
    const params = new URLSearchParams({ credentialId });
    if (query) params.set('query', query);
    if (type) params.set('type', type);
    const res = await fetch(`${API_BASE}/api/integrations/google/drive/files?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  },

  // Runs APIs
  async runWorkflow(
    id: string,
    params: {
      triggerKey?: string;
      triggerPayload?: Json;
    } = {}
  ): Promise<{ runId: string }> {
    const res = await fetch(`${API_BASE}/api/workflows/${id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to run workflow');
    }
    return res.json();
  },

  async getRuns(): Promise<RunRecord[]> {
    const res = await fetch(`${API_BASE}/api/runs`);
    if (!res.ok) throw new Error('Failed to fetch runs');
    const data = await res.json();
    dataCache.runs = data.runs;
    return data.runs;
  },

  async getRunDetails(
    runId: string
  ): Promise<{ run: RunRecord; nodeRuns: NodeRunRecord[] }> {
    const res = await fetch(`${API_BASE}/api/runs/${runId}`);
    if (!res.ok) throw new Error('Failed to fetch run details');
    return res.json();
  },

  async cancelRun(runId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/api/runs/${runId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to cancel execution');
    }
    return res.json();
  },

  getRunEventsUrl(runId: string): string {
    return `${API_BASE}/api/runs/${runId}/events`;
  },

  // Templates APIs
  async getTemplates(): Promise<WorkflowTemplateRecord[]> {
    const res = await fetch(`${API_BASE}/api/templates`);
    if (!res.ok) throw new Error('Failed to fetch workflow templates');
    const data = await res.json();
    dataCache.templates = data.templates;
    return data.templates;
  },

  async instantiateTemplate(
    id: string,
    name?: string
  ): Promise<{ workflow: WorkflowRecord; template: WorkflowTemplateRecord; message: string }> {
    const res = await fetch(`${API_BASE}/api/templates/${id}/instantiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.details || err.error || 'Failed to instantiate template');
    }
    const result = await res.json();
    if (dataCache.workflows) {
      dataCache.workflows = [result.workflow, ...dataCache.workflows];
    }
    return result;
  },
};
