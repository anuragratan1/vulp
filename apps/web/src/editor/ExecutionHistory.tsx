import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowLeft,
  Calendar,
  Layers,
  Activity,
  RotateCw,
} from 'lucide-react';
import { api, RunRecord, NodeRunRecord } from '../api/client.js';

interface ExecutionHistoryProps {
  onSelectRun: (runId: string) => void;
  onBack: () => void;
}

export function ExecutionHistory({ onSelectRun, onBack }: ExecutionHistoryProps) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunDetails, setSelectedRunDetails] = useState<{
    run: RunRecord;
    nodeRuns: NodeRunRecord[];
  } | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const list = await api.getRuns();
      setRuns(list);
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectRun = async (id: string) => {
    setSelectedRunId(id);
    try {
      const details = await api.getRunDetails(id);
      setSelectedRunDetails(details);
    } catch (err) {
      console.error('Failed to load run details:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-warning bg-warning/10 border border-warning/30 px-2.5 py-0.5 rounded-full animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Running
          </span>
        );
      case 'succeeded':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-success bg-success/10 border border-success/30 px-2.5 py-0.5 rounded-full shadow-subtle">
            <CheckCircle2 className="w-3 h-3" /> Done
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-danger bg-danger/10 border border-danger/30 px-2.5 py-0.5 rounded-full shadow-subtle">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      default:
        return (
          <span className="text-xs text-text-muted bg-surface-secondary border border-border px-2.5 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden text-xs select-none">
      {/* Top Header */}
      <header className="h-16 px-6 bg-surface-secondary border-b border-border flex items-center justify-between shrink-0 shadow-subtle">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full bg-surface hover:bg-surface-elevated border border-border text-text-muted hover:text-text-primary transition-all shadow-subtle"
            title="Return to canvas"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Past Runs & Activity</h2>
            <p className="text-[11px] text-text-muted font-sans">
              Execution timeline and step outcomes
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadRuns}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-secondary hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary text-xs font-medium transition-all shadow-subtle"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left List of Runs */}
        <div className="w-96 border-r border-border overflow-y-auto p-4 space-y-2.5 bg-surface-secondary/40">
          {loading ? (
            <div className="py-16 text-center text-text-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-accent" />
              <span>Loading past executions...</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="py-16 text-center text-text-muted space-y-2 font-sans">
              <Clock className="w-8 h-8 mx-auto opacity-40 text-text-muted" />
              <p className="font-medium text-text-secondary">No runs recorded yet</p>
              <p className="text-[11px]">Click Test Run in the studio to test your automation.</p>
            </div>
          ) : (
            runs.map((r) => {
              const isSelected = selectedRunId === r.id;
              const duration =
                r.finishedAt && r.startedAt
                  ? ((r.finishedAt - r.startedAt) / 1000).toFixed(2) + 's'
                  : null;

              return (
                <div
                  key={r.id}
                  onClick={() => handleInspectRun(r.id)}
                  className={`p-4 rounded-[18px] border cursor-pointer transition-all duration-150 select-none ${
                    isSelected
                      ? 'bg-surface-elevated border-border text-text-primary shadow-subtle ring-1 ring-border -translate-y-0.5'
                      : 'bg-surface hover:bg-surface-elevated/70 border-border text-text-secondary'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-bold text-text-primary truncate text-xs">
                      {r.workflowName || 'Automation Run'}
                    </span>
                    {getStatusBadge(r.status)}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-text-muted font-sans">
                    <span className="font-mono">{r.id.slice(0, 12)}...</span>
                    {duration && <span className="font-mono text-text-secondary">{duration}</span>}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted font-sans">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(r.queuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="capitalize">{r.triggerType.replace('.', ' ')}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail Pane */}
        <div className="flex-1 bg-surface-elevated p-8 overflow-y-auto">
          {selectedRunDetails ? (
            <div className="space-y-6 max-w-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <h3 className="text-base font-bold text-text-primary">
                      {selectedRunDetails.run.workflowName}
                    </h3>
                    {getStatusBadge(selectedRunDetails.run.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-sans text-text-muted">
                    <span>
                      Run ID: <strong className="font-mono text-text-secondary">{selectedRunDetails.run.id}</strong>
                    </span>
                    <span>
                      Trigger: <strong className="text-text-secondary capitalize">{selectedRunDetails.run.triggerType.replace('.', ' ')}</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectRun(selectedRunDetails.run.id)}
                  className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-white font-bold text-xs shadow-glow-accent transition-all"
                >
                  Load Snapshot on Canvas
                </button>
              </div>

              {selectedRunDetails.run.error && (
                <div className="p-4 rounded-[18px] bg-danger/10 border border-danger/30 text-danger space-y-1">
                  <span className="font-semibold text-xs flex items-center gap-1.5 font-sans">
                    <AlertCircle className="w-4 h-4" /> Run Execution Error
                  </span>
                  <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {selectedRunDetails.run.error}
                  </pre>
                </div>
              )}

              {/* Executed Steps Sequence */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5 font-sans">
                  <Layers className="w-3.5 h-3.5 text-accent" />
                  Executed Steps ({selectedRunDetails.nodeRuns.length})
                </h4>

                <div className="space-y-2.5">
                  {selectedRunDetails.nodeRuns.map((nr) => (
                    <div
                      key={nr.id}
                      className="p-4 rounded-[18px] bg-surface-secondary border border-border space-y-3 shadow-subtle"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-surface border border-border flex items-center justify-center font-mono font-semibold text-text-muted text-[10px]">
                            #{nr.seq}
                          </span>
                          <div>
                            <span className="font-bold text-text-primary text-xs block leading-snug">
                              {nr.nodeName}
                            </span>
                            <span className="text-[11px] text-text-muted font-sans">
                              {nr.nodeType} ({nr.nodeKey})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-text-muted font-sans">
                            {nr.attempts} attempt{nr.attempts === 1 ? '' : 's'}
                          </span>
                          {getStatusBadge(nr.status)}
                        </div>
                      </div>

                      {nr.error && (
                        <div className="p-3 rounded-[14px] bg-danger/10 border border-danger/30 text-danger text-[11px] font-mono leading-relaxed">
                          {nr.error}
                        </div>
                      )}

                      {nr.output && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-semibold text-text-muted font-sans">
                            Step Result
                          </span>
                          <pre className="p-3 rounded-[14px] bg-surface border border-border font-mono text-[11px] text-text-primary overflow-x-auto max-h-40 leading-relaxed shadow-subtle">
                            {JSON.stringify(nr.output, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-text-muted space-y-2 font-sans">
              <Activity className="w-8 h-8 mx-auto opacity-30 text-text-muted" />
              <p className="font-medium text-text-secondary">Select a run on the left</p>
              <p className="text-[11px]">Inspect complete step-by-step inputs, logs, and outputs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
