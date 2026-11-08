import {
  ConfigError,
  Json,
  NodeError,
  ParamField,
  RunContext,
} from '../../../contracts.js';
import {
  IIntegrationOperation,
  IntegrationActionNode,
} from '../../base/IntegrationActionNode.js';

export class GitHubCreateIssueOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const token = (
      secrets.token ||
      secrets.personalAccessToken ||
      secrets.apiKey ||
      ''
    ).trim();

    if (!token) {
      throw new ConfigError(
        'GitHub Create Issue requires a Personal Access Token. Please select or configure a GitHub credential.'
      );
    }

    const rawOwner = params.owner;
    if (!rawOwner || String(rawOwner).trim() === '') {
      throw new ConfigError("Parameter 'owner' (organization or username) is required.");
    }
    const owner = String(rawOwner).trim();

    const rawRepo = params.repo;
    if (!rawRepo || String(rawRepo).trim() === '') {
      throw new ConfigError("Parameter 'repo' (repository name) is required.");
    }
    const repo = String(rawRepo).trim();

    const rawTitle = params.title;
    if (!rawTitle || String(rawTitle).trim() === '') {
      throw new ConfigError("Parameter 'title' is required for GitHub Create Issue.");
    }
    const title = String(rawTitle).trim();

    const body = params.body ? String(params.body) : '';

    let labels: string[] | undefined = undefined;
    if (params.labels) {
      if (Array.isArray(params.labels)) {
        labels = params.labels.map(String);
      } else if (typeof params.labels === 'string') {
        labels = params.labels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`;
    ctx.log('info', `Creating GitHub issue in ${owner}/${repo}: "${title}"`);

    const payload: Record<string, any> = {
      title,
      body,
    };
    if (labels && labels.length > 0) {
      payload.labels = labels;
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new Error('GitHub request timed out after 15000ms'));
    }, 15000);

    const abortListener = () => {
      timeoutController.abort(ctx.signal.reason);
    };
    ctx.signal.addEventListener('abort', abortListener, { once: true });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Vulp-Automation-Engine',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: timeoutController.signal,
      });
    } catch (netErr: any) {
      if (timeoutController.signal.aborted) {
        throw new NodeError(`GitHub request timed out or was aborted: ${netErr?.message}`, true);
      }
      throw new NodeError(`Network error while communicating with GitHub: ${netErr?.message}`, true);
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', abortListener);
    }

    let resultJson: any = null;
    try {
      resultJson = await response.json();
    } catch {
      // response might not be JSON
    }

    const msg = resultJson?.message || response.statusText;

    if (response.status === 429 || (response.status === 403 && msg.toLowerCase().includes('rate limit'))) {
      throw new NodeError(`GitHub rate limit exceeded (${response.status}): ${msg}`, true);
    }

    if (response.status >= 500) {
      throw new NodeError(`GitHub server error (${response.status}): ${msg}`, true);
    }

    if (response.status === 401) {
      throw new NodeError(`GitHub authentication failed (401): Invalid or expired token.`, false);
    }

    if (response.status === 404) {
      throw new NodeError(
        `GitHub repository '${owner}/${repo}' not found (404) or token lacks access.`,
        false
      );
    }

    if (response.status === 403) {
      throw new NodeError(
        `GitHub permission denied (403): Token lacks write permission to '${owner}/${repo}'.`,
        false
      );
    }

    if (!response.ok) {
      throw new NodeError(`GitHub API error (${response.status}): ${msg}`, false);
    }

    return {
      issueNumber: resultJson?.number,
      issueUrl: resultJson?.html_url,
      title: resultJson?.title,
      state: resultJson?.state,
      id: resultJson?.id,
      createdAt: resultJson?.created_at,
    };
  }
}

export class GitHubCreateIssueNode extends IntegrationActionNode {
  readonly type = 'github.createIssue';
  readonly label = 'GitHub Create Issue';
  readonly integration = 'github';
  readonly operation = 'createIssue';
  readonly credentialType = 'github';

  readonly params: ParamField[] = [
    {
      name: 'owner',
      label: 'Repository Owner / Organization',
      kind: 'string',
      required: true,
    },
    {
      name: 'repo',
      label: 'Repository Name',
      kind: 'string',
      required: true,
    },
    {
      name: 'title',
      label: 'Issue Title',
      kind: 'string',
      required: true,
    },
    {
      name: 'body',
      label: 'Issue Description / Markdown',
      kind: 'text',
      required: false,
    },
    {
      name: 'labels',
      label: 'Labels (comma-separated)',
      kind: 'string',
      required: false,
    },
  ];

  private readonly op = new GitHubCreateIssueOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}

