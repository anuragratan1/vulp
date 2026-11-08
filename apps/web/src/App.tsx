import React, { useEffect, useState } from 'react';
import {
  Home,
  Workflow as WorkflowIcon,
  Layout,
  Clock,
  Layers,
  Settings as SettingsIcon,
  User,
  PanelLeft,
  Zap,
  ChevronDown,
  Check,
  Plus,
  X,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api, WorkflowRecord, NodeTypeMetadata } from './api/client.js';
import { WorkflowEditor } from './editor/WorkflowEditor.js';
import { OverviewView } from './components/OverviewView.js';
import { AutomationsView } from './components/AutomationsView.js';
import { TemplatesView } from './components/TemplatesView.js';
import { ActivityView } from './components/ActivityView.js';
import { ConnectionsView } from './components/ConnectionsView.js';
import { SettingsView } from './components/SettingsView.js';
import { AccountView } from './components/AccountView.js';
import { VulpLogo } from './components/VulpLogo.js';

type ViewMode =
  | 'overview'
  | 'automations'
  | 'editor'
  | 'templates'
  | 'activity'
  | 'connections'
  | 'settings'
  | 'account';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

function NavItem({ icon, label, active, collapsed, onClick }: NavItemProps) {
  const content = (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3.5 rounded-full text-[13.5px] font-medium outline-none focus:outline-none focus-visible:outline-none focus:ring-0 border-0 transition-colors duration-150 ${
        collapsed
          ? `w-11 h-11 justify-center mx-auto ${
              active
                ? 'bg-surface-elevated text-text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`
          : `w-full px-4 py-3 ${
              active
                ? 'bg-surface-elevated text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`
      }`}
    >
      <span className={`shrink-0 ${active ? 'text-[#FF7306]' : 'text-current'}`}>{icon}</span>
      {!collapsed && <span className="truncate tracking-[-0.01em]">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip.Root delayDuration={80}>
        <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={12}
            className="z-50 px-3 py-1.5 text-xs font-semibold text-text-primary bg-surface-elevated border border-border rounded-full shadow-2xl animate-in fade-in-0 zoom-in-95 pointer-events-none select-none"
          >
            {label}
            <Tooltip.Arrow className="fill-surface-elevated" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  return content;
}

export default function App() {
  // Normalize incoming URL view parameters for backward compatibility
  const getInitialView = (): ViewMode => {
    if (typeof window === 'undefined') return 'overview';
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('view');
    if (!raw) {
      if (params.get('workflow')) return 'editor';
      return 'overview';
    }
    if (raw === 'workflows') return 'automations';
    if (raw === 'history' || raw === 'executions') return 'activity';
    if (raw === 'credentials' || raw === 'integrations') return 'connections';
    if (
      [
        'overview',
        'automations',
        'editor',
        'templates',
        'activity',
        'connections',
        'settings',
        'account',
      ].includes(raw)
    ) {
      return raw as ViewMode;
    }
    return 'overview';
  };

  const [view, setView] = useState<ViewMode>(getInitialView);
  const [inspectedRunId, setInspectedRunId] = useState<string | null>(null);

  // Sync view to URL search params
  const handleNavigate = (newView: ViewMode) => {
    if (newView === view && (newView !== 'activity' || inspectedRunId === null)) {
      return;
    }
    if (newView !== 'activity') {
      setInspectedRunId(null);
    }
    setView(newView);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', newView);
      if (newView !== 'editor') {
        url.searchParams.delete('selectNode');
        url.searchParams.delete('workflow');
      } else if (activeWorkflowId) {
        url.searchParams.set('workflow', activeWorkflowId);
      }
      window.history.pushState({}, '', url.toString());
    }
  };

  // Browser back/forward navigation sync
  useEffect(() => {
    const handlePopState = () => {
      const newView = getInitialView();
      setView(newView);
      const params = new URLSearchParams(window.location.search);
      const wfId = params.get('workflow');
      if (wfId) {
        setActiveWorkflowId(wfId);
      }
      if (newView !== 'activity') {
        setInspectedRunId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // User workspace preference with persistence
  const [currentWorkspace, setCurrentWorkspace] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vulp_active_workspace');
      if (saved) return saved;
    }
    return 'Pro Workspace';
  });

  const [workspaces, setWorkspaces] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vulp_workspaces_list');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
      }
    }
    return ['Pro Workspace', 'Personal Workspace'];
  });

  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const handleSelectWorkspace = (name: string) => {
    setCurrentWorkspace(name);
    try {
      localStorage.setItem('vulp_active_workspace', name);
    } catch {}
  };

  const handleConfirmCreateWorkspace = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = newWorkspaceName.trim();
    if (!clean) return;
    if (!workspaces.includes(clean)) {
      const updated = [...workspaces, clean];
      setWorkspaces(updated);
      try {
        localStorage.setItem('vulp_workspaces_list', JSON.stringify(updated));
      } catch {}
    }
    handleSelectWorkspace(clean);
    setNewWorkspaceName('');
    setIsWorkspaceModalOpen(false);
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vulp_sidebar_collapsed');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return getInitialView() === 'editor';
  });

  const toggleSidebar = (explicitVal?: boolean) => {
    setIsSidebarCollapsed((prev) => {
      const next = explicitVal !== undefined ? explicitVal : !prev;
      try {
        localStorage.setItem('vulp_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const initialWorkflowId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('workflow') ||
        localStorage.getItem('vulp_active_workflow_id')
      : null;

  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(initialWorkflowId);
  const [nodeTypes, setNodeTypes] = useState<NodeTypeMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync active workflow ID to localStorage and URL (only when editor is active)
  useEffect(() => {
    if (activeWorkflowId) {
      try {
        localStorage.setItem('vulp_active_workflow_id', activeWorkflowId);
        if (view === 'editor') {
          const url = new URL(window.location.href);
          url.searchParams.set('workflow', activeWorkflowId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
  }, [activeWorkflowId, view]);

  // Load initial data
  useEffect(() => {
    async function init() {
      try {
        const [types, list] = await Promise.all([
          api.getNodeTypes(),
          api.getWorkflows(),
        ]);
        setNodeTypes(types);
        setWorkflows(list);

        // Preload background data cache for instant zero-latency tab switching
        Promise.all([
          api.getRuns().catch(() => []),
          api.getConnections().catch(() => []),
          api.getCredentials().catch(() => []),
          api.getTemplates().catch(() => []),
        ]);

        if (list.length > 0) {
          const savedId =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('workflow') ||
                localStorage.getItem('vulp_active_workflow_id')
              : null;

          const matched = savedId ? list.find((w) => w.id === savedId) : null;
          if (matched) {
            setActiveWorkflowId(matched.id);
          } else {
            const sorted = [...list].sort(
              (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
            );
            setActiveWorkflowId(sorted[0].id);
          }
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleCreateWorkflow = async () => {
    try {
      const created = await api.createWorkflow({
        name: `Untitled Automation ${workflows.length + 1}`,
        graph: {
          nodes: [
            {
              key: `trigger_${Date.now().toString(36)}`,
              type: 'manual.trigger',
              name: 'Manual Trigger',
              position: { x: 140, y: 200 },
              params: { payload: {} },
            },
          ],
          edges: [],
        },
      });
      setWorkflows((prev) => [created, ...prev]);
      setActiveWorkflowId(created.id);
      handleNavigate('editor');
    } catch (err: any) {
      alert(`Failed to create automation: ${err.message}`);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this automation? Its execution history will also be removed.')) {
      return;
    }
    try {
      await api.deleteWorkflow(id);
      const remaining = workflows.filter((w) => w.id !== id);
      setWorkflows(remaining);
      if (activeWorkflowId === id) {
        setActiveWorkflowId(remaining[0]?.id || null);
        if (remaining.length === 0) {
          handleNavigate('automations');
        }
      }
    } catch (err: any) {
      alert(`Failed to delete automation: ${err.message}`);
    }
  };

  const handleWorkflowSaved = (updated: WorkflowRecord) => {
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || null;

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background text-text-primary flex flex-col items-center justify-center space-y-4 font-sans select-none">
        <div className="w-14 h-14 rounded-[20px] bg-surface-elevated border border-border flex items-center justify-center shadow-2xl animate-pulse overflow-hidden">
          <VulpLogo size={40} />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-sm font-semibold text-text-primary">Loading Vulp Studio</h2>
          <p className="text-xs text-text-muted font-sans">Connecting to runtime engine...</p>
        </div>
      </div>
    );
  }

  return (
    <Tooltip.Provider delayDuration={80}>
      <div className="h-screen w-screen flex overflow-hidden bg-background text-text-primary select-none font-sans">
        {/* Primary Left Navigation Sidebar */}
        <nav
          className={`bg-surface-secondary border-r border-border-subtle flex flex-col shrink-0 select-none transition-[width] duration-200 ease-in-out z-20 ${
            isSidebarCollapsed ? 'w-[72px]' : 'w-[264px]'
          }`}
        >
          {/* Brand Header */}
          <div className="pt-5 pb-4 px-4 border-b border-border-subtle">
            {isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-3">
                <div
                  onClick={() => handleNavigate('overview')}
                  className="w-11 h-11 rounded-2xl bg-surface-elevated border border-border shadow-sm flex items-center justify-center shrink-0 cursor-pointer hover:border-border-hover transition-all"
                  title="Vulp Overview"
                >
                  <VulpLogo size={32} />
                </div>
                <Tooltip.Root delayDuration={80}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleSidebar()}
                      className="w-9 h-9 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover flex items-center justify-center outline-none focus:outline-none focus-visible:outline-none transition-colors"
                      aria-label="Expand sidebar"
                    >
                      <PanelLeft className="w-4 h-4" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      sideOffset={12}
                      className="z-50 px-3 py-1.5 text-xs font-semibold text-text-primary bg-surface-elevated border border-border rounded-full shadow-2xl"
                    >
                      Expand sidebar
                      <Tooltip.Arrow className="fill-surface-elevated" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                {/* Collapsed Workspace Menu */}
                <DropdownMenu.Root>
                  <Tooltip.Root delayDuration={80}>
                    <Tooltip.Trigger asChild>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          className="w-9 h-9 rounded-full bg-surface-elevated border border-border hover:border-border-hover text-[#FF7306] flex items-center justify-center outline-none focus:outline-none focus-visible:outline-none transition-colors cursor-pointer"
                          aria-label={`Current Workspace: ${currentWorkspace}`}
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      </DropdownMenu.Trigger>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="right"
                        sideOffset={12}
                        className="z-50 px-3 py-1.5 text-xs font-semibold text-text-primary bg-surface-elevated border border-border rounded-full shadow-2xl"
                      >
                        Workspace: {currentWorkspace}
                        <Tooltip.Arrow className="fill-surface-elevated" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="right"
                      align="start"
                      sideOffset={12}
                      className="z-50 min-w-[220px] bg-surface-elevated border border-border rounded-2xl p-1.5 shadow-2xl space-y-1 animate-in fade-in-0 zoom-in-95 text-xs"
                    >
                      <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-text-muted">
                        Workspaces
                      </div>
                      {workspaces.map((ws) => (
                        <DropdownMenu.Item
                          key={ws}
                          onClick={() => handleSelectWorkspace(ws)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-text-primary hover:bg-surface-hover cursor-pointer outline-none transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full bg-[#FF7306]" />
                            <span className="font-medium">{ws}</span>
                          </div>
                          {currentWorkspace === ws && <Check className="w-3.5 h-3.5 text-[#FF7306]" />}
                        </DropdownMenu.Item>
                      ))}
                      <DropdownMenu.Separator className="h-px bg-border my-1" />
                      <DropdownMenu.Item
                        onClick={() => setIsWorkspaceModalOpen(true)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer outline-none transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Workspace...</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            ) : (
              <>
                {/* Prominent Brand Identity */}
                <div className="flex items-center justify-between px-1">
                  <div
                    onClick={() => handleNavigate('overview')}
                    className="flex items-center gap-3.5 cursor-pointer group"
                  >
                    <div className="w-11 h-11 rounded-[14px] bg-surface-elevated border border-border shadow-md flex items-center justify-center shrink-0 group-hover:border-border-hover transition-all">
                      <VulpLogo size={32} />
                    </div>
                    <span className="font-bold text-[19px] text-text-primary tracking-tight leading-none group-hover:text-[#FF7306] transition-colors">
                      Vulp
                    </span>
                  </div>
                  <Tooltip.Root delayDuration={80}>
                    <Tooltip.Trigger asChild>
                      <button
                        type="button"
                        onClick={() => toggleSidebar()}
                        className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover outline-none focus:outline-none focus-visible:outline-none transition-colors"
                        aria-label="Collapse sidebar"
                      >
                        <PanelLeft className="w-4 h-4" />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        side="right"
                        sideOffset={8}
                        className="z-50 px-3 py-1.5 text-xs font-semibold text-text-primary bg-surface-elevated border border-border rounded-full shadow-2xl"
                      >
                        Collapse sidebar
                        <Tooltip.Arrow className="fill-surface-elevated" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </div>

                {/* Clear Workspace Switcher */}
                <div className="mt-4">
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        className="w-full px-3.5 py-2.5 rounded-full bg-surface-elevated border border-border hover:border-border-hover flex items-center justify-between text-xs outline-none focus:outline-none focus-visible:outline-none transition-colors cursor-pointer select-none group"
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Zap className="w-4 h-4 text-[#FF7306] shrink-0" />
                          <span className="font-medium text-text-primary truncate text-[13px]">
                            {currentWorkspace}
                          </span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        className="z-50 min-w-[230px] bg-surface-elevated border border-border rounded-2xl p-1.5 shadow-2xl space-y-1 animate-in fade-in-0 zoom-in-95 text-xs"
                      >
                        <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-text-muted">
                          Workspaces
                        </div>
                        {workspaces.map((ws) => (
                          <DropdownMenu.Item
                            key={ws}
                            onClick={() => handleSelectWorkspace(ws)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-text-primary hover:bg-surface-hover cursor-pointer outline-none transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-2 h-2 rounded-full bg-[#FF7306]" />
                              <span className="font-medium">{ws}</span>
                            </div>
                            {currentWorkspace === ws && <Check className="w-3.5 h-3.5 text-[#FF7306]" />}
                          </DropdownMenu.Item>
                        ))}
                        <DropdownMenu.Separator className="h-px bg-border my-1" />
                        <DropdownMenu.Item
                          onClick={() => setIsWorkspaceModalOpen(true)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-hover cursor-pointer outline-none transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Create Workspace...</span>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </>
            )}
          </div>

          {/* EXACT PRIMARY NAVIGATION STRUCTURE */}
          <div className={`p-3.5 space-y-1.5 flex-1 overflow-y-auto ${isSidebarCollapsed ? 'px-2' : ''}`}>
            {/* 1. Overview */}
            <NavItem
              icon={<Home className="w-[18px] h-[18px]" />}
              label="Overview"
              active={view === 'overview'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('overview')}
            />

            {/* 2. Automations (renamed from Workflows) */}
            <NavItem
              icon={<WorkflowIcon className="w-[18px] h-[18px]" />}
              label="Automations"
              active={view === 'automations' || view === 'editor'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('automations')}
            />

            {/* 3. Templates */}
            <NavItem
              icon={<Layout className="w-[18px] h-[18px]" />}
              label="Templates"
              active={view === 'templates'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('templates')}
            />

            {/* 4. Activity (renamed from Executions) */}
            <NavItem
              icon={<Clock className="w-[18px] h-[18px]" />}
              label="Activity"
              active={view === 'activity'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('activity')}
            />

            {/* 5. Connections (merged with Credentials) */}
            <NavItem
              icon={<Layers className="w-[18px] h-[18px]" />}
              label="Connections"
              active={view === 'connections'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('connections')}
            />
          </div>

          {/* BOTTOM SECTION: 6. Settings & 7. Account & Workspace */}
          <div className={`p-3.5 border-t border-border-subtle space-y-1.5 ${isSidebarCollapsed ? 'px-2' : ''}`}>
            {/* 6. Settings */}
            <NavItem
              icon={<SettingsIcon className="w-[18px] h-[18px]" />}
              label="Settings"
              active={view === 'settings'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('settings')}
            />

            {/* 7. Account & Workspace */}
            {isSidebarCollapsed ? (
              <div className="flex justify-center pt-1">
                <Tooltip.Root delayDuration={80}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={() => handleNavigate('account')}
                      className={`w-11 h-11 rounded-full flex items-center justify-center outline-none focus:outline-none focus-visible:outline-none focus:ring-0 border-0 transition-colors duration-150 ${
                        view === 'account'
                          ? 'bg-surface-elevated text-text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                      }`}
                    >
                      <User className="w-[18px] h-[18px]" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      sideOffset={12}
                      className="z-50 px-3 py-2 text-xs font-medium text-text-primary bg-surface-elevated border border-border rounded-xl shadow-2xl"
                    >
                      <div className="font-semibold text-text-primary">Account &amp; Workspace</div>
                      <div className="text-[11px] text-text-muted mt-0.5">{currentWorkspace}</div>
                      <Tooltip.Arrow className="fill-surface-elevated" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            ) : (
              <NavItem
                icon={<User className="w-[18px] h-[18px]" />}
                label="Account & Workspace"
                active={view === 'account'}
                collapsed={isSidebarCollapsed}
                onClick={() => handleNavigate('account')}
              />
            )}
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 flex overflow-hidden bg-background min-w-0">
          <div className="flex-1 flex flex-col h-full w-full overflow-hidden animate-page-enter">
            {view === 'editor' && activeWorkflow ? (
              <WorkflowEditor
                key={activeWorkflow.id}
                workflow={activeWorkflow}
                nodeTypesMeta={nodeTypes}
                onSave={handleWorkflowSaved}
                onOpenHistory={() => handleNavigate('activity')}
                onBack={() => handleNavigate('automations')}
                onDeleteWorkflow={() => handleDeleteWorkflow(activeWorkflow.id)}
              />
            ) : view === 'overview' ? (
              <OverviewView
                onCreateAutomation={handleCreateWorkflow}
                onOpenAutomation={(id) => {
                  setActiveWorkflowId(id);
                  handleNavigate('editor');
                }}
                onNavigate={(dest) => handleNavigate(dest)}
                onInspectRun={(runId) => {
                  setInspectedRunId(runId);
                  handleNavigate('activity');
                }}
              />
            ) : view === 'automations' ? (
              <AutomationsView
                onOpenAutomation={(id) => {
                  setActiveWorkflowId(id);
                  handleNavigate('editor');
                }}
                onCreateScratch={handleCreateWorkflow}
                onOpenTemplates={() => handleNavigate('templates')}
              />
            ) : view === 'templates' ? (
              <TemplatesView
                onBack={() => handleNavigate('automations')}
                onOpenWorkflow={(wf) => {
                  setWorkflows((prev) => [wf, ...prev]);
                  setActiveWorkflowId(wf.id);
                  handleNavigate('editor');
                }}
              />
            ) : view === 'activity' ? (
              <ActivityView
                initialRunId={inspectedRunId}
                onOpenWorkflow={(id) => {
                  setActiveWorkflowId(id);
                  handleNavigate('editor');
                }}
                onBackToOverview={() => handleNavigate('overview')}
              />
            ) : view === 'connections' ? (
              <ConnectionsView
                onBack={() => handleNavigate('automations')}
                onOpenWorkflow={(wfId) => {
                  setActiveWorkflowId(wfId);
                  handleNavigate('editor');
                }}
              />
            ) : view === 'settings' ? (
              <SettingsView onBack={() => handleNavigate('automations')} />
            ) : view === 'account' ? (
              <AccountView
                currentWorkspace={currentWorkspace}
                onSelectWorkspace={handleSelectWorkspace}
                onBack={() => handleNavigate('automations')}
              />
            ) : (
              <OverviewView
                onCreateAutomation={handleCreateWorkflow}
                onOpenAutomation={(id) => {
                  setActiveWorkflowId(id);
                  handleNavigate('editor');
                }}
                onNavigate={(dest) => handleNavigate(dest)}
              />
            )}
          </div>
        </main>

        {/* Create Workspace Modal Dialog */}
        {isWorkspaceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
            <div
              className="bg-surface-elevated border border-border w-full max-w-md rounded-[24px] shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FF7306]/10 border border-[#FF7306]/20 flex items-center justify-center text-[#FF7306]">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-text-primary">Create New Workspace</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(false)}
                  className="p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-text-muted">
                Workspaces help isolate your team's automations, credentials, and execution history.
              </p>

              <form onSubmit={handleConfirmCreateWorkspace} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="e.g. Acme Marketing, Production Workflows"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-surface border border-border text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#FF7306] transition-colors"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewWorkspaceName('');
                      setIsWorkspaceModalOpen(false);
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-border text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newWorkspaceName.trim()}
                    className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#FF7306] hover:bg-[#E56705] text-white shadow-sm disabled:opacity-40 transition-all"
                  >
                    Create Workspace
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Tooltip.Provider>
  );
}
