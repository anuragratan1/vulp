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

export class SheetsAppendRowOperation implements IIntegrationOperation {
  async execute(
    params: Record<string, Json>,
    secrets: Record<string, string>,
    ctx: RunContext
  ): Promise<Json> {
    const rawSpreadsheetId = params.spreadsheetId;
    if (!rawSpreadsheetId || String(rawSpreadsheetId).trim() === '') {
      throw new ConfigError("Parameter 'spreadsheetId' is required for Google Sheets: Append Row.");
    }
    const spreadsheetId = String(rawSpreadsheetId).trim();
    const sheetName = params.sheetName ? String(params.sheetName).trim() : 'Sheet1';

    let rowValues: any[] = [];
    const rawValues = params.values;

    if (rawValues === undefined || rawValues === null) {
      throw new ConfigError("Parameter 'values' is required for Google Sheets: Append Row.");
    }

    // Helper: Map an object's keys to spreadsheet headers with case-insensitive normalization
    const mapObjectToHeaders = async (obj: Record<string, any>): Promise<any[]> => {
      let headers: string[] = [];
      try {
        const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values/${encodeURIComponent(`${sheetName}!1:1`)}`;
        const headerRes = await GoogleAuthHelper.fetchGoogle(
          headerUrl,
          { method: 'GET' },
          secrets,
          ctx,
          'Google Sheets'
        );
        headers = (headerRes?.values?.[0] || []).map((h: any) => String(h).trim()).filter(Boolean);
      } catch (err: any) {
        ctx.log('info', `Could not fetch sheet headers: ${err.message || err}. Falling back to object keys.`);
      }

      if (headers.length === 0) {
        // Fallback: If no headers found in row 1, use object's own values in insertion order
        return Object.values(obj);
      }

      // Build normalized lookup maps for flexible matching:
      // 1. Exact key match
      // 2. Lowercase trimmed match (e.g. "email" matches "Email")
      // 3. Alphanumeric stripped match (e.g. "email_address" matches "Email Address")
      const lowerMap = new Map<string, any>();
      const alphaMap = new Map<string, any>();

      for (const [key, val] of Object.entries(obj)) {
        const trimmed = key.trim();
        lowerMap.set(trimmed.toLowerCase(), val);
        alphaMap.set(trimmed.toLowerCase().replace(/[^a-z0-9]/g, ''), val);
      }

      return headers.map((h) => {
        const trimmedHeader = h.trim();
        if (obj[trimmedHeader] !== undefined) {
          return obj[trimmedHeader];
        }
        const lowerHeader = trimmedHeader.toLowerCase();
        if (lowerMap.has(lowerHeader)) {
          return lowerMap.get(lowerHeader);
        }
        const alphaHeader = lowerHeader.replace(/[^a-z0-9]/g, '');
        if (alphaMap.has(alphaHeader)) {
          return alphaMap.get(alphaHeader);
        }
        return '';
      });
    };

    if (Array.isArray(rawValues)) {
      rowValues = rawValues;
    } else if (typeof rawValues === 'object' && rawValues !== null) {
      rowValues = await mapObjectToHeaders(rawValues as Record<string, any>);
    } else if (typeof rawValues === 'string') {
      const trimmedStr = rawValues.trim();
      let parsedJson: any = null;
      try {
        parsedJson = JSON.parse(trimmedStr);
      } catch {
        parsedJson = null;
      }

      if (parsedJson !== null) {
        if (Array.isArray(parsedJson)) {
          rowValues = parsedJson;
        } else if (typeof parsedJson === 'object') {
          rowValues = await mapObjectToHeaders(parsedJson as Record<string, any>);
        } else {
          rowValues = [parsedJson];
        }
      } else {
        // Non-JSON string: check if it looks like a damaged JSON fragment (starts with '{' or '[')
        if (trimmedStr.startsWith('{') || trimmedStr.startsWith('[')) {
          // Do NOT comma-split broken JSON fragments into multiple cells; keep as single cell value
          rowValues = [trimmedStr];
        } else if (trimmedStr.includes(',')) {
          // Standard CSV comma-separated row
          rowValues = trimmedStr.split(',').map((s) => s.trim());
        } else {
          rowValues = [trimmedStr];
        }
      }
    } else {
      rowValues = [rawValues];
    }

    // Ensure all individual cell values are properly typed primitives (string, number, boolean)
    const sanitizedCells = rowValues.map((cell) => {
      if (cell === null || cell === undefined) return '';
      if (typeof cell === 'number' || typeof cell === 'boolean' || typeof cell === 'string') {
        return cell;
      }
      return JSON.stringify(cell);
    });

    ctx.log('info', `Appending row with ${sanitizedCells.length} columns to ${sheetName}`);

    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED`;

    const res = await GoogleAuthHelper.fetchGoogle(
      appendUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [sanitizedCells],
        }),
      },
      secrets,
      ctx,
      'Google Sheets'
    );

    const updatedRange = res?.updates?.updatedRange || null;
    const updatedRows = res?.updates?.updatedRows || 1;

    ctx.log('info', `Successfully appended row (range: ${updatedRange || 'unknown'})`);

    const mappedObject: Record<string, any> =
      typeof rawValues === 'object' && rawValues !== null && !Array.isArray(rawValues)
        ? (rawValues as Record<string, any>)
        : {};

    return {
      appended: true,
      spreadsheetId,
      sheetName,
      updatedRange,
      updatedRows,
      values: sanitizedCells,
      row: mappedObject,
      ...mappedObject,
    };
  }
}

export class SheetsAppendRowNode extends IntegrationActionNode {
  readonly type = 'sheets.appendRow';
  readonly label = 'Google Sheets: Append Row';
  readonly category = 'action' as const;
  readonly outputs: PortName[] = ['default'];
  readonly credentialType = 'google';
  readonly integration = 'google';
  readonly operation = 'sheets.appendRow';

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
      name: 'values',
      label: 'Row Values (Object or Array)',
      kind: 'json',
      required: true,
      default: {},
    },
  ];

  private readonly op = new SheetsAppendRowOperation();

  protected getOperation(): IIntegrationOperation {
    return this.op;
  }
}
