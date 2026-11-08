import { useState, useEffect } from 'react';
import {
  Workflow as WorkflowIcon,
  Play,
  Layers,
  LayoutTemplate,
  Compass,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  ShieldAlert,
  Radio,
  ExternalLink,
} from 'lucide-react';
import {
  api,
  WorkflowRecord,
  RunRecord,
  ConnectionRecord,
} from '../api/client.js';

interface OverviewViewProps {
  onCreateAutomation: () => void;
  onOpenAutomation: (id: string) => void;
  onNavigate: (view: 'automations' | 'templates' | 'activity' | 'connections' | 'settings' | 'account') => void;
  onInspectRun?: (runId: string) => void;
}

export function OverviewView({
  onCreateAutomation,
  onOpenAutomation,
  onNavigate,
  onInspectRun,
}: OverviewViewProps) {
  const cachedWfs = api.getCachedWorkflows();
  const cachedRuns = api.getCachedRuns();
  const cachedConns = api.getCachedConnections();
  const hasCache = cachedWfs !== null;

  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => cachedWfs || []);
  const [runs, setRuns] = useState<RunRecord[]>(() => cachedRuns || []);
  const [connections, setConnections] = useState<ConnectionRecord[]>(() => cachedConns || []);
  const [loading, setLoading] = useState(!hasCache);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [wfList, runList, connList] = await Promise.all([
          api.getWorkflows(),
          api.getRuns().catch(() => []),
          api.getConnections().catch(() => []),
        ]);
        if (!active) return;
        setWorkflows(wfList);
        setRuns(runList);
        setConnections(connList);
      } catch (err) {
        console.error('Failed to load overview data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Compute metrics from real data
  const totalAutomations = workflows.length;
  const activeAutomations = workflows.filter((w) => w.active).length;
  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === 'succeeded').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;

  // Identify automations requiring attention (latest run failed)
  const failedWorkflowIds = new Set<string>();
  const latestRunByWorkflow = new Map<string, RunRecord>();

  runs.forEach((r) => {
    if (!latestRunByWorkflow.has(r.workflowId)) {
      latestRunByWorkflow.set(r.workflowId, r);
      if (r.status === 'failed') {
        failedWorkflowIds.add(r.workflowId);
      }
    }
  });

  const automationsRequiringAttention = workflows.filter((w) =>
    failedWorkflowIds.has(w.id)
  );

  // Expired / disconnected connections
  const expiredConnections = connections.filter((c) => c.status === 'expired');

  // Format relative time helper
  const formatTimeAgo = (ts?: number | null) => {
    if (!ts) return 'Never';
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const formatDuration = (start?: number | null, end?: number | null) => {
    if (!start || !end) return '-';
    const diff = end - start;
    if (diff < 1000) return `${diff}ms`;
    return `${(diff / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-8 text-center font-sans">
        <div className="w-10 h-10 rounded-full border-2 border-border border-t-[#FF7306] animate-spin mb-4" />
        <p className="text-xs text-text-muted">Loading workspace overview...</p>
      </div>
    );
  }

  // First-time empty state when no automations exist yet
  if (totalAutomations === 0) {
    return (
      <div className="flex-1 bg-background p-8 md:p-12 overflow-y-auto font-sans flex flex-col justify-center">
        <div className="max-w-3xl mx-auto w-full space-y-8 animate-fadeIn">
          {/* Welcome Header */}
          <div className="space-y-3 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-border text-xs text-[#FF7306] font-medium">
              <Compass className="w-3.5 h-3.5" />
              <span>Welcome to Vulp Studio</span>
            </div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              Let's build your first automation
            </h1>
            <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
              Vulp connects your apps, webhooks, and Google Workspace into resilient, autonomous multi-step workflows. Choose how you want to get started:
            </p>
          </div>

          {/* 3 Prominent Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
            <div
              onClick={onCreateAutomation}
              className="p-6 rounded-[22px] bg-surface hover:bg-surface-elevated border border-border hover:border-[#FF7306]/50 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FF7306]/10 border border-[#FF7306]/20 flex items-center justify-center text-[#FF7306] group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">Start from Scratch</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Open a blank canvas with a default Manual Trigger ready to test and connect.
                </p>
              </div>
              <div className="pt-6 flex items-center gap-2 text-xs font-semibold text-[#FF7306]">
                <span>Blank Canvas</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div
              onClick={() => onNavigate('templates')}
              className="p-6 rounded-[22px] bg-surface hover:bg-surface-elevated border border-border hover:border-border-hover transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-text-primary group-hover:scale-105 transition-transform">
                  <LayoutTemplate className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">Start with a Template</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Use tested recipes for lead capture, Google Sheets logging, and instant notifications.
                </p>
              </div>
              <div className="pt-6 flex items-center gap-2 text-xs font-semibold text-text-primary">
                <span>Browse Recipes</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <div
              onClick={() => onNavigate('connections')}
              className="p-6 rounded-[22px] bg-surface hover:bg-surface-elevated border border-border hover:border-border-hover transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center text-text-primary group-hover:scale-105 transition-transform">
                  <Layers className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">Connect an Application</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Authorize Google, Slack, Telegram, or add API keys securely with AES-256-GCM encryption.
                </p>
              </div>
              <div className="pt-6 flex items-center gap-2 text-xs font-semibold text-text-primary">
                <span>Manage Accounts</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Top Header */}
      <div className="px-8 py-6 border-b border-border bg-surface-secondary flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Overview</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
              {totalAutomations} total
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Workspace summary, system health, and recent automation activity
          </p>
        </div>

        {/* Quick Actions Header Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('templates')}
            className="px-4 py-2 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-all flex items-center gap-2"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
            <span>Browse Templates</span>
          </button>
          <button
            type="button"
            onClick={onCreateAutomation}
            className="px-4 py-2 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-semibold transition-all shadow-sm flex items-center gap-2 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Automation</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn">

        {/* 1. Summary Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-5 rounded-[20px] bg-surface border border-border space-y-2">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>Total Automations</span>
              <WorkflowIcon className="w-4 h-4 text-text-muted" />
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">{totalAutomations}</div>
            <div className="text-[11px] text-text-muted">In workspace</div>
          </div>

          <div className="p-5 rounded-[20px] bg-surface border border-border space-y-2">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>Active</span>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">{activeAutomations}</div>
            <div className="text-[11px] text-text-muted">Listening & live</div>
          </div>

          <div className="p-5 rounded-[20px] bg-surface border border-border space-y-2">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>Total Executions</span>
              <Activity className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">{totalRuns}</div>
            <div className="text-[11px] text-text-muted">Processed runs</div>
          </div>

          <div className="p-5 rounded-[20px] bg-surface border border-border space-y-2">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>Successful</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">{successfulRuns}</div>
            <div className="text-[11px] text-text-muted">
              {totalRuns > 0 ? `${((successfulRuns / totalRuns) * 100).toFixed(0)}% success rate` : '0%'}
            </div>
          </div>

          <div className="p-5 rounded-[20px] bg-surface border border-border space-y-2">
            <div className="flex items-center justify-between text-text-muted text-xs">
              <span>Failed</span>
              <AlertCircle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 tracking-tight">{failedRuns}</div>
            <div className="text-[11px] text-text-muted">Requires review</div>
          </div>
        </div>

        {/* 2. Automation Health & Attention Alerts */}
        {(automationsRequiringAttention.length > 0 || expiredConnections.length > 0) && (
          <div className="p-5 rounded-[22px] bg-amber-500/5 border border-amber-500/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Workspace Attention Items</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {automationsRequiringAttention.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => onOpenAutomation(wf.id)}
                  className="p-3.5 rounded-[14px] bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary group-hover:text-amber-300 transition-colors">
                        {wf.name}
                      </div>
                      <div className="text-[11px] text-text-muted">Latest execution failed</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                    Open <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              ))}

              {expiredConnections.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onNavigate('connections')}
                  className="p-3.5 rounded-[14px] bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-text-primary group-hover:text-amber-300 transition-colors">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-text-muted">Account token expired</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-amber-400 flex items-center gap-1">
                    Reconnect <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Main Split: Recent Activity & Quick Navigation */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Recent Activity */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-muted" />
                <span>Recent Activity</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('activity')}
                className="text-xs text-[#FF7306] hover:underline flex items-center gap-1"
              >
                <span>View all activity</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {runs.length === 0 ? (
              <div className="p-8 rounded-[20px] bg-surface border border-border text-center space-y-2">
                <Play className="w-6 h-6 mx-auto text-text-muted opacity-40" />
                <p className="text-xs text-text-muted">No runs recorded yet.</p>
                <button
                  type="button"
                  onClick={onCreateAutomation}
                  className="text-xs text-[#FF7306] hover:underline font-semibold"
                >
                  Test your first automation
                </button>
              </div>
            ) : (
              <div className="rounded-[20px] bg-surface border border-border overflow-hidden divide-y divide-border-subtle">
                {runs.slice(0, 6).map((run) => {
                  const duration = formatDuration(run.startedAt, run.finishedAt);
                  const statusColors: Record<string, string> = {
                    succeeded: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
                    failed: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
                    running: 'text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse',
                    queued: 'text-text-muted bg-surface-secondary border-border',
                    cancelled: 'text-text-muted bg-surface-secondary border-border',
                  };
                  const statusStyle = statusColors[run.status] || 'text-text-muted bg-surface-secondary border-border';

                  return (
                    <div
                      key={run.id}
                      onClick={() => {
                        if (onInspectRun) {
                          onInspectRun(run.id);
                        } else {
                          onNavigate('activity');
                        }
                      }}
                      className="p-4 hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            run.status === 'succeeded'
                              ? 'bg-emerald-400'
                              : run.status === 'failed'
                              ? 'bg-rose-400'
                              : 'bg-amber-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors truncate">
                            {run.workflowName || 'Automation Run'}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-text-muted font-sans mt-0.5">
                            <span>{run.triggerType.replace('.trigger', '')} trigger</span>
                            <span>•</span>
                            <span>{formatTimeAgo(run.queuedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-mono text-text-muted hidden sm:inline-block">
                          {duration}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border capitalize ${statusStyle}`}
                        >
                          {run.status}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Col: Active Automations & App Shortcuts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <WorkflowIcon className="w-4 h-4 text-text-muted" />
                <span>Automations</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('automations')}
                className="text-xs text-[#FF7306] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="rounded-[20px] bg-surface border border-border p-2 space-y-1.5">
              {workflows.slice(0, 4).map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => onOpenAutomation(wf.id)}
                  className="p-3 rounded-2xl hover:bg-surface-hover transition-colors cursor-pointer flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors truncate">
                      {wf.name}
                    </div>
                    <div className="text-[11px] text-text-muted mt-0.5">
                      {wf.graph?.nodes?.length || 0} steps • {wf.active ? 'Active' : 'Draft'}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary shrink-0" />
                </div>
              ))}
            </div>

            {/* Connected Apps Card */}
            <div className="p-5 rounded-[20px] bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-text-primary flex items-center gap-2">
                  <Layers className="w-4 h-4 text-text-muted" />
                  <span>Integrations</span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('connections')}
                  className="text-[11px] text-[#FF7306] hover:underline"
                >
                  Manage
                </button>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                {connections.length > 0
                  ? `${connections.length} external application account(s) authenticated and ready for workflow execution.`
                  : 'No accounts connected yet. Authorize Google Workspace, Slack, or Telegram to automate your tools.'}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('connections')}
                className="w-full py-2 px-3 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-all text-center"
              >
                + Connect an Application
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

