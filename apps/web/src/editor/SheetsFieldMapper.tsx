import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Zap,
  ChevronDown,
  Search,
  Table,
  Plus,
  Trash2,
  RefreshCw,
  Code,
  Calendar,
  Check,
  CheckCircle2,
  AlertCircle,
  Info,
  ExternalLink,
} from 'lucide-react';
import { CanvasNode, CanvasEdge } from './graphConverter.js';
import { NodeRunRecord, api } from '../api/client.js';
import {
  autoMapFields,
  SourceFieldDefinition,
  MappingOrigin,
  AutoMapResult,
} from '@workflow/engine';
import { discoverWorkflowVariables } from './fields/dynamicVariableDiscovery.js';

export interface SheetsFieldMapperProps {
  spreadsheetId?: string;
  sheetName?: string;
  credentialId?: string;
  values: any;
  mappingMeta?: Record<string, any>;
  allNodes: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId: string;
  onChangeValues: (newValues: Record<string, any>, newMeta?: Record<string, any>) => void;
}

export const SheetsFieldMapper: React.FC<SheetsFieldMapperProps> = ({
  spreadsheetId,
  sheetName = 'Sheet1',
  credentialId,
  values,
  mappingMeta,
  allNodes,
  edges = [],
  nodeRuns = [],
  currentNodeId,
  onChangeValues,
}) => {
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoadingHeaders, setIsLoadingHeaders] = useState(false);
  const [autoMapSuccess, setAutoMapSuccess] = useState(false);
  const [activeDropdownCol, setActiveDropdownCol] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [customInputCol, setCustomInputCol] = useState<string | null>(null);
  const [customInputValue, setCustomInputValue] = useState('');
  const [customRawCol, setCustomRawCol] = useState<string | null>(null);
  const [customRawValue, setCustomRawValue] = useState('');
  const [isWritingHeaders, setIsWritingHeaders] = useState(false);

  // Check if upstream webhook node exists and whether it has received sample data
  const upstreamWebhookNode = useMemo(() => {
    return allNodes.find((n) => n.data.type === 'webhook.trigger');
  }, [allNodes]);

  const hasWebhookSample = Boolean(
    upstreamWebhookNode?.data?.params?.samplePayload ||
      upstreamWebhookNode?.data?.params?.lastPayload
  );

  const upstreamFormsNode = useMemo(() => {
    return allNodes.find(
      (n) => n.data.type === 'google_forms.trigger' || n.data.type === 'forms.trigger'
    );
  }, [allNodes]);

  const hasFormsSample = Boolean(
    upstreamFormsNode?.data?.params?.samplePayload ||
      upstreamFormsNode?.data?.params?.lastPayload ||
      (Array.isArray(upstreamFormsNode?.data?.params?.questions) &&
        upstreamFormsNode?.data?.params?.questions.length > 0)
  );

  // 1. Normalize current values into a key-value dictionary
  const currentMap = useMemo<Record<string, any>>(() => {
    if (!values) return {};
    if (typeof values === 'object' && !Array.isArray(values)) {
      return { ...values };
    }
    if (typeof values === 'string') {
      try {
        const parsed = JSON.parse(values);
        if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
          return parsed;
        }
      } catch {}
    }
    return {};
  }, [values]);

  // 2. Normalized mapping metadata
  const currentMeta = useMemo<Record<string, { origin?: MappingOrigin; value?: string; userEdited?: boolean }>>(() => {
    if (mappingMeta && typeof mappingMeta === 'object' && !Array.isArray(mappingMeta)) {
      return { ...mappingMeta };
    }
    return {};
  }, [mappingMeta]);

  // 3. Dynamically discover all workflow variables from upstream steps and system
  const availableSources = useMemo<SourceFieldDefinition[]>(() => {
    const groups = discoverWorkflowVariables({
      currentNodeId,
      allNodes,
      edges,
      nodeRuns,
      includeSystem: true,
    });

    const flat: SourceFieldDefinition[] = [];
    for (const group of groups) {
      for (const v of group.variables) {
        flat.push({
          id: v.id,
          rawExpression: v.rawExpression,
          nodeKey: v.nodeKey,
          stepName: group.nodeName,
          path: v.path,
          label: `${group.nodeName} → ${v.label}`,
          type: v.type,
          sampleValue: v.sampleValue,
          sourceCategory: group.nodeType === 'system' ? 'system' : 'action',
        });
      }
    }
    return flat;
  }, [currentNodeId, allNodes, edges, nodeRuns]);

  // Derive real upstream question/field names
  const realUpstreamFieldNames = useMemo<string[]>(() => {
    const nonSystem = availableSources.filter((s) => s.sourceCategory !== 'system');
    const names = new Set<string>();
    for (const s of nonSystem) {
      const key = s.path.includes('.') ? s.path.split('.').pop()! : s.path;
      if (
        key &&
        !['responseId', 'formId', 'submittedAt', 'timestamp', 'answers', 'body', 'headers', 'query', 'payload'].includes(
          key
        )
      ) {
        names.add(s.path.includes('.') ? s.path : s.label || key);
      }
    }
    return Array.from(names);
  }, [availableSources]);

  const upstreamSourceName = useMemo((): string => {
    const trigger = allNodes.find((n) => n.data?.category === 'trigger');
    const raw = trigger?.data?.label ?? trigger?.data?.name;
    return typeof raw === 'string' && raw.trim() ? raw : 'Trigger';
  }, [allNodes]);

  // 4. Fetch sheet headers dynamically when spreadsheet and sheetName change
  const fetchHeaders = async () => {
    if (!spreadsheetId || !credentialId || spreadsheetId.includes('{{')) {
      setHeaders([]);
      return;
    }

    setIsLoadingHeaders(true);
    try {
      const fetched = await api.getGoogleSheetHeaders(
        spreadsheetId,
        sheetName || 'Sheet1',
        credentialId
      );
      if (Array.isArray(fetched)) {
        setHeaders(fetched);
      } else {
        setHeaders([]);
      }
    } catch {
      setHeaders([]);
    } finally {
      setIsLoadingHeaders(false);
    }
  };

  useEffect(() => {
    fetchHeaders();
  }, [spreadsheetId, sheetName, credentialId]);

  // 5. Evaluate matching using FieldMatchingEngine
  const matchingResult = useMemo<AutoMapResult>(() => {
    return autoMapFields({
      targets: headers,
      sources: availableSources,
      existingValues: currentMap,
      existingMeta: currentMeta,
      forceRemap: false,
    });
  }, [headers, availableSources, currentMap, currentMeta]);

  const headersSig = headers.join('|');
  const sourcesSig = availableSources.map((s) => s.id).join('|');
  const lastAutoMappedSig = useRef<string>('');

  // 6. Prune stale / obsolete column mappings that do not exist in current sheet headers
  useEffect(() => {
    if (headers.length === 0) {
      // If sheet has no headers and values has stale keys, reset
      if (Object.keys(currentMap).length > 0) {
        onChangeValues({}, {});
      }
      return;
    }
    const headerSet = new Set(headers);
    const staleKeys = Object.keys(currentMap).filter((k) => !headerSet.has(k));
    const staleMetaKeys = Object.keys(currentMeta).filter((k) => !headerSet.has(k));

    if (staleKeys.length > 0 || staleMetaKeys.length > 0) {
      const prunedValues: Record<string, any> = {};
      const prunedMeta: Record<string, any> = {};

      for (const h of headers) {
        if (currentMap[h] !== undefined) {
          prunedValues[h] = currentMap[h];
        }
        if (currentMeta[h] !== undefined) {
          prunedMeta[h] = currentMeta[h];
        }
      }

      onChangeValues(prunedValues, prunedMeta);
    }
  }, [headersSig]);

  // 7. Automatic matching on mount and whenever headers or upstream fields change
  useEffect(() => {
    if (headers.length === 0 || availableSources.length === 0) return;

    const currentSig = `${headersSig}:::${sourcesSig}`;
    if (lastAutoMappedSig.current === currentSig) return;
    lastAutoMappedSig.current = currentSig;

    const res = autoMapFields({
      targets: headers,
      sources: availableSources,
      existingValues: currentMap,
      existingMeta: currentMeta,
      forceRemap: false,
    });

    let changed = false;
    const newValues: Record<string, any> = {};
    const newMeta: Record<string, any> = {};

    // Only retain active headers
    for (const h of headers) {
      if (currentMap[h] !== undefined) {
        newValues[h] = currentMap[h];
      }
      if (currentMeta[h] !== undefined) {
        newMeta[h] = currentMeta[h];
      }
    }

    const headerSet = new Set(headers);
    if (Object.keys(currentMap).some((k) => !headerSet.has(k))) {
      changed = true;
    }

    for (const entry of res.entries) {
      const header = entry.targetKey;
      if (!headers.includes(header)) continue;
      const isManual = newMeta[header]?.origin === 'manual';
      const hasValue = newValues[header] !== undefined && String(newValues[header]).trim() !== '';

      if (!isManual && !hasValue && entry.origin === 'auto' && entry.value) {
        newValues[header] = entry.value;
        newMeta[header] = {
          origin: 'auto',
          value: entry.value,
        };
        changed = true;
      }
    }

    if (changed) {
      onChangeValues(newValues, newMeta);
    }
  }, [headersSig, sourcesSig]);

  // 8. Manual trigger: Auto-Map button
  const handleAutoMap = () => {
    const res = autoMapFields({
      targets: headers,
      sources: availableSources,
      existingValues: currentMap,
      existingMeta: currentMeta,
      forceRemap: true, // re-evaluates all auto fields while preserving manual fields
    });

    const newValues: Record<string, any> = {};
    const newMeta: Record<string, any> = {};

    for (const header of headers) {
      if (currentMap[header] !== undefined) {
        newValues[header] = currentMap[header];
      }
      if (currentMeta[header] !== undefined) {
        newMeta[header] = currentMeta[header];
      }
    }

    for (const entry of res.entries) {
      const header = entry.targetKey;
      if (!headers.includes(header)) continue;

      const isManualWithVal =
        newMeta[header]?.origin === 'manual' &&
        newValues[header] !== undefined &&
        String(newValues[header]).trim() !== '';

      if (!isManualWithVal && entry.origin === 'auto' && entry.value) {
        newValues[header] = entry.value;
        newMeta[header] = {
          origin: 'auto',
          value: entry.value,
        };
      }
    }

    onChangeValues(newValues, newMeta);
    setAutoMapSuccess(true);
    setTimeout(() => setAutoMapSuccess(false), 2000);
  };

  // 9. One-click Accept for suggested matches
  const handleAcceptSuggestion = (header: string, expr: string) => {
    const newValues: Record<string, any> = {};
    const newMeta: Record<string, any> = {};

    for (const h of headers) {
      if (currentMap[h] !== undefined) {
        newValues[h] = currentMap[h];
      }
      if (currentMeta[h] !== undefined) {
        newMeta[h] = currentMeta[h];
      }
    }

    newValues[header] = expr;
    newMeta[header] = {
      origin: 'manual' as MappingOrigin,
      value: expr,
      userEdited: true,
    };
    onChangeValues(newValues, newMeta);
  };

  // 10. Assign manual mapping
  const handleMapField = (header: string, exprOrVal: string) => {
    const newValues: Record<string, any> = {};
    const newMeta: Record<string, any> = {};

    for (const h of headers) {
      if (currentMap[h] !== undefined) {
        newValues[h] = currentMap[h];
      }
      if (currentMeta[h] !== undefined) {
        newMeta[h] = currentMeta[h];
      }
    }

    newValues[header] = exprOrVal;
    newMeta[header] = {
      origin: 'manual' as MappingOrigin,
      value: exprOrVal,
      userEdited: true,
    };
    onChangeValues(newValues, newMeta);
    setActiveDropdownCol(null);
  };

  // 11. Remove mapping
  const handleRemoveField = (header: string) => {
    const newValues: Record<string, any> = {};
    const newMeta: Record<string, any> = {};

    for (const h of headers) {
      if (h === header) continue;
      if (currentMap[h] !== undefined) {
        newValues[h] = currentMap[h];
      }
      if (currentMeta[h] !== undefined) {
        newMeta[h] = currentMeta[h];
      }
    }

    newMeta[header] = {
      origin: 'manual' as MappingOrigin,
      value: '',
      userEdited: true,
    };
    onChangeValues(newValues, newMeta);
  };

  // 12. Add custom column
  const handleAddCustomColumn = async () => {
    const colName = prompt('Enter new column header name:');
    if (colName && colName.trim()) {
      const trimmed = colName.trim();
      if (!headers.includes(trimmed)) {
        const next = [...headers, trimmed];
        setHeaders(next);
        if (spreadsheetId && credentialId) {
          try {
            await api.addGoogleSheetColumns(spreadsheetId, sheetName || 'Sheet1', credentialId, [trimmed]);
          } catch (err) {
            console.warn('Could not write column to remote sheet:', err);
          }
        }
      }
    }
  };

  // 12b. Auto-create headers in Google Sheet from real upstream trigger fields
  const handleAutoCreateHeadersFromUpstream = async () => {
    if (realUpstreamFieldNames.length === 0) return;
    setIsWritingHeaders(true);
    try {
      if (spreadsheetId && credentialId) {
        const updated = await api.addGoogleSheetColumns(
          spreadsheetId,
          sheetName || 'Sheet1',
          credentialId,
          realUpstreamFieldNames
        );
        setHeaders(updated);
      } else {
        setHeaders(realUpstreamFieldNames);
      }
    } catch (err: any) {
      console.error('Failed to create headers in sheet:', err);
      setHeaders(realUpstreamFieldNames);
    } finally {
      setIsWritingHeaders(false);
    }
  };

  // 12c. Clear all current mappings
  const handleClearAllMappings = () => {
    onChangeValues({}, {});
  };

  // 13. Format display label and validate expression against upstream sources
  const getDisplayLabel = (val: any) => {
    if (val === undefined || val === null || val === '') {
      return null;
    }
    const str = String(val).trim();
    const matched = availableSources.find((s) => s.rawExpression === str);
    if (matched) {
      return {
        label: matched.label,
        isExpression: true,
        sample: matched.sampleValue ? String(matched.sampleValue) : undefined,
        isValid: true,
      };
    }
    if (str.startsWith('{{') && str.endsWith('}}')) {
      const inner = str.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
      const segments = inner.split(/[\.\[\]]/).filter(Boolean);

      let fieldPath = inner;
      if (segments[0] === '$node' && segments.length > 1) {
        const rest = segments.slice(1);
        if (rest[0] === 'output' || rest[0] === 'data') rest.shift();
        if (rest.length > 1 && (rest[0] === 'trigger' || rest[0].includes('trigger'))) {
          fieldPath = rest.slice(1).join('.');
        } else {
          fieldPath = rest.join('.');
        }
      } else if (segments[0] === 'trigger' && segments.length > 1) {
        fieldPath = segments.slice(1).join('.');
      }

      // Check if any source in availableSources matches this field path or root
      const pathMatched = availableSources.find(
        (s) =>
          s.path === fieldPath ||
          s.id.endsWith(`.${fieldPath}`) ||
          s.rawExpression.includes(inner) ||
          inner === '$now' ||
          inner === '$uuid'
      );

      if (pathMatched) {
        return {
          label: pathMatched.label || inner,
          isExpression: true,
          sample: pathMatched.sampleValue ? String(pathMatched.sampleValue) : undefined,
          isValid: true,
        };
      }

      // If availableSources has elements and no match is found, mark as invalid/obsolete
      const isMissing = availableSources.length > 0;
      return {
        label: inner,
        isExpression: true,
        sample: isMissing ? 'Missing Variable' : 'Dynamic Value',
        isValid: !isMissing,
        isObsolete: isMissing,
        errorReason: isMissing ? `Variable '${inner}' does not exist in upstream steps` : undefined,
      };
    }
    return {
      label: str,
      isExpression: false,
      sample: str,
      isValid: true,
    };
  };

  // Column letters (A, B, C...)
  const getColLetter = (index: number) => {
    return String.fromCharCode(65 + (index % 26));
  };

  // Filter sources based on search query
  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return availableSources;
    const q = searchQuery.toLowerCase();
    return availableSources.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.path.toLowerCase().includes(q) ||
        s.rawExpression.toLowerCase().includes(q)
    );
  }, [availableSources, searchQuery]);

  // Mapping summary metrics
  const totalCols = headers.length;
  const mappedCols = headers.filter((h) => currentMap[h] && String(currentMap[h]).trim() !== '').length;
  const autoMappedCols = headers.filter(
    (h) => currentMap[h] && String(currentMap[h]).trim() !== '' && currentMeta[h]?.origin === 'auto'
  ).length;
  const manualCols = headers.filter(
    (h) => currentMap[h] && String(currentMap[h]).trim() !== '' && currentMeta[h]?.origin === 'manual'
  ).length;
  const unmappedCols = totalCols - mappedCols;
  const invalidCols = headers.filter((h) => {
    const d = getDisplayLabel(currentMap[h]);
    return d && !d.isValid;
  });

  return (
    <div className="space-y-4 font-sans select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Table className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-text-primary">
            Column Field Mapping
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold font-mono"
            title={`${autoMappedCols} Auto, ${manualCols} Manual, ${unmappedCols} Unmapped`}
          >
            {mappedCols}/{totalCols} columns mapped
          </span>
        </div>

        <div className="flex items-center gap-2">
          {mappedCols > 0 && (
            <button
              type="button"
              onClick={handleClearAllMappings}
              className="px-2 py-1 rounded-[8px] text-[10px] text-text-muted hover:text-rose-400 hover:bg-[#202020] transition-colors cursor-pointer"
              title="Clear all field mappings"
            >
              Clear Mappings
            </button>
          )}

          <button
            type="button"
            onClick={fetchHeaders}
            disabled={isLoadingHeaders}
            className="p-1 rounded-[8px] text-text-muted hover:text-text-primary hover:bg-[#202020] transition-colors cursor-pointer"
            title="Refresh headers from spreadsheet"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingHeaders ? 'animate-spin text-accent' : ''}`}
            />
          </button>

          {headers.length > 0 && (
            <button
              type="button"
              onClick={handleAutoMap}
              className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] bg-[#1E1E1E] hover:bg-[#262626] border border-[#303030] text-[11px] font-semibold text-text-primary transition-all hover:border-emerald-500/40 shadow-sm cursor-pointer"
              title="Automatically match spreadsheet columns with upstream workflow fields"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>{autoMapSuccess ? 'Mapped!' : 'Auto-Map'}</span>
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-text-muted font-sans leading-relaxed">
        Map each Google Sheet column to an incoming workflow field or static text. Each execution appends exactly one clean row.
      </p>

      {/* Upstream Webhook Needs Sample Alert */}
      {upstreamWebhookNode && !hasWebhookSample && (
        <div className="p-3 rounded-[14px] bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200">
              Webhook Trigger Needs Sample Payload
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              No webhook payload has been captured yet. Auto-Map and field pickers need a sample JSON payload to dynamically discover fields. Open the <strong>Webhook Trigger</strong> node to send a test request or click <strong>Load Test Lead Payload</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Upstream Google Forms Needs Sample Alert */}
      {upstreamFormsNode && !hasFormsSample && (
        <div className="p-3 rounded-[14px] bg-[#7248B9]/15 border border-[#7248B9]/30 text-purple-200 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[#7248B9] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-white">
              Google Forms Schema Discovery Ready
            </div>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              Open your <strong>Google Forms Trigger</strong> and click <strong>Test Trigger</strong> to preview sample responses and auto-map your sheet columns.
            </p>
          </div>
        </div>
      )}

      {/* Invalid / Missing Variable Alert */}
      {invalidCols.length > 0 && (
        <div className="p-3 rounded-[14px] bg-danger/10 border border-danger/30 text-danger text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-danger">
              {invalidCols.length} Invalid Variable Mapping{invalidCols.length > 1 ? 's' : ''} Detected
            </div>
            <p className="text-[11px] text-danger/80 leading-relaxed">
              Column{invalidCols.length > 1 ? 's' : ''} <strong>{invalidCols.join(', ')}</strong> reference variable expressions that no longer exist in upstream steps. Click on the mapping chip to select an available variable or click trash to clear it before running.
            </p>
          </div>
        </div>
      )}

      {/* Pre-Execution Validation Notice */}
      {totalCols > 0 && (
        <div
          className={`p-2.5 rounded-[12px] border text-xs flex items-start gap-2 ${
            unmappedCols === 0
              ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
              : 'bg-amber-950/20 border-amber-500/20 text-amber-300'
          }`}
        >
          {unmappedCols === 0 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed text-[11px]">
            {unmappedCols === 0 ? (
              <span>All {totalCols} columns mapped and ready for execution.</span>
            ) : (
              <span>
                {unmappedCols} unmapped column(s) (
                {headers.filter((h) => !currentMap[h] || currentMap[h] === '').slice(0, 3).join(', ')}
                {unmappedCols > 3 ? '...' : ''}
                ). They will be appended as blank cells unless mapped.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Field Mapping Rows or Empty State */}
      {isLoadingHeaders ? (
        <div className="p-6 rounded-[18px] bg-[#121212] border border-[#242424] text-center space-y-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400 mx-auto" />
          <span className="text-xs text-text-muted">Loading headers from spreadsheet...</span>
        </div>
      ) : headers.length === 0 ? (
        <div className="p-5 rounded-[18px] bg-[#141414] border border-[#262626] text-center space-y-3">
          <div className="w-9 h-9 rounded-full bg-[#1F1F1F] border border-[#303030] flex items-center justify-center mx-auto text-[#888888]">
            <Table className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="font-semibold text-white text-xs">
              No Column Headers Detected in "{sheetName}"
            </div>
            <p className="text-[11px] text-[#808080] max-w-sm mx-auto leading-relaxed">
              Row 1 of this sheet is currently empty. Add headers to Row 1 in your Google Sheet, or click below to set up columns.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleAddCustomColumn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#222222] hover:bg-[#2A2A2A] border border-[#333333] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Add Column Header</span>
            </button>

            {realUpstreamFieldNames.length > 0 && (
              <button
                type="button"
                onClick={handleAutoCreateHeadersFromUpstream}
                disabled={isWritingHeaders}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isWritingHeaders ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Create Headers from {upstreamSourceName} ({realUpstreamFieldNames.length} fields)</span>
              </button>
            )}

            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#202020] hover:bg-[#282828] text-[#A0A0A0] hover:text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <span>Open Google Sheets</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 bg-[#121212] border border-[#242424] rounded-[18px] p-3 shadow-inner">
          {headers.map((header, idx) => {
            const mappedVal = currentMap[header];
            const display = getDisplayLabel(mappedVal);
            const isDropdownOpen = activeDropdownCol === header;
            const entry = matchingResult.entries.find((e) => e.targetKey === header);

            const isMapped = mappedVal !== undefined && mappedVal !== null && String(mappedVal).trim() !== '';
            const origin = currentMeta[header]?.origin || (isMapped ? 'auto' : undefined);

            const hasSuggestion = !isMapped && entry?.origin === 'suggested' && entry?.suggestedSource;

            return (
              <div
                key={header}
                className="relative p-2.5 rounded-[12px] bg-[#181818] border border-[#282828] hover:border-[#333333] transition-colors space-y-2"
              >
              <div className="flex items-center justify-between gap-3">
                {/* Column Badge & Header Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-[6px] bg-[#222222] border border-[#2E2E2E] text-[10px] font-mono font-bold text-text-secondary flex items-center justify-center shrink-0">
                    {getColLetter(idx)}
                  </span>
                  <span className="text-xs font-semibold text-text-primary truncate" title={header}>
                    {header}
                  </span>

                  {/* Mapping Status Badge */}
                  {isMapped && display && !display.isValid && (
                    <span
                      className="px-1.5 py-0.5 rounded-[6px] bg-danger/15 text-danger border border-danger/30 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                      title={display.errorReason || 'Expression references missing upstream field'}
                    >
                      <AlertCircle className="w-2.5 h-2.5 text-danger" />
                      Invalid
                    </span>
                  )}
                  {isMapped && (!display || display.isValid) && origin === 'auto' && (
                    <span
                      className="px-1.5 py-0.5 rounded-[6px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold flex items-center gap-1 shrink-0"
                      title={entry?.reason || 'Automatically matched from upstream workflow fields'}
                    >
                      <Zap className="w-2.5 h-2.5 text-emerald-400" />
                      Auto
                    </span>
                  )}
                  {isMapped && (!display || display.isValid) && origin === 'manual' && (
                    <span
                      className="px-1.5 py-0.5 rounded-[6px] bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-semibold shrink-0"
                      title="Manually configured or overridden"
                    >
                      Manual
                    </span>
                  )}
                  {hasSuggestion && (
                    <span
                      className="px-1.5 py-0.5 rounded-[6px] bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold shrink-0"
                      title={entry?.suggestedReason || 'Suggested based on field similarity'}
                    >
                      Suggested
                    </span>
                  )}
                  {!isMapped && !hasSuggestion && (
                    <span className="px-1.5 py-0.5 rounded-[6px] bg-[#222222] text-text-muted border border-[#303030] text-[10px] shrink-0">
                      Unmapped
                    </span>
                  )}
                </div>

                {/* Right: Selected Value Button or Selector */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* If unmapped and has a medium-confidence suggestion, offer 1-click Accept */}
                  {hasSuggestion && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAcceptSuggestion(header, entry!.suggestedSource!.rawExpression)
                      }
                      className="flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition-colors shadow-sm"
                      title={`Accept suggested mapping: ${entry!.suggestedSource!.label}`}
                    >
                      <Check className="w-3 h-3 text-amber-400" />
                      <span>Accept {entry!.suggestedSource!.path || entry!.suggestedSource!.label}</span>
                    </button>
                  )}

                  {display ? (
                    <div
                      className={`flex items-center gap-1 rounded-[10px] px-2.5 py-1 text-xs border ${
                        display.isValid
                          ? 'bg-[#202020] border-[#333333]'
                          : 'bg-danger/10 border-danger/40 text-danger shadow-sm'
                      }`}
                    >
                      {display.isExpression ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          {display.isValid ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0" />
                          )}
                          <span
                            className={`truncate max-w-[130px] ${
                              display.isValid ? 'text-text-primary' : 'text-danger font-semibold'
                            }`}
                            title={display.errorReason || display.label}
                          >
                            {display.isValid ? display.label : `Missing: ${display.label}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-secondary truncate max-w-[130px]">
                          "{display.label}"
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveDropdownCol(isDropdownOpen ? null : header);
                          setSearchQuery('');
                        }}
                        className="p-0.5 rounded text-text-muted hover:text-text-primary ml-1"
                        title="Change mapping"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveField(header)}
                        className="p-0.5 rounded text-text-muted hover:text-danger ml-0.5"
                        title="Clear field mapping"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDropdownCol(isDropdownOpen ? null : header);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-[10px] bg-[#222222] hover:bg-[#2A2A2A] border border-[#303030] text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors"
                    >
                      <span>Choose field...</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Source Picker Dropdown Popover */}
              {isDropdownOpen && (
                <div className="p-3 rounded-[14px] bg-[#1F1F1F] border border-[#333333] shadow-2xl space-y-3 z-30 animate-in fade-in zoom-in-95 duration-100">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-2.5" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search previous step fields..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#161616] border border-[#2E2E2E] focus:border-[#444444] text-text-primary text-xs rounded-[10px] pl-8 pr-3 py-2 outline-none transition-colors"
                    />
                  </div>

                  {/* Sources List Grouped */}
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1 text-xs">
                    {/* Previous steps */}
                    <div>
                      <div className="text-[10px] uppercase font-mono tracking-wider text-text-muted px-2 py-1 font-semibold">
                        Previous Steps
                      </div>
                      <div className="space-y-0.5">
                        {filteredSources.filter((s) => s.sourceCategory !== 'system').length === 0 ? (
                          <div className="px-2.5 py-2.5 text-[11px] text-[#707070] italic">
                            No variables detected from previous steps. Configure or test upstream triggers to discover fields.
                          </div>
                        ) : (
                          filteredSources
                            .filter((s) => s.sourceCategory !== 'system')
                            .map((source) => (
                              <button
                                key={source.rawExpression}
                                type="button"
                                onClick={() => handleMapField(header, source.rawExpression)}
                                className="w-full text-left px-2.5 py-1.5 rounded-[8px] hover:bg-[#282828] text-text-primary flex items-center justify-between group transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  <span className="font-medium text-xs truncate">
                                    {source.label}
                                  </span>
                                </div>
                                {source.sampleValue !== undefined && source.sampleValue !== null && (
                                  <span className="text-[10px] text-text-muted truncate max-w-[100px] font-mono opacity-80">
                                    {String(source.sampleValue)}
                                  </span>
                                )}
                              </button>
                            ))
                        )}
                      </div>
                    </div>

                    {/* System Values */}
                    <div className="pt-1 border-t border-[#2A2A2A]">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-text-muted px-2 py-1 font-semibold flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-accent" />
                        <span>System Values</span>
                      </div>
                      <div className="space-y-0.5">
                        {filteredSources
                          .filter((s) => s.sourceCategory === 'system')
                          .map((source) => (
                            <button
                              key={source.rawExpression}
                              type="button"
                              onClick={() => handleMapField(header, source.rawExpression)}
                              className="w-full text-left px-2.5 py-1.5 rounded-[8px] hover:bg-[#282828] text-text-primary flex items-center justify-between group transition-colors"
                            >
                              <span className="font-medium text-xs text-text-secondary group-hover:text-text-primary">
                                {source.label}
                              </span>
                              {source.sampleValue !== undefined && source.sampleValue !== null && (
                                <span className="text-[10px] text-text-muted font-mono">
                                  {String(source.sampleValue)}
                                </span>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Custom Static Text Input */}
                    <div className="pt-2 border-t border-[#2A2A2A]">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-text-muted px-2 py-1 font-semibold">
                        Static Text
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="e.g. VIP Lead, Active, 100"
                          value={customInputCol === header ? customInputValue : ''}
                          onChange={(e) => {
                            setCustomInputCol(header);
                            setCustomInputValue(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customInputValue.trim()) {
                              handleMapField(header, customInputValue.trim());
                            }
                          }}
                          className="flex-1 bg-[#161616] border border-[#2E2E2E] text-text-primary text-xs rounded-[8px] px-2.5 py-1.5 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customInputValue.trim()) {
                              handleMapField(header, customInputValue.trim());
                            }
                          }}
                          className="px-3 py-1.5 rounded-[8px] bg-white text-black text-xs font-semibold hover:bg-[#EAEAEA]"
                        >
                          Set
                        </button>
                      </div>
                    </div>

                    {/* Advanced: Custom Field Path / Expression */}
                    <div className="pt-2 border-t border-[#2A2A2A]">
                      <div className="text-[10px] uppercase font-mono tracking-wider text-text-muted px-2 py-1 font-semibold flex items-center justify-between">
                        <span>Advanced: Custom Field Path</span>
                        <span className="text-[9px] text-neutral-500">e.g. body.score</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="e.g. body.leadId or {{ trigger.body.leadId }}"
                          value={customRawCol === header ? customRawValue : ''}
                          onChange={(e) => {
                            setCustomRawCol(header);
                            setCustomRawValue(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customRawValue.trim()) {
                              const raw = customRawValue.trim();
                              const expr = raw.startsWith('{{')
                                ? raw
                                : `{{ trigger.${raw.replace(/^trigger\./, '')} }}`;
                              handleMapField(header, expr);
                              setCustomRawValue('');
                              setCustomRawCol(null);
                            }
                          }}
                          className="flex-1 bg-[#161616] border border-[#2E2E2E] text-text-primary text-xs rounded-[8px] px-2.5 py-1.5 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customRawValue.trim()) {
                              const raw = customRawValue.trim();
                              const expr = raw.startsWith('{{')
                                ? raw
                                : `{{ trigger.${raw.replace(/^trigger\./, '')} }}`;
                              handleMapField(header, expr);
                              setCustomRawValue('');
                              setCustomRawCol(null);
                            }
                          }}
                          className="px-3 py-1.5 rounded-[8px] bg-white text-black text-xs font-semibold hover:bg-[#EAEAEA]"
                        >
                          Map
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add custom column button */}
        <button
          type="button"
          onClick={handleAddCustomColumn}
          className="w-full py-2 rounded-[12px] border border-dashed border-[#2E2E2E] hover:border-[#444444] text-[11px] font-medium text-text-muted hover:text-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Column Header</span>
        </button>
      </div>
    )}

      {/* Row Preview Card (Live spreadsheet preview) */}
      <div className="p-4 rounded-[18px] bg-[#141414] border border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h4 className="text-xs font-semibold text-text-primary">
              Live Row Preview
            </h4>
          </div>
          <span className="text-[10px] text-text-muted font-mono">
            {sheetName} (1 row appended)
          </span>
        </div>

        {/* Horizontal Mini Sheet Table */}
        <div className="border border-[#262626] rounded-[12px] overflow-hidden bg-[#101010]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] font-mono">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#282828] text-text-muted">
                  {headers.map((h, i) => (
                    <th key={h} className="px-3 py-2 font-medium border-r border-[#242424] last:border-r-0 whitespace-nowrap">
                      <span className="text-text-secondary font-bold mr-1">{getColLetter(i)}:</span>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-[#161616] text-text-primary">
                  {headers.map((h) => {
                    const mappedVal = currentMap[h];
                    const display = getDisplayLabel(mappedVal);

                    return (
                      <td key={h} className="px-3 py-2 border-r border-[#242424] last:border-r-0 whitespace-nowrap">
                        {display ? (
                          <span className={display.isExpression ? 'text-emerald-300' : 'text-text-primary'}>
                            {display.sample || display.label}
                          </span>
                        ) : (
                          <span className="text-text-muted/40 italic">(empty)</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Advanced Section: Raw JSON / Direct Expressions */}
      <div className="border-t border-[#222222] pt-3">
        <button
          type="button"
          onClick={() => setShowAdvancedJson(!showAdvancedJson)}
          className="flex items-center justify-between w-full text-left text-xs font-medium text-text-muted hover:text-text-primary transition-colors py-1"
        >
          <span className="flex items-center gap-1.5">
            <Code className="w-3.5 h-3.5" />
            <span>Advanced: Raw JSON / Expression Editor</span>
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${showAdvancedJson ? 'rotate-180' : ''}`}
          />
        </button>

        {showAdvancedJson && (
          <div className="pt-3 space-y-2 animate-in fade-in duration-150">
            <textarea
              rows={5}
              value={JSON.stringify(currentMap, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (typeof parsed === 'object' && parsed !== null) {
                    onChangeValues(parsed);
                  }
                } catch {}
              }}
              className="w-full bg-[#161616] border border-[#262626] focus:border-[#444444] text-text-primary rounded-[12px] p-3 text-xs font-mono outline-none transition-colors resize-y leading-relaxed"
            />
            <p className="text-[10px] text-text-muted">
              You can edit the raw JSON mapping directly. Keys represent spreadsheet column headers.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
