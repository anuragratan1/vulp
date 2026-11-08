import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkflowEngine,
  createDefaultNodeRegistry,
  WorkflowGraph,
  ICredentialStore,
  NodeError,
  ConfigError,
} from '../src/index.js';

describe('M5 External Integrations (Telegram, Slack, GitHub)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockCredentials: Record<string, Record<string, string>> = {
    cred_telegram: {
      botToken: '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_secret_token',
    },
    cred_slack: {
      webhookUrl: 'https://hooks.slack.com/services/T000/B000/secret_token_123',
    },
    cred_github: {
      token: 'ghp_secretPersonalAccessToken9988776655443322',
    },
  };

  const credentialStore: ICredentialStore = {
    get: async (id: string) => {
      if (mockCredentials[id]) {
        return mockCredentials[id];
      }
      throw new Error(`Credential '${id}' not found`);
    },
  };

  const registry = createDefaultNodeRegistry();

  // ----------------------------------------------------
  // Telegram Integration Tests
  // ----------------------------------------------------
  describe('Telegram Send Message Node', () => {
    it('successfully sends message using bot token and returns structured JSON', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ok: true,
          result: {
            message_id: 1042,
            chat: { id: 987654321, title: 'Alerts Channel' },
            date: 1710000000,
            text: 'Lead Qualified: John Doe ($1500)',
            from: { username: 'VulpAlertBot' },
          },
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Inbound Lead',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'telegram_step',
            type: 'telegram.sendMessage',
            name: 'Send Alert',
            position: { x: 200, y: 0 },
            credentialId: 'cred_telegram',
            params: {
              chatId: '987654321',
              text: 'Lead Qualified: {{trigger.lead.name}} (${{trigger.lead.value}})',
            },
          },
        ],
        edges: [
          { id: 'e1', source: 'trig', sourcePort: 'default', target: 'telegram_step' },
        ],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-telegram-1',
        triggerKey: 'trig',
        triggerPayload: {
          lead: { name: 'John Doe', value: 1500 },
        },
      });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_secret_token');
      const sentPayload = JSON.parse(calledOpts.body);
      expect(sentPayload.chat_id).toBe('987654321');
      expect(sentPayload.text).toBe('Lead Qualified: John Doe ($1500)');
    });

    it('fails non-retryable if credential or botToken is missing', async () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'tg_missing',
            type: 'telegram.sendMessage',
            name: 'Send Telegram',
            position: { x: 200, y: 0 },
            params: {
              chatId: '12345',
              text: 'Hello world',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'tg_missing' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-tg-missing',
        triggerKey: 'trig',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Telegram Bot Token');
    });

    it('identifies 429 rate limit as retryable error', async () => {
      let attempts = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          return {
            ok: false,
            status: 429,
            statusText: 'Too Many Requests',
            json: async () => ({
              ok: false,
              description: 'Too Many Requests: retry after 1',
              parameters: { retry_after: 1 },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          json: async () => ({
            ok: true,
            result: { message_id: 1043, chat: { id: 12345 } },
          }),
        };
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'tg_retry',
            type: 'telegram.sendMessage',
            name: 'Send with Retry',
            position: { x: 200, y: 0 },
            credentialId: 'cred_telegram',
            retry: { maxAttempts: 3, backoff: 'fixed', delayMs: 10 },
            params: {
              chatId: '12345',
              text: 'Retry test',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'tg_retry' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-tg-retry',
        triggerKey: 'trig',
      });

      expect(result.status).toBe('succeeded');
      expect(attempts).toBe(3);
    });

    it('redacts bot token secret from output and logs', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ok: true,
          result: {
            message_id: 2001,
            chat: { id: 999 },
            text: 'Echo secret: 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_secret_token',
          },
        }),
      });
      globalThis.fetch = mockFetch;

      let loggedMessages: string[] = [];
      const observer = {
        onEvent: (event: any) => {
          if (event.type === 'node.finished' && event.nodeKey === 'tg_redact') {
            loggedMessages = loggedMessages.concat(event.logs || []);
            const outStr = JSON.stringify(event.output || {});
            expect(outStr).not.toContain('123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_secret_token');
            expect(outStr).toContain('[REDACTED]');
          }
        },
      };

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'tg_redact',
            type: 'telegram.sendMessage',
            name: 'Redact Step',
            position: { x: 200, y: 0 },
            credentialId: 'cred_telegram',
            params: {
              chatId: '999',
              text: 'test',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'tg_redact' }],
      };

      const engine = new WorkflowEngine(registry, {
        credentials: credentialStore,
        observers: [observer],
      });
      const result = await engine.run(graph, {
        runId: 'run-tg-redact',
        triggerKey: 'trig',
      });

      expect(result.status).toBe('succeeded');
      expect(JSON.stringify(loggedMessages)).not.toContain(
        '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_secret_token'
      );
    });
  });

  // ----------------------------------------------------
  // Slack Integration Tests
  // ----------------------------------------------------
  describe('Slack Post Message Node', () => {
    it('successfully posts message to incoming webhook URL', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'ok',
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'slack_step',
            type: 'slack.postMessage',
            name: 'Slack Notification',
            position: { x: 200, y: 0 },
            credentialId: 'cred_slack',
            params: {
              text: 'New Issue: {{trigger.issueTitle}} created by {{trigger.author}}',
              channel: '#deployments',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'slack_step' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-slack-1',
        triggerKey: 'trig',
        triggerPayload: {
          issueTitle: 'DB Deadlock in Checkout',
          author: 'Alice',
        },
      });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://hooks.slack.com/services/T000/B000/secret_token_123');
      const body = JSON.parse(calledOpts.body);
      expect(body.text).toBe('New Issue: DB Deadlock in Checkout created by Alice');
      expect(body.channel).toBe('#deployments');
    });

    it('fails with clear error when Slack webhook returns invalid_payload (4xx)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_payload',
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'slack_err',
            type: 'slack.postMessage',
            name: 'Slack Error',
            position: { x: 200, y: 0 },
            credentialId: 'cred_slack',
            params: {
              text: 'Payload',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'slack_err' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-slack-err',
        triggerKey: 'trig',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Slack webhook failed (400): invalid_payload');
    });
  });

  // ----------------------------------------------------
  // GitHub Integration Tests
  // ----------------------------------------------------
  describe('GitHub Create Issue Node', () => {
    it('successfully creates an issue in specified repository using Personal Access Token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        statusText: 'Created',
        json: async () => ({
          id: 991823,
          number: 42,
          title: 'Bug: Crash on mobile view',
          state: 'open',
          html_url: 'https://github.com/vulp-org/vulp-app/issues/42',
          created_at: '2026-11-06T00:00:00Z',
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gh_step',
            type: 'github.createIssue',
            name: 'Create GitHub Issue',
            position: { x: 200, y: 0 },
            credentialId: 'cred_github',
            params: {
              owner: 'vulp-org',
              repo: 'vulp-app',
              title: 'Bug: Crash on mobile view',
              body: 'Automated report from: {{trigger.reporter}}',
              labels: 'bug, automated',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gh_step' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-gh-1',
        triggerKey: 'trig',
        triggerPayload: {
          reporter: 'QualityBot',
        },
      });

      expect(result.status).toBe('succeeded');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe('https://api.github.com/repos/vulp-org/vulp-app/issues');
      expect(calledOpts.headers['Authorization']).toBe(
        'Bearer ghp_secretPersonalAccessToken9988776655443322'
      );
      const parsedBody = JSON.parse(calledOpts.body);
      expect(parsedBody.title).toBe('Bug: Crash on mobile view');
      expect(parsedBody.body).toBe('Automated report from: QualityBot');
      expect(parsedBody.labels).toEqual(['bug', 'automated']);
    });

    it('fails non-retryable on GitHub 401 Unauthorized or 404 Not Found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          message: 'Bad credentials',
        }),
      });
      globalThis.fetch = mockFetch;

      const graph: WorkflowGraph = {
        nodes: [
          {
            key: 'trig',
            type: 'manual.trigger',
            name: 'Trigger',
            position: { x: 0, y: 0 },
            params: {},
          },
          {
            key: 'gh_fail',
            type: 'github.createIssue',
            name: 'Create GitHub Issue',
            position: { x: 200, y: 0 },
            credentialId: 'cred_github',
            params: {
              owner: 'vulp-org',
              repo: 'private-repo',
              title: 'Issue',
            },
          },
        ],
        edges: [{ id: 'e1', source: 'trig', sourcePort: 'default', target: 'gh_fail' }],
      };

      const engine = new WorkflowEngine(registry, { credentials: credentialStore });
      const result = await engine.run(graph, {
        runId: 'run-gh-fail',
        triggerKey: 'trig',
      });

      expect(result.status).toBe('failed');
      expect(result.error).toContain('GitHub authentication failed (401)');
    });
  });
});
