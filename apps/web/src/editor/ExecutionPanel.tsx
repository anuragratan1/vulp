import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  MinusCircle,
  X,
  Copy,
  Check,
  Terminal,
  FileCode,
  ListOrdered,
  Activity,
  Maximize2,
  Minimize2,
  Play,
  RotateCw,
  Square,
} from 'lucide-react';
import { RunRecord, NodeRunRecord } from '../api/client.js';

export interface ExecutionPanelProps {
  run: RunRecord | null;
  nodeRuns: NodeRunRecord[];
  height: number;
  onHeightChange: (newHeight: number) => void;
  onClose: () => void;
  onReRun?: () => void;
  onRefresh?: () => void;
  onCancel?: () => void;
  isRunning?: boolean;
}

const MIN_PANEL_HEIGHT = 160;
const STORAGE_KEY = 'vulp_execution_panel_height';

export function ExecutionPanel({
  run,
  nodeRuns,
  height,
  onHeightChange,
  onClose,
  onReRun,
  onRefresh,
  onCancel,
  isRunning = false,
}: ExecutionPanelProps) {
  const [selectedNodeRunKey, setSelectedNodeRunKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'output' | 'inputs' | 'logs'>('output');
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaximizeHeightRef = useRef<number>(height);

  const panelRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Automatically select the most recent node run if none is explicitly selected
  const activeNodeRun =
    nodeRuns.find((n) => n.nodeKey === selectedNodeRunKey) ||
    nodeRuns[nodeRuns.length - 1] ||
    null;

  // Auto-switch to logs tab if an error occurred in the active step
  useEffect(() => {
    if (activeNodeRun?.error) {
      setActiveTab('output');
    }
  }, [activeNodeRun?.nodeKey]);

  // Duration calculation
  const durationMs =
    run?.finishedAt && run?.startedAt
      ? run.finishedAt - run.startedAt
      : run?.startedAt
      ? Date.now() - run.startedAt
      : null;

  // Resizing handler
  const handleDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      setIsMaximized(false);

      const startY = e.clientY;
      const startHeight = height;

      // Add overlay styles to body to prevent text selection and keep row-resize cursor
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startY - moveEvent.clientY;
        const parentContainer = panelRef.current?.parentElement;
        const containerHeight = parentContainer?.clientHeight || window.innerHeight;
        const maxAllowed = Math.max(MIN_PANEL_HEIGHT, containerHeight - 100);

        const calculated = Math.round(startHeight + delta);
        const clamped = Math.max(MIN_PANEL_HEIGHT, Math.min(maxAllowed, calculated));

        onHeightChange(clamped);
        try {
          localStorage.setItem(STORAGE_KEY, String(clamped));
        } catch {
          // ignore storage error
        }
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [height, onHeightChange]
  );

  const toggleMaximize = () => {
    const parentContainer = panelRef.current?.parentElement;
    const containerHeight = parentContainer?.clientHeight || window.innerHeight;
    const maxAllowed = Math.max(MIN_PANEL_HEIGHT, containerHeight - 80);

    if (isMaximized) {
      onHeightChange(preMaximizeHeightRef.current || 300);
      setIsMaximized(false);
    } else {
      preMaximizeHeightRef.current = height;
      onHeightChange(maxAllowed);
      setIsMaximized(true);
    }
  };

  const handleCopy = (data: any) => {
    navigator.clipboard.writeText(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Running
          </span>
        );
      case 'succeeded':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-success bg-success/10 border border-success/30 px-2 py-0.5 rounded-full shadow-subtle">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-danger bg-danger/10 border border-danger/30 px-2 py-0.5 rounded-full shadow-subtle">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'skipped':
        return (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted bg-[#222222] border border-[#333333] px-2 py-0.5 rounded-full">
            <MinusCircle className="w-3 h-3" /> Skipped
          </span>
        );
      default:
        return (
          <span className="text-[11px] text-text-muted bg-[#1E1E1E] border border-[#2D2D2D] px-2 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div
      ref={panelRef}
      style={{ height: `${height}px` }}
      className="w-full bg-[#121212] border-t border-[#262626] flex flex-col shrink-0 relative z-10 shadow-2xl overflow-hidden font-sans select-none"
    >
      {/* Draggable Divider (VS Code style horizontal resize handle) */}
      <div
        onMouseDown={handleDividerMouseDown}
        className="absolute -top-1.5 inset-x-0 h-3 cursor-row-resize z-30 group flex items-center justify-center pointer-events-auto"
        title="Drag up or down to resize execution panel"
      >
        <div className="w-16 h-1 rounded-full bg-transparent group-hover:bg-[#FF7306] transition-colors" />
      </div>

      {/* Panel Top Header Bar */}
      <div className="h-10 px-3 bg-[#161616] border-b border-[#242424] flex items-center justify-between shrink-0 select-none">
        {/* Left: Terminal Icon + Title + Run Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary shrink-0">
            <Terminal className="w-3.5 h-3.5 text-[#FF7306]" />
            <span className="hidden xs:inline truncate">Execution Output</span>
          </div>

          {run ? (
            <div className="flex items-center gap-1.5 ml-1 shrink-0">
              <span className="font-mono text-[10px] text-text-muted bg-[#1E1E1E] border border-[#2A2A2A] px-1.5 py-0.5 rounded-[6px]">
                #{run.id.slice(0, 8)}
              </span>
              {getStatusBadge(run.status)}
              {durationMs !== null && (
                <span className="text-[11px] font-mono text-text-muted hidden md:inline">
                  ({(durationMs / 1000).toFixed(2)}s)
                </span>
              )}
            </div>
          ) : isRunning ? (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-warning bg-warning/10 border border-warning/30 px-2 py-0.5 rounded-full animate-pulse shrink-0">
              <Loader2 className="w-3 h-3 animate-spin" /> Queued...
            </span>
          ) : (
            <span className="text-[11px] text-text-muted bg-[#1C1C1C] border border-[#282828] px-2 py-0.5 rounded-[6px] shrink-0">
              Ready
            </span>
          )}
        </div>

        {/* Center / Tab Navigation (when a step is active) */}
        {activeNodeRun && (
          <div className="flex items-center gap-1 bg-[#1A1A1A] border border-[#282828] p-0.5 rounded-[8px] text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab('output')}
              className={`px-2.5 py-0.5 rounded-[6px] transition-colors flex items-center gap-1.5 font-medium ${
                activeTab === 'output'
                  ? 'bg-[#262626] text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <FileCode className="w-3 h-3 text-[#FF7306]" />
              <span>Result</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inputs')}
              className={`px-2.5 py-0.5 rounded-[6px] transition-colors flex items-center gap-1.5 font-medium ${
                activeTab === 'inputs'
                  ? 'bg-[#262626] text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>Inputs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-2.5 py-0.5 rounded-[6px] transition-colors flex items-center gap-1.5 font-medium ${
                activeTab === 'logs'
                  ? 'bg-[#262626] text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Terminal className="w-3 h-3 text-warning" />
              <span>Logs ({activeNodeRun.logs?.length || 0})</span>
            </button>
          </div>
        )}

        {/* Right Action Icons: Cancel, Re-Run, Maximize, Close */}
        <div className="flex items-center gap-1.5">
          {(isRunning || run?.status === 'running') && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-medium text-danger bg-danger/10 hover:bg-danger/20 border border-danger/30 transition-colors"
              title="Cancel running workflow execution"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Cancel</span>
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRunning}
              className="p-1 rounded-[6px] text-text-muted hover:text-text-primary hover:bg-[#222222] transition-colors disabled:opacity-40"
              title="Refresh logs & step outputs"
              aria-label="Refresh logs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onReRun && (
            <button
              type="button"
              onClick={onReRun}
              disabled={isRunning || run?.status === 'running'}
              className="p-1 rounded-[6px] text-text-muted hover:text-text-primary hover:bg-[#222222] transition-colors disabled:opacity-40"
              title="Re-run workflow"
              aria-label="Re-run workflow"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={toggleMaximize}
            className="p-1 rounded-[6px] text-text-muted hover:text-text-primary hover:bg-[#222222] transition-colors"
            title={isMaximized ? 'Restore Panel Height' : 'Maximize Panel'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-[6px] text-text-muted hover:text-text-primary hover:bg-[#262626] transition-colors"
            title="Close execution panel (⌥T)"
            aria-label="Close execution panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Panel Content Area (Split into Steps on Left, Result Inspector on Right) */}
      <div className="flex-1 flex overflow-hidden min-h-0 text-xs">
        {/* Left: Step Sequence Column */}
        <div className="w-[240px] md:w-[260px] lg:w-[280px] bg-[#141414] border-r border-[#242424] flex flex-col shrink-0 overflow-hidden">
          <div className="px-3.5 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider flex items-center justify-between border-b border-[#1E1E1E]">
            <span className="flex items-center gap-1.5">
              <ListOrdered className="w-3 h-3 text-[#FF7306]" />
              Steps ({nodeRuns.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {nodeRuns.map((nr) => {
              const isSelected = activeNodeRun?.nodeKey === nr.nodeKey;
              return (
                <button
                  key={nr.id || nr.nodeKey}
                  type="button"
                  onClick={() => setSelectedNodeRunKey(nr.nodeKey)}
                  className={`w-full text-left flex items-center justify-between p-2.5 rounded-[12px] transition-all border ${
                    isSelected
                      ? 'bg-[#202020] border-[#383838] text-text-primary font-medium shadow-sm'
                      : 'hover:bg-[#1A1A1A] border-transparent text-text-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden min-w-0 pr-1">
                    <span className="w-4 h-4 rounded-full bg-[#181818] border border-[#2B2B2B] flex items-center justify-center font-mono text-[9px] text-text-muted shrink-0">
                      {nr.seq}
                    </span>
                    <span className="truncate leading-tight text-xs font-sans">
                      {nr.nodeName || nr.nodeKey}
                    </span>
                  </div>
                  <div className="shrink-0">{getStatusBadge(nr.status)}</div>
                </button>
              );
            })}

            {nodeRuns.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-text-muted space-y-2">
                <div className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-[#282828] flex items-center justify-center text-text-muted">
                  <Play className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-text-secondary text-xs">No Steps Executed</p>
                  <p className="text-[11px] leading-relaxed max-w-[200px]">
                    Click Run in the toolbar to execute this automation.
                  </p>
                </div>
                {onRefresh && (
                  <button
                    type="button"
                    onClick={onRefresh}
                    className="mt-2 px-3 py-1 text-xs rounded-[6px] bg-[#222222] hover:bg-[#2A2A2A] text-text-primary border border-[#333333] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Load Latest Logs</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Step Result Detail Inspector */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#101010]">
          {activeNodeRun ? (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Step Sub-Header */}
              <div className="px-4 py-2 border-b border-[#202020] flex items-center justify-between bg-[#151515] shrink-0">
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span className="font-bold text-text-primary text-xs truncate">
                    {activeNodeRun.nodeName}
                  </span>
                  <span className="font-mono text-[10px] text-text-muted shrink-0">
                    ({activeNodeRun.nodeType})
                  </span>
                  {getStatusBadge(activeNodeRun.status)}
                  <span className="text-[10px] text-text-muted hidden sm:inline">
                    • {activeNodeRun.attempts} attempt{activeNodeRun.attempts === 1 ? '' : 's'}
                  </span>
                </div>

                {activeTab === 'output' && activeNodeRun.output !== undefined && (
                  <button
                    type="button"
                    onClick={() => handleCopy(activeNodeRun.output)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#1F1F1F] hover:bg-[#282828] border border-[#303030] text-text-secondary hover:text-text-primary transition-colors text-[11px] font-medium"
                    title="Copy output JSON"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-success" />
                        <span className="text-success">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Step Content Panes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 select-text">
                {/* Error Callout */}
                {activeNodeRun.error && (
                  <div className="p-3.5 rounded-[14px] bg-danger/10 border border-danger/30 text-danger space-y-1">
                    <span className="font-semibold flex items-center gap-1.5 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" /> Execution Error
                    </span>
                    <pre className="font-mono text-[11px] whitespace-pre-wrap leading-relaxed pl-5">
                      {activeNodeRun.error}
                    </pre>
                  </div>
                )}

                {/* Tab: Output Data */}
                {activeTab === 'output' && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-text-secondary flex items-center gap-1.5 text-xs font-sans">
                      <FileCode className="w-3.5 h-3.5 text-[#FF7306]" /> Output Payload
                    </span>
                    <pre className="p-3.5 rounded-[12px] bg-[#141414] border border-[#242424] font-mono text-[11px] text-[#EDEDED] overflow-x-auto leading-relaxed max-h-72 shadow-inner">
                      {activeNodeRun.output !== null && activeNodeRun.output !== undefined
                        ? JSON.stringify(activeNodeRun.output, null, 2)
                        : '(No output returned)'}
                    </pre>
                  </div>
                )}

                {/* Tab: Resolved Inputs */}
                {activeTab === 'inputs' && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-text-secondary flex items-center gap-1.5 text-xs font-sans">
                      <Activity className="w-3.5 h-3.5 text-cyan-400" /> Resolved Input Parameters
                    </span>
                    <pre className="p-3.5 rounded-[12px] bg-[#141414] border border-[#242424] font-mono text-[11px] text-text-secondary overflow-x-auto leading-relaxed max-h-72 shadow-inner">
                      {activeNodeRun.paramsResolved !== null && activeNodeRun.paramsResolved !== undefined
                        ? JSON.stringify(activeNodeRun.paramsResolved, null, 2)
                        : '(No input parameters captured)'}
                    </pre>
                  </div>
                )}

                {/* Tab: Activity Logs */}
                {activeTab === 'logs' && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-text-secondary flex items-center gap-1.5 text-xs font-sans">
                      <Terminal className="w-3.5 h-3.5 text-warning" /> Activity Log Stream
                    </span>
                    {activeNodeRun.logs && activeNodeRun.logs.length > 0 ? (
                      <div className="p-3 rounded-[12px] bg-[#141414] border border-[#242424] font-mono text-[11px] space-y-1 text-text-secondary max-h-72 overflow-y-auto shadow-inner">
                        {activeNodeRun.logs.map((log, idx) => {
                          const isWarn = log.includes('[WARN]');
                          const isError = log.includes('[ERROR]');
                          const isInfo = log.includes('[INFO]');
                          return (
                            <div
                              key={idx}
                              className={`leading-relaxed ${
                                isError
                                  ? 'text-danger font-medium'
                                  : isWarn
                                  ? 'text-warning'
                                  : isInfo
                                  ? 'text-text-primary'
                                  : 'text-text-muted'
                              }`}
                            >
                              {log}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 rounded-[12px] bg-[#141414] border border-[#242424] text-text-muted font-mono text-[11px]">
                        No logs recorded for this step.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-text-muted space-y-2">
              <Activity className="w-6 h-6 text-text-muted opacity-40 mx-auto" />
              <p className="text-xs text-text-secondary font-medium">No Step Selected</p>
              <p className="text-[11px] max-w-xs leading-relaxed">
                Select a step on the left progress list to inspect its output payloads, input parameters, and console logs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export as ExecutionDrawer for backward compatibility
export const ExecutionDrawer = ExecutionPanel;
