import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';

export interface DiscoveredVariable {
  id: string; // e.g. "webhook_lead.body.customer.email"
  rawExpression: string; // e.g. "{{ webhook_lead.body.customer.email }}"
  nodeKey: string; // e.g. "webhook_lead"
  stepName: string; // e.g. "Capture Lead Form"
  stepType: string; // e.g. "webhook.trigger"
  path: string; // e.g. "body.customer.email"
  label: string; // e.g. "Customer Email"
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  sampleValue?: string;
  sourceCategory: 'execution' | 'sample' | 'schema' | 'system';
}

export interface StepVariableGroup {
  nodeId: string;
  nodeKey: string;
  nodeName: string;
  nodeType: string;
  hasLiveOutputs: boolean;
  variables: DiscoveredVariable[];
}

/**
 * Humanize a data path segment into a clean, readable label.
 * e.g. "customer_email" -> "Customer Email"
 * e.g. "items[0].unit_price" -> "Item 1 Unit Price"
 */
export function formatFieldLabel(path: string): string {
  if (!path) return '';

  // Strip common root containers like "body." or "data." if nested
  let displayPath = path;
  if (displayPath.startsWith('body.') && displayPath.length > 5) {
    displayPath = displayPath.slice(5);
  } else if (displayPath.startsWith('data.') && displayPath.length > 5) {
    displayPath = displayPath.slice(5);
  }

  // Handle array index like items[0] -> items [0]
  displayPath = displayPath.replace(/\[(\d+)\]/g, (_, idx) => ` [${idx}] `);

  const parts = displayPath.split('.').filter(Boolean);
  const formattedParts = parts.map((part) => {
    // Replace underscores and dashes
    const unslugged = part.replace(/[_-]+/g, ' ');
    // Split camelCase
    const decamel = unslugged.replace(/([a-z\d])([A-Z])/g, '$1 $2');
    // Title Case, preserving acronyms
    return decamel
      .trim()
      .split(/\s+/)
      .map((w) => {
        const up = w.toUpperCase();
        if (['ID', 'URL', 'IP', 'HTTP', 'API', 'UUID', 'JSON', 'HTML'].includes(up)) {
          return up;
        }
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  });

  return formattedParts.join(' ');
}

/**
 * Format a raw variable expression, safely handling spaces and special characters with bracket notation.
 * e.g. "email" -> "{{ trigger.email }}"
 * e.g. "What is your role?" -> "{{ trigger["What is your role?"] }}"
 */
export function formatRawExpression(nodeKey: string, path: string): string {
  if (!path) return `{{ ${nodeKey} }}`;
  const segments = path.split('.');
  const allIdentifiers = segments.every((seg) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(seg));
  if (allIdentifiers) {
    return `{{ ${nodeKey}.${path} }}`;
  }
  if (segments.length === 1) {
    return `{{ ${nodeKey}["${path.replace(/"/g, '\\"')}"] }}`;
  }
  let expr = nodeKey;
  for (const seg of segments) {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(seg)) {
      expr += `.${seg}`;
    } else {
      expr += `["${seg.replace(/"/g, '\\"')}"]`;
    }
  }
  return `{{ ${expr} }}`;
}

/**
 * Recursively inspect an object or array to discover all dot-notation paths,
 * types, and real sample values.
 */
export function extractFieldsFromData(
  data: any,
  nodeKey: string,
  stepName = 'Step',
  stepType = 'action',
  sourceCategory: 'execution' | 'sample' | 'schema' = 'execution',
  prefix = '',
  depth = 0,
  maxDepth = 4
): DiscoveredVariable[] {
  const result: DiscoveredVariable[] = [];

  if (depth > maxDepth || data === undefined) {
    return result;
  }

  if (data === null) {
    if (prefix) {
      result.push({
        id: `${nodeKey}.${prefix}`,
        rawExpression: formatRawExpression(nodeKey, prefix),
        nodeKey,
        stepName,
        stepType,
        path: prefix,
        label: formatFieldLabel(prefix),
        type: 'string',
        sampleValue: 'null',
        sourceCategory,
      });
    }
    return result;
  }

  const valueType = typeof data;

  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    if (prefix) {
      let sample = String(data);
      if (valueType === 'string') {
        sample = sample.length > 40 ? `${sample.slice(0, 37)}...` : sample;
      }
      result.push({
        id: `${nodeKey}.${prefix}`,
        rawExpression: formatRawExpression(nodeKey, prefix),
        nodeKey,
        stepName,
        stepType,
        path: prefix,
        label: formatFieldLabel(prefix),
        type: valueType,
        sampleValue: sample,
        sourceCategory,
      });
    }
    return result;
  }

  if (Array.isArray(data)) {
    if (prefix) {
      result.push({
        id: `${nodeKey}.${prefix}`,
        rawExpression: formatRawExpression(nodeKey, prefix),
        nodeKey,
        stepName,
        stepType,
        path: prefix,
        label: `${formatFieldLabel(prefix)} (List)`,
        type: 'array',
        sampleValue: `[${data.length} items]`,
        sourceCategory,
      });
    }

    // Inspect first item to discover array child fields
    if (data.length > 0) {
      const firstItemFields = extractFieldsFromData(
        data[0],
        nodeKey,
        stepName,
        stepType,
        sourceCategory,
        prefix ? `${prefix}[0]` : '[0]',
        depth + 1,
        maxDepth
      );
      result.push(...firstItemFields);
    }
    return result;
  }

  if (valueType === 'object') {
    if (prefix) {
      result.push({
        id: `${nodeKey}.${prefix}`,
        rawExpression: formatRawExpression(nodeKey, prefix),
        nodeKey,
        stepName,
        stepType,
        path: prefix,
        label: `${formatFieldLabel(prefix)} (Object)`,
        type: 'object',
        sampleValue: '{...}',
        sourceCategory,
      });
    }

    const keys = Object.keys(data);
    for (const key of keys.slice(0, 40)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      const childFields = extractFieldsFromData(
        data[key],
        nodeKey,
        stepName,
        stepType,
        sourceCategory,
        nextPrefix,
        depth + 1,
        maxDepth
      );
      result.push(...childFields);
    }
  }

  return result;
}

/**
 * Return standard structural output schemas for known VULP node types
 * when neither execution records nor user sample data exist yet.
 */
export function getDefaultNodeSchema(
  type: string,
  nodeKey = 'step',
  stepName = 'Step'
): DiscoveredVariable[] {
  const fields: DiscoveredVariable[] = [];

  const add = (
    path: string,
    label: string,
    type: 'string' | 'number' | 'boolean' | 'object' | 'array',
    sampleValue?: string
  ) => {
    fields.push({
      id: `${nodeKey}.${path}`,
      rawExpression: `{{ ${nodeKey}.${path} }}`,
      nodeKey,
      stepName,
      stepType: type,
      path,
      label,
      type,
      sampleValue,
      sourceCategory: 'schema',
    });
  };

  switch (type) {
    case 'google_forms.trigger':
    case 'forms.trigger':
      add('responseId', 'Response ID', 'string');
      add('formTitle', 'Form Title', 'string');
      add('formId', 'Form ID', 'string');
      add('submittedAt', 'Submission Time', 'string');
      add('respondentEmail', 'Respondent Email', 'string');
      break;

    case 'webhook.trigger':
      add('body', 'Request Body', 'object', '{ ... }');
      add('headers', 'Request Headers', 'object', '{ ... }');
      add('query', 'URL Query Parameters', 'object', '{ ... }');
      add('timestamp', 'Received Timestamp', 'number', String(Date.now()));
      break;

    case 'manual.trigger':
      add('payload', 'Trigger Payload', 'object', '{ ... }');
      break;

    case 'schedule.trigger':
      add('timestamp', 'Trigger Timestamp', 'string', new Date().toISOString());
      add('scheduledTime', 'Scheduled Time', 'string', '12:00:00');
      add('timezone', 'Timezone', 'string', 'UTC');
      break;

    case 'gmail.sendEmail':
      add('id', 'Message ID', 'string', '189a2b3c4d5e');
      add('threadId', 'Thread ID', 'string', '189a2b3c4d5e');
      add('to', 'Recipient Email', 'string', 'user@example.com');
      add('subject', 'Email Subject', 'string', 'Automated Notification');
      add('sentAt', 'Sent Timestamp', 'string', new Date().toISOString());
      break;

    case 'sheets.appendRow':
    case 'sheets.updateRow':
      add('appended', 'Status', 'boolean', 'true');
      add('spreadsheetId', 'Spreadsheet ID', 'string', '1BxiMVs0XRA5nFMd...');
      add('sheetName', 'Sheet Name', 'string', 'Sheet1');
      add('updatedRange', 'Updated Range', 'string', 'Sheet1!A2:E2');
      add('updatedRows', 'Updated Rows Count', 'number', '1');
      break;

    case 'sheets.readRows':
      add('rows', 'All Rows', 'array', '[...]');
      add('rowCount', 'Row Count', 'number', '25');
      add('spreadsheetId', 'Spreadsheet ID', 'string', '1BxiMVs0XRA5nFMd...');
      add('range', 'Read Range', 'string', 'Sheet1!A1:E25');
      break;

    case 'drive.uploadFile':
      add('id', 'File ID', 'string', '1A2B3C4D5E6F');
      add('name', 'File Name', 'string', 'document.pdf');
      add('mimeType', 'MIME Type', 'string', 'application/pdf');
      add('webViewLink', 'Web View Link', 'string', 'https://drive.google.com/file/d/...');
      add('size', 'File Size (bytes)', 'number', '204850');
      break;

    case 'calendar.createEvent':
      add('id', 'Event ID', 'string', 'ev_99812401');
      add('summary', 'Event Title', 'string', 'Meeting');
      add('htmlLink', 'Google Calendar URL', 'string', 'https://calendar.google.com/event?...');
      add('startTime', 'Start Time', 'string', new Date().toISOString());
      add('endTime', 'End Time', 'string', new Date().toISOString());
      add('status', 'Event Status', 'string', 'confirmed');
      break;

    case 'telegram.sendMessage':
      add('messageId', 'Telegram Message ID', 'number', '4201');
      add('chatId', 'Chat ID', 'string', '123456789');
      add('text', 'Message Text', 'string', 'Alert dispatched');
      add('sentAt', 'Sent Timestamp', 'string', new Date().toISOString());
      break;

    case 'slack.postMessage':
      add('ok', 'Delivery Status', 'boolean', 'true');
      add('channel', 'Channel ID / Name', 'string', '#general');
      add('ts', 'Message Timestamp', 'string', '1700000000.000100');
      add('message', 'Message Text', 'string', 'Notification posted');
      break;

    case 'github.createIssue':
      add('id', 'Issue ID', 'number', '109284');
      add('number', 'Issue Number', 'number', '42');
      add('title', 'Issue Title', 'string', 'Bug Report');
      add('htmlUrl', 'GitHub Issue Link', 'string', 'https://github.com/owner/repo/issues/42');
      add('state', 'State', 'string', 'open');
      break;

    case 'http.request':
      add('status', 'HTTP Status Code', 'number', '200');
      add('statusText', 'Status Text', 'string', 'OK');
      add('headers', 'Response Headers', 'object', '{ ... }');
      add('body', 'Response Body', 'object', '{ ... }');
      break;

    case 'logic.if':
      add('result', 'Condition Result', 'boolean', 'true');
      add('left', 'Left Evaluated Value', 'string', 'resolved_val');
      add('operator', 'Operator Used', 'string', 'equals');
      break;

    case 'logic.delay':
      add('waitedMs', 'Duration Waited (ms)', 'number', '5000');
      break;

    default:
      add('output', 'Step Output', 'object', '{ ... }');
      break;
  }

  return fields;
}

/**
 * Return system-level dynamic helpers like $now and $uuid.
 */
export function getSystemVariables(): DiscoveredVariable[] {
  return [
    {
      id: 'system.$now',
      rawExpression: '{{ $now }}',
      nodeKey: '$now',
      stepName: 'System',
      stepType: 'system',
      path: '$now',
      label: 'Current Date & Time',
      type: 'string',
      sampleValue: new Date().toISOString(),
      sourceCategory: 'system',
    },
    {
      id: 'system.$uuid',
      rawExpression: '{{ $uuid }}',
      nodeKey: '$uuid',
      stepName: 'System',
      stepType: 'system',
      path: '$uuid',
      label: 'Unique ID (UUID)',
      type: 'string',
      sampleValue: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      sourceCategory: 'system',
    },
  ];
}

/**
 * Topologically discover all ancestors of `currentNodeId` in the graph.
 */
export function getUpstreamNodes(
  currentNodeId: string,
  allNodes: CanvasNode[],
  edges: CanvasEdge[] = []
): CanvasNode[] {
  if (!currentNodeId || allNodes.length <= 1) {
    return allNodes.filter((n) => n.id !== currentNodeId);
  }

  // If no edges, return all other nodes
  if (!edges || edges.length === 0) {
    return allNodes.filter((n) => n.id !== currentNodeId);
  }

  // Build incoming adjacency map (target -> sources)
  const incomingMap = new Map<string, string[]>();
  for (const edge of edges) {
    if (!incomingMap.has(edge.target)) {
      incomingMap.set(edge.target, []);
    }
    incomingMap.get(edge.target)!.push(edge.source);
  }

  // Traverse backwards from currentNodeId
  const ancestorIds = new Set<string>();
  const queue = [...(incomingMap.get(currentNodeId) || [])];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    if (!ancestorIds.has(parentId)) {
      ancestorIds.add(parentId);
      const grandParents = incomingMap.get(parentId) || [];
      for (const gp of grandParents) {
        if (!ancestorIds.has(gp)) {
          queue.push(gp);
        }
      }
    }
  }

  // If node is connected to ancestors, return only those ancestors in DAG order
  if (ancestorIds.size > 0) {
    return allNodes.filter((n) => ancestorIds.has(n.id));
  }

  // Fallback if isolated node: return all other nodes
  return allNodes.filter((n) => n.id !== currentNodeId);
}

/**
 * Deduplicate and sanitize discovered variables:
 * 1. Eliminate pure lowercase alphanumeric slugs if a properly cased/spaced/punctuated question title exists
 *    (e.g., drops `yourscore0100` in favor of `Your Score (0-100)`, drops `fullname` in favor of `Full Name`)
 * 2. Eliminate old hardcoded demo fallbacks (`leadId`, `name`, `email`, etc.) if not actual questions in the form
 * 3. Eliminate redundant nested containers like `answers.*` if top-level fields are present
 * 4. Replace placeholder strings like 'Sample Response' with clean, context-appropriate samples
 */
export function sanitizeDiscoveredVariables(
  vars: DiscoveredVariable[],
  nodeParams?: Record<string, any>,
  nodeType?: string
): DiscoveredVariable[] {
  if (!vars || vars.length === 0) return [];

  const isForms = nodeType === 'google_forms.trigger' || nodeType === 'forms.trigger';
  const knownQuestionTitles: string[] =
    isForms && Array.isArray(nodeParams?.questions)
      ? (nodeParams.questions as any[])
          .map((q) => (q?.title ? String(q.title).trim() : ''))
          .filter(Boolean)
      : [];

  // Group variables by their compact normalized leaf path (lowercase alphanumeric)
  const normMap = new Map<string, DiscoveredVariable[]>();
  for (const v of vars) {
    if (v.path.startsWith('answers.') || v.path.startsWith('body.answers.')) {
      continue;
    }
    const leaf = v.path.includes('.') ? v.path.split('.').pop()! : v.path;
    const norm = leaf.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!norm) continue;

    if (!normMap.has(norm)) {
      normMap.set(norm, []);
    }
    normMap.get(norm)!.push(v);
  }

  const result: DiscoveredVariable[] = [];

  for (const [norm, group] of normMap.entries()) {
    let best = group[0];
    if (group.length > 1) {
      // Pick the best variable: prefer ones with spaces, uppercase, or punctuation
      const proper = group.find((v) => {
        const leaf = v.path.includes('.') ? v.path.split('.').pop()! : v.path;
        return /[A-Z\s?()_]/.test(leaf) && leaf !== norm;
      });
      best = proper || group[0];
    }

    const leaf = best.path.includes('.') ? best.path.split('.').pop()! : best.path;

    // Filter out fake demo fallbacks
    if (isForms) {
      if (['name', 'email', 'leadId', 'phone', 'score', 'source'].includes(leaf)) {
        if (!knownQuestionTitles.includes(leaf)) {
          continue; // Skip fake demo field
        }
      }
      if (
        knownQuestionTitles.length > 0 &&
        !['responseId', 'submittedAt', 'respondentEmail', 'formId', 'formTitle'].includes(leaf)
      ) {
        const matchesKnown = knownQuestionTitles.some(
          (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '') === norm
        );
        if (!matchesKnown) {
          continue; // Skip fields not in known questions
        }
      }
    }

    // Clean sample value if it contains stale demo placeholders
    let cleanSample = best.sampleValue;
    if (cleanSample === 'Sample Response') {
      cleanSample = undefined;
    } else if (
      cleanSample === 'Sarah Connor' ||
      cleanSample === 'sarah.c@sky.net' ||
      cleanSample === 'LEAD-101'
    ) {
      cleanSample = undefined;
    }

    result.push({
      ...best,
      sampleValue: cleanSample,
    });
  }

  return result;
}

/**
 * Main discovery orchestrator. Derives variable suggestions for each eligible
 * upstream node, inspecting:
 * 1. Actual outputs from previous execution runs (nodeRuns)
 * 2. User-supplied sample data in node params (e.g. manual trigger payload)
 * 3. Default node type schemas
 */
export function discoverWorkflowVariables({
  currentNodeId,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  includeSystem = true,
}: {
  currentNodeId?: string;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  includeSystem?: boolean;
}): StepVariableGroup[] {
  const eligibleNodes = currentNodeId
    ? getUpstreamNodes(currentNodeId, allNodes, edges)
    : allNodes;

  const groups: StepVariableGroup[] = [];

  for (const node of eligibleNodes) {
    const nodeKey = node.data.key || node.id;
    const nodeName = node.data.name || nodeKey;
    const nodeType = (node.data.nodeType || node.data.type || '') as string;

    let discoveredVars: DiscoveredVariable[] = [];
    let hasLiveOutputs = false;

    // 1. Check actual execution output from recent node runs
    const matchingRun = nodeRuns
      .filter((nr) => (nr.nodeKey === nodeKey || nr.nodeKey === node.id) && nr.status === 'succeeded')
      .sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0))[0];

    if (matchingRun && matchingRun.output && typeof matchingRun.output === 'object') {
      const liveVars = extractFieldsFromData(
        matchingRun.output,
        nodeKey,
        nodeName,
        nodeType,
        'execution'
      );
      if (liveVars.length > 0) {
        discoveredVars = sanitizeDiscoveredVariables(liveVars, node.data.params, nodeType);
        hasLiveOutputs = true;
      }
    }

    // 2. Check user-supplied sample data (e.g. manual trigger payload or webhook sample)
    if (!hasLiveOutputs && node.data.params) {
      const params = node.data.params;
      let sampleData: any = null;

      if (nodeType === 'manual.trigger' && params.payload) {
        if (typeof params.payload === 'string') {
          try {
            sampleData = JSON.parse(params.payload);
          } catch {
            sampleData = { text: params.payload };
          }
        } else if (typeof params.payload === 'object') {
          sampleData = params.payload;
        }
      } else if (nodeType === 'webhook.trigger') {
        const rawPayload = params.samplePayload ?? params.lastPayload ?? params.payload;
        if (rawPayload) {
          let parsed = rawPayload;
          if (typeof rawPayload === 'string') {
            try {
              parsed = JSON.parse(rawPayload);
            } catch {
              parsed = { text: rawPayload };
            }
          }
          if (parsed && typeof parsed === 'object') {
            // If already wrapped with body/headers/query, use as-is; otherwise wrap under body
            if ('body' in parsed || 'headers' in parsed || 'query' in parsed) {
              sampleData = parsed;
            } else {
              sampleData = { body: parsed };
            }
          }
        }
      } else if (nodeType === 'google_forms.trigger' || nodeType === 'forms.trigger') {
        const rawPayload = params.samplePayload ?? params.lastPayload ?? params.payload;
        if (rawPayload) {
          let parsed = rawPayload;
          if (typeof rawPayload === 'string') {
            try {
              parsed = JSON.parse(rawPayload);
            } catch {
              parsed = { text: rawPayload };
            }
          }
          if (parsed && typeof parsed === 'object') {
            const parsedObj = parsed as Record<string, any>;
            const cleanObj: Record<string, any> = {};
            const keys = Object.keys(parsedObj).filter(
              (k) => !['answers', 'formId', 'formTitle'].includes(k)
            );
            const questionTitles: string[] = Array.isArray(params.questions)
              ? (params.questions as any[]).map((q) => (q?.title ? String(q.title).trim() : '')).filter(Boolean)
              : [];

            for (const k of keys) {
              if (['responseId', 'submittedAt', 'respondentEmail'].includes(k)) {
                cleanObj[k] = parsedObj[k];
                continue;
              }
              if (['name', 'email', 'leadId', 'phone', 'score', 'source'].includes(k) && !questionTitles.includes(k)) {
                continue;
              }
              if (questionTitles.length > 0) {
                if (questionTitles.includes(k)) {
                  cleanObj[k] = parsedObj[k];
                }
                continue;
              }
              const isSlugOfAnother = keys.some(
                (other) => other !== k && other.toLowerCase().replace(/[^a-z0-9]/g, '') === k
              );
              if (!isSlugOfAnother) {
                cleanObj[k] = parsedObj[k];
              }
            }
            // Ensure essential Google Forms metadata fields are always present
            if (!('respondentEmail' in cleanObj)) {
              cleanObj.respondentEmail = parsedObj.respondentEmail ?? 'respondent@example.com';
            }
            if (!('submittedAt' in cleanObj)) {
              cleanObj.submittedAt = parsedObj.submittedAt ?? new Date().toISOString();
            }
            if (!('responseId' in cleanObj)) {
              cleanObj.responseId = parsedObj.responseId ?? 'resp_101';
            }
            sampleData = cleanObj;
          }
        } else if (Array.isArray(params.questions) && params.questions.length > 0) {
          // Discover real variables directly from the form's actual questions
          const qData: Record<string, any> = {
            responseId: 'resp_101',
            submittedAt: new Date().toISOString(),
            respondentEmail: 'respondent@example.com',
          };
          for (const q of (params.questions as any[])) {
            if (q && typeof q === 'object' && typeof q.title === 'string' && q.title.trim()) {
              const cleanTitle = q.title.trim();
              qData[cleanTitle] = `Sample ${cleanTitle}`;
            }
          }
          sampleData = qData;
        }
      } else if (nodeType === 'sheets.appendRow' || nodeType === 'sheets.updateRow') {
        const rawValues = params.values;
        let parsed: Record<string, any> = {};
        if (rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)) {
          parsed = rawValues;
        } else if (typeof rawValues === 'string') {
          try {
            parsed = JSON.parse(rawValues);
          } catch {}
        }
        if (parsed && typeof parsed === 'object') {
          const colObj: Record<string, any> = {};
          for (const [colName, colVal] of Object.entries(parsed)) {
            const cleanCol = colName.trim();
            if (!cleanCol) continue;
            colObj[cleanCol] =
              typeof colVal === 'string' && colVal.startsWith('{{')
                ? `Sample ${cleanCol}`
                : colVal || `Sample ${cleanCol}`;
          }
          if (Object.keys(colObj).length > 0) {
            sampleData = colObj;
          }
        }
      }

      if (sampleData && typeof sampleData === 'object') {
        const sampleVars = extractFieldsFromData(
          sampleData,
          nodeKey,
          nodeName,
          nodeType,
          'sample'
        );
        if (sampleVars.length > 0) {
          const schemaVars =
            nodeType === 'sheets.appendRow' || nodeType === 'sheets.updateRow'
              ? getDefaultNodeSchema(nodeType, nodeKey, nodeName)
              : [];
          discoveredVars = sanitizeDiscoveredVariables(
            [...sampleVars, ...schemaVars],
            node.data.params,
            nodeType
          );
        }
      }
    }

    // 3. Fallback: Structural schema
    if (discoveredVars.length === 0) {
      discoveredVars = getDefaultNodeSchema(nodeType, nodeKey, nodeName);
    }

    // Final deduplication & clean safeguard
    discoveredVars = sanitizeDiscoveredVariables(discoveredVars, node.data.params, nodeType);

    if (discoveredVars.length > 0) {
      groups.push({
        nodeId: node.id,
        nodeKey,
        nodeName,
        nodeType,
        hasLiveOutputs,
        variables: discoveredVars,
      });
    }
  }

  // Append system variables
  if (includeSystem) {
    groups.push({
      nodeId: 'system',
      nodeKey: 'system',
      nodeName: 'System Variables',
      nodeType: 'system',
      hasLiveOutputs: true,
      variables: getSystemVariables(),
    });
  }

  return groups;
}
