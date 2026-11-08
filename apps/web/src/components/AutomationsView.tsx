import { useState, useEffect } from 'react';
import {
  Workflow as WorkflowIcon,
  Plus,
  Search,
  LayoutTemplate,
  ArrowRight,
  MoreVertical,
  Copy,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api, WorkflowRecord, RunRecord } from '../api/client.js';

interface AutomationsViewProps {
  onOpenAutomation: (id: string) => void;
  onCreateScratch: () => void;
  onOpenTemplates: () => void;
}

type FilterTab = 'all' | 'active' | 'inactive' | 'attention';

export function AutomationsView({
  onOpenAutomation,
  onCreateScratch,
  onOpenTemplates,
}: AutomationsViewProps) {
  const cachedWfs = api.getCachedWorkflows();
  const cachedRuns = api.getCachedRuns();
  const hasCache = cachedWfs !== null;

  const [workflows, setWorkflows] = useState<WorkflowRecord[]>(() => cachedWfs || []);
  const [runs, setRuns] = useState<RunRecord[]>(() => cachedRuns || []);
  const [loading, setLoading] = useState(!hasCache);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilter, setCurrentFilter] = useState<FilterTab>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [wfs, pastRuns] = await Promise.all([
          api.getWorkflows(),
          api.getRuns().catch(() => []),
        ]);
        if (!active) return;
        setWorkflows(wfs);
        setRuns(pastRuns);
      } catch (err) {
        console.error('Failed to load automations data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Compute stats per workflow
  const runsByWorkflow = runs.reduce((acc, r) => {
    if (!acc[r.workflowId]) acc[r.workflowId] = [];
    acc[r.workflowId].push(r);
    return acc;
  }, {} as Record<string, RunRecord[]>);

  const handleToggleActive = async (wf: WorkflowRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTogglingId(wf.id);
      if (wf.active) {
        await api.deactivateWorkflow(wf.id);
      } else {
        await api.activateWorkflow(wf.id);
      }
      setWorkflows((prev) =>
        prev.map((item) => (item.id === wf.id ? { ...item, active: !item.active } : item))
      );
    } catch (err: any) {
      alert(`Could not toggle status: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDuplicate = async (wf: WorkflowRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const duplicated = await api.createWorkflow({
        name: `Copy of ${wf.name}`,
        graph: wf.graph,
        active: false,
      });
      setWorkflows((prev) => [duplicated, ...prev]);
      onOpenAutomation(duplicated.id);
    } catch (err: any) {
      alert(`Failed to duplicate automation: ${err.message}`);
    }
  };

  const handleDelete = async (wfId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete automation "${name}"? This will permanently remove its configuration and execution logs.`)) {
      return;
    }
    try {
      await api.deleteWorkflow(wfId);
      setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleSaveRename = async (wfId: string) => {
    if (!renameValue.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      const updated = await api.updateWorkflow(wfId, { name: renameValue.trim() });
      setWorkflows((prev) => prev.map((w) => (w.id === wfId ? updated : w)));
    } catch (err: any) {
      alert(`Failed to rename: ${err.message}`);
    } finally {
      setRenamingId(null);
    }
  };

  const formatTimestamp = (ts?: number | null) => {
    if (!ts) return 'Never';
    const date = new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter workflows
  const filteredWorkflows = workflows.filter((wf) => {
    // Search filter
    const matchesSearch =
      wf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wf.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const wfRuns = runsByWorkflow[wf.id] || [];
    const latestRun = wfRuns[0];

    if (currentFilter === 'active') return wf.active;
    if (currentFilter === 'inactive') return !wf.active;
    if (currentFilter === 'attention') return latestRun?.status === 'failed';
    return true;
  });

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Top Header */}
      <div className="px-8 py-6 border-b border-border bg-surface-secondary flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Automations</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
              {workflows.length} total
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1 font-sans">
            Build, manage, and schedule your autonomous multi-step processes
          </p>
        </div>

        {/* Primary Action Button with modal trigger */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenTemplates}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-all"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
            <span>Templates</span>
          </button>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Automation</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-8 py-4 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-full border border-border">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
              { id: 'attention', label: 'Needs Attention' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 ${
                currentFilter === tab.id
                  ? 'bg-surface text-text-primary font-semibold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search automations..."
            className="pl-9 pr-3.5 py-1.5 rounded-full bg-surface-secondary border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover w-56 transition-colors"
          />
        </div>
      </div>

      {/* Main Content / Automation Cards Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto space-y-4">
          {loading ? (
            <div className="py-20 text-center text-xs text-text-muted">
              Loading automations...
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <div className="py-16 text-center space-y-3 font-sans">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center mx-auto text-text-muted">
                <WorkflowIcon className="w-5 h-5 text-text-muted" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">No automations found</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                {searchQuery || currentFilter !== 'all'
                  ? 'Try adjusting your search terms or filter selection.'
                  : 'Get started by creating an automation from scratch or with a template.'}
              </p>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-2 px-4 py-2 rounded-full bg-text-primary text-background text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                Create your first automation
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWorkflows.map((wf) => {
                const stepCount = wf.graph?.nodes?.length || 0;
                const wfRuns = runsByWorkflow[wf.id] || [];
                const latestRun = wfRuns[0];
                const isRenaming = renamingId === wf.id;

                return (
                  <div
                    key={wf.id}
                    onClick={() => onOpenAutomation(wf.id)}
                    className="group p-5 rounded-[22px] bg-surface hover:bg-surface-hover border border-border hover:border-border-hover transition-all cursor-pointer shadow-sm flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Header Row with status switch */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-9 h-9 rounded-xl bg-surface-elevated border border-border flex items-center justify-center text-text-primary shrink-0 group-hover:border-[#FF7306]/40 transition-colors">
                            <WorkflowIcon className="w-4 h-4 text-[#FF7306]" />
                          </div>

                          <div className="min-w-0 flex-1">
                            {isRenaming ? (
                              <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRename(wf.id);
                                  if (e.key === 'Escape') setRenamingId(null);
                                }}
                                onBlur={() => handleSaveRename(wf.id)}
                                className="w-full px-2 py-1 rounded bg-surface-secondary border border-border text-xs font-semibold text-text-primary focus:outline-none"
                              />
                            ) : (
                              <h3 className="text-sm font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors truncate">
                                {wf.name}
                              </h3>
                            )}
                            <div className="text-[11px] text-text-muted font-sans mt-0.5">
                              {stepCount} {stepCount === 1 ? 'step' : 'steps'} configured
                            </div>
                          </div>
                        </div>

                        {/* More menu */}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              type="button"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              sideOffset={6}
                              className="z-50 min-w-[160px] bg-surface-elevated border border-border rounded-2xl p-1.5 shadow-2xl space-y-1 text-xs animate-in fade-in-0 zoom-in-95"
                            >
                              <DropdownMenu.Item
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingId(wf.id);
                                  setRenameValue(wf.name);
                                }}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-primary hover:bg-surface-hover cursor-pointer outline-none transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-text-muted" />
                                <span>Rename</span>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item
                                onClick={(e) => handleDuplicate(wf, e)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-primary hover:bg-surface-hover cursor-pointer outline-none transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5 text-text-muted" />
                                <span>Duplicate</span>
                              </DropdownMenu.Item>

                              <DropdownMenu.Separator className="h-px bg-border my-1" />

                              <DropdownMenu.Item
                                onClick={(e) => handleDelete(wf.id, wf.name, e)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 cursor-pointer outline-none transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>

                      {/* Run Outcome Badge */}
                      <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] font-sans">
                        <span className="text-text-muted">Last run</span>
                        {latestRun ? (
                          <div className="flex items-center gap-1.5">
                            {latestRun.status === 'succeeded' ? (
                              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Success</span>
                              </span>
                            ) : latestRun.status === 'failed' ? (
                              <span className="flex items-center gap-1 text-rose-400 font-medium">
                                <AlertCircle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                            ) : (
                              <span className="text-amber-400 font-medium">
                                Running
                              </span>
                            )}
                            <span className="text-text-muted font-mono">
                              ({formatTimestamp(latestRun.finishedAt || latestRun.queuedAt)})
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted font-sans">Never run</span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Active Switch & Quick Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={togglingId === wf.id}
                          onClick={(e) => handleToggleActive(wf, e)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            wf.active ? 'bg-emerald-500' : 'bg-surface-secondary'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              wf.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-[11px] font-medium text-text-muted font-sans">
                          {wf.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <span className="text-xs font-semibold text-text-muted group-hover:text-text-primary flex items-center gap-1 transition-colors">
                        <span>Open Canvas</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Creation Experience (2 Clear Choices) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-border rounded-[24px] max-w-lg w-full p-6 shadow-2xl space-y-6 animate-in fade-in-0 zoom-in-95">
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-text-primary tracking-tight">Create an Automation</h2>
              <p className="text-xs text-text-muted font-sans">
                Choose how you'd like to begin building this workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option 1: Start from Scratch */}
              <div
                onClick={() => {
                  setIsCreateModalOpen(false);
                  onCreateScratch();
                }}
                className="p-5 rounded-[20px] bg-surface hover:bg-surface-hover border border-border hover:border-[#FF7306] cursor-pointer transition-all group flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-[#FF7306]/10 border border-[#FF7306]/20 flex items-center justify-center text-[#FF7306] group-hover:scale-105 transition-transform">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">Start from Scratch</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Open a blank canvas with a default Manual Trigger ready to test and connect.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FF7306]">
                  <span>Blank Canvas</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Option 2: Start from Template */}
              <div
                onClick={() => {
                  setIsCreateModalOpen(false);
                  onOpenTemplates();
                }}
                className="p-5 rounded-[20px] bg-surface hover:bg-surface-hover border border-border hover:border-amber-400 cursor-pointer transition-all group flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                    <LayoutTemplate className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">Use a Template</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Browse ready-made recipes for Google Sheets, Gmail, and Webhooks.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                  <span>Browse Recipes</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-full bg-surface hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
