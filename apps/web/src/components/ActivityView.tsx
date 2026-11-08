import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  RotateCw,
  AlertCircle,
  Clock,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { api, RunRecord, NodeRunRecord, WorkflowRecord } from '../api/client.js';
import { ServiceIcon } from './ServiceIcons.js';

interface ActivityViewProps {
  onOpenWorkflow: (workflowId: string) => void;
  onBackToOverview?: () => void;
  initialRunId?: string | null;
}

type StatusFilter = 'all' | 'succeeded' | 'failed' | 'running';

export function ActivityView({
  onOpenWorkflow,
  initialRunId,
}: ActivityViewProps) {
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cachedRuns = api.getCachedRuns();
  const cachedWfs = api.getCachedWorkflows();
  const hasCache = cachedRuns !== null;

  const [runs, setRuns] = useState<RunRecord[]>(() => cachedRuns || []);
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => cachedWfs || []);
  const [loading, setLoading] = useState(!hasCache);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialRunId || (cachedRuns && cachedRuns.length > 0 ? cachedRuns[0].id : null)
  );
  const [selectedRunDetails, setSelectedRunDetails] = useState<{
    run: RunRecord;
    nodeRuns: NodeRunRecord[];
  } | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'steps' | 'debug'>('overview');
  const [expandedNodeKey, setExpandedNodeKey] = useState<string | null>(null);

  const handleInspectRun = useCallback(async (runId: string) => {
    setSelectedRunId(runId);
    try {
      setLoadingDetails(true);
      const details = await api.getRunDetails(runId);
      if (isMountedRef.current) {
        setSelectedRunDetails(details);
      }
    } catch (err) {
      console.error('Failed to load run details:', err);
    } finally {
      if (isMountedRef.current) {
        setLoadingDetails(false);
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      if (!api.getCachedRuns()) setLoading(true);
      const [runList, wfList] = await Promise.all([
        api.getRuns(),
        api.getWorkflows().catch(() => []),
      ]);
      if (!isMountedRef.current) return;
      setRuns(runList);
      setWorkflows(wfList);

      // Auto-select initial or first run
      const targetId = initialRunId || (runList.length > 0 ? runList[0].id : null);
      if (targetId && isMountedRef.current) {
        handleInspectRun(targetId);
      }
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [initialRunId, handleInspectRun]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRetryRun = async () => {
    if (!selectedRunDetails) return;
    const { run } = selectedRunDetails;
    try {
      setRetrying(true);
      const res = await api.runWorkflow(run.workflowId, {
        triggerPayload: run.triggerPayload,
      });
      await loadData();
      handleInspectRun(res.runId);
    } catch (err: any) {
      alert(`Retry failed: ${err.message}`);
    } finally {
      setRetrying(false);
    }
  };

  const formatTimestamp = (ts?: number | null) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (start?: number | null, end?: number | null) => {
    if (!start || !end) return '-';
    const diff = end - start;
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
  };

  // Humanize errors
  const humanizeError = (errorStr?: string | null, _failedNode?: NodeRunRecord) => {
    if (!errorStr) return null;

    let explanation = errorStr;
    let suggestion = 'Check your node configuration parameters and ensure all required values are provided.';

    if (errorStr.includes('missing required parameter') || errorStr.includes('missing required')) {
      const match = errorStr.match(/'([^']+)'/);
      const paramName = match ? match[1] : 'required field';
      explanation = `The step failed because parameter "${paramName}" is missing or empty.`;
      suggestion = `Open the automation in the editor and provide a valid value or dynamic tag for "${paramName}".`;
    } else if (errorStr.includes('Failed to fetch') || errorStr.includes('ENOTFOUND')) {
      explanation = 'Could not establish connection to the remote endpoint or server.';
      suggestion = 'Verify the target URL and ensure the remote API server is online and reachable.';
    } else if (errorStr.includes('Invalid credentials') || errorStr.includes('401') || errorStr.includes('expired')) {
      explanation = 'The external service rejected the request due to invalid or expired credentials.';
      suggestion = 'Go to Connections and reconnect your account or update the API token.';
    } else if (errorStr.includes('Graph validation failed')) {
      explanation = 'The automation graph contains incomplete or misconfigured connections.';
      suggestion = 'Open the workflow editor to review and fix red connection badges.';
    }

    return { explanation, suggestion };
  };

  const filteredRuns = runs.filter((r) => {
    const matchesSearch =
      r.workflowName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (selectedWorkflowId !== 'all' && r.workflowId !== selectedWorkflowId) return false;

    return true;
  });

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Top Header */}
      <div className="px-8 py-5 border-b border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Activity</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
              {runs.length} runs recorded
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            Real-time execution log, step outcomes, and diagnostic debugging
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-all self-start md:self-auto"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-8 py-3.5 border-b border-border bg-surface-secondary flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-full border border-border">
            {(
              [
                { id: 'all', label: 'All Activity' },
                { id: 'succeeded', label: 'Successful' },
                { id: 'failed', label: 'Failed' },
                { id: 'running', label: 'Running' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 ${
                  statusFilter === tab.id
                    ? 'bg-surface-elevated text-text-primary font-semibold'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Workflow Selector */}
          <select
            value={selectedWorkflowId}
            onChange={(e) => setSelectedWorkflowId(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-surface border border-border text-xs text-text-primary focus:outline-none"
          >
            <option value="all">All Automations</option>
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>
                {wf.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search run ID or name..."
            className="pl-9 pr-3.5 py-1.5 rounded-full bg-input-bg border border-input-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover w-56"
          />
        </div>
      </div>

      {/* Main Split Layout: Left List, Right Inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List of Runs */}
        <div className="w-full md:w-96 border-r border-border bg-surface-secondary overflow-y-auto p-4 space-y-2 shrink-0">
          {loading ? (
            <div className="py-20 text-center text-xs text-text-muted">
              Loading execution history...
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-text-muted font-sans">
              <Clock className="w-8 h-8 mx-auto opacity-40 text-text-muted" />
              <p className="font-semibold text-text-primary text-xs">No activity found</p>
              <p className="text-[11px]">No executions match your active filter.</p>
            </div>
          ) : (
            filteredRuns.map((r) => {
              const isSelected = selectedRunId === r.id;
              const duration = formatDuration(r.startedAt, r.finishedAt);

              return (
                <div
                  key={r.id}
                  onClick={() => handleInspectRun(r.id)}
                  className={`p-4 rounded-[20px] border cursor-pointer transition-all duration-150 select-none ${
                    isSelected
                      ? 'bg-surface-elevated border-border shadow-md ring-1 ring-accent/30'
                      : 'bg-surface hover:bg-surface-hover border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-bold text-text-primary text-xs truncate">
                      {r.workflowName || 'Automation Run'}
                    </span>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
                        r.status === 'succeeded'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : r.status === 'failed'
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-muted font-sans">
                    <span className="font-mono">{r.id.slice(0, 10)}...</span>
                    <span>{duration}</span>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-muted font-sans">
                    <span>{r.triggerType.replace('.trigger', '')}</span>
                    <span>{formatTimestamp(r.queuedAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Details Inspector */}
        <div className="flex-1 bg-background overflow-y-auto p-6 md:p-8">
          {loadingDetails ? (
            <div className="h-full flex items-center justify-center text-xs text-text-muted">
              Loading execution details...
            </div>
          ) : !selectedRunDetails ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-text-muted space-y-2">
              <Play className="w-8 h-8 opacity-40 text-text-muted" />
              <p className="text-xs font-semibold text-text-primary">Select an execution to inspect</p>
              <p className="text-[11px] max-w-xs">
                Review step inputs, outputs, error diagnostics, and duration breakdowns.
              </p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
              {/* Header Bar */}
              <div className="p-6 rounded-[24px] bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-text-primary tracking-tight">
                      {selectedRunDetails.run.workflowName}
                    </h2>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider font-mono ${
                        selectedRunDetails.run.status === 'succeeded'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : selectedRunDetails.run.status === 'failed'
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                          : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      }`}
                    >
                      {selectedRunDetails.run.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted font-sans">
                    <span>Run ID: <code className="font-mono text-text-secondary">{selectedRunDetails.run.id}</code></span>
                    <span>•</span>
                    <span>{formatTimestamp(selectedRunDetails.run.queuedAt)}</span>
                  </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={retrying}
                    onClick={handleRetryRun}
                    className="px-4 py-2 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-all flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                    <span>{retrying ? 'Retrying...' : 'Re-run'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenWorkflow(selectedRunDetails.run.workflowId)}
                    className="px-4 py-2 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Canvas</span>
                  </button>
                </div>
              </div>

              {/* Execution Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 rounded-[18px] bg-surface border border-border">
                  <div className="text-[11px] text-text-muted">Total Duration</div>
                  <div className="text-base font-bold text-text-primary mt-1">
                    {formatDuration(selectedRunDetails.run.startedAt, selectedRunDetails.run.finishedAt)}
                  </div>
                </div>

                <div className="p-4 rounded-[18px] bg-surface border border-border">
                  <div className="text-[11px] text-text-muted">Trigger Source</div>
                  <div className="text-base font-bold text-text-primary mt-1 capitalize">
                    {selectedRunDetails.run.triggerType.replace('.trigger', '')}
                  </div>
                </div>

                <div className="p-4 rounded-[18px] bg-surface border border-border">
                  <div className="text-[11px] text-text-muted">Steps Executed</div>
                  <div className="text-base font-bold text-text-primary mt-1">
                    {selectedRunDetails.nodeRuns.length}
                  </div>
                </div>

                <div className="p-4 rounded-[18px] bg-surface border border-border">
                  <div className="text-[11px] text-text-muted">Execution Mode</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">
                    Autonomous
                  </div>
                </div>
              </div>

              {/* Humanized Error Presentation (If failed) */}
              {selectedRunDetails.run.error && (() => {
                const failedNode = selectedRunDetails.nodeRuns.find((n) => n.status === 'failed');
                const humanError = humanizeError(selectedRunDetails.run.error, failedNode);

                return (
                  <div className="p-6 rounded-[22px] bg-rose-500/5 border border-rose-500/20 space-y-4">
                    <div className="flex items-center gap-2.5 text-rose-400 font-bold text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <span>Execution Troubleshooting Assistant</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <div className="font-semibold text-rose-300">What happened?</div>
                        <p className="text-text-secondary leading-relaxed">
                          {humanError?.explanation}
                        </p>
                        {failedNode && (
                          <div className="mt-2 text-[11px] text-rose-400">
                            Failed in step: <span className="font-semibold">{failedNode.nodeName}</span> ({failedNode.nodeType})
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        <div className="font-semibold text-emerald-300">Suggested resolution</div>
                        <p className="text-text-secondary leading-relaxed">
                          {humanError?.suggestion}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Step Sequence Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                    Step-by-step Run Log
                  </h3>
                  <span className="text-[11px] text-text-muted font-sans">
                    Click step to inspect inputs & outputs
                  </span>
                </div>

                <div className="space-y-2.5">
                  {selectedRunDetails.nodeRuns.map((nodeRun) => {
                    const isExpanded = expandedNodeKey === nodeRun.nodeKey;
                    const duration = formatDuration(nodeRun.startedAt, nodeRun.finishedAt);

                    return (
                      <div
                        key={nodeRun.id}
                        className="rounded-[18px] bg-surface border border-border overflow-hidden transition-all"
                      >
                        <div
                          onClick={() => setExpandedNodeKey(isExpanded ? null : nodeRun.nodeKey)}
                          className="p-4 flex items-center justify-between gap-3 hover:bg-surface-hover cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-primary">
                              <ServiceIcon service={nodeRun.nodeType} size={15} />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                                <span>{nodeRun.nodeName}</span>
                                <span className="text-[10px] font-mono text-text-muted uppercase">
                                  {nodeRun.nodeType}
                                </span>
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                Step #{nodeRun.seq} • Duration: {duration}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${
                                nodeRun.status === 'succeeded'
                                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                  : nodeRun.status === 'failed'
                                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                                  : 'text-text-muted bg-surface-secondary border-border'
                              }`}
                            >
                              {nodeRun.status}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-text-muted" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-text-muted" />
                            )}
                          </div>
                        </div>

                        {/* Collapsible Step Inputs & Outputs */}
                        {isExpanded && (
                          <div className="p-4 bg-surface-secondary border-t border-border-subtle space-y-3 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Inputs */}
                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-text-muted font-mono">
                                  Resolved Parameters (Inputs)
                                </div>
                                <pre className="p-3 rounded-xl bg-surface border border-border font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                                  {JSON.stringify(nodeRun.paramsResolved, null, 2)}
                                </pre>
                              </div>

                              {/* Outputs */}
                              <div className="space-y-1">
                                <div className="text-[11px] font-semibold text-text-muted font-mono">
                                  Step Outputs (Results)
                                </div>
                                <pre className="p-3 rounded-xl bg-surface border border-border font-mono text-[11px] text-amber-400 overflow-x-auto max-h-48">
                                  {JSON.stringify(nodeRun.output, null, 2)}
                                </pre>
                              </div>
                            </div>

                            {nodeRun.error && (
                              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-[11px]">
                                {nodeRun.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Advanced / Debug Details */}
              <div className="p-4 rounded-[18px] bg-surface border border-border space-y-2">
                <div
                  onClick={() => setActiveTab(activeTab === 'debug' ? 'overview' : 'debug')}
                  className="flex items-center justify-between cursor-pointer text-xs font-semibold text-text-muted hover:text-text-primary transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    <span>Raw Technical Snapshot &amp; Debug Logs</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${activeTab === 'debug' ? 'rotate-180' : ''}`}
                  />
                </div>

                {activeTab === 'debug' && (
                  <div className="pt-3 border-t border-border-subtle space-y-2">
                    <pre className="p-4 rounded-xl bg-surface-secondary border border-border font-mono text-[11px] text-text-muted overflow-x-auto max-h-60 leading-relaxed">
                      {JSON.stringify(
                        {
                          run: selectedRunDetails.run,
                          nodeCount: selectedRunDetails.nodeRuns.length,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
