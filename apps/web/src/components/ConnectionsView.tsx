import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Search,
  Key,
  Lock,
  Layers,
  Edit2,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  api,
  ConnectionRecord,
  IntegrationDefinition,
  CredentialRecord,
} from '../api/client.js';
import { ConnectionModal } from './ConnectionModal.js';
import {
  ServiceIcon,
  GmailIcon,
  GoogleSheetsIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
} from './ServiceIcons.js';

interface ConnectionsViewProps {
  onBack: () => void;
  onOpenWorkflow?: (workflowId: string) => void;
  initialTab?: 'accounts' | 'credentials';
}

type TabType = 'accounts' | 'credentials';
type CredentialType = 'apiKey' | 'bearer' | 'basic' | 'custom';

export function ConnectionsView({
  onBack,
  onOpenWorkflow: _onOpenWorkflow,
  initialTab = 'accounts',
}: ConnectionsViewProps) {
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cachedConns = api.getCachedConnections();
  const cachedCreds = api.getCachedCredentials();
  const hasCache = cachedConns !== null;

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [connections, setConnections] = useState<ConnectionRecord[]>(() => cachedConns || []);
  const [integrations, setIntegrations] = useState<IntegrationDefinition[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>(() => cachedCreds || []);
  const [loading, setLoading] = useState(!hasCache);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceForModal, setSelectedServiceForModal] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Credential Modal State
  const [isCredModalOpen, setIsCredModalOpen] = useState(false);
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [credName, setCredName] = useState('');
  const [credType, setCredType] = useState<CredentialType>('apiKey');
  const [apiKey, setApiKey] = useState('');
  const [headerName, setHeaderName] = useState('x-api-key');
  const [bearerToken, setBearerToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [isSubmittingCred, setIsSubmittingCred] = useState(false);
  const [credFormError, setCredFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (!api.getCachedConnections()) setLoading(true);
      const [conns, ints, creds] = await Promise.all([
        api.getConnections().catch(() => []),
        api.getIntegrations().catch(() => []),
        api.getCredentials().catch(() => []),
      ]);
      if (!isMountedRef.current) return;
      setConnections(conns);
      setIntegrations(ints);
      setCredentials(creds);
    } catch (err: any) {
      console.error('Failed to load connections:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async (id: string) => {
    try {
      setRefreshingId(id);
      const res = await api.refreshConnection(id);
      if (res.success) {
        setNotification({ type: 'success', message: 'Connection verified active!' });
        await loadData();
      } else {
        setNotification({ type: 'error', message: res.error || 'Failed to refresh connection' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Error refreshing connection' });
    } finally {
      setRefreshingId(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (!window.confirm(`Disconnect connection "${name}"? Workflows using this account will fail until updated.`)) {
      return;
    }

    try {
      setDisconnectingId(id);
      await api.disconnectConnection(id);
      setNotification({ type: 'success', message: `Disconnected "${name}"` });
      setConnections((prev) => prev.filter((c) => c.id !== id));
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Failed to disconnect account' });
    } finally {
      setDisconnectingId(null);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Credential Modal Handlers
  const handleOpenCredModal = (cred?: CredentialRecord) => {
    if (cred) {
      setEditingCredId(cred.id);
      setCredName(cred.name);
      setCredType((cred.type as CredentialType) || 'apiKey');
    } else {
      setEditingCredId(null);
      setCredName('');
      setCredType('apiKey');
    }
    setApiKey('');
    setHeaderName('x-api-key');
    setBearerToken('');
    setUsername('');
    setPassword('');
    setCustomKey('');
    setCustomVal('');
    setCredFormError(null);
    setIsCredModalOpen(true);
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credName.trim()) {
      setCredFormError('Please enter a credential name');
      return;
    }

    const secretData: Record<string, string> = {};

    if (credType === 'apiKey') {
      if (!apiKey.trim() && !editingCredId) {
        setCredFormError('Please enter an API Key value');
        return;
      }
      if (apiKey.trim()) {
        secretData.apiKey = apiKey.trim();
        secretData.headerName = headerName.trim() || 'x-api-key';
      }
    } else if (credType === 'bearer') {
      if (!bearerToken.trim() && !editingCredId) {
        setCredFormError('Please enter a Bearer Token value');
        return;
      }
      if (bearerToken.trim()) secretData.token = bearerToken.trim();
    } else if (credType === 'basic') {
      if ((!username.trim() || !password.trim()) && !editingCredId) {
        setCredFormError('Username and password are required for Basic Auth');
        return;
      }
      if (username.trim()) secretData.username = username.trim();
      if (password.trim()) secretData.password = password.trim();
    } else if (credType === 'custom') {
      if ((!customKey.trim() || !customVal.trim()) && !editingCredId) {
        setCredFormError('Custom key and secret value are required');
        return;
      }
      if (customKey.trim()) secretData[customKey.trim()] = customVal.trim();
    }

    try {
      setIsSubmittingCred(true);
      setCredFormError(null);

      if (editingCredId) {
        const updated = await api.updateCredential(editingCredId, {
          name: credName.trim(),
          type: credType,
          data: Object.keys(secretData).length > 0 ? secretData : undefined,
        });
        setCredentials((prev) => prev.map((c) => (c.id === editingCredId ? updated : c)));
        setNotification({ type: 'success', message: `Updated credential "${updated.name}"` });
      } else {
        const created = await api.createCredential({
          name: credName.trim(),
          type: credType,
          data: secretData,
        });
        setCredentials((prev) => [created, ...prev]);
        setNotification({ type: 'success', message: `Securely encrypted "${created.name}"` });
      }

      setIsCredModalOpen(false);
      await loadData();
    } catch (err: any) {
      setCredFormError(err.message || 'Failed to save credential');
    } finally {
      setIsSubmittingCred(false);
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const handleDeleteCred = async (id: string, name: string) => {
    if (!window.confirm(`Permanently delete credential "${name}"? Automations referencing it will fail.`)) {
      return;
    }
    try {
      await api.deleteCredential(id);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      setConnections((prev) => prev.filter((c) => c.id !== id));
      setNotification({ type: 'success', message: `Deleted credential "${name}"` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err?.message || 'Failed to delete' });
    } finally {
      setTimeout(() => setNotification(null), 4000);
    }
  };

  // Group connections by type
  const connsByType = connections.reduce((acc, c) => {
    const key = c.type.toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {} as Record<string, ConnectionRecord[]>);

  // Filter custom credentials (non-oauth generic credentials)
  const genericCreds = credentials.filter(
    (c) => ['apikey', 'bearer', 'basic', 'custom'].includes(c.type.toLowerCase())
  );

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Top Banner / Header */}
      <div className="px-8 py-6 border-b border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Connections &amp; Credentials</h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border">
              {connections.length} active
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Authenticate applications and manage secure API keys. All tokens are encrypted at rest with AES-256-GCM.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'accounts' ? (
            <button
              type="button"
              onClick={() => setSelectedServiceForModal('google')}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Application</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenCredModal()}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>New API Key / Token</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary transition-all"
          >
            Back to Editor
          </button>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="px-8 py-3.5 border-b border-border bg-surface-secondary flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-surface p-1 rounded-full border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 ${
              activeTab === 'accounts'
                ? 'bg-surface-elevated text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Connected Accounts &amp; Apps</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface text-text-muted font-mono">
              {connections.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium outline-none focus:outline-none focus-visible:outline-none transition-colors duration-150 ${
              activeTab === 'credentials'
                ? 'bg-surface-elevated text-text-primary font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Keys &amp; Secret Vault</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface text-text-muted font-mono">
              {genericCreds.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'accounts' ? 'Search apps...' : 'Search credentials...'}
            className="pl-9 pr-3.5 py-1.5 rounded-full bg-surface-secondary border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-hover w-52 transition-colors"
          />
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`mx-8 mt-4 p-3 rounded-[14px] text-xs flex items-center justify-between border animate-fadeIn ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {loading ? (
            <div className="py-20 text-center text-xs text-text-muted">
              Loading connections &amp; vault records...
            </div>
          ) : activeTab === 'accounts' ? (
            /* TAB 1: CONNECTED ACCOUNTS & APPLICATIONS */
            <div className="space-y-6">
              {/* Security Banner */}
              <div className="p-4 rounded-[18px] bg-surface border border-border flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary">Unified Google &amp; Third-Party Authentication</div>
                    <div className="text-[11px] mt-0.5">
                      Connecting your Google Workspace account automatically enables Gmail, Google Sheets, Google Drive, and Google Calendar.
                    </div>
                  </div>
                </div>
              </div>

              {/* Integrations Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {integrations
                  .filter((item) => {
                    const q = searchQuery.toLowerCase();
                    return (
                      item.name.toLowerCase().includes(q) ||
                      item.description.toLowerCase().includes(q) ||
                      item.category.toLowerCase().includes(q)
                    );
                  })
                  .map((item) => {
                    const activeConns = connsByType[item.credentialType.toLowerCase()] || [];
                    const isConnected = activeConns.length > 0;

                    return (
                      <div
                        key={item.id}
                        className="rounded-[24px] bg-surface border border-border hover:border-border-hover transition-all p-6 flex flex-col justify-between shadow-sm space-y-4 group"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5">
                              <div className="w-11 h-11 rounded-2xl bg-surface-elevated border border-border flex items-center justify-center shrink-0 shadow-inner">
                                <ServiceIcon service={item.id} size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-bold text-text-primary">{item.name}</h3>
                                  <span
                                    className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                      isConnected
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-surface-secondary text-text-muted border-border'
                                    }`}
                                  >
                                    {isConnected
                                      ? `● ${activeConns.length} Connected`
                                      : '○ Not Connected'}
                                  </span>
                                </div>
                                <span className="text-[11px] text-text-muted block mt-0.5 font-sans">
                                  {item.category}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedServiceForModal(item.id)}
                              className="px-3.5 py-1.5 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                            >
                              <Plus className="w-3.5 h-3.5 text-accent" />
                              <span>{isConnected ? 'Add Account' : 'Connect'}</span>
                            </button>
                          </div>

                          {/* Capabilities Pills for Unified Google */}
                          {item.id === 'google' && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {[
                                { label: 'Gmail', Icon: GmailIcon },
                                { label: 'Sheets', Icon: GoogleSheetsIcon },
                                { label: 'Drive', Icon: GoogleDriveIcon },
                                { label: 'Calendar', Icon: GoogleCalendarIcon },
                              ].map(({ label, Icon }) => (
                                <span
                                  key={label}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-surface-secondary border border-border text-text-secondary flex items-center gap-1.5 font-medium"
                                >
                                  <Icon size={12} />
                                  <span>{label}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Description */}
                          <p className="text-xs text-text-muted mt-3 leading-relaxed">
                            {item.description}
                          </p>

                          {/* Connected Accounts Sub-List */}
                          {isConnected && (
                            <div className="mt-4 pt-4 border-t border-border-subtle space-y-2.5">
                              <span className="text-[11px] uppercase tracking-wider font-semibold text-text-muted block font-mono">
                                Authenticated Accounts
                              </span>
                              {activeConns.map((conn) => (
                                <div
                                  key={conn.id}
                                  className="p-3.5 rounded-2xl bg-surface-secondary border border-border flex items-center justify-between gap-3 text-xs"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-text-primary truncate">
                                        {conn.accountIdentifier || conn.name}
                                      </span>
                                      {conn.status === 'expired' && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                                          Expired
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-text-muted mt-0.5">
                                      Used in {conn.workflowCount} {conn.workflowCount === 1 ? 'automation' : 'automations'}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={refreshingId === conn.id}
                                      onClick={() => handleRefresh(conn.id)}
                                      className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                                      title="Refresh token verification"
                                    >
                                      <RefreshCw className={`w-3.5 h-3.5 ${refreshingId === conn.id ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={disconnectingId === conn.id}
                                      onClick={() => handleDisconnect(conn.id, conn.name)}
                                      className="p-1.5 rounded-full hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors"
                                      title="Disconnect account"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* TAB 2: API KEYS & CUSTOM CREDENTIAL VAULT */
            <div className="space-y-6">
              <div className="p-4 rounded-[18px] bg-surface border border-border flex items-center justify-between text-xs text-text-muted">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-text-primary">Credential Vault Protection</div>
                    <div className="text-[11px] mt-0.5">
                      Plaintext secrets are never returned to the browser. Keys are injected in-memory only during execution.
                    </div>
                  </div>
                </div>
              </div>

              {genericCreds.length === 0 ? (
                <div className="py-20 text-center space-y-3 font-sans">
                  <Key className="w-8 h-8 mx-auto text-text-muted opacity-40" />
                  <h3 className="text-sm font-semibold text-text-primary">No custom credentials added yet</h3>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    Add API keys, Bearer tokens, or Basic Auth credentials to authenticate with third-party webhooks and REST endpoints.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenCredModal()}
                    className="px-4 py-2 rounded-full bg-text-primary text-background text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Add your first API Key
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {genericCreds.map((cred) => (
                    <div
                      key={cred.id}
                      className="p-5 rounded-[22px] bg-surface border border-border hover:border-border-hover transition-all space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-surface-secondary border border-border flex items-center justify-center text-[#FF7306]">
                            <Key className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-text-primary">{cred.name}</h3>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted block mt-0.5">
                              {cred.type} Authentication
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCredModal(cred)}
                            className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
                            title="Update / replace secrets"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCred(cred.id, cred.name)}
                            className="p-1.5 rounded-full hover:bg-rose-500/10 text-text-muted hover:text-rose-400 transition-colors"
                            title="Delete credential"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Masked Secret Row */}
                      <div className="p-3 rounded-xl bg-surface-secondary border border-border flex items-center justify-between text-xs">
                        <span className="font-mono text-text-muted text-[11px]">Secret Payload</span>
                        <span className="font-mono text-text-muted tracking-widest text-[11px]">
                          ••••••••••••••••
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Credential Create / Edit Modal */}
      {isCredModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-elevated border border-border rounded-[24px] max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-text-primary">
                  {editingCredId ? 'Update Encrypted Credential' : 'New Encrypted Credential'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Securely stored and encrypted with AES-256-GCM
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCredModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {credFormError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {credFormError}
              </div>
            )}

            <form onSubmit={handleSaveCredential} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1.5">
                  Credential Name *
                </label>
                <input
                  type="text"
                  value={credName}
                  onChange={(e) => setCredName(e.target.value)}
                  placeholder="e.g., Stripe Production Key"
                  className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none focus:border-border-hover transition-colors"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1.5">
                  Auth Type
                </label>
                <select
                  value={credType}
                  onChange={(e) => setCredType(e.target.value as CredentialType)}
                  className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                >
                  <option value="apiKey">API Key (Header / Query)</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth (Username / Password)</option>
                  <option value="custom">Custom Headers</option>
                </select>
              </div>

              {credType === 'apiKey' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-text-secondary font-medium mb-1">
                      Header Name
                    </label>
                    <input
                      type="text"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                      placeholder="x-api-key"
                      className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none font-mono transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary font-medium mb-1">
                      API Key Value *
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={editingCredId ? 'Leave blank to keep existing secret' : 'sk_live_...'}
                      className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none font-mono transition-colors"
                    />
                  </div>
                </div>
              )}

              {credType === 'bearer' && (
                <div>
                  <label className="block text-text-secondary font-medium mb-1">
                    Bearer Token *
                  </label>
                  <input
                    type="password"
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    placeholder={editingCredId ? 'Leave blank to keep existing token' : 'ghp_... or eyJhbGci...'}
                    className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none font-mono transition-colors"
                  />
                </div>
              )}

              {credType === 'basic' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-text-secondary font-medium mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin"
                      className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary font-medium mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editingCredId ? '••••••••' : 'Secret password'}
                      className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCredModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-surface-elevated hover:bg-surface-hover text-text-primary border border-border font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCred}
                  className="px-5 py-2 rounded-full bg-text-primary hover:opacity-90 text-background font-bold transition-all shadow-sm"
                >
                  {isSubmittingCred ? 'Encrypting...' : editingCredId ? 'Update Credential' : 'Save & Encrypt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ConnectionModal for OAuth / Integrations */}
      {selectedServiceForModal && (
        <ConnectionModal
          isOpen={true}
          serviceId={selectedServiceForModal}
          onClose={() => {
            setSelectedServiceForModal(null);
            loadData();
          }}
          onSuccess={() => {
            setSelectedServiceForModal(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
