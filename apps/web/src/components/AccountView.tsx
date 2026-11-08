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
  X,
  Lock,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';

interface AccountViewProps {
  onBack: () => void;
}

export function AccountView({ onBack }: AccountViewProps) {
  const {
    user,
    workspace,
    workspaces,
    switchWorkspace,
    createWorkspace,
    updateProfile,
    logout,
  } = useAuth();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password change state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Create Workspace state
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  // Danger Zone: Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleSaveProfile = async () => {
    if (!tempName.trim()) return;
    setProfileSaving(true);
    try {
      await updateProfile({ name: tempName.trim() });
      setIsEditingProfile(false);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordLoading(true);

    try {
      await api.updatePassword({ currentPassword, newPassword });
      setPasswordSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleConfirmCreateWorkspace = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = newWorkspaceName.trim();
    if (!clean) return;

    setWorkspaceLoading(true);
    try {
      await createWorkspace(clean);
      setNewWorkspaceName('');
      setIsWorkspaceModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const workflows = await api.getWorkflows();
      const runs = await api.getRuns();
      const connections = await api.getConnections();

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        user: { id: user?.id, email: user?.email, name: user?.name },
        workspace: { id: workspace?.id, name: workspace?.name },
        workflows,
        runs,
        connections: connections.map((c) => ({ id: c.id, name: c.name, type: c.type, status: c.status })),
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vulp_workspace_${workspace?.name?.toLowerCase().replace(/\s+/g, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Failed to export workspace data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleteLoading(true);
    try {
      await api.deleteAccount();
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
      setDeleteLoading(false);
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
              <h1 className="text-xl font-bold text-text-primary tracking-tight">Account &amp; Workspaces</h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Personal identity, workspace switcher, and security policies
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="px-4 py-2 rounded-full bg-surface-elevated hover:bg-rose-500/10 hover:text-rose-400 border border-border text-xs font-semibold text-text-muted transition-all flex items-center gap-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Account Settings */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* 1. Personal Profile */}
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
                    setTempName(user?.name || '');
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
                    disabled={profileSaving}
                    className="text-xs font-bold bg-[#FF7306] text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
                  >
                    {profileSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-surface-secondary border border-border flex items-center justify-center font-bold text-xl text-text-primary shadow-sm shrink-0">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </div>

              {!isEditingProfile ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-text-primary leading-tight">{user?.name}</h3>
                    {profileSuccess && (
                      <span className="flex items-center gap-1 text-[11px] text-green-400">
                        <Check className="w-3.5 h-3.5" /> Updated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{user?.email}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 flex-1 max-w-sm text-xs">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-1.5 rounded-xl bg-surface-secondary border border-border text-text-primary focus:outline-none focus:border-[#FF7306] transition-colors"
                  />
                  <div className="text-[11px] text-text-tertiary">Email cannot be changed after account creation.</div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
              <div className="text-xs text-text-secondary">
                Secure your account with a strong password.
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-text-primary border border-border transition-colors flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3 text-[#FF7306]" /> Change Password
              </button>
            </div>
          </div>

          {/* 2. Workspace Management */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2.5">
                <Building className="w-4 h-4 text-accent" />
                <h2 className="text-sm font-bold text-text-primary">Workspaces</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkspaceModalOpen(true)}
                className="flex items-center gap-1.5 text-xs text-[#FF7306] hover:underline font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Workspace</span>
              </button>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Workspaces isolate automations, credentials, and execution logs. Select a workspace to switch:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {workspaces.map((ws) => {
                const isActive = workspace?.id === ws.id;

                return (
                  <div
                    key={ws.id}
                    onClick={() => !isActive && switchWorkspace(ws.id)}
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
                        <div className="text-xs font-bold text-text-primary">{ws.name}</div>
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

          {/* 3. Danger Zone */}
          <div className="p-6 rounded-[24px] bg-red-500/5 border border-red-500/20 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-red-400">Danger Zone</h2>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-border">
              <div>
                <h4 className="text-xs font-bold text-text-primary">Export Workspace Data</h4>
                <p className="text-[11px] text-text-muted">
                  Download all your workflows, configurations, and execution histories in standard JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportData}
                disabled={exportLoading}
                className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-text-primary border border-border flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                {exportLoading ? 'Exporting...' : 'Export JSON'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-red-500/20">
              <div>
                <h4 className="text-xs font-bold text-red-400">Delete Entire Account</h4>
                <p className="text-[11px] text-text-muted">
                  Permanently erase your account, all workspaces, workflows, and encrypted tokens. This action is irreversible.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-400 border border-red-500/30 flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
          <div className="bg-surface-elevated border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">Change Password</h3>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-1 rounded-full text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordError && (
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-surface border border-border text-text-primary focus:outline-none focus:border-[#FF7306]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-surface border border-border text-text-primary focus:outline-none focus:border-[#FF7306]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-border text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#FF7306] text-white hover:bg-[#FF7306]/90 transition-colors"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {isWorkspaceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
          <div className="bg-surface-elevated border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">Create New Workspace</h3>
              <button
                type="button"
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="p-1 rounded-full text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateWorkspace} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Workspace Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Acme Marketing, Production Workflows"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-surface border border-border text-text-primary focus:outline-none focus:border-[#FF7306]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWorkspaceModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-border text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newWorkspaceName.trim() || workspaceLoading}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#FF7306] text-white hover:bg-[#FF7306]/90 disabled:opacity-50 transition-colors"
                >
                  {workspaceLoading ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
          <div className="bg-surface-elevated border border-red-500/40 w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold">Permanently Delete Account?</h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              This action cannot be undone. All your workflows, credentials, execution histories, and workspaces
              will be permanently erased from Cloudflare D1.
            </p>

            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-text-secondary">
                Type <strong className="text-red-400 font-mono">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-xs rounded-xl bg-surface border border-border text-text-primary focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmText('');
                }}
                className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-border text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {deleteLoading ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
