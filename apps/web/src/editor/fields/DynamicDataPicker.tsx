import { useState, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Clock,
  ArrowRight,
  X,
  Variable,
} from 'lucide-react';
import { CanvasNode } from '../graphConverter.js';
import { ServiceIcon } from '../../components/ServiceIcons.js';
import { extractFieldsFromData } from './dynamicVariableDiscovery.js';

export interface DynamicSourceField {
  label: string; // Human readable, e.g. "Customer Email"
  path: string; // e.g. "body.email" or "data.id"
  expression: string; // e.g. "{{ webhook_lead.body.email }}"
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  sampleValue?: string;
  sourceNodeId: string;
  sourceNodeName: string;
  sourceNodeType: string;
}

export interface DynamicDataPickerProps {
  allNodes?: CanvasNode[];
  currentNodeId: string;
  onSelect: (expression: string, field: DynamicSourceField) => void;
  onClose?: () => void;
}

export function DynamicDataPicker({
  allNodes = [],
  currentNodeId,
  onSelect,
  onClose,
}: DynamicDataPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Discover all upstream/previous workflow steps
  const sourceGroups = useMemo(() => {
    // Exclude current node from output sources
    const eligibleNodes = allNodes.filter((n) => n.id !== currentNodeId);

    const groups: Array<{
      nodeId: string;
      nodeName: string;
      nodeType: string;
      fields: DynamicSourceField[];
    }> = [];

    for (const node of eligibleNodes) {
      const type = node.data.type;
      const nodeName = node.data.name || node.data.key || node.id;
      const nodeKey = node.data.key || node.id;

      const fields: DynamicSourceField[] = [];

      // Determine fields based on node type
      if (type === 'webhook.trigger') {
        const rawPayload =
          node.data.params?.samplePayload ??
          node.data.params?.lastPayload ??
          node.data.params?.payload;

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
            const root =
              'body' in parsed || 'headers' in parsed || 'query' in parsed
                ? parsed
                : { body: parsed };
            const extracted = extractFieldsFromData(root, nodeKey, nodeName, type, 'sample');
            for (const item of extracted) {
              fields.push({
                label: item.label,
                path: item.path,
                expression: item.rawExpression,
                type: item.type,
                sampleValue: item.sampleValue ? String(item.sampleValue) : undefined,
                sourceNodeId: node.id,
                sourceNodeName: nodeName,
                sourceNodeType: type,
              });
            }
          }
        } else {
          fields.push(
            {
              label: 'Full Request Body',
              path: 'body',
              expression: `{{ ${nodeKey}.body }}`,
              type: 'object',
              sampleValue: '(Waiting for test webhook)',
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            },
            {
              label: 'Request Headers',
              path: 'headers',
              expression: `{{ ${nodeKey}.headers }}`,
              type: 'object',
              sampleValue: '{ ... }',
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            },
            {
              label: 'URL Query Parameters',
              path: 'query',
              expression: `{{ ${nodeKey}.query }}`,
              type: 'object',
              sampleValue: '{ ... }',
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            }
          );
        }
      } else if (type === 'manual.trigger') {
        const payload = node.data.params?.payload;
        if (payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
          for (const [k, v] of Object.entries(payload)) {
            fields.push({
              label: k.charAt(0).toUpperCase() + k.slice(1),
              path: `payload.${k}`,
              expression: `{{ ${nodeKey}.${k} }}`,
              type: typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string',
              sampleValue: String(v),
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            });
          }
        } else {
          fields.push(
            {
              label: 'Trigger Lead ID',
              path: 'leadId',
              expression: `{{ ${nodeKey}.leadId }}`,
              type: 'string',
              sampleValue: '"LEAD-402"',
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            },
            {
              label: 'Trigger Email',
              path: 'email',
              expression: `{{ ${nodeKey}.email }}`,
              type: 'string',
              sampleValue: '"alex@example.com"',
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            },
            {
              label: 'Trigger Amount / Score',
              path: 'amount',
              expression: `{{ ${nodeKey}.amount }}`,
              type: 'number',
              sampleValue: '150',
              sourceNodeId: node.id,
              sourceNodeName: nodeName,
              sourceNodeType: type,
            }
          );
        }
      } else if (type === 'schedule.trigger') {
        fields.push(
          {
            label: 'Execution ISO Timestamp',
            path: 'timestamp',
            expression: `{{ ${nodeKey}.timestamp }}`,
            type: 'string',
            sampleValue: '"2026-11-06T10:00:00.000Z"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Cron Rule',
            path: 'cron',
            expression: `{{ ${nodeKey}.cron }}`,
            type: 'string',
            sampleValue: '"0 * * * *"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          }
        );
      } else if (type === 'http.request') {
        fields.push(
          {
            label: 'Response Body / Data',
            path: 'data',
            expression: `{{ ${nodeKey}.data }}`,
            type: 'object',
            sampleValue: '{ "id": "101", "status": "ok" }',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Response Status Code',
            path: 'status',
            expression: `{{ ${nodeKey}.status }}`,
            type: 'number',
            sampleValue: '200',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Response Item ID',
            path: 'data.id',
            expression: `{{ ${nodeKey}.data.id }}`,
            type: 'string',
            sampleValue: '"REC-884"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          }
        );
      } else if (type === 'logic.if') {
        fields.push({
          label: 'Condition Evaluation Result',
          path: 'result',
          expression: `{{ ${nodeKey}.result }}`,
          type: 'boolean',
          sampleValue: 'true',
          sourceNodeId: node.id,
          sourceNodeName: nodeName,
          sourceNodeType: type,
        });
      } else if (type.startsWith('sheets.')) {
        fields.push(
          {
            label: 'Read Rows List',
            path: 'rows',
            expression: `{{ ${nodeKey}.rows }}`,
            type: 'array',
            sampleValue: '[ { "Name": "Alex", "Email": "..." } ]',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Total Rows Count',
            path: 'totalRows',
            expression: `{{ ${nodeKey}.totalRows }}`,
            type: 'number',
            sampleValue: '14',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Updated Spreadsheet Range',
            path: 'updatedRange',
            expression: `{{ ${nodeKey}.updatedRange }}`,
            type: 'string',
            sampleValue: '"Sheet1!A12:D12"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          }
        );
      } else if (type === 'gmail.sendEmail') {
        fields.push({
          label: 'Sent Message ID',
          path: 'messageId',
          expression: `{{ ${nodeKey}.messageId }}`,
          type: 'string',
          sampleValue: '"18be75c02b1a9f02"',
          sourceNodeId: node.id,
          sourceNodeName: nodeName,
          sourceNodeType: type,
        });
      } else if (type.startsWith('drive.')) {
        fields.push(
          {
            label: 'Uploaded File ID',
            path: 'fileId',
            expression: `{{ ${nodeKey}.fileId }}`,
            type: 'string',
            sampleValue: '"1A2b3C4d5E6f_GoogleDriveId"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Web View Link',
            path: 'webViewLink',
            expression: `{{ ${nodeKey}.webViewLink }}`,
            type: 'string',
            sampleValue: '"https://drive.google.com/file/d/..."',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          }
        );
      } else if (type === 'calendar.createEvent') {
        fields.push(
          {
            label: 'Calendar Event ID',
            path: 'eventId',
            expression: `{{ ${nodeKey}.eventId }}`,
            type: 'string',
            sampleValue: '"cal_evt_991823"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Event Web URL',
            path: 'htmlLink',
            expression: `{{ ${nodeKey}.htmlLink }}`,
            type: 'string',
            sampleValue: '"https://calendar.google.com/event?eid=..."',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          }
        );
      } else if (type === 'github.createIssue') {
        fields.push(
          {
            label: 'Issue Number',
            path: 'issueNumber',
            expression: `{{ ${nodeKey}.issueNumber }}`,
            type: 'number',
            sampleValue: '#42',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          },
          {
            label: 'Issue URL',
            path: 'htmlUrl',
            expression: `{{ ${nodeKey}.htmlUrl }}`,
            type: 'string',
            sampleValue: '"https://github.com/org/repo/issues/42"',
            sourceNodeId: node.id,
            sourceNodeName: nodeName,
            sourceNodeType: type,
          }
        );
      } else {
        // Generic fallback fields
        fields.push({
          label: `${nodeName} Output`,
          path: 'output',
          expression: `{{ ${nodeKey}.output }}`,
          type: 'object',
          sampleValue: '{ ... }',
          sourceNodeId: node.id,
          sourceNodeName: nodeName,
          sourceNodeType: type,
        });
      }

      groups.push({
        nodeId: node.id,
        nodeName,
        nodeType: type,
        fields,
      });
    }

    // Add System Values group
    groups.push({
      nodeId: '__system__',
      nodeName: 'System & Date Values',
      nodeType: 'system',
      fields: [
        {
          label: 'Current Timestamp ($now)',
          path: '$now',
          expression: '{{ $now }}',
          type: 'string',
          sampleValue: new Date().toISOString(),
          sourceNodeId: '__system__',
          sourceNodeName: 'System',
          sourceNodeType: 'system',
        },
        {
          label: "Today's Date (YYYY-MM-DD)",
          path: '$today',
          expression: '{{ $now }}',
          type: 'string',
          sampleValue: new Date().toISOString().slice(0, 10),
          sourceNodeId: '__system__',
          sourceNodeName: 'System',
          sourceNodeType: 'system',
        },
      ],
    });

    return groups;
  }, [allNodes, currentNodeId]);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: prev[nodeId] === undefined ? false : !prev[nodeId],
    }));
  };

  // Filter fields based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return sourceGroups;
    const q = searchQuery.toLowerCase();

    return sourceGroups
      .map((g) => ({
        ...g,
        fields: g.fields.filter(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.path.toLowerCase().includes(q) ||
            f.sourceNodeName.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.fields.length > 0);
  }, [sourceGroups, searchQuery]);

  return (
    <div className="w-[340px] max-h-[440px] bg-[#161616] border border-[#2B2B2B] rounded-[20px] shadow-2xl flex flex-col overflow-hidden text-xs font-sans animate-in fade-in-0 zoom-in-95 duration-150 z-50 select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-[#242424] flex items-center justify-between bg-[#1A1A1A]">
        <div className="flex items-center gap-2">
          <Variable className="w-3.5 h-3.5 text-[#FF7306]" />
          <span className="font-semibold text-white tracking-tight">Select Data from Previous Step</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#7A7A7A] hover:text-white hover:bg-[#262626] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-[#242424] bg-[#141414]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#6B6B6B] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields (e.g. email, orderId, name)..."
            className="w-full bg-[#1A1A1A] border border-[#282828] focus:border-[#444444] text-white rounded-full pl-8 pr-3.5 py-1.5 text-xs outline-none transition-colors"
            autoFocus
          />
        </div>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredGroups.length === 0 ? (
          <div className="p-6 text-center text-[#737373]">
            <Variable className="w-6 h-6 mx-auto mb-2 opacity-40 text-white" />
            <p className="font-medium text-white/80">No matching fields found</p>
            <p className="text-[11px] mt-1 text-[#7A7A7A]">
              Connect previous steps to pass data into this field.
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isExpanded = expandedNodes[group.nodeId] ?? true;

            return (
              <div
                key={group.nodeId}
                className="rounded-[14px] bg-[#181818] border border-[#242424] overflow-hidden"
              >
                {/* Node Section Header */}
                <button
                  type="button"
                  onClick={() => toggleNode(group.nodeId)}
                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#202020] transition-colors text-left"
                >
                  <div className="flex items-center gap-2 truncate">
                    {group.nodeType === 'system' ? (
                      <Clock className="w-3.5 h-3.5 text-[#FF7306]" />
                    ) : (
                      <ServiceIcon service={group.nodeType} size={15} />
                    )}
                    <span className="font-semibold text-white truncate text-[12px]">
                      {group.nodeName}
                    </span>
                    <span className="text-[10px] text-[#737373] font-normal truncate">
                      ({group.fields.length} {group.fields.length === 1 ? 'field' : 'fields'})
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-[#737373]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-[#737373]" />
                  )}
                </button>

                {/* Fields under this node */}
                {isExpanded && (
                  <div className="border-t border-[#222222] divide-y divide-[#202020] bg-[#141414]">
                    {group.fields.map((field) => (
                      <button
                        key={field.expression}
                        type="button"
                        onClick={() => onSelect(field.expression, field)}
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-[#202020] transition-colors text-left group"
                      >
                        <div className="truncate pr-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium text-[#EDEDED] group-hover:text-white truncate">
                              {field.label}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#202020] border border-[#2A2A2A] text-[#8E8E8E] font-mono">
                              {field.type}
                            </span>
                          </div>
                          {field.sampleValue && (
                            <div className="text-[10px] text-[#737373] truncate font-mono mt-0.5">
                              Sample: <span className="text-[#A3A3A3]">{field.sampleValue}</span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-1 text-[11px] text-[#FF7306] opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Insert</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-[#242424] bg-[#181818] flex items-center justify-between text-[11px] text-[#7A7A7A]">
        <span>Automatically creates dynamic tag</span>
        <span className="font-mono text-[#9E9E9E]">&#123;&#123; variable &#125;&#125;</span>
      </div>
    </div>
  );
}
