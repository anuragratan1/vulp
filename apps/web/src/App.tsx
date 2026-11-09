import { useEffect, useState } from 'react';
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
  Loader2,
  LogOut,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { api, WorkflowRecord, NodeTypeMetadata } from './api/client.js';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { LandingPage } from './components/public/LandingPage.js';
import { OnboardingWizard } from './components/OnboardingWizard.js';
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

const PUBLIC_ROUTES = [
  '/',
  '/features',
  '/integrations',
  '/templates',
  '/docs',
  '/security',
  '/faq',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  '/cookies',
  '/login',
  '/signup',
];

function MainStudioApp() {
  const {
    isAuthenticated,
    isLoading,
    user,
    workspace,
    workspaces,
    switchWorkspace,
    createWorkspace,
    logout,
  } = useAuth();

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

  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const handleConfirmCreateWorkspace = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = newWorkspaceName.trim();
    if (!clean) return;
    try {
      await createWorkspace(clean);
      setNewWorkspaceName('');
      setIsWorkspaceModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create workspace');
    }
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

  // Sync active workflow ID to localStorage and URL (only when editor is active)
  useEffect(() => {
    if (activeWorkflowId) {
      try {
        localStorage.setItem('vulp_active_workflow_id', activeWorkflowId);
        if (view === 'editor') {
          const url = new URL(window.location.href);
          url.searchParams.set('view', 'editor');
          url.searchParams.set('workflow', activeWorkflowId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch {}
    }
  }, [activeWorkflowId, view]);

  // Sync post-login redirect destination
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof window === 'undefined') return;

    try {
      const savedRedirect = sessionStorage.getItem('vulp_redirect_after_auth');
      if (savedRedirect) {
        sessionStorage.removeItem('vulp_redirect_after_auth');
        window.history.replaceState({}, '', savedRedirect);
        const restoredView = getInitialView();
        setView(restoredView);
        const params = new URLSearchParams(window.location.search);
        const wfId = params.get('workflow');
        if (wfId) setActiveWorkflowId(wfId);
        return;
      }
    } catch {}

    const curPath = window.location.pathname;
    if (curPath === '/login' || curPath === '/signup') {
      window.history.replaceState({}, '', '/');
    }
  }, [isAuthenticated]);

  // Load workflows and node types
  useEffect(() => {
    if (!isAuthenticated) return;

    let isMounted = true;
    async function loadInitialData() {
      try {
        const [wfList, types] = await Promise.all([
          api.getWorkflows(),
          api.getNodeTypes(),
        ]);
        if (!isMounted) return;

        setWorkflows(wfList);
        setNodeTypes(types);

        if (wfList.length > 0 && !activeWorkflowId) {
          setActiveWorkflowId(wfList[0].id);
        }
      } catch (err) {
        console.error('Failed to load initial studio data:', err);
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, workspace?.id]);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) || workflows[0] || null;

  const handleCreateWorkflow = async () => {
    try {
      const created = await api.createWorkflow({
        name: 'Untitled Automation',
      });
      setWorkflows((prev) => [created, ...prev]);
      setActiveWorkflowId(created.id);
      handleNavigate('editor');
    } catch (err: any) {
      alert(`Error creating workflow: ${err.message}`);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      await api.deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (activeWorkflowId === id) {
        const remaining = workflows.filter((w) => w.id !== id);
        setActiveWorkflowId(remaining.length > 0 ? remaining[0].id : null);
      }
      handleNavigate('automations');
    } catch (err: any) {
      alert(`Error deleting workflow: ${err.message}`);
    }
  };

  const handleWorkflowSaved = (updated: WorkflowRecord) => {
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  };

  const handleOnboardingComplete = async (action?: { type: 'template' | 'blank'; templateId?: string }) => {
    if (action?.type === 'template' && action.templateId) {
      try {
        const res = await api.instantiateTemplate(action.templateId);
        setWorkflows((prev) => [res.workflow, ...prev]);
        setActiveWorkflowId(res.workflow.id);
        handleNavigate('editor');
        return;
      } catch (err) {
        console.error('Failed to instantiate onboarding template:', err);
      }
    }
    handleNavigate('automations');
  };

  // If loading auth state, show clean loader
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <VulpLogo size={48} />
          <Loader2 className="w-5 h-5 animate-spin text-[#FF7306]" />
          <span className="text-xs font-semibold text-text-secondary">Connecting to VULP Studio...</span>
        </div>
      </div>
    );
  }

  // Strict Authentication Gate:
  // If not authenticated, NO anonymous access to Studio Canvas, workflows, runs, or credentials.
  if (!isAuthenticated) {
    const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '/';
    const search = typeof window !== 'undefined' ? window.location.search : '';

    if (pathname === '/login') {
      return <LandingPage initialPath="home" autoOpenAuth="signin" onEnterApp={() => {}} />;
    }
    if (pathname === '/signup') {
      return <LandingPage initialPath="home" autoOpenAuth="signup" onEnterApp={() => {}} />;
    }

    const cleanPath = pathname.replace(/^\/+/, '');
    if (PUBLIC_ROUTES.includes(pathname)) {
      return <LandingPage initialPath={cleanPath || 'home'} onEnterApp={() => {}} />;
    }

    // Protected Route or deep link (e.g. /canvas, /editor, /automations, /settings, or ?view=... / ?workflow=...)
    // Persist destination for post-login redirect, replace URL to /login, and open signin modal
    if (typeof window !== 'undefined') {
      try {
        const fullTarget = pathname + search;
        sessionStorage.setItem('vulp_redirect_after_auth', fullTarget);
        window.history.replaceState({}, '', '/login');
      } catch {}
    }
    return <LandingPage initialPath="home" autoOpenAuth="signin" onEnterApp={() => {}} />;
  }

  return (
    <Tooltip.Provider>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-text-primary font-sans antialiased selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
        {/* First-time onboarding wizard overlay */}
        {user && user.onboardingCompleted === false && (
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        )}

        {/* Sidebar Navigation */}
        <nav
          aria-label="Main Navigation"
          className={`flex flex-col shrink-0 bg-surface-secondary border-r border-border transition-all duration-300 ease-in-out select-none relative ${
            isSidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
          }`}
        >
          {/* Top Brand Header */}
          <div className="h-16 flex items-center px-4 border-b border-border-subtle shrink-0">
            {isSidebarCollapsed ? (
              <div className="w-full flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => toggleSidebar(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors focus:outline-none"
                  title="Expand sidebar"
                >
                  <VulpLogo size={24} />
                </button>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between">
                <div
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => handleNavigate('overview')}
                >
                  <VulpLogo size={28} />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm tracking-tight text-text-primary leading-none group-hover:text-[#FF7306] transition-colors">
                      VULP
                    </span>
                    <span className="text-[10px] text-text-muted font-medium tracking-tight mt-0.5">
                      Edge Automation
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleSidebar(true)}
                  className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                  title="Collapse sidebar"
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Workspace Switcher Selector */}
          <div className="p-3 border-b border-border-subtle shrink-0">
            {isSidebarCollapsed ? (
              <Tooltip.Root delayDuration={80}>
                <Tooltip.Trigger asChild>
                  <button
                    type="button"
                    onClick={() => handleNavigate('account')}
                    className="w-11 h-11 mx-auto rounded-full bg-surface-elevated flex items-center justify-center border border-border text-[#FF7306] shadow-sm hover:scale-105 transition-all"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="right"
                    sideOffset={12}
                    className="z-50 px-3 py-2 text-xs font-medium text-text-primary bg-surface-elevated border border-border rounded-xl shadow-2xl"
                  >
                    <div className="font-semibold">{workspace?.name || 'My Workspace'}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">Click to switch or create</div>
                    <Tooltip.Arrow className="fill-surface-elevated" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="w-full px-3 py-2.5 rounded-2xl bg-surface-elevated hover:bg-surface-hover border border-border flex items-center justify-between text-left text-xs font-semibold text-text-primary shadow-sm transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-[#FF7306]/10 text-[#FF7306] flex items-center justify-center shrink-0 border border-[#FF7306]/20">
                        <Zap className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate text-[12px]">{workspace?.name || 'Workspace'}</span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    className="z-50 w-[232px] p-1.5 bg-surface-elevated border border-border rounded-2xl shadow-2xl animate-in fade-in-0 zoom-in-95 text-xs select-none"
                  >
                    <DropdownMenu.Label className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Workspaces
                    </DropdownMenu.Label>

                    {workspaces.map((ws) => (
                      <DropdownMenu.Item
                        key={ws.id}
                        onSelect={() => switchWorkspace(ws.id)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer outline-none transition-colors ${
                          workspace?.id === ws.id
                            ? 'bg-surface font-semibold text-text-primary'
                            : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                        }`}
                      >
                        <span className="truncate">{ws.name}</span>
                        {workspace?.id === ws.id && <Check className="w-3.5 h-3.5 text-[#FF7306]" />}
                      </DropdownMenu.Item>
                    ))}

                    <DropdownMenu.Separator className="h-px bg-border my-1" />

                    <DropdownMenu.Item
                      onSelect={() => setIsWorkspaceModalOpen(true)}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-[#FF7306] hover:bg-[#FF7306]/10 font-semibold cursor-pointer outline-none transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Workspace</span>
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>

          {/* Navigation Items */}
          <div className={`flex-1 overflow-y-auto py-3 space-y-1.5 ${isSidebarCollapsed ? 'px-2' : 'px-3'}`}>
            <NavItem
              icon={<Home className="w-[18px] h-[18px]" />}
              label="Overview"
              active={view === 'overview'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('overview')}
            />

            <NavItem
              icon={<WorkflowIcon className="w-[18px] h-[18px]" />}
              label="Workflows"
              active={view === 'automations'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('automations')}
            />

            <NavItem
              icon={<Layout className="w-[18px] h-[18px]" />}
              label="Templates"
              active={view === 'templates'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('templates')}
            />

            <NavItem
              icon={<Clock className="w-[18px] h-[18px]" />}
              label="Executions"
              active={view === 'activity'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('activity')}
            />

            <NavItem
              icon={<Layers className="w-[18px] h-[18px]" />}
              label="Connections"
              active={view === 'connections'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('connections')}
            />
          </div>

          {/* Bottom Settings, Account & Logout Navigation */}
          <div className={`p-3 border-t border-border-subtle space-y-1.5 ${isSidebarCollapsed ? 'px-2' : ''}`}>
            <NavItem
              icon={<SettingsIcon className="w-[18px] h-[18px]" />}
              label="Settings"
              active={view === 'settings'}
              collapsed={isSidebarCollapsed}
              onClick={() => handleNavigate('settings')}
            />

            {isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-1.5 pt-1">
                {/* Collapsed User Dropdown */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FF7306]/20 to-[#FF7306]/5 border border-[#FF7306]/30 flex items-center justify-center text-[#FF7306] font-semibold text-xs outline-none hover:border-[#FF7306]/60 transition-colors cursor-pointer select-none"
                      aria-label="User Account Menu"
                    >
                      {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="right"
                      align="end"
                      sideOffset={12}
                      className="z-50 min-w-[220px] bg-[#1A1A1A] border border-[#2E2E2E] rounded-[16px] p-1.5 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 text-xs"
                    >
                      <div className="px-3 py-2 border-b border-[#262626]">
                        <div className="font-semibold text-text-primary truncate">{user?.name}</div>
                        <div className="text-[11px] text-text-muted truncate">{user?.email}</div>
                        {workspace?.name && (
                          <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#242424] text-[#FF7306]">
                            {workspace.name}
                          </div>
                        )}
                      </div>

                      <DropdownMenu.Item
                        onClick={() => handleNavigate('account')}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-[#262626] cursor-pointer outline-none transition-colors"
                      >
                        <User className="w-4 h-4 text-text-muted" />
                        <span>Account &amp; Workspaces</span>
                      </DropdownMenu.Item>

                      <DropdownMenu.Item
                        onClick={() => handleNavigate('settings')}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-[#262626] cursor-pointer outline-none transition-colors"
                      >
                        <SettingsIcon className="w-4 h-4 text-text-muted" />
                        <span>Settings</span>
                      </DropdownMenu.Item>

                      <DropdownMenu.Separator className="h-px bg-[#262626] my-1" />

                      <DropdownMenu.Item
                        onClick={() => logout()}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer outline-none transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* Collapsed Direct Log Out Button */}
                <Tooltip.Root delayDuration={80}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      onClick={() => logout()}
                      className="w-10 h-10 rounded-[12px] flex items-center justify-center text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      aria-label="Log Out"
                    >
                      <LogOut className="w-[18px] h-[18px]" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      side="right"
                      sideOffset={12}
                      className="z-50 px-2.5 py-1 text-xs font-medium text-red-300 bg-[#221212] border border-red-500/30 rounded-[6px] shadow-2xl"
                    >
                      Log Out
                      <Tooltip.Arrow className="fill-[#221212]" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </div>
            ) : (
              <>
                {/* Expanded User Dropdown Menu */}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className={`w-full flex items-center justify-between p-2 rounded-[12px] transition-all text-left group cursor-pointer ${
                        view === 'account'
                          ? 'bg-surface-elevated text-text-primary border border-border-subtle'
                          : 'hover:bg-surface-hover text-text-secondary hover:text-text-primary'
                      }`}
                      aria-label="User Account Menu"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FF7306]/20 to-[#FF7306]/5 border border-[#FF7306]/30 flex items-center justify-center text-[#FF7306] font-semibold text-xs shrink-0 select-none">
                          {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 truncate">
                          <div className="text-xs font-medium text-text-primary truncate">
                            {user?.name || 'Account'}
                          </div>
                          <div className="text-[10px] text-text-muted truncate">
                            {user?.email || workspace?.name || 'Workspace'}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-text-muted group-hover:text-text-primary shrink-0 transition-transform" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      side="top"
                      align="start"
                      sideOffset={8}
                      className="z-50 min-w-[220px] bg-[#1A1A1A] border border-[#2E2E2E] rounded-[16px] p-1.5 shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 text-xs"
                    >
                      <div className="px-3 py-2 border-b border-[#262626]">
                        <div className="font-semibold text-text-primary truncate">{user?.name}</div>
                        <div className="text-[11px] text-text-muted truncate">{user?.email}</div>
                        {workspace?.name && (
                          <div className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#242424] text-[#FF7306]">
                            {workspace.name}
                          </div>
                        )}
                      </div>

                      <DropdownMenu.Item
                        onClick={() => handleNavigate('account')}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-[#262626] cursor-pointer outline-none transition-colors"
                      >
                        <User className="w-4 h-4 text-text-muted" />
                        <span>Account &amp; Workspaces</span>
                      </DropdownMenu.Item>

                      <DropdownMenu.Item
                        onClick={() => handleNavigate('settings')}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-text-secondary hover:text-text-primary hover:bg-[#262626] cursor-pointer outline-none transition-colors"
                      >
                        <SettingsIcon className="w-4 h-4 text-text-muted" />
                        <span>Settings</span>
                      </DropdownMenu.Item>

                      <DropdownMenu.Separator className="h-px bg-[#262626] my-1" />

                      <DropdownMenu.Item
                        onClick={() => logout()}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer outline-none transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>

                {/* Direct 1-Click Logout Button */}
                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full flex items-center gap-3 px-3.5 py-2 rounded-[12px] text-xs font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer group"
                  title="Sign out of your account"
                >
                  <LogOut className="w-[18px] h-[18px] text-text-muted group-hover:text-red-400 transition-colors" />
                  <span>Log Out</span>
                </button>
              </>
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
                onWorkflowUpdated={handleWorkflowSaved}
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
              <AccountView onBack={() => handleNavigate('automations')} />
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

        {/* Create Workspace Modal */}
        {isWorkspaceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
            <div
              className="bg-surface-elevated border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4"
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
                Workspaces isolate automations, credentials, and execution logs for individual teams or projects.
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
                    placeholder="e.g. Marketing Ops, Client Alpha"
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

export default function App() {
  return (
    <AuthProvider>
      <MainStudioApp />
    </AuthProvider>
  );
}
