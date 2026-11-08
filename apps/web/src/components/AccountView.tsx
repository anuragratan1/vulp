import { useState } from 'react';
import {
  User,
  Zap,
  Check,
  Plus,
  LogOut,
  ArrowLeft,
  Building,
  Mail,
  Users,
  X,
} from 'lucide-react';

interface AccountViewProps {
  currentWorkspace: string;
  onSelectWorkspace: (name: string) => void;
  onBack: () => void;
}

export function AccountView({
  currentWorkspace,
  onSelectWorkspace,
  onBack,
}: AccountViewProps) {
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('vulp_user_name') || 'Anurag Ratan';
  });

  const [userEmail, setUserEmail] = useState(() => {
    return localStorage.getItem('vulp_user_email') || 'anurag@vulp.dev';
  });

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [tempEmail, setTempEmail] = useState(userEmail);

  // Available Workspaces
  const [workspaces, setWorkspaces] = useState<string[]>(() => {
    const saved = localStorage.getItem('vulp_workspaces_list');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return ['Pro Workspace', 'Personal Workspace'];
  });

  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  const handleSaveProfile = () => {
    setUserName(tempName);
    setUserEmail(tempEmail);
    localStorage.setItem('vulp_user_name', tempName);
    localStorage.setItem('vulp_user_email', tempEmail);
    setIsEditingProfile(false);
  };

  const handleCreateWorkspace = () => {
    setIsWorkspaceModalOpen(true);
  };

  const handleConfirmCreateWorkspace = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = newWorkspaceName.trim();
    if (clean) {
      if (!workspaces.includes(clean)) {
        const updated = [...workspaces, clean];
        setWorkspaces(updated);
        localStorage.setItem('vulp_workspaces_list', JSON.stringify(updated));
      }
      onSelectWorkspace(clean);
      setNewWorkspaceName('');
      setIsWorkspaceModalOpen(false);
    }
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out of Vulp Studio?')) {
      localStorage.removeItem('vulp_active_workflow_id');
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Top Header */}
      <header className="px-8 py-6 border-b border-border bg-surface-secondary flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            title="Back to editor"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-text-secondary" />
              <h1 className="text-xl font-bold text-text-primary tracking-tight">Account &amp; Workspace</h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Personal identity, workspace switcher, and team collaboration status
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="px-4 py-2 rounded-full bg-surface-elevated hover:bg-rose-500/10 hover:text-rose-400 border border-border text-xs font-semibold text-text-muted transition-all flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Settings Sections */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 1. Personal Profile Section */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-bold text-text-primary">Personal Profile</h2>
              </div>
              {!isEditingProfile ? (
                <button
                  type="button"
                  onClick={() => {
                    setTempName(userName);
                    setTempEmail(userEmail);
                    setIsEditingProfile(true);
                  }}
                  className="text-xs text-[#FF7306] hover:underline font-semibold"
                >
                  Edit Profile
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="text-xs text-text-muted hover:text-text-primary px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="text-xs font-bold bg-text-primary text-background px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center font-bold text-xl text-text-primary shadow-sm shrink-0">
                {userName.charAt(0).toUpperCase()}
              </div>

              {!isEditingProfile ? (
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-text-primary leading-tight">{userName}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{userEmail}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 flex-1 max-w-sm text-xs">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-1.5 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                  />
                  <input
                    type="email"
                    value={tempEmail}
                    onChange={(e) => setTempEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full px-3 py-1.5 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. Workspace Management */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-bold text-text-primary">Active Workspace</h2>
              </div>
              <button
                type="button"
                onClick={handleCreateWorkspace}
                className="flex items-center gap-1.5 text-xs text-[#FF7306] hover:underline font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Workspaces isolate your automations, credentials, and execution logs. Select or switch your active workspace below:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {workspaces.map((ws) => {
                const isActive = currentWorkspace === ws;

                return (
                  <div
                    key={ws}
                    onClick={() => onSelectWorkspace(ws)}
                    className={`p-4 rounded-[20px] border cursor-pointer transition-all flex items-center justify-between ${
                      isActive
                        ? 'bg-surface-elevated border-[#FF7306]/50 shadow-sm ring-1 ring-[#FF7306]/30'
                        : 'bg-surface hover:bg-surface-hover border-border'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-surface-secondary border border-border flex items-center justify-center text-[#FF7306]">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-text-primary">{ws}</div>
                        <div className="text-[11px] text-text-muted mt-0.5">Role: Owner</div>
                      </div>
                    </div>

                    {isActive && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-[#FF7306]">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Team & Collaboration */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
              <Users className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text-primary">Workspace Members</h2>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-secondary border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-secondary border border-border flex items-center justify-center font-bold text-xs text-text-primary">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-text-primary block">{userName}</span>
                    <span className="text-[11px] text-text-muted">{userEmail}</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
                  Workspace Owner
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-secondary border border-border text-[11px] text-text-muted leading-relaxed">
              Multi-user invitations, SAML SSO integration, and role-based access control (RBAC) are ready for enterprise identity federation.
            </div>
          </div>
        </div>
      </div>

      {/* Create Workspace Modal */}
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
              Workspaces isolate your team's automations, credentials, and execution logs.
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
  );
}
