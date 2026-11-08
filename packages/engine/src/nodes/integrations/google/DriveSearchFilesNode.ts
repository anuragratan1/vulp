import {
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

export class DriveSearchFilesOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawQuery = params.query ? String(params.query).trim() : '';
    const folderId = params.folderId ? String(params.folderId).trim() : '';
    const pageSize = params.pageSize ? Math.min(Math.max(Number(params.pageSize), 1), 50) : 10;

    const queryClauses: string[] = ['trashed = false'];
    if (folderId) {
      queryClauses.push(`'${folderId}' in parents`);
    }
    if (rawQuery) {
      if (rawQuery.includes('=') || rawQuery.includes('contains')) {
        queryClauses.push(`(${rawQuery})`);
      } else {
        queryClauses.push(`name contains '${rawQuery.replace(/'/g, "\\'")}'`);
      }
    }

    const q = queryClauses.join(' and ');
    ctx.log('info', `Searching Google Drive files with query: ${q}`);

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&pageSize=${pageSize}&fields=files(id,name,mimeType,webViewLink,createdTime,size)`;

    const res = await GoogleAuthHelper.fetchGoogle(
      url,
      { method: 'GET' },
      secrets,
      ctx,
      'Google Drive'
    );

    const files = Array.isArray(res?.files)
      ? res.files.map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          webViewLink: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
          createdTime: f.createdTime,
          size: f.size ? Number(f.size) : null,
        }))
      : [];

    ctx.log('info', `Found ${files.length} files matching query`);

    return {
      files,
      count: files.length,
      query: q,
    };
  }
}

export class DriveSearchFilesNode extends IntegrationActionNode {
  readonly type = 'drive.searchFiles';
  readonly label = 'Google Drive: Find Files';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'drive.searchFiles';

  readonly params: ParamField[] = [
    {
      name: 'query',
      label: 'Search Query / File Name',
      kind: 'string',
      required: false,
      default: '',
    },
    {
      name: 'folderId',
      label: 'Folder ID (optional)',
      kind: 'string',
      required: false,
    },
    {
      name: 'pageSize',
      label: 'Max Results',
      kind: 'number',
      required: false,
      default: 10,
    },
  ];

  private readonly op = new DriveSearchFilesOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
