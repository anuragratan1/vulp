import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  RefreshCw,
  Link2,
  FolderOpen,
  ExternalLink,
  Plus,
  AlertCircle,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { api } from '../../api/client.js';
import { CanvasNode } from '../graphConverter.js';
import { discoverWorkflowVariables } from './dynamicVariableDiscovery.js';

interface UpstreamField {
  key: string;
  label: string;
  expression: string;
  sourceStepName: string;
}

function getUpstreamFieldSuggestions(
  allNodes: CanvasNode[] = [],
  currentNodeId?: string
): UpstreamField[] {
  const groups = discoverWorkflowVariables({
    currentNodeId,
    allNodes,
    includeSystem: false,
  });

  const fields: UpstreamField[] = [];
  const seenKeys = new Set<string>();

  for (const group of groups) {
    for (const v of group.variables) {
      // Skip top-level container objects if they contain nested fields
      if (
        v.type === 'object' &&
        (v.path === 'body' || v.path === 'headers' || v.path === 'query' || v.path === 'payload')
      ) {
        continue;
      }

      // Determine leaf key (e.g. for "body.leadId" -> "leadId")
      const key = v.path.includes('.') ? v.path.split('.').pop()! : v.path;
      const lower = key.toLowerCase();

      if (!seenKeys.has(lower)) {
        seenKeys.add(lower);
        fields.push({
          key,
          label: v.label,
          expression: v.rawExpression,
          sourceStepName: group.nodeName,
        });
      }
    }
  }

  return fields;
}

export interface SpreadsheetPickerProps {
  credentialId?: string;
  spreadsheetId?: string;
  sheetName?: string;
  onChangeSpreadsheet: (id: string) => void;
  onChangeSheetName: (name: string) => void;
  allNodes?: CanvasNode[];
  currentNodeId?: string;
  onCreatedSpreadsheet?: (info: {
    spreadsheetId: string;
    sheetName: string;
    title: string;
    headers: string[];
    initialValues?: Record<string, string>;
  }) => void;
}

interface SpreadsheetValidationState {
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  error?: string;
  statusNumber?: number;
  title?: string;
  sheets?: string[];
  url?: string;
}

export const SpreadsheetPicker: React.FC<SpreadsheetPickerProps> = ({
  credentialId,
  spreadsheetId = '',
  sheetName = 'Sheet1',
  onChangeSpreadsheet,
  onChangeSheetName,
  allNodes = [],
  currentNodeId,
  onCreatedSpreadsheet,
}) => {
  const [spreadsheets, setSpreadsheets] = useState<
    Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>
  >([]);
  const [sheetsList, setSheetsList] = useState<string[]>([]);
  const [isLoadingSpreadsheets, setIsLoadingSpreadsheets] = useState(false);
  const [fetchSpreadsheetsError, setFetchSpreadsheetsError] = useState<string | null>(null);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);

  // Validation state for selected spreadsheet
  const [validationState, setValidationState] = useState<SpreadsheetValidationState>({
    status: 'idle',
  });

  // Modes: "select" (Select Existing) vs "create" (Create New)
  const [primaryMode, setPrimaryMode] = useState<'select' | 'create'>('select');
  // Select method: "picker" (Drive Picker) vs "url" (Paste URL / ID)
  const [selectMethod, setSelectMethod] = useState<'picker' | 'url'>(
    spreadsheetId && !spreadsheetId.includes(' ') ? 'picker' : 'picker'
  );
  const [customUrlInput, setCustomUrlInput] = useState(spreadsheetId);

  // Creation State
  const [newTitle, setNewTitle] = useState('');
  const [newSheetName, setNewSheetName] = useState('Sheet1');
  const [columnsToCreate, setColumnsToCreate] = useState<string[]>([]);
  const [customColInput, setCustomColInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [creationSuccessBanner, setCreationSuccessBanner] = useState<{
    id: string;
    title: string;
    url: string;
  } | null>(null);

  // Sync customUrlInput if spreadsheetId changes externally
  useEffect(() => {
    setCustomUrlInput(spreadsheetId);
  }, [spreadsheetId]);

  // Discover upstream fields
  const upstreamSuggestions = useMemo(() => {
    return getUpstreamFieldSuggestions(allNodes, currentNodeId);
  }, [allNodes, currentNodeId]);

  // Pre-seed columns from upstream when switching to Create mode if empty
  const handleSwitchToCreate = () => {
    setPrimaryMode('create');
    setCreateError(null);
    setValidationError(null);
    if (columnsToCreate.length === 0 && upstreamSuggestions.length > 0) {
      setColumnsToCreate(upstreamSuggestions.map((s) => s.key));
    }
  };

  // Fetch real spreadsheets from Google Drive for the connected account
  const fetchSpreadsheets = useCallback(async () => {
    if (!credentialId) {
      setSpreadsheets([]);
      setFetchSpreadsheetsError(null);
      return;
    }
    setIsLoadingSpreadsheets(true);
    setFetchSpreadsheetsError(null);
    try {
      const items = await api.getGoogleSpreadsheets(credentialId);
      setSpreadsheets(items || []);
    } catch (err: any) {
      setSpreadsheets([]);
      setFetchSpreadsheetsError(
        err?.message || 'Failed to retrieve spreadsheets from Google Drive.'
      );
    } finally {
      setIsLoadingSpreadsheets(false);
    }
  }, [credentialId]);

  useEffect(() => {
    fetchSpreadsheets();
  }, [fetchSpreadsheets]);

  // Validate the selected spreadsheet against Google Sheets API whenever spreadsheetId or credentialId changes
  const validateSpreadsheet = useCallback(
    async (targetId: string, targetCredId?: string) => {
      const cleanId = (targetId || '').trim();
      if (!cleanId) {
        setValidationState({ status: 'idle' });
        setSheetsList([]);
        return;
      }

      if (!targetCredId) {
        setValidationState({
          status: 'idle',
          title: spreadsheets.find((s) => s.id === cleanId)?.name,
          url: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        });
        return;
      }

      setValidationState({
        status: 'validating',
      });
      setIsLoadingSheets(true);

      try {
        const data = await api.getGoogleSpreadsheet(cleanId, targetCredId);
        setValidationState({
          status: 'valid',
          title: data.title,
          sheets: data.sheets,
          url: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        });

        if (Array.isArray(data.sheets) && data.sheets.length > 0) {
          setSheetsList(data.sheets);
          if (!data.sheets.includes(sheetName)) {
            onChangeSheetName(data.sheets[0]);
          }
        } else {
          setSheetsList(['Sheet1']);
        }
      } catch (err: any) {
        const errorMsg =
          err?.message ||
          (err?.status === 404
            ? 'Spreadsheet not found or deleted in Google Sheets.'
            : err?.status === 403
            ? 'Access denied. The connected Google account does not have permission to access this spreadsheet.'
            : 'Unable to access spreadsheet.');

        setValidationState({
          status: 'invalid',
          error: errorMsg,
          statusNumber: err?.status,
        });
        setSheetsList([]);
      } finally {
        setIsLoadingSheets(false);
      }
    },
    [spreadsheets, sheetName, onChangeSheetName]
  );

  useEffect(() => {
    validateSpreadsheet(spreadsheetId, credentialId);
  }, [spreadsheetId, credentialId, validateSpreadsheet]);

  // Helper to extract spreadsheet ID from full URL or raw ID
  const handleUrlChange = (val: string) => {
    setCustomUrlInput(val);
    const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      onChangeSpreadsheet(match[1]);
    } else {
      onChangeSpreadsheet(val.trim());
    }
  };

  // Add column manually
  const handleAddCustomColumn = () => {
    const trimmed = customColInput.trim();
    if (!trimmed) return;
    if (!columnsToCreate.includes(trimmed)) {
      setColumnsToCreate((prev) => [...prev, trimmed]);
    }
    setCustomColInput('');
  };

  // Toggle or add suggested upstream column
  const handleToggleSuggestedColumn = (key: string) => {
    if (columnsToCreate.includes(key)) {
      setColumnsToCreate((prev) => prev.filter((c) => c !== key));
    } else {
      setColumnsToCreate((prev) => [...prev, key]);
    }
  };

  // Add all detected columns
  const handleAddAllDetected = () => {
    const allKeys = Array.from(new Set([...columnsToCreate, ...upstreamSuggestions.map((s) => s.key)]));
    setColumnsToCreate(allKeys);
  };

  // Remove column chip
  const handleRemoveColumn = (col: string) => {
    setColumnsToCreate((prev) => prev.filter((c) => c !== col));
  };

  // Create Spreadsheet Handler
  const handleCreateSpreadsheet = async () => {
    if (isCreating) return; // Prevent duplicate creation on rapid clicks
    setValidationError(null);
    setCreateError(null);

    if (!credentialId) {
      setValidationError('Please connect or select a Google account in the step settings above first.');
      return;
    }

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setValidationError('Please enter a spreadsheet name.');
      return;
    }

    setIsCreating(true);

    try {
      const targetSheetName = (newSheetName || 'Sheet1').trim() || 'Sheet1';
      const created = await api.createGoogleSpreadsheet({
        credentialId,
        title: trimmedTitle,
        sheetName: targetSheetName,
        headers: columnsToCreate,
      });

      // 1. Update local spreadsheets state
      setSpreadsheets((prev) => [
        {
          id: created.spreadsheetId,
          name: created.title || trimmedTitle,
          webViewLink: created.spreadsheetUrl,
        },
        ...prev.filter((s) => s.id !== created.spreadsheetId),
      ]);

      // 2. Automatically save returned spreadsheet ID and worksheet tab
      onChangeSpreadsheet(created.spreadsheetId);
      onChangeSheetName(targetSheetName);

      // 3. Set validated state directly
      setValidationState({
        status: 'valid',
        title: created.title || trimmedTitle,
        sheets: created.sheets || [targetSheetName],
        url: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
      });
      setSheetsList(created.sheets || [targetSheetName]);

      // 4. Compute initial values mapping from upstream
      const initialValues: Record<string, string> = {};
      for (const col of columnsToCreate) {
        const match = upstreamSuggestions.find((s) => s.key.toLowerCase() === col.toLowerCase());
        if (match) {
          initialValues[col] = match.expression;
        }
      }

      // 5. Notify parent callback if provided
      if (onCreatedSpreadsheet) {
        onCreatedSpreadsheet({
          spreadsheetId: created.spreadsheetId,
          sheetName: targetSheetName,
          title: created.title || trimmedTitle,
          headers: created.headers || columnsToCreate,
          initialValues,
        });
      }

      // 6. Show success confirmation banner and switch back to Select view with sheet selected
      setCreationSuccessBanner({
        id: created.spreadsheetId,
        title: created.title || trimmedTitle,
        url: created.spreadsheetUrl,
      });
      setNewTitle('');
      setPrimaryMode('select');
      setSelectMethod('picker');
    } catch (err: any) {
      const msg = err?.message || 'Failed to create spreadsheet via Google API.';
      setCreateError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const selectedSpreadsheet = spreadsheets.find((s) => s.id === spreadsheetId);
  const activeTitle = validationState.title || selectedSpreadsheet?.name;
  const canonicalEditUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : '';

  return (
    <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
      {/* Target Google Sheet Header & Primary Mode Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Table className="w-4 h-4 text-[#0F9D58] shrink-0" />
          <span className="text-xs font-semibold text-white truncate">Target Google Sheet</span>
        </div>

        {/* Primary Modes: Select Existing vs Create New */}
        <div className="flex rounded-full bg-[#121212] border border-[#262626] p-0.5 text-[10px] shrink-0">
          <button
            type="button"
            onClick={() => setPrimaryMode('select')}
            className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              primaryMode === 'select'
                ? 'bg-[#0F9D58] text-white font-semibold shadow-sm'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            <FolderOpen className="w-3 h-3" />
            <span>Select Existing</span>
          </button>
          <button
            type="button"
            onClick={handleSwitchToCreate}
            className={`px-3 py-1 rounded-full transition-all flex items-center gap-1.5 ${
              primaryMode === 'create'
                ? 'bg-[#0F9D58] text-white font-semibold shadow-sm'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            <Plus className="w-3 h-3" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Mode 1: Select Existing Spreadsheet */}
      {primaryMode === 'select' ? (
        <div className="space-y-3">
          {/* Sub-toggle: Drive Picker vs Paste URL / ID */}
          <div className="flex items-center justify-between text-[11px] text-[#A3A3A3] pt-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#666666]">
              Spreadsheet Source
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectMethod('picker')}
                className={`text-[11px] transition-colors flex items-center gap-1 cursor-pointer ${
                  selectMethod === 'picker'
                    ? 'text-[#0F9D58] font-semibold underline underline-offset-4 decoration-[#0F9D58]'
                    : 'text-[#777777] hover:text-white'
                }`}
              >
                <span>Google Drive File</span>
              </button>
              <span className="text-[#333333] select-none">|</span>
              <button
                type="button"
                onClick={() => setSelectMethod('url')}
                className={`text-[11px] transition-colors flex items-center gap-1 cursor-pointer ${
                  selectMethod === 'url'
                    ? 'text-[#0F9D58] font-semibold underline underline-offset-4 decoration-[#0F9D58]'
                    : 'text-[#777777] hover:text-white'
                }`}
              >
                <Link2 className="w-3 h-3" />
                <span>Paste URL / ID</span>
              </button>
            </div>
          </div>

          {selectMethod === 'picker' ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-[#A3A3A3] flex items-center justify-between">
                <span>Choose Spreadsheet</span>
                <div className="flex items-center gap-2.5">
                  <a
                    href={canonicalEditUrl || 'https://docs.google.com/spreadsheets'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#0F9D58] hover:underline hover:text-[#2FD07E] flex items-center gap-1 transition-colors font-medium"
                    title="Open Google Sheets in a new tab"
                  >
                    <span>Open Google Sheets</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span className="text-[#333333] select-none">•</span>
                  <button
                    type="button"
                    onClick={() => fetchSpreadsheets()}
                    disabled={isLoadingSpreadsheets || !credentialId}
                    className="text-[10px] text-[#737373] hover:text-[#0F9D58] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
                    title="Refresh spreadsheets list from Google Drive"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${isLoadingSpreadsheets ? 'animate-spin text-[#0F9D58]' : ''}`}
                    />
                    <span>{isLoadingSpreadsheets ? 'Refreshing...' : 'Refresh'}</span>
                  </button>
                </div>
              </div>

              {!credentialId ? (
                <div className="p-3 rounded-[12px] bg-[#141414] border border-[#222222] text-[#888888] text-[11px] space-y-1">
                  <p>Select a connected Google account in the step settings above to view your spreadsheets.</p>
                </div>
              ) : fetchSpreadsheetsError ? (
                <div className="p-2.5 rounded-[12px] bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center justify-between gap-2">
                  <span className="truncate">{fetchSpreadsheetsError}</span>
                  <button
                    type="button"
                    onClick={() => fetchSpreadsheets()}
                    className="underline text-xs text-rose-200 hover:text-white shrink-0"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={spreadsheetId}
                    onChange={(e) => onChangeSpreadsheet(e.target.value)}
                    disabled={isLoadingSpreadsheets}
                    className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-[#0F9D58] pr-8 disabled:opacity-50"
                  >
                    <option value="" disabled>
                      {spreadsheets.length === 0
                        ? '-- No spreadsheets found in Google Drive --'
                        : `-- Select from Google Drive (${spreadsheets.length} available) --`}
                    </option>
                    {/* If selected spreadsheet is not in list (e.g. pasted or newly created), include it */}
                    {spreadsheetId && !spreadsheets.some((s) => s.id === spreadsheetId) && (
                      <option value={spreadsheetId}>
                        {activeTitle ? `${activeTitle} (${spreadsheetId.slice(0, 12)}...)` : spreadsheetId}
                      </option>
                    )}
                    {spreadsheets.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] text-[10px]">
                    ▼
                  </div>
                </div>
              )}

              {credentialId && spreadsheets.length === 0 && !isLoadingSpreadsheets && !fetchSpreadsheetsError && (
                <div className="p-2.5 rounded-[12px] bg-[#141414] border border-[#222222] text-[11px] text-[#888888] flex items-center justify-between">
                  <span>No spreadsheets found in your Google Drive.</span>
                  <button
                    type="button"
                    onClick={handleSwitchToCreate}
                    className="text-[#0F9D58] hover:underline font-semibold ml-2 cursor-pointer"
                  >
                    Create One Here &rarr;
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#A3A3A3]">
                Spreadsheet ID or Google Sheet URL
              </label>
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="Paste https://docs.google.com/spreadsheets/d/... or ID"
                className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0F9D58] placeholder-[#555555]"
              />
            </div>
          )}

          {/* Creation Success Banner */}
          {creationSuccessBanner && (
            <div className="p-2.5 rounded-[12px] bg-[#121E17] border border-[#1B4D32] flex items-center justify-between text-xs animate-in fade-in-0 duration-150">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-[#0F9D58] shrink-0" />
                <span className="text-[#D1F2DE] truncate text-[11px]">
                  Created &amp; selected: <strong>{creationSuccessBanner.title}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCreationSuccessBanner(null)}
                className="text-[#7A7A7A] hover:text-white p-0.5"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SPREADSHEET VALIDATION STATUS CARD */}
          {spreadsheetId && (
            <>
              {/* State A: Validating in Google Sheets */}
              {validationState.status === 'validating' && (
                <div className="flex items-center gap-2.5 p-2.5 rounded-[12px] bg-[#161616] border border-[#2E2E2E] text-xs text-[#A3A3A3] animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 text-[#0F9D58] animate-spin shrink-0" />
                  <span className="text-[11px]">Verifying spreadsheet access in Google Sheets...</span>
                </div>
              )}

              {/* State B: Inaccessible / Deleted / 404 / 403 (NEVER SHOW SUCCESS) */}
              {validationState.status === 'invalid' && (
                <div
                  data-testid="spreadsheet-inaccessible-card"
                  className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-2 animate-in fade-in-0 duration-150"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-rose-200">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Spreadsheet Inaccessible</span>
                    </div>
                    {canonicalEditUrl && (
                      <a
                        href={canonicalEditUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10.5px] text-rose-300/80 hover:text-rose-100 underline flex items-center gap-1 shrink-0"
                      >
                        <span>Open Google link</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">
                    {validationState.error ||
                      'The spreadsheet was not found or your connected Google account does not have permission to access it.'}
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeSpreadsheet('');
                        setCustomUrlInput('');
                        setValidationState({ status: 'idle' });
                      }}
                      className="px-3 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-100 text-[10.5px] font-semibold transition-colors cursor-pointer"
                    >
                      Select Another Spreadsheet
                    </button>
                    <button
                      type="button"
                      onClick={() => validateSpreadsheet(spreadsheetId, credentialId)}
                      className="px-2.5 py-1 rounded-full bg-[#1F1F1F] hover:bg-[#282828] border border-[#333333] text-[#A3A3A3] hover:text-white text-[10.5px] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              )}

              {/* State C: Verified Real Spreadsheet Access */}
              {validationState.status === 'valid' && (
                <div
                  data-testid="spreadsheet-verified-card"
                  className="flex items-center justify-between p-2.5 rounded-[12px] bg-[#121E17] border border-[#1B4D32] text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 className="w-4 h-4 text-[#0F9D58] shrink-0" />
                    <div className="min-w-0 truncate">
                      <div className="font-semibold text-[#D1F2DE] truncate text-[11.5px]">
                        {activeTitle || 'Spreadsheet Connected'}
                      </div>
                      <div className="text-[9.5px] text-[#70A887] font-mono truncate">
                        ID: {spreadsheetId}
                      </div>
                    </div>
                  </div>
                  <a
                    href={canonicalEditUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10.5px] text-[#0F9D58] hover:underline hover:text-[#2FD07E] flex items-center gap-1 shrink-0 ml-2 font-medium"
                  >
                    <span>Open in Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* State D: Credential not selected yet */}
              {!credentialId && validationState.status === 'idle' && (
                <div className="p-2.5 rounded-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate text-[11px]">
                      Connect or select a Google account above to verify this spreadsheet.
                    </span>
                  </div>
                  {canonicalEditUrl && (
                    <a
                      href={canonicalEditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-amber-300 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {/* Worksheet / Tab Selector */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-medium text-[#A3A3A3] flex items-center justify-between">
              <span>Worksheet Tab</span>
              {isLoadingSheets && <RefreshCw className="w-3 h-3 animate-spin text-[#0F9D58]" />}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <select
                  value={sheetName}
                  onChange={(e) => onChangeSheetName(e.target.value)}
                  disabled={isLoadingSheets || validationState.status === 'invalid'}
                  className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-[#0F9D58] pr-8 disabled:opacity-50"
                >
                  {validationState.status === 'invalid' ? (
                    <option value="" disabled>
                      Spreadsheet inaccessible
                    </option>
                  ) : sheetsList.length > 0 ? (
                    sheetsList.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))
                  ) : (
                    <option value="Sheet1">Sheet1</option>
                  )}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] text-[10px]">
                  ▼
                </div>
              </div>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => onChangeSheetName(e.target.value)}
                placeholder="Custom Tab"
                disabled={validationState.status === 'invalid'}
                className="w-28 bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-2.5 py-2 text-xs text-white focus:outline-none focus:border-[#0F9D58] disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: Native Create New Spreadsheet */
        <div className="space-y-3.5 animate-in fade-in-0 duration-150">
          <div className="p-3 rounded-[14px] bg-[#121212] border border-[#222222] space-y-1">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0F9D58]" />
              <span>Native Spreadsheet Creation</span>
            </div>
            <p className="text-[11px] text-[#888888] leading-relaxed">
              Creates a Google Sheet directly in your authenticated Google account and configures Row 1 columns for this workflow.
            </p>
          </div>

          {/* Validation & Error States */}
          {validationError && (
            <div className="p-3 rounded-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {createError && (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] space-y-1">
              <div className="flex items-center gap-2 font-semibold text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Failed to create spreadsheet</span>
              </div>
              <p className="text-[10.5px] text-rose-300/90 pl-6 leading-relaxed">{createError}</p>
            </div>
          )}

          {/* Spreadsheet Name Input (Required) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-white flex items-center justify-between">
              <span>Spreadsheet Name *</span>
              <span className="text-[10px] text-[#737373]">Required</span>
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => {
                setNewTitle(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateSpreadsheet();
                }
              }}
              placeholder="e.g. Lead Submissions 2026"
              disabled={isCreating}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0F9D58] placeholder-[#555555] disabled:opacity-50"
            />
          </div>

          {/* Worksheet Tab Name (Optional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-white flex items-center justify-between">
              <span>Initial Worksheet Tab</span>
              <span className="text-[10px] text-[#737373]">Defaults to Sheet1</span>
            </label>
            <input
              type="text"
              value={newSheetName}
              onChange={(e) => setNewSheetName(e.target.value)}
              placeholder="Sheet1"
              disabled={isCreating}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0F9D58] placeholder-[#555555] disabled:opacity-50"
            />
          </div>

          {/* Column Creation (Row 1 Headers) */}
          <div className="space-y-2 p-3 rounded-[14px] bg-[#121212] border border-[#222222]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Row 1 Column Headers</span>
              {upstreamSuggestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddAllDetected}
                  disabled={isCreating}
                  className="text-[10px] font-semibold text-[#0F9D58] hover:text-[#2FD07E] transition-colors"
                >
                  + Add all detected ({upstreamSuggestions.length})
                </button>
              )}
            </div>

            {/* Auto-detected Upstream Field Pills */}
            {upstreamSuggestions.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-[#737373] block">
                  Click to add/remove detected upstream fields:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {upstreamSuggestions.map((s) => {
                    const isAdded = columnsToCreate.includes(s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => handleToggleSuggestedColumn(s.key)}
                        disabled={isCreating}
                        className={`px-2 py-0.5 rounded-full text-[10px] transition-all flex items-center gap-1 cursor-pointer ${
                          isAdded
                            ? 'bg-[#0F9D58]/20 border border-[#0F9D58]/60 text-[#30D158] font-semibold'
                            : 'bg-[#181818] border border-[#282828] text-[#8E8E8E] hover:text-white'
                        }`}
                      >
                        <span>{isAdded ? '✓' : '+'}</span>
                        <span>{s.key}</span>
                        <span className="text-[8.5px] opacity-60">({s.sourceStepName})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Column Header Input */}
            <div className="flex gap-2 pt-1.5">
              <input
                type="text"
                value={customColInput}
                onChange={(e) => setCustomColInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomColumn();
                  }
                }}
                placeholder="Add custom column (e.g. Notes)"
                disabled={isCreating}
                className="flex-1 bg-[#161616] border border-[#282828] rounded-[10px] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0F9D58] placeholder-[#555555] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleAddCustomColumn}
                disabled={isCreating || !customColInput.trim()}
                className="px-3 py-1.5 rounded-[10px] bg-[#222222] hover:bg-[#2A2A2A] text-white text-xs font-medium border border-[#303030] transition-colors disabled:opacity-40"
              >
                Add Column
              </button>
            </div>

            {/* Active Columns Preview */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-[#8E8E8E] flex items-center justify-between">
                <span>Columns to write into Row 1 ({columnsToCreate.length}):</span>
                {columnsToCreate.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setColumnsToCreate([])}
                    disabled={isCreating}
                    className="text-[10px] text-[#666666] hover:text-rose-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {columnsToCreate.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 rounded-[10px] bg-[#141414] border border-[#1E1E1E]">
                  {columnsToCreate.map((col, idx) => (
                    <span
                      key={`${col}_${idx}`}
                      className="px-2 py-0.5 rounded-full bg-[#1A1A1A] border border-[#2C2C2C] text-[#D1F2DE] text-[10.5px] font-mono flex items-center gap-1.5"
                    >
                      <span>{col}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(col)}
                        disabled={isCreating}
                        className="text-[#737373] hover:text-rose-400 p-0.5 rounded-full transition-colors"
                        title="Remove column"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-[#666666] italic py-1">
                  No columns added yet. Add columns above or leave empty for a blank spreadsheet.
                </p>
              )}
            </div>
          </div>

          {/* Create Spreadsheet Action Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCreateSpreadsheet}
              disabled={isCreating || !newTitle.trim() || !credentialId}
              className="w-full py-2.5 px-4 rounded-full bg-[#0F9D58] hover:bg-[#0D874B] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>Creating spreadsheet via Google API...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Create Spreadsheet</span>
                </>
              )}
            </button>
            {!credentialId && (
              <p className="text-[10px] text-amber-400/90 text-center pt-1.5">
                Select a connected Google account above to enable spreadsheet creation.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
