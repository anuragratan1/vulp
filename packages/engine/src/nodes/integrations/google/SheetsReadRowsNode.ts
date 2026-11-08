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

export class SheetsReadRowsOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawSpreadsheetId = params.spreadsheetId;
    if (!rawSpreadsheetId || String(rawSpreadsheetId).trim() === '') {
      throw new ConfigError("Parameter 'spreadsheetId' is required for Google Sheets: Read Rows.");
    }
    const spreadsheetId = String(rawSpreadsheetId).trim();
    const sheetName = params.sheetName ? String(params.sheetName).trim() : 'Sheet1';
    const rangeParam = params.range ? String(params.range).trim() : '';
    const hasHeaders = params.hasHeaders !== undefined ? Boolean(params.hasHeaders) : true;

    const fullRange = rangeParam
      ? (rangeParam.includes('!') ? rangeParam : `${sheetName}!${rangeParam}`)
      : sheetName;

    ctx.log('info', `Reading rows from spreadsheet ${spreadsheetId} (range: ${fullRange})`);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(fullRange)}`;

    const response = await GoogleAuthHelper.fetchGoogle(
      url,
      { method: 'GET' },
      secrets,
      ctx,
      'Google Sheets'
    );

    const rawValues: any[][] = Array.isArray(response?.values) ? response.values : [];
    let rows: Json[] = [];

    if (hasHeaders && rawValues.length > 1) {
      const headers = rawValues[0].map((h: any, i: number) =>
        String(h || '').trim() || `col_${i + 1}`
      );
      rows = rawValues.slice(1).map((row) => {
        const item: Record<string, Json> = {};
        headers.forEach((h: string, idx: number) => {
          item[h] = row[idx] !== undefined ? row[idx] : null;
        });
        return item;
      });
    } else {
      rows = rawValues;
    }

    ctx.log('info', `Read ${rows.length} rows successfully`);

    return {
      spreadsheetId,
      sheetName,
      range: fullRange,
      rowCount: rows.length,
      rows,
      rawValues,
    };
  }
}

export class SheetsReadRowsNode extends IntegrationActionNode {
  readonly type = 'sheets.readRows';
  readonly label = 'Google Sheets: Read Rows';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'sheets.readRows';

  readonly params: ParamField[] = [
    {
      name: 'spreadsheetId',
      label: 'Spreadsheet ID',
      kind: 'string',
      required: true,
      default: '',
    },
    {
      name: 'sheetName',
      label: 'Sheet / Tab Name',
      kind: 'string',
      required: true,
      default: 'Sheet1',
    },
    {
      name: 'range',
      label: 'Range (optional, e.g. A1:Z)',
      kind: 'string',
      required: false,
    },
    {
      name: 'hasHeaders',
      label: 'First Row Contains Column Headers',
      kind: 'boolean',
      required: false,
      default: true,
    },
  ];

  private readonly op = new SheetsReadRowsOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
