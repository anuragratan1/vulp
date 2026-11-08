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

export class SheetsUpdateRowOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawSpreadsheetId = params.spreadsheetId;
    if (!rawSpreadsheetId || String(rawSpreadsheetId).trim() === '') {
      throw new ConfigError("Parameter 'spreadsheetId' is required for Google Sheets: Update Row.");
    }
    const spreadsheetId = String(rawSpreadsheetId).trim();

    const rawRange = params.range;
    if (!rawRange || String(rawRange).trim() === '') {
      throw new ConfigError("Parameter 'range' is required for Google Sheets: Update Row (e.g. 'Sheet1!A2:C2').");
    }
    const range = String(rawRange).trim();

    const rawValues = params.values;
    if (rawValues === undefined || rawValues === null) {
      throw new ConfigError("Parameter 'values' is required for Google Sheets: Update Row.");
    }

    let rowValues: any[] = [];
    if (Array.isArray(rawValues)) {
      rowValues = rawValues;
    } else if (typeof rawValues === 'object') {
      rowValues = Object.values(rawValues);
    } else if (typeof rawValues === 'string') {
      try {
        const parsed = JSON.parse(rawValues);
        rowValues = Array.isArray(parsed) ? parsed : Object.values(parsed);
      } catch {
        rowValues = rawValues.split(',').map((s) => s.trim());
      }
    } else {
      rowValues = [rawValues];
    }

    ctx.log('info', `Updating range ${range} in spreadsheet ${spreadsheetId}`);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

    const res = await GoogleAuthHelper.fetchGoogle(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowValues],
        }),
      },
      secrets,
      ctx,
      'Google Sheets'
    );

    const updatedRange = res?.updatedRange || range;
    const updatedCells = res?.updatedCells || rowValues.length;

    ctx.log('info', `Successfully updated row at ${updatedRange}`);

    return {
      updated: true,
      spreadsheetId,
      updatedRange,
      updatedCells,
      values: rowValues,
    };
  }
}

export class SheetsUpdateRowNode extends IntegrationActionNode {
  readonly type = 'sheets.updateRow';
  readonly label = 'Google Sheets: Update Row';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'sheets.updateRow';

  readonly params: ParamField[] = [
    {
      name: 'spreadsheetId',
      label: 'Spreadsheet ID',
      kind: 'string',
      required: true,
      default: '',
    },
    {
      name: 'range',
      label: 'Target Cell Range (e.g. Sheet1!A2:D2)',
      kind: 'string',
      required: true,
      default: 'Sheet1!A2:C2',
    },
    {
      name: 'values',
      label: 'Updated Values (Array or Object)',
      kind: 'json',
      required: true,
      default: ['Updated Value 1', 'Updated Value 2'],
    },
  ];

  private readonly op = new SheetsUpdateRowOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
