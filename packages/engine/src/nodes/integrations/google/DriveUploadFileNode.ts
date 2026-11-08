import {
  ConfigError,
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

export class DriveUploadFileOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawFileName = params.fileName;
    if (!rawFileName || String(rawFileName).trim() === '') {
      throw new ConfigError("Parameter 'fileName' is required for Google Drive: Upload File.");
    }
    const fileName = String(rawFileName).trim();

    const rawContent = params.content;
    if (rawContent === undefined || rawContent === null) {
      throw new ConfigError("Parameter 'content' is required for Google Drive: Upload File.");
    }
    const content = typeof rawContent === 'object' ? JSON.stringify(rawContent, null, 2) : String(rawContent);

    const folderId = params.folderId ? String(params.folderId).trim() : undefined;
    const mimeType = params.mimeType ? String(params.mimeType).trim() : 'text/plain';

    ctx.log('info', `Uploading file '${fileName}' to Google Drive`);

    const boundary = '-------vulp_boundary_' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata: Record<string, any> = {
      name: fileName,
      mimeType,
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n\r\n` +
      content +
      closeDelimiter;

    const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,size';

    const res = await GoogleAuthHelper.fetchGoogle(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      },
      secrets,
      ctx,
      'Google Drive'
    );

    ctx.log('info', `File uploaded successfully (id: ${res?.id || 'unknown'})`);

    return {
      id: res?.id || null,
      name: res?.name || fileName,
      mimeType: res?.mimeType || mimeType,
      webViewLink: res?.webViewLink || (res?.id ? `https://drive.google.com/file/d/${res.id}/view` : null),
      size: res?.size ? Number(res.size) : Buffer.byteLength(content),
    };
  }
}

export class DriveUploadFileNode extends IntegrationActionNode {
  readonly type = 'drive.uploadFile';
  readonly label = 'Google Drive: Upload File';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'drive.uploadFile';

  readonly params: ParamField[] = [
    {
      name: 'fileName',
      label: 'File Name',
      kind: 'string',
      required: true,
      default: 'export_{{ $node.trigger.output.id }}.txt',
    },
    {
      name: 'content',
      label: 'File Content',
      kind: 'text',
      required: true,
      default: 'Workflow output data generated on {{ $node.trigger.output.timestamp }}',
    },
    {
      name: 'folderId',
      label: 'Folder ID (optional, defaults to root Drive)',
      kind: 'string',
      required: false,
    },
    {
      name: 'mimeType',
      label: 'MIME Type',
      kind: 'string',
      required: false,
      default: 'text/plain',
    },
  ];

  private readonly op = new DriveUploadFileOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
