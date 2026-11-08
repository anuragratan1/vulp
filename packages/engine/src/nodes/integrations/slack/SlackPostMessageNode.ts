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

export class SlackPostMessageOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const webhookUrl = (secrets.webhookUrl || secrets.url || (params.webhookUrl as string) || '').trim();
    if (!webhookUrl) {
      throw new ConfigError(
        'Slack Post Message requires an Incoming Webhook URL. Please select or configure a Slack credential.'
      );
    }

    try {
      new URL(webhookUrl);
    } catch {
      throw new ConfigError('The configured Slack Webhook URL is invalid.');
    }

    const rawText = params.text ?? params.message;
    if (rawText === undefined || rawText === null || String(rawText).trim() === '') {
      throw new ConfigError("Parameter 'text' is required for Slack Post Message.");
    }
    const text = String(rawText);

    ctx.log('info', 'Dispatching Slack notification via incoming webhook');

    const payload: Record<string, any> = {
      text,
    };
    if (params.channel) {
      payload.channel = String(params.channel);
    }
    if (params.username) {
      payload.username = String(params.username);
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new Error('Slack request timed out after 15000ms'));
    }, 15000);

    const abortListener = () => {
      timeoutController.abort(ctx.signal.reason);
    };
    ctx.signal.addEventListener('abort', abortListener, { once: true });

    let response: Response;
    let responseText = '';
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: timeoutController.signal,
      });
      responseText = await response.text();
    } catch (netErr: any) {
      if (timeoutController.signal.aborted) {
        throw new NodeError(`Slack request timed out or was aborted: ${netErr?.message}`, true);
      }
      throw new NodeError(`Network error while communicating with Slack: ${netErr?.message}`, true);
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', abortListener);
    }

    if (response.status === 429) {
      throw new NodeError(`Slack rate limit exceeded (429): ${responseText || 'Too many requests'}`, true);
    }

    if (response.status >= 500) {
      throw new NodeError(`Slack server error (${response.status}): ${responseText || response.statusText}`, true);
    }

    if (!response.ok || responseText.trim() !== 'ok') {
      throw new NodeError(
        `Slack webhook failed (${response.status}): ${responseText || response.statusText}`,
        false
      );
    }

    return {
      success: true,
      deliveredAt: new Date().toISOString(),
      text,
    };
  }
}

export class SlackPostMessageNode extends IntegrationActionNode {
  readonly type = 'slack.postMessage';
  readonly label = 'Slack Post Message';
  readonly integration = 'slack';
  readonly operation = 'postMessage';
  readonly credentialType = 'slack';

  readonly params: ParamField[] = [
    {
      name: 'text',
      label: 'Message Content',
      kind: 'text',
      required: true,
    },
    {
      name: 'channel',
      label: 'Channel Override (Optional)',
      kind: 'string',
      required: false,
    },
    {
      name: 'username',
      label: 'Bot Name Override (Optional)',
      kind: 'string',
      required: false,
    },
  ];

  private readonly op = new SlackPostMessageOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}

