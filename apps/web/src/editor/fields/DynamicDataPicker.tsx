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
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';
import { ServiceIcon } from '../../components/ServiceIcons.js';
import { discoverWorkflowVariables } from './dynamicVariableDiscovery.js';

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
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId: string;
  onSelect: (expression: string, field: DynamicSourceField) => void;
  onClose?: () => void;
}

export function DynamicDataPicker({
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId,
  onSelect,
  onClose,
}: DynamicDataPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Discover all upstream/previous workflow steps dynamically
  const sourceGroups = useMemo(() => {
    const rawGroups = discoverWorkflowVariables({
      currentNodeId,
      allNodes,
      edges,
      nodeRuns,
      includeSystem: true,
    });

    const groups: Array<{
      nodeId: string;
      nodeName: string;
      nodeType: string;
      fields: DynamicSourceField[];
    }> = [];

    for (const group of rawGroups) {
      const fields: DynamicSourceField[] = group.variables.map((v) => ({
        label: v.label,
        path: v.path,
        expression: v.rawExpression,
        type: v.type,
        sampleValue: v.sampleValue ? String(v.sampleValue) : undefined,
        sourceNodeId: group.nodeId,
        sourceNodeName: group.nodeName,
        sourceNodeType: group.nodeType,
      }));

      // If this is Google Sheets and has mapped column values in params, ensure those mapped column headers are also exposed
      const node = allNodes.find((n) => n.id === group.nodeId);
      if (node && node.data.type?.startsWith('sheets.') && node.data.params?.values) {
        const rawValues = node.data.params.values;
        let parsedValues: Record<string, any> = {};
        if (typeof rawValues === 'object' && !Array.isArray(rawValues) && rawValues !== null) {
          parsedValues = rawValues;
        } else if (typeof rawValues === 'string') {
          try {
            parsedValues = JSON.parse(rawValues);
          } catch {}
        }
        for (const [colName, colVal] of Object.entries(parsedValues)) {
          if (!colName.trim()) continue;
          const colClean = colName.trim();
          const colPath = `row["${colClean.replace(/"/g, '\\"')}"]`;
          const colExpr = `{{ ${group.nodeKey}["${colClean.replace(/"/g, '\\"')}"] }}`;
          if (!fields.some((f) => f.label.toLowerCase() === colClean.toLowerCase())) {
            fields.unshift({
              label: colClean,
              path: colPath,
              expression: colExpr,
              type: 'string',
              sampleValue: typeof colVal === 'string' && colVal.startsWith('{{') ? undefined : String(colVal),
              sourceNodeId: group.nodeId,
              sourceNodeName: group.nodeName,
              sourceNodeType: group.nodeType,
            });
          }
        }
      }

      groups.push({
        nodeId: group.nodeId,
        nodeName: group.nodeName,
        nodeType: group.nodeType,
        fields,
      });
    }

    return groups;
  }, [allNodes, edges, nodeRuns, currentNodeId]);

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !(prev[nodeId] ?? true),
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
            f.expression.toLowerCase().includes(q) ||
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
