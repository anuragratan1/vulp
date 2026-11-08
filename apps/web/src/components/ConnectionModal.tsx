import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Copy,
  Check,
} from 'lucide-react';
import { api, ConnectionRecord } from '../api/client.js';
import {
  ServiceIcon,
  GoogleIcon,
  GmailIcon,
  GoogleSheetsIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
  getServiceBrandColor,
  getServiceDisplayName,
} from './ServiceIcons.js';

interface ConnectionModalProps {
  isOpen: boolean;
  serviceId: string; // 'google' | 'telegram' | 'slack' | 'github' | 'generic'
  onClose: () => void;
  onSuccess: (conn: ConnectionRecord) => void;
}

export function ConnectionModal({
  isOpen,
  serviceId,
  onClose,
  onSuccess,
}: ConnectionModalProps) {
  if (!isOpen) return null;

  const service = serviceId.toLowerCase();
  const displayName = getServiceDisplayName(service);
  const brandColor = getServiceBrandColor(service);

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for API key / Bot Token / Webhook
  const [accountName, setAccountName] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [slackUrl, setSlackUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');

  // Manual token option for Google (useful in local dev / without OAuth consent screen)
  const [showManualGoogle, setShowManualGoogle] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');

  // Google OAuth Config State
  const [googleConfig, setGoogleConfig] = useState<{
    configured: boolean;
    redirectUri: string;
    clientId: string | null;
  } | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);

  // Reset state on open
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    setAccountName('');
    setTelegramToken('');
    setSlackUrl('');
    setGithubToken('');
    setShowManualGoogle(false);
    setGoogleAccessToken('');
    setGoogleEmail('');
    setCopiedUri(false);

    if (isOpen && service === 'google') {
      api
        .getGoogleAuthUrl(window.location.origin)
        .then((info) => {
          setGoogleConfig({
            configured: info.configured,
            redirectUri: info.redirectUri,
            clientId: info.clientId,
          });
        })
        .catch(() => {});
    }
  }, [isOpen, serviceId, service]);

  const handleCopyUri = () => {
    const uri = googleConfig?.redirectUri || 'https://vulp-psi.vercel.app/api/auth/callback/google';
    navigator.clipboard.writeText(uri);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
  };

  // Listen for OAuth callbacks via window postMessage, BroadcastChannel, and localStorage
  useEffect(() => {
    let completed = false;

    const onAuthSuccess = async (data: { credentialId?: string; email?: string }) => {
      if (completed) return;
      completed = true;
      setLoading(false);
      setSuccessMsg(`Successfully connected Google account (${data.email || 'Google User'})!`);
      setTimeout(async () => {
        const list = await api.getConnections();
        const found = (data.credentialId && list.find((c) => c.id === data.credentialId)) || list[0];
        onSuccess(found);
        onClose();
      }, 1000);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vulp_oauth_success') {
        onAuthSuccess(event.data);
      } else if (event.data?.type === 'vulp_oauth_error') {
        setLoading(false);
        setError(`OAuth Authorization Error: ${event.data.error || 'Access denied'}`);
      }
    };

    // BroadcastChannel across tabs/popups
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('vulp_oauth');
      bc.onmessage = (event) => {
        if (event.data?.type === 'vulp_oauth_success') {
          onAuthSuccess(event.data);
        } else if (event.data?.type === 'vulp_oauth_error') {
          setLoading(false);
          setError(`OAuth Authorization Error: ${event.data.error || 'Access denied'}`);
        }
      };
    } catch {}

    // Storage event fallback
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'vulp_oauth_event' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          if (parsed.type === 'vulp_oauth_success') {
            onAuthSuccess(parsed);
          }
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (bc) bc.close();
    };
  }, [onSuccess, onClose]);

  // Google OAuth Popup Trigger
  const handleConnectGoogleOAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      const authData = await api.getGoogleAuthUrl(window.location.origin);

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authData.url,
        'vulp_google_auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        // Fallback to top-level redirect if popup blocker prevented window
        window.location.href = authData.url;
      }
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Failed to start Google OAuth flow');
    }
  };

  // Google Manual Token Submit
  const handleSaveManualGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAccessToken.trim()) {
      setError('Please provide a Google Access Token');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const email = googleEmail.trim() || 'workspace-account@google.com';
      const cred = await api.saveDirectToken({
        type: 'google',
        accessToken: googleAccessToken.trim(),
        email,
        name: `Google (${email})`,
      });
      setSuccessMsg('Google account connected successfully!');
      setTimeout(async () => {
        const list = await api.getConnections();
        const found = list.find((c) => c.id === cred.id) || list[0];
        onSuccess(found);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save Google connection');
    } finally {
      setLoading(false);
    }
  };

  // Telegram Submit & Live Validation
  const handleConnectTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = telegramToken.trim();
    if (!token) {
      setError('Please enter your Telegram Bot Token');
      return;
    }

    try {
      setValidating(true);
      setError(null);

      // Validate with Telegram
      const check = await api.validateConnection('telegram', { botToken: token });
      if (!check.valid) {
        setError(check.error || 'Invalid Telegram bot token');
        setValidating(false);
        return;
      }

      const botName = check.identifier || 'Bot';
      const name = accountName.trim() || `Telegram (${botName})`;

      const cred = await api.createCredential({
        name,
        type: 'telegram',
        data: {
          botToken: token,
          botUsername: check.identifier?.replace(/^@/, '') || '',
        },
      });

      setSuccessMsg(`Connected successfully as ${botName}!`);
      setTimeout(async () => {
        const list = await api.getConnections();
        const found = list.find((c) => c.id === cred.id) || list[0];
        onSuccess(found);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect Telegram');
    } finally {
      setValidating(false);
    }
  };

  // Slack Submit & Validation
  const handleConnectSlack = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = slackUrl.trim();
    if (!url) {
      setError('Please enter your Slack Incoming Webhook URL');
      return;
    }

    try {
      setValidating(true);
      setError(null);

      const check = await api.validateConnection('slack', { webhookUrl: url });
      if (!check.valid) {
        setError(check.error || 'Invalid Slack webhook URL');
        setValidating(false);
        return;
      }

      const name = accountName.trim() || 'Slack Alerts Channel';
      const cred = await api.createCredential({
        name,
        type: 'slack',
        data: {
          webhookUrl: url,
        },
      });

      setSuccessMsg('Connected Slack Incoming Webhook!');
      setTimeout(async () => {
        const list = await api.getConnections();
        const found = list.find((c) => c.id === cred.id) || list[0];
        onSuccess(found);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect Slack');
    } finally {
      setValidating(false);
    }
  };

  // GitHub Submit & Live Validation
  const handleConnectGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = githubToken.trim();
    if (!token) {
      setError('Please enter your GitHub Personal Access Token');
      return;
    }

    try {
      setValidating(true);
      setError(null);

      const check = await api.validateConnection('github', { token });
      if (!check.valid) {
        setError(check.error || 'Invalid GitHub token');
        setValidating(false);
        return;
      }

      const username = check.identifier || 'User';
      const name = accountName.trim() || `GitHub (${username})`;

      const cred = await api.createCredential({
        name,
        type: 'github',
        data: {
          token,
          username: check.identifier?.replace(/^@/, '') || '',
        },
      });

      setSuccessMsg(`Connected GitHub account ${username}!`);
      setTimeout(async () => {
        const list = await api.getConnections();
        const found = list.find((c) => c.id === cred.id) || list[0];
        onSuccess(found);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect GitHub');
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#262626] rounded-[24px] shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="p-6 border-b border-[#222222] flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-[14px] bg-[#1C1C1C] border border-[#2B2B2B] flex items-center justify-center shrink-0 shadow-inner"
              style={{ borderColor: `${brandColor}40` }}
            >
              <ServiceIcon service={service} size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-text-primary">
                  Connect {displayName}
                </h3>
                <span
                  className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${brandColor}1A`,
                    color: brandColor,
                    border: `1px solid ${brandColor}33`,
                  }}
                >
                  {service === 'google' ? 'OAuth 2.0' : 'Guided Setup'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {service === 'google'
                  ? 'Access Gmail, Google Sheets, Drive, and Calendar seamlessly.'
                  : service === 'telegram'
                  ? 'Send instant messages and alerts via your Telegram Bot.'
                  : service === 'slack'
                  ? 'Post notifications directly into Slack channels.'
                  : service === 'github'
                  ? 'Create issues and manage repositories in your workflows.'
                  : 'Connect external services with secure encrypted storage.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-text-muted hover:text-text-primary hover:bg-[#222222] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
          {error && (
            <div className="p-3.5 rounded-[14px] bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ----------------- GOOGLE OAUTH FLOW ----------------- */}
          {service === 'google' && (
            <div className="space-y-5">
              <div className="p-4 rounded-[16px] bg-[#1A1A1A] border border-[#262626] space-y-3">
                <h4 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  What permissions Vulp requests
                </h4>
                <ul className="text-xs text-text-muted space-y-2.5">
                  <li className="flex items-start gap-2">
                    <GmailIcon size={14} className="mt-0.5 shrink-0" />
                    <span><strong className="text-text-primary font-medium">Gmail</strong>: Send emails from your account on workflow triggers.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <GoogleSheetsIcon size={14} className="mt-0.5 shrink-0" />
                    <span><strong className="text-text-primary font-medium">Sheets</strong>: Read, append, and update rows in spreadsheets you choose.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <GoogleDriveIcon size={14} className="mt-0.5 shrink-0" />
                    <span><strong className="text-text-primary font-medium">Drive</strong>: Upload workflow files and locate documents.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <GoogleCalendarIcon size={14} className="mt-0.5 shrink-0" />
                    <span><strong className="text-text-primary font-medium">Calendar</strong>: Create scheduled events and meetings.</span>
                  </li>
                </ul>
              </div>

              {!showManualGoogle ? (
                <div className="space-y-3 pt-1">
                  {googleConfig?.configured && (
                    <div className="p-3 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-400 text-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="font-medium">OAuth Credentials Active</span>
                      </div>
                      <span className="text-[10px] text-text-muted font-mono bg-[#1F1F1F] px-2 py-0.5 rounded border border-[#333]">
                        Ready to Connect
                      </span>
                    </div>
                  )}

                  <div className="p-3 rounded-[14px] bg-[#171717] border border-[#262626] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-text-muted" />
                        Authorized Redirect URI
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUri}
                        className="text-text-primary hover:text-white flex items-center gap-1 text-[11px] transition-colors"
                      >
                        {copiedUri ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URI</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="text-xs font-mono text-text-primary bg-[#111] px-2.5 py-1.5 rounded-[8px] border border-[#222] truncate select-all">
                      {googleConfig?.redirectUri || 'https://vulp-psi.vercel.app/api/auth/callback/google'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConnectGoogleOAuth}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-[14px] bg-white hover:bg-[#F0F0F0] text-black font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.99] mt-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <GoogleIcon size={18} />
                    )}
                    <span>{loading ? 'Opening Google Authorization...' : 'Sign in with Google'}</span>
                  </button>

                  <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 px-1">
                    <span>Running in local/offline environment?</span>
                    <button
                      type="button"
                      onClick={() => setShowManualGoogle(true)}
                      className="text-text-primary underline hover:text-white"
                    >
                      Enter Token / Credentials
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveManualGoogle} className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">
                      Manual Google Token Entry
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowManualGoogle(false)}
                      className="text-[11px] text-text-muted hover:text-text-primary"
                    >
                      ← Back to One-Click Sign In
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">
                      Account Email Address
                    </label>
                    <input
                      type="email"
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      placeholder="e.g. sarah.c@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">
                      OAuth Access Token <span className="text-danger">*</span>
                    </label>
                    <input
                      type="password"
                      value={googleAccessToken}
                      onChange={(e) => setGoogleAccessToken(e.target.value)}
                      placeholder="ya29.a0ARedaCtEd..."
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      Token is securely encrypted with AES-256-GCM.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 rounded-[12px] bg-[#1E1E1E] text-text-muted hover:text-text-primary text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-5 py-2 rounded-[12px] bg-white text-black font-semibold text-xs hover:bg-[#F0F0F0]"
                    >
                      {loading ? 'Saving...' : 'Save Google Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ----------------- TELEGRAM GUIDED FLOW ----------------- */}
          {service === 'telegram' && (
            <form onSubmit={handleConnectTelegram} className="space-y-4">
              <div className="p-4 rounded-[16px] bg-[#181818] border border-[#262626] space-y-3">
                <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
                  <span>How to obtain your Bot Token</span>
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#229ED9] hover:underline flex items-center gap-1"
                  >
                    Open @BotFather <ExternalLink className="w-3 h-3" />
                  </a>
                </h4>
                <ol className="text-xs text-text-muted space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Open Telegram and start a chat with <strong>@BotFather</strong>.</li>
                  <li>Send <code>/newbot</code> and pick a display name and username.</li>
                  <li>BotFather will reply with your HTTP API token.</li>
                  <li>Paste the token into the field below.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Connection Label (optional)
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Sales Team Alerts Bot"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Bot Token <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-[12px] bg-[#1C1C1C] text-text-muted hover:text-text-primary text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validating}
                  className="px-5 py-2 rounded-[12px] bg-[#229ED9] hover:bg-[#1F8EC3] text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
                >
                  {validating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating with Telegram...</span>
                    </>
                  ) : (
                    <span>Test & Connect Bot</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ----------------- SLACK GUIDED FLOW ----------------- */}
          {service === 'slack' && (
            <form onSubmit={handleConnectSlack} className="space-y-4">
              <div className="p-4 rounded-[16px] bg-[#181818] border border-[#262626] space-y-3">
                <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
                  <span>How to create an Incoming Webhook</span>
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#E01E5A] hover:underline flex items-center gap-1"
                  >
                    Open Slack Apps <ExternalLink className="w-3 h-3" />
                  </a>
                </h4>
                <ol className="text-xs text-text-muted space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Visit <strong>api.slack.com/apps</strong> and create an app.</li>
                  <li>Enable <strong>Incoming Webhooks</strong> in features.</li>
                  <li>Click <strong>Add New Webhook to Workspace</strong> and choose your channel.</li>
                  <li>Copy the Webhook URL and paste it below.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Connection Label (optional)
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. #dev-alerts Slack"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Incoming Webhook URL <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={slackUrl}
                  onChange={(e) => setSlackUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXX"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-[12px] bg-[#1C1C1C] text-text-muted hover:text-text-primary text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validating}
                  className="px-5 py-2 rounded-[12px] bg-[#E01E5A] hover:bg-[#C2184B] text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
                >
                  {validating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating Webhook...</span>
                    </>
                  ) : (
                    <span>Test & Connect Slack</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ----------------- GITHUB GUIDED FLOW ----------------- */}
          {service === 'github' && (
            <form onSubmit={handleConnectGithub} className="space-y-4">
              <div className="p-4 rounded-[16px] bg-[#181818] border border-[#262626] space-y-3">
                <h4 className="text-xs font-semibold text-text-primary flex items-center justify-between">
                  <span>How to generate a Personal Access Token</span>
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-text-primary hover:underline flex items-center gap-1"
                  >
                    Open GitHub Tokens <ExternalLink className="w-3 h-3" />
                  </a>
                </h4>
                <ol className="text-xs text-text-muted space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Go to <strong>GitHub Settings → Developer settings → Personal access tokens</strong>.</li>
                  <li>Click <strong>Generate new token (classic)</strong>.</li>
                  <li>Select the <strong>repo</strong> scope (to create issues on your behalf).</li>
                  <li>Copy your token (starts with <code>ghp_</code>) and paste below.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Connection Label (optional)
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. GitHub Dev Token"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Personal Access Token <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#181818] border border-[#2B2B2B] text-xs text-text-primary focus:outline-none focus:border-[#444]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-[12px] bg-[#1C1C1C] text-text-muted hover:text-text-primary text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={validating}
                  className="px-5 py-2 rounded-[12px] bg-white hover:bg-[#EAEAEA] text-black font-semibold text-xs flex items-center gap-2 shadow-sm"
                >
                  {validating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                      <span>Validating with GitHub...</span>
                    </>
                  ) : (
                    <span>Test & Connect GitHub</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Privacy & Security Guarantee */}
          <div className="p-3.5 rounded-[14px] bg-[#121212] border border-[#202020] flex items-center gap-2.5 text-[11px] text-text-muted">
            <Lock className="w-3.5 h-3.5 text-text-secondary shrink-0" />
            <span>
              Your tokens are encrypted with <strong>AES-256-GCM</strong>. Vulp never returns decrypted secrets to the browser.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
