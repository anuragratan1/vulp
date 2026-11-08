import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  Lock,
  UserCheck,
  Plus,
  Trash2,
  AlertCircle,
  X,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import { api, CredentialRecord } from '../api/client.js';

interface CredentialsViewProps {
  onBack: () => void;
  onCredentialCreated?: (cred: CredentialRecord) => void;
}

type CredentialType = 'apiKey' | 'bearer' | 'basic' | 'custom';

export function CredentialsView({ onBack, onCredentialCreated }: CredentialsViewProps) {
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Modal form state
  const [name, setName] = useState('');
  const [type, setType] = useState<CredentialType>('apiKey');
  const [apiKey, setApiKey] = useState('');
  const [headerName, setHeaderName] = useState('x-api-key');
  const [bearerToken, setBearerToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCredentials = async () => {
    try {
      setLoading(true);
      const list = await api.getCredentials();
      setCredentials(list);
    } catch (err: any) {
      console.error('Failed to load credentials:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredentials();
  }, []);

  const handleOpenModal = () => {
    setName('');
    setType('apiKey');
    setApiKey('');
    setHeaderName('x-api-key');
    setBearerToken('');
    setUsername('');
    setPassword('');
    setCustomKey('');
    setCustomVal('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleCreateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Please enter a credential name');
      return;
    }

    const secretData: Record<string, string> = {};

    if (type === 'apiKey') {
      if (!apiKey.trim()) {
        setFormError('Please enter an API Key value');
        return;
      }
      secretData.apiKey = apiKey.trim();
      secretData.headerName = headerName.trim() || 'x-api-key';
    } else if (type === 'bearer') {
      if (!bearerToken.trim()) {
        setFormError('Please enter a Bearer Token value');
        return;
      }
      secretData.token = bearerToken.trim();
    } else if (type === 'basic') {
      if (!username.trim() || !password.trim()) {
        setFormError('Username and password are required for Basic Auth');
        return;
      }
      secretData.username = username.trim();
      secretData.password = password.trim();
    } else if (type === 'custom') {
      if (!customKey.trim() || !customVal.trim()) {
        setFormError('Custom key and secret value are required');
        return;
      }
      secretData[customKey.trim()] = customVal.trim();
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      const newCred = await api.createCredential({
        name: name.trim(),
        type,
        data: secretData,
      });

      setCredentials((prev) => [newCred, ...prev]);
      setIsModalOpen(false);
      if (onCredentialCreated) {
        onCredentialCreated(newCred);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save credential');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential? Workflows referencing it will fail.')) {
      return;
    }

    try {
      setDeletingId(id);
      await api.deleteCredential(id);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(`Failed to delete credential: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getTypeBadge = (credType: string) => {
    switch (credType) {
      case 'apiKey':
        return { label: 'API Key', icon: Key, color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
      case 'bearer':
        return { label: 'Bearer Token', icon: Shield, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' };
      case 'basic':
        return { label: 'Basic Auth', icon: UserCheck, color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
      default:
        return { label: 'Secret Vault', icon: Lock, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
    }
  };

  return (
    <div className="flex-1 bg-[#0F0F0F] flex flex-col h-full overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 px-8 border-b border-[#222222] bg-[#141414] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[#202020] text-text-muted hover:text-text-primary transition-colors"
            title="Back to workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Key className="w-4 h-4 text-text-muted" />
              Credentials & Secrets
            </h1>
            <p className="text-[11px] text-text-muted mt-0.5">
              Encrypted API keys and service tokens for your workflows
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-[#EEEEEE] text-black text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Credential</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Security Banner */}
          <div className="p-4 rounded-[18px] bg-[#161616] border border-[#262626] flex items-center justify-between text-xs text-text-muted">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-medium text-text-primary">AES-256-GCM Vault Active</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Secrets are encrypted using your master key. Raw secrets are never sent to the browser or stored in logs.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-[#202020] text-[10px] font-mono text-text-muted border border-[#2E2E2E]">
              Zero-Leakage Guarantee
            </span>
          </div>

          {/* Credentials List */}
          {loading ? (
            <div className="p-12 text-center text-text-muted text-xs">
              Loading encrypted credentials...
            </div>
          ) : credentials.length === 0 ? (
            <div className="p-12 rounded-[22px] bg-[#141414] border border-[#222222] text-center space-y-3">
              <div className="w-12 h-12 rounded-[16px] bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center mx-auto text-text-muted">
                <Key className="w-5 h-5 text-text-muted" />
              </div>
              <h3 className="text-sm font-semibold text-text-primary">No credentials added yet</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                Securely store API keys or auth tokens to authenticate your HTTP Request and automated actions.
              </p>
              <button
                type="button"
                onClick={handleOpenModal}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1C1C1C] hover:bg-[#242424] border border-[#2E2E2E] text-xs font-semibold text-text-primary transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add your first credential
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {credentials.map((cred) => {
                const badge = getTypeBadge(cred.type);
                const BadgeIcon = badge.icon;
                const formattedDate = new Date(cred.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });

                return (
                  <div
                    key={cred.id}
                    className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] hover:border-[#303030] flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-[14px] bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-text-muted shrink-0 group-hover:text-text-primary transition-colors">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-text-primary">{cred.name}</h4>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${badge.color}`}
                          >
                            <BadgeIcon className="w-2.5 h-2.5" />
                            {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1">
                          <span className="font-mono text-[10px] text-text-muted">ID: {cred.id}</span>
                          <span>•</span>
                          <span>Created {formattedDate}</span>
                          <span>•</span>
                          <span className="text-emerald-400/80 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" />
                            Encrypted
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(cred.id)}
                      disabled={deletingId === cred.id}
                      className="p-2 rounded-full text-text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-70 group-hover:opacity-100 disabled:opacity-30"
                      title="Delete credential"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* New Credential Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#161616] border border-[#2A2A2A] rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#242424] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Add New Credential</h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Secrets are securely encrypted with AES-256-GCM
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-full hover:bg-[#202020] text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateCredential} className="p-6 space-y-4 text-xs font-sans">
              {formError && (
                <div className="p-3 rounded-[12px] bg-danger/10 border border-danger/20 text-danger text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Credential Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Credential Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe Production Key, Slack Bot Token"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary outline-none transition-colors"
                />
              </div>

              {/* Type Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Authentication Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('apiKey')}
                    className={`p-2.5 rounded-[14px] border text-left flex items-center gap-2 transition-all ${
                      type === 'apiKey'
                        ? 'bg-[#222222] border-white/40 text-text-primary font-medium'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-text-muted hover:border-[#383838]'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>API Key</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('bearer')}
                    className={`p-2.5 rounded-[14px] border text-left flex items-center gap-2 transition-all ${
                      type === 'bearer'
                        ? 'bg-[#222222] border-white/40 text-text-primary font-medium'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-text-muted hover:border-[#383838]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    <span>Bearer Token</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('basic')}
                    className={`p-2.5 rounded-[14px] border text-left flex items-center gap-2 transition-all ${
                      type === 'basic'
                        ? 'bg-[#222222] border-white/40 text-text-primary font-medium'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-text-muted hover:border-[#383838]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                    <span>Basic Auth</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setType('custom')}
                    className={`p-2.5 rounded-[14px] border text-left flex items-center gap-2 transition-all ${
                      type === 'custom'
                        ? 'bg-[#222222] border-white/40 text-text-primary font-medium'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-text-muted hover:border-[#383838]'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Custom Secret</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Inputs based on type */}
              {type === 'apiKey' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      API Key Secret <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="sk_live_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Header Name
                    </label>
                    <input
                      type="text"
                      placeholder="x-api-key"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              {type === 'bearer' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    Bearer Token <span className="text-danger">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={bearerToken}
                    onChange={(e) => setBearerToken(e.target.value)}
                    className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none transition-colors"
                  />
                </div>
              )}

              {type === 'basic' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Username <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Password <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              {type === 'custom' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Secret Key <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. webhookSecret or header:X-Custom-Auth"
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Secret Value <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Secret payload..."
                      value={customVal}
                      onChange={(e) => setCustomVal(e.target.value)}
                      className="w-full bg-[#1C1C1C] border border-[#2E2E2E] focus:border-[#555555] rounded-[14px] px-3.5 py-2.5 text-xs text-text-primary font-mono outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-[#242424]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-full border border-[#2E2E2E] text-text-muted hover:text-text-primary text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-full bg-white hover:bg-[#EEEEEE] text-black text-xs font-semibold transition-all shadow-sm active:scale-[0.98] disabled:opacity-40"
                >
                  {isSubmitting ? 'Encrypting & Saving...' : 'Save Credential'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
