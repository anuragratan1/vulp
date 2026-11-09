import {
  ConfigError,
  NodeError,
  Json,
  ParamField,
  PortName,
  RunContext,
} from '../../../contracts.js';
import {
  IIntegrationOperation,
  IntegrationActionNode,
} from '../../base/IntegrationActionNode.js';
import { GoogleAuthHelper } from './GoogleAuthHelper.js';

export interface GmailAttachmentInput {
  name?: string;
  filename?: string;
  fileName?: string;
  mimeType?: string;
  type?: string;
  contentType?: string;
  size?: number;
  content?: string;
  data?: string;
  base64?: string;
  url?: string;
  driveFileId?: string;
  fileId?: string;
  [key: string]: any;
}

interface ResolvedAttachment {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export class GmailSendEmailOperation implements IIntegrationOperation {
  private async resolveAttachment(
    att: any,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<ResolvedAttachment> {
    if (typeof att === 'string') {
      const trimmed = att.trim();
      // Case 1: Direct URL string
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return this.fetchFromUrl(trimmed, undefined, ctx);
      }
      // Case 2: Data URL string
      if (trimmed.startsWith('data:')) {
        return this.parseDataUrl(trimmed);
      }
      // Case 3: Raw text/string content
      return {
        name: 'attachment.txt',
        mimeType: 'text/plain; charset=utf-8',
        buffer: Buffer.from(trimmed, 'utf-8'),
      };
    }

    if (typeof att === 'object' && att !== null) {
      const name =
        att.name ||
        att.filename ||
        att.fileName ||
        (att.url ? att.url.split('/').pop()?.split('?')[0] : null) ||
        'attachment';

      const explicitMime = att.mimeType || att.contentType || att.type;

      // 1. Google Drive file reference
      const driveId = att.driveFileId || att.fileId;
      if (driveId) {
        return this.fetchFromGoogleDrive(driveId, name, explicitMime, secrets, ctx);
      }

      // 2. HTTP URL reference
      if (att.url) {
        return this.fetchFromUrl(att.url, name, ctx, explicitMime);
      }

      // 3. Raw content or base64
      const rawContent = att.content || att.data || att.base64;
      if (rawContent) {
        if (typeof rawContent === 'string' && rawContent.startsWith('data:')) {
          const parsed = this.parseDataUrl(rawContent);
          return {
            name: name !== 'attachment' ? name : parsed.name,
            mimeType: explicitMime || parsed.mimeType,
            buffer: parsed.buffer,
          };
        }

        const isBase64 =
          att.encoding === 'base64' ||
          (typeof rawContent === 'string' &&
            /^[A-Za-z0-9+/=]+$/.test(rawContent.trim()) &&
            rawContent.length % 4 === 0 &&
            rawContent.length > 32);

        const buffer = isBase64
          ? Buffer.from(rawContent, 'base64')
          : Buffer.from(String(rawContent), 'utf-8');

        return {
          name,
          mimeType: explicitMime || 'application/octet-stream',
          buffer,
        };
      }
    }

    throw new ConfigError(`Unable to process attachment of format: ${typeof att}`);
  }

  private async fetchFromUrl(
    url: string,
    customName?: string,
    ctx?: RunContext,
    customMime?: string
  ): Promise<ResolvedAttachment> {
    try {
      const res = await fetch(url, { signal: ctx?.signal });
      if (!res.ok) {
        throw new NodeError(
          `Failed to fetch attachment from URL "${url}": HTTP ${res.status} ${res.statusText}`,
          true
        );
      }
      const arrayBuf = await res.arrayBuffer();
      const detectedMime =
        customMime || res.headers.get('content-type') || 'application/octet-stream';
      const urlFileName = url.split('/').pop()?.split('?')[0] || 'attachment';

      return {
        name: customName || urlFileName,
        mimeType: detectedMime.split(';')[0].trim(),
        buffer: Buffer.from(arrayBuf),
      };
    } catch (err: any) {
      if (err instanceof NodeError) throw err;
      throw new NodeError(`Network error downloading attachment from "${url}": ${err?.message}`, true);
    }
  }

  private async fetchFromGoogleDrive(
    fileId: string,
    customName: string,
    customMime?: string,
    secrets?: Record<string, string>,
    ctx?: RunContext
  ): Promise<ResolvedAttachment> {
    if (!secrets) {
      throw new ConfigError('Google credentials required to fetch file from Google Drive');
    }
    const token = GoogleAuthHelper.extractAccessToken(secrets);

    // 1. Fetch file metadata
    const metaUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`;
    let meta: any = null;
    try {
      meta = await GoogleAuthHelper.fetchGoogle(metaUrl, { method: 'GET' }, secrets, ctx || ({} as any), 'Google Drive');
    } catch {
      // Proceed with customName/customMime if metadata fetch fails
    }

    let finalName = customName || meta?.name || `drive-file-${fileId}`;
    let finalMime = customMime || meta?.mimeType || 'application/octet-stream';

    // 2. Handle native Google Docs / Sheets exports
    let downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    if (finalMime === 'application/vnd.google-apps.document') {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;
      finalMime = 'application/pdf';
      if (!finalName.toLowerCase().endsWith('.pdf')) finalName += '.pdf';
    } else if (finalMime === 'application/vnd.google-apps.spreadsheet') {
      downloadUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=application/pdf`;
      finalMime = 'application/pdf';
      if (!finalName.toLowerCase().endsWith('.pdf')) finalName += '.pdf';
    }

    try {
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctx?.signal,
      });
      if (!res.ok) {
        throw new NodeError(`Google Drive API error downloading "${finalName}": HTTP ${res.status}`, true);
      }
      const arrayBuf = await res.arrayBuffer();
      return {
        name: finalName,
        mimeType: finalMime,
        buffer: Buffer.from(arrayBuf),
      };
    } catch (err: any) {
      if (err instanceof NodeError) throw err;
      throw new NodeError(`Failed to download Google Drive attachment "${finalName}": ${err?.message}`, true);
    }
  }

  private parseDataUrl(dataUrl: string): ResolvedAttachment {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      // Plain text data URL
      const textMatches = dataUrl.match(/^data:([^,]+),(.*)$/);
      if (textMatches) {
        return {
          name: 'attachment.txt',
          mimeType: textMatches[1] || 'text/plain',
          buffer: Buffer.from(decodeURIComponent(textMatches[2]), 'utf-8'),
        };
      }
      throw new ConfigError('Invalid data URL format for attachment');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const ext = mimeType.split('/')[1] || 'bin';

    return {
      name: `attachment.${ext}`,
      mimeType,
      buffer: Buffer.from(base64Data, 'base64'),
    };
  }

  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawTo = params.to;
    if (!rawTo || String(rawTo).trim() === '') {
      throw new ConfigError("Parameter 'to' is required for Gmail: Send Email.");
    }
    const to = String(rawTo).trim();

    const rawSubject = params.subject;
    if (rawSubject === undefined || rawSubject === null) {
      throw new ConfigError("Parameter 'subject' is required for Gmail: Send Email.");
    }
    const subject = String(rawSubject);

    const rawBody = params.body;
    if (rawBody === undefined || rawBody === null) {
      throw new ConfigError("Parameter 'body' is required for Gmail: Send Email.");
    }
    const body = String(rawBody);

    const cc = params.cc ? String(params.cc).trim() : undefined;
    const bcc = params.bcc ? String(params.bcc).trim() : undefined;
    const replyTo = params.replyTo ? String(params.replyTo).trim() : undefined;
    const senderName = params.senderName ? String(params.senderName).trim() : undefined;
    const isHtml = params.isHtml === undefined ? body.includes('<') && body.includes('>') : Boolean(params.isHtml);

    // Resolve Attachments if provided
    const rawAttachments = Array.isArray(params.attachments)
      ? params.attachments
      : params.attachments
      ? [params.attachments]
      : [];

    const resolvedAttachments: ResolvedAttachment[] = [];
    for (const att of rawAttachments) {
      if (att) {
        const resolved = await this.resolveAttachment(att, secrets, ctx);
        resolvedAttachments.push(resolved);
      }
    }

    // Check Gmail 25MB total payload limit
    const totalAttachmentBytes = resolvedAttachments.reduce((sum, a) => sum + a.buffer.length, 0);
    const MAX_GMAIL_BYTES = 25 * 1024 * 1024; // 25 MB
    if (totalAttachmentBytes > MAX_GMAIL_BYTES) {
      const mb = (totalAttachmentBytes / (1024 * 1024)).toFixed(1);
      throw new ConfigError(`Attachments exceed Gmail's 25MB total limit (${mb}MB). Please reduce file size.`);
    }

    ctx.log(
      'info',
      `Sending email via Gmail to ${to} (subject: "${subject}", attachments: ${resolvedAttachments.length})`
    );

    // Build RFC 2822 email payload
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;
    const cleanAddress = (addr: string) => addr.trim();

    const formattedTo = to
      .split(',')
      .map(cleanAddress)
      .filter(Boolean)
      .join(', ');

    const fromHeader = senderName
      ? `From: =?utf-8?B?${Buffer.from(senderName, 'utf-8').toString('base64')}?=`
      : 'From: me';

    const ccHeader = cc
      ? `Cc: ${cc.split(',').map(cleanAddress).filter(Boolean).join(', ')}`
      : null;
    const bccHeader = bcc
      ? `Bcc: ${bcc.split(',').map(cleanAddress).filter(Boolean).join(', ')}`
      : null;
    const replyToHeader = replyTo ? `Reply-To: ${cleanAddress(replyTo)}` : null;

    let mimePayload = '';

    if (resolvedAttachments.length === 0) {
      // Simple Single-part MIME message
      const lines = [
        fromHeader,
        `To: ${formattedTo}`,
        ccHeader,
        bccHeader,
        replyToHeader,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        isHtml
          ? 'Content-Type: text/html; charset=utf-8'
          : 'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body, 'utf-8').toString('base64'),
      ]
        .filter((line) => line !== null)
        .join('\r\n');

      mimePayload = lines;
    } else {
      // Multipart Mixed MIME message with attachments
      const boundary = `====_vulp_boundary_${Date.now()}_${Math.random().toString(36).slice(2)}====`;
      const parts: string[] = [
        fromHeader,
        `To: ${formattedTo}`,
        ccHeader,
        bccHeader,
        replyToHeader,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        isHtml
          ? 'Content-Type: text/html; charset=utf-8'
          : 'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(body, 'utf-8').toString('base64'),
      ].filter((l) => l !== null) as string[];

      for (const att of resolvedAttachments) {
        const encodedName = `=?utf-8?B?${Buffer.from(att.name, 'utf-8').toString('base64')}?=`;
        parts.push(
          `--${boundary}`,
          `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${encodedName}"`,
          `Content-Description: ${encodedName}`,
          `Content-Disposition: attachment; filename="${encodedName}"`,
          'Content-Transfer-Encoding: base64',
          '',
          att.buffer.toString('base64')
        );
      }

      parts.push(`--${boundary}--`, '');
      mimePayload = parts.join('\r\n');
    }

    // Base64url encoding for Gmail API
    const rawBase64Url = Buffer.from(mimePayload)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await GoogleAuthHelper.fetchGoogle(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: rawBase64Url }),
      },
      secrets,
      ctx,
      'Gmail'
    );

    const sentAt = Date.now();
    ctx.log('info', `Email sent successfully (id: ${result?.id || 'unknown'})`);

    return {
      id: result?.id || null,
      threadId: result?.threadId || null,
      to,
      subject,
      status: 'sent',
      sentAt,
      attachmentsCount: resolvedAttachments.length,
      attachments: resolvedAttachments.map((a) => ({
        name: a.name,
        size: a.buffer.length,
        mimeType: a.mimeType,
      })),
    };
  }
}

export class GmailSendEmailNode extends IntegrationActionNode {
  readonly type = 'gmail.sendEmail';
  readonly label = 'Gmail: Send Email';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'gmail.sendEmail';

  readonly params: ParamField[] = [
    {
      name: 'to',
      label: 'Recipient Email (To)',
      kind: 'string',
      required: true,
      default: '',
    },
    {
      name: 'subject',
      label: 'Subject Line',
      kind: 'string',
      required: true,
      default: 'New update from Vulp',
    },
    {
      name: 'body',
      label: 'Email Body',
      kind: 'text',
      required: true,
      default: 'Hello,\n\nThis is an automated notification from your Vulp workflow.',
    },
    {
      name: 'cc',
      label: 'CC',
      kind: 'string',
      required: false,
    },
    {
      name: 'bcc',
      label: 'BCC',
      kind: 'string',
      required: false,
    },
    {
      name: 'replyTo',
      label: 'Reply-To Email',
      kind: 'string',
      required: false,
    },
    {
      name: 'senderName',
      label: 'Sender Display Name',
      kind: 'string',
      required: false,
    },
    {
      name: 'isHtml',
      label: 'Format as HTML',
      kind: 'boolean',
      required: false,
      default: true,
    },
    {
      name: 'attachments',
      label: 'Attachments',
      kind: 'json',
      required: false,
    },
  ];

  private readonly op = new GmailSendEmailOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
