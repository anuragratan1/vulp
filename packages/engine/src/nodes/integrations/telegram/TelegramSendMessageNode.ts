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

/**
 * Safely redact Telegram bot tokens from any string, URL, log, or error message.
 */
export function redactBotToken(str: string, token?: string): string {
  if (!str) return '';
  let out = String(str);
  if (token && token.trim()) {
    out = out.split(token.trim()).join('[REDACTED_BOT_TOKEN]');
  }
  out = out.replace(/\b\d{8,11}:[A-Za-z0-9_-]{35}\b/g, '[REDACTED_BOT_TOKEN]');
  out = out.replace(/https:\/\/api\.telegram\.org\/bot[^/\s]+/g, 'https://api.telegram.org/bot[REDACTED_BOT_TOKEN]');
  return out;
}

export class TelegramSendMessageOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawBotToken = secrets.botToken || secrets.token || secrets.apiKey;
    if (!rawBotToken || !rawBotToken.trim()) {
      throw new ConfigError(
        'Telegram Send Message requires a Telegram Bot Token. Please select or add a Telegram credential.'
      );
    }
    const botToken = rawBotToken.trim();

    const rawChatId = params.chatId;
    if (rawChatId === undefined || rawChatId === null || String(rawChatId).trim() === '') {
      throw new ConfigError("Parameter 'chatId' is required for Telegram Send Message.");
    }
    let chatId = String(rawChatId).trim();
    // Normalize t.me channel links if entered (e.g. https://t.me/channel_name -> @channel_name)
    chatId = chatId.replace(/^(?:https?:\/\/)?t\.me\//, '@');

    const rawText = params.text;
    if (rawText === undefined || rawText === null || String(rawText).trim() === '') {
      throw new ConfigError("Parameter 'text' is required for Telegram Send Message.");
    }
    const text = String(rawText);

    const parseMode = params.parseMode ? String(params.parseMode) : undefined;

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    ctx.log('info', `Sending Telegram message to chat ${chatId}`);

    const payload: Record<string, any> = {
      chat_id: chatId,
      text,
    };
    if (parseMode && ['Markdown', 'MarkdownV2', 'HTML'].includes(parseMode)) {
      payload.parse_mode = parseMode;
    }

    const timeoutController = new AbortController();
    const timer = setTimeout(() => {
      timeoutController.abort(new Error('Telegram request timed out after 15000ms'));
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: timeoutController.signal,
      });
    } catch (netErr: any) {
      if (timeoutController.signal.aborted) {
        throw new NodeError(`Telegram request timed out or was aborted: ${redactBotToken(netErr?.message, botToken)}`, true);
      }
      throw new NodeError(`Network error while communicating with Telegram: ${redactBotToken(netErr?.message, botToken)}`, true);
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

    const rawDescription = resultJson?.description || response.statusText;
    const description = redactBotToken(rawDescription, botToken);

    if (response.status === 429) {
      const retryAfter = resultJson?.parameters?.retry_after;
      throw new NodeError(
        `Telegram rate limit exceeded (429): ${description}${retryAfter ? ` (retry after ${retryAfter}s)` : ''}`,
        true
      );
    }

    if (response.status >= 500) {
      throw new NodeError(
        `Telegram server error (${response.status}): ${description}`,
        true
      );
    }

    if (!response.ok || (resultJson && !resultJson.ok)) {
      // If formatting failed with Markdown/HTML parse errors, retry sending as plain text
      if (
        payload.parse_mode &&
        (description.toLowerCase().includes("can't parse entities") ||
          description.toLowerCase().includes('entity'))
      ) {
        ctx.log(
          'warn',
          `Telegram formatting error with parse_mode '${payload.parse_mode}': ${description}. Retrying delivery as plain text...`
        );
        try {
          const fallbackRes = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chat_id: chatId, text }),
          });
          const fallbackJson: any = await fallbackRes.json().catch(() => null);
          if (fallbackRes.ok && fallbackJson?.ok) {
            return {
              success: true,
              messageId: fallbackJson.result?.message_id,
              chatId: String(fallbackJson.result?.chat?.id),
              date: fallbackJson.result?.date,
              text: fallbackJson.result?.text,
              sender: fallbackJson.result?.from?.username || fallbackJson.result?.from?.first_name,
              formattingFallback: true,
            };
          }
        } catch {
          // fallback failed, continue to standard error mapping below
        }
      }

      // Provide clear, actionable errors for known Telegram rejection causes
      if (description.toLowerCase().includes('chat not found')) {
        throw new NodeError(
          `Telegram API error (400): Chat not found (chatId: '${chatId}'). Ensure the user or group has sent '/start' to the bot, or that the bot has been added as a member of the group/channel.`,
          false
        );
      }

      if (description.toLowerCase().includes('bot was blocked')) {
        throw new NodeError(
          `Telegram API error (403): Bot was blocked by the user (chatId: '${chatId}').`,
          false
        );
      }

      if (description.toLowerCase().includes('unauthorized') || response.status === 401) {
        throw new NodeError(
          'Telegram API error (401): Unauthorized. The bot token is invalid or has been revoked.',
          false
        );
      }

      throw new NodeError(
        `Telegram API error (${response.status}): ${description}`,
        false
      );
    }

    return {
      success: true,
      messageId: resultJson.result?.message_id,
      chatId: String(resultJson.result?.chat?.id),
      date: resultJson.result?.date,
      text: resultJson.result?.text,
      sender: resultJson.result?.from?.username || resultJson.result?.from?.first_name,
    };
  }
}

export class TelegramSendMessageNode extends IntegrationActionNode {
  readonly type = 'telegram.sendMessage';
  readonly label = 'Telegram Send Message';
  readonly integration = 'telegram';
  readonly operation = 'sendMessage';
  readonly credentialType = 'telegram';

  readonly params: ParamField[] = [
    {
      name: 'chatId',
      label: 'Chat ID / Channel',
      kind: 'string',
      required: true,
    },
    {
      name: 'text',
      label: 'Message Text',
      kind: 'text',
      required: true,
    },
    {
      name: 'parseMode',
      label: 'Formatting Mode',
      kind: 'select',
      required: false,
      default: 'Markdown',
      options: ['None', 'Markdown', 'MarkdownV2', 'HTML'],
    },
  ];

  private readonly op = new TelegramSendMessageOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
