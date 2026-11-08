import { CanvasNode } from '../graphConverter.js';
import { formatFieldLabel } from './dynamicVariableDiscovery.js';

export interface VariableDisplayInfo {
  raw: string; // e.g. "{{ webhook_lead.body.email }}"
  cleanExpr: string; // e.g. "webhook_lead.body.email"
  label: string; // e.g. "Customer Email"
  stepName: string; // e.g. "Manual Trigger"
  displayLabel: string; // e.g. "Manual Trigger → Customer Name"
  stepType: string; // e.g. "manual.trigger"
  path: string; // e.g. "body.email" or "name"
  sampleValue?: string;
}

export function parseExpressionParts(expr: string): { nodeKey: string; path: string } {
  const clean = expr.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  const parts = clean.split('.');
  const nodeKey = parts[0] || '';
  const path = parts.slice(1).join('.');
  return { nodeKey, path };
}

export function humanizeNodeKey(nodeKey: string): string {
  if (!nodeKey) return 'Step';
  if (nodeKey === 'trigger' || nodeKey.startsWith('trigger_')) return 'Trigger';
  if (nodeKey.startsWith('manual_trigger')) return 'Manual Trigger';
  if (nodeKey.startsWith('webhook_trigger')) return 'Webhook Trigger';
  if (nodeKey.startsWith('google_forms') || nodeKey.startsWith('forms_')) return 'Google Forms';
  if (nodeKey.startsWith('gmail_')) return 'Gmail';
  if (nodeKey.startsWith('sheets_')) return 'Google Sheets';
  if (nodeKey.startsWith('slack_')) return 'Slack';
  if (nodeKey.startsWith('telegram_')) return 'Telegram';
  if (nodeKey.startsWith('github_')) return 'GitHub';
  if (nodeKey.startsWith('http_')) return 'HTTP Request';

  // Strip trailing hash/timestamp suffix if present (e.g. `trigger_mw5uet48` -> `trigger`)
  const base = nodeKey.replace(/_[a-z0-9]{8,}$|_[a-z0-9]*\d[a-z0-9]*$/i, '');
  return base
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function getVariableDisplayInfo(
  rawExpression: string,
  allNodes: CanvasNode[] = []
): VariableDisplayInfo {
  const clean = rawExpression.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  const { nodeKey, path } = parseExpressionParts(clean);

  // System variables
  if (clean === '$now' || clean.startsWith('$now')) {
    return {
      raw: rawExpression,
      cleanExpr: clean,
      label: 'Current Date/Time',
      stepName: 'System',
      displayLabel: 'System → Current Date/Time',
      stepType: 'system',
      path: '$now',
      sampleValue: new Date().toISOString(),
    };
  }

  if (clean === '$uuid') {
    return {
      raw: rawExpression,
      cleanExpr: clean,
      label: 'Unique ID (UUID)',
      stepName: 'System',
      displayLabel: 'System → Unique ID (UUID)',
      stepType: 'system',
      path: '$uuid',
      sampleValue: 'a1b2c3d4-e5f6',
    };
  }

  // Find upstream node
  const matchedNode = allNodes.find(
    (n) =>
      n.id === nodeKey ||
      n.data.key === nodeKey ||
      (nodeKey === 'trigger' && (n.data.category === 'trigger' || n.data.type?.includes('trigger') || n.type === 'trigger')) ||
      (nodeKey.startsWith('trigger') && (n.data.category === 'trigger' || n.data.type?.includes('trigger') || n.type === 'trigger'))
  );

  const stepName = matchedNode?.data.name || humanizeNodeKey(nodeKey);
  const stepType = matchedNode?.data.type || 'step';

  // Humanize path into friendly label
  let label = path || clean;
  const pathParts = path.split('.');
  const lastPart = pathParts[pathParts.length - 1] || path;

  // Common mapping heuristics
  const lower = lastPart.toLowerCase();
  if (lower === 'name' || lower === 'customername' || lower === 'leadname') {
    label = 'Customer Name';
  } else if (lower === 'email' || lower === 'customeremail') {
    label = 'Customer Email';
  } else if (lower === 'score' || lower === 'leadscore') {
    label = 'Lead Score';
  } else if (lower === 'body' && pathParts.length === 1) {
    label = 'Full Request Body';
  } else if (lower === 'subject') {
    label = 'Email Subject';
  } else if (lower === 'id' || lower === 'leadid' || lower === 'orderid') {
    label = lastPart.toUpperCase();
  } else if (lower === 'company') {
    label = 'Company';
  } else if (lower === 'phone' || lower === 'phonenumber') {
    label = 'Phone Number';
  } else if (lower === 'message') {
    label = 'Message Content';
  } else if (lower === 'amount' || lower === 'total') {
    label = 'Total Amount';
  } else if (lastPart) {
    label = formatFieldLabel(lastPart);
  }

  const displayLabel = `${stepName} → ${label}`;

  // Sample values for live email previews
  let sampleValue = `[${label}]`;
  if (lower.includes('email')) sampleValue = 'sarah.c@sky.net';
  else if (lower.includes('name')) sampleValue = 'Sarah Connor';
  else if (lower.includes('company')) sampleValue = 'Cyberdyne Systems';
  else if (lower.includes('score')) sampleValue = '94';
  else if (lower.includes('amount')) sampleValue = '$450.00';
  else if (lower.includes('date') || lower.includes('time')) sampleValue = new Date().toLocaleDateString();

  return {
    raw: rawExpression,
    cleanExpr: clean,
    label,
    stepName,
    displayLabel,
    stepType,
    path,
    sampleValue,
  };
}

/**
 * Resolves all {{ expr }} variables in a string or HTML with realistic sample values for live preview
 */
export function resolveExpressionsForPreview(
  text: string,
  allNodes: CanvasNode[] = []
): string {
  if (!text) return '';
  return text.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match) => {
    const info = getVariableDisplayInfo(match, allNodes);
    return info.sampleValue || info.label;
  });
}
