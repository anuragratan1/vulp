import { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';
import {
  GoogleIcon,
  TelegramIcon,
  SlackIcon,
  GoogleFormsIcon,
  GoogleSheetsIcon,
  GmailIcon,
} from './ServiceIcons.js';

interface OnboardingWizardProps {
  onComplete: (action?: { type: 'template' | 'blank'; templateId?: string }) => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, workspace, completeOnboarding } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isFinishing, setIsFinishing] = useState(false);

  // Telegram test state
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [telegramError, setTelegramError] = useState('');

  // Slack test state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackStatus, setSlackStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [slackError, setSlackError] = useState('');

  // Google OAuth state
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'connecting' | 'success'>('idle');

  // Check if Google Workspace is already connected on mount and listen to OAuth signals
  useEffect(() => {
    let isMounted = true;

    const checkExistingGoogle = async () => {
      try {
        const conns = await api.getConnections();
        if (!isMounted) return;
        if (conns.some((c) => c.type.toLowerCase().includes('google'))) {
          setGoogleStatus('success');
        }
      } catch {}
    };

    checkExistingGoogle();

    const handleOAuthSuccess = () => {
      if (!isMounted) return;
      setGoogleStatus('success');
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'vulp_oauth_success' && event.data?.service === 'google') {
        handleOAuthSuccess();
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('vulp_oauth');
      bc.onmessage = (event) => {
        if (event.data?.type === 'vulp_oauth_success' && event.data?.service === 'google') {
          handleOAuthSuccess();
        }
      };
    } catch {}

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'vulp_oauth_event' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data?.type === 'vulp_oauth_success' && data?.service === 'google') {
            handleOAuthSuccess();
          }
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      bc?.close();
    };
  }, []);

  // Poll connection status while "connecting" to recover immediately when authorization completes
  useEffect(() => {
    if (googleStatus !== 'connecting') return;
    const interval = setInterval(async () => {
      try {
        const conns = await api.getConnections();
        if (conns.some((c) => c.type.toLowerCase().includes('google'))) {
          setGoogleStatus('success');
          clearInterval(interval);
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [googleStatus]);

  const handleConnectGoogle = async () => {
    try {
      setGoogleStatus('connecting');
      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open popup synchronously on user click to prevent browser throttling
      const popup = window.open(
        'about:blank',
        'vulp_google_auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const authData = await api.getGoogleAuthUrl(origin, workspace?.id);

      if (popup && !popup.closed) {
        popup.location.href = authData.url;
      } else {
        window.location.href = authData.url;
      }
    } catch {
      setGoogleStatus('idle');
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramChatId || !telegramToken) return;
    setTelegramStatus('testing');
    setTelegramError('');
    try {
      const res = await api.testTelegram({
        botToken: telegramToken,
        chatId: telegramChatId,
        text: '👋 Test alert from your VULP automation platform!',
      });
      if (res.success) {
        setTelegramStatus('success');
        // Persist credential
        await api.createCredential({
          name: 'Telegram Bot',
          type: 'telegram',
          data: { botToken: telegramToken, defaultChatId: telegramChatId },
        });
      } else {
        setTelegramStatus('error');
        setTelegramError(res.error || 'Failed to send Telegram message');
      }
    } catch (err: any) {
      setTelegramStatus('error');
      setTelegramError(err.message || 'Telegram test failed');
    }
  };

  const handleTestSlack = async () => {
    if (!slackWebhookUrl) return;
    setSlackStatus('testing');
    setSlackError('');
    try {
      const res = await api.testSlack({
        webhookUrl: slackWebhookUrl,
        text: '🚀 Test alert from your VULP automation platform!',
      });
      if (res.success) {
        setSlackStatus('success');
        // Persist credential
        await api.createCredential({
          name: 'Slack Webhook',
          type: 'slack',
          data: { webhookUrl: slackWebhookUrl },
        });
      } else {
        setSlackStatus('error');
        setSlackError(res.error || 'Failed to trigger Slack webhook');
      }
    } catch (err: any) {
      setSlackStatus('error');
      setSlackError(err.message || 'Slack test failed');
    }
  };

  const handleFinish = async (action?: { type: 'template' | 'blank'; templateId?: string }) => {
    setIsFinishing(true);
    try {
      await completeOnboarding();
      onComplete(action);
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Progress Bar & Header */}
        <div className="p-6 border-b border-border bg-surface-elevated/40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF7306]/10 text-[#FF7306] font-bold text-xs border border-[#FF7306]/20">
                {step}/3
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {step === 1 && 'Welcome to VULP'}
                {step === 2 && 'Connect Integrations'}
                {step === 3 && 'Choose Starting Point'}
              </span>
            </div>

            <button
              onClick={() => handleFinish({ type: 'blank' })}
              className="text-xs font-medium text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1"
            >
              Skip setup <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#FF7306] h-full transition-all duration-300 ease-out"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="p-8 overflow-y-auto max-h-[70vh]">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF7306]/10 border border-[#FF7306]/20 flex items-center justify-center text-[#FF7306]">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">
                  Welcome aboard, {user?.name || 'Explorer'}!
                </h2>
                <p className="text-sm text-text-secondary max-w-md mx-auto">
                  Your isolated workspace <strong className="text-text-primary">{workspace?.name}</strong> is ready.
                  VULP allows you to connect APIs, create autonomous workflows, and trigger actions with zero latency.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
                <div className="p-4 rounded-xl border border-border bg-surface-elevated/30 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary">Instant Triggers</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Execute workflows via incoming Webhooks, Cron timers, and Google Forms.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-surface-elevated/30 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary">Zero-Leak Security</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Credentials encrypted with AES-256-GCM and strictly scoped to your tenant.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-border bg-surface-elevated/30 flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-[#FF7306] flex items-center justify-center">
                    <Zap className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-semibold text-text-primary">Edge Velocity</h4>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    High throughput DAG execution running on Cloudflare Edge global network.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-text-primary">Connect Your Tools</h3>
                <p className="text-xs text-text-secondary">
                  Authorize Google Workspace or connect Telegram and Slack for real-time alerting.
                </p>
              </div>

              <div className="space-y-4">
                {/* Google Workspace */}
                <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-2">
                      <GoogleIcon size={24} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">Google Workspace</h4>
                      <p className="text-xs text-text-secondary">Gmail, Sheets, Drive, Forms & Calendar</p>
                    </div>
                  </div>

                  {googleStatus === 'success' ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                    </span>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      disabled={googleStatus === 'connecting'}
                      className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-surface hover:bg-surface-hover text-text-primary border border-border transition-colors"
                    >
                      {googleStatus === 'connecting' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Authorizing...
                        </>
                      ) : (
                        <>
                          Connect OAuth <ExternalLink className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Telegram Bot */}
                <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#229ED9]/10 border border-[#229ED9]/20 flex items-center justify-center p-2">
                        <TelegramIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-text-primary">Telegram Bot</h4>
                        <p className="text-xs text-text-secondary">Instant notifications & alert broadcasts</p>
                      </div>
                    </div>

                    {telegramStatus === 'success' && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    <input
                      type="password"
                      placeholder="Bot Token (from @BotFather)"
                      value={telegramToken}
                      onChange={(e) => setTelegramToken(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Chat ID (e.g. 12345678)"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306]"
                      />
                      <button
                        onClick={handleTestTelegram}
                        disabled={!telegramToken || !telegramChatId || telegramStatus === 'testing'}
                        className="px-3 py-2 shrink-0 rounded-lg bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-text-primary border border-border disabled:opacity-50 transition-colors"
                      >
                        {telegramStatus === 'testing' ? 'Testing...' : 'Test & Save'}
                      </button>
                    </div>
                  </div>
                  {telegramError && <p className="text-[11px] text-red-400">{telegramError}</p>}
                </div>

                {/* Slack Incoming Webhook */}
                <div className="p-4 rounded-xl border border-border bg-surface-elevated/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#4A154B]/10 border border-[#4A154B]/20 flex items-center justify-center p-2">
                        <SlackIcon size={24} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-text-primary">Slack Webhook</h4>
                        <p className="text-xs text-text-secondary">Post messages to channel webhooks</p>
                      </div>
                    </div>

                    {slackStatus === 'success' && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={slackWebhookUrl}
                      onChange={(e) => setSlackWebhookUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306]"
                    />
                    <button
                      onClick={handleTestSlack}
                      disabled={!slackWebhookUrl || slackStatus === 'testing'}
                      className="px-3 py-2 shrink-0 rounded-lg bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-text-primary border border-border disabled:opacity-50 transition-colors"
                    >
                      {slackStatus === 'testing' ? 'Testing...' : 'Test & Save'}
                    </button>
                  </div>
                  {slackError && <p className="text-[11px] text-red-400">{slackError}</p>}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-text-primary">Start Building</h3>
                <p className="text-xs text-text-secondary">
                  Choose a battle-tested template or launch a blank automation canvas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() => handleFinish({ type: 'template', templateId: 'google-forms-to-telegram' })}
                  disabled={isFinishing}
                  className="p-4 rounded-xl border border-border hover:border-[#FF7306]/50 bg-surface-elevated/40 hover:bg-surface-elevated text-left transition-all duration-150 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-lg bg-[#7248B9]/15 flex items-center justify-center p-1.5">
                        <GoogleFormsIcon size={18} />
                      </div>
                      <span className="text-[10px] text-text-tertiary font-mono">→</span>
                      <div className="w-8 h-8 rounded-lg bg-[#229ED9]/15 flex items-center justify-center p-1.5">
                        <TelegramIcon size={18} />
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors">
                      Google Forms to Telegram
                    </h4>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Instant alerts dispatched into Telegram whenever a new response is submitted.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#FF7306] pt-3 flex items-center gap-1">
                    Use template <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>

                <button
                  onClick={() => handleFinish({ type: 'template', templateId: 'webhook-to-sheets' })}
                  disabled={isFinishing}
                  className="p-4 rounded-xl border border-border hover:border-[#FF7306]/50 bg-surface-elevated/40 hover:bg-surface-elevated text-left transition-all duration-150 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-text-tertiary font-mono">→</span>
                      <div className="w-8 h-8 rounded-lg bg-[#34A853]/15 flex items-center justify-center p-1.5">
                        <GoogleSheetsIcon size={18} />
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors">
                      Webhook to Google Sheets
                    </h4>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Ingest external payloads and append rows into Google Sheets with auto-schema.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#FF7306] pt-3 flex items-center gap-1">
                    Use template <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>

                <button
                  onClick={() => handleFinish({ type: 'template', templateId: 'scheduled-gmail-digest' })}
                  disabled={isFinishing}
                  className="p-4 rounded-xl border border-border hover:border-[#FF7306]/50 bg-surface-elevated/40 hover:bg-surface-elevated text-left transition-all duration-150 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#EA4335]/15 flex items-center justify-center p-1.5">
                      <GmailIcon size={18} />
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors">
                      Scheduled Gmail Alert
                    </h4>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Send scheduled reports, summaries, or recurring reminders via Gmail.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-[#FF7306] pt-3 flex items-center gap-1">
                    Use template <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>

                <button
                  onClick={() => handleFinish({ type: 'blank' })}
                  disabled={isFinishing}
                  className="p-4 rounded-xl border border-dashed border-border hover:border-[#FF7306] bg-surface/40 hover:bg-surface-elevated text-left transition-all duration-150 flex flex-col justify-between group"
                >
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FF7306]/15 text-[#FF7306] flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary group-hover:text-[#FF7306] transition-colors">
                      Blank Canvas
                    </h4>
                    <p className="text-[11px] text-text-secondary leading-relaxed">
                      Start from scratch with a manual trigger and build your custom pipeline.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-text-secondary group-hover:text-[#FF7306] pt-3 flex items-center gap-1">
                    Create blank <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-border bg-surface-elevated/40 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as any)}
              className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as any)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF7306] hover:bg-[#FF7306]/90 text-white font-semibold text-xs transition-colors shadow-lg shadow-[#FF7306]/20"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => handleFinish({ type: 'blank' })}
              disabled={isFinishing}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FF7306] hover:bg-[#FF7306]/90 text-white font-semibold text-xs transition-colors shadow-lg shadow-[#FF7306]/20 disabled:opacity-50"
            >
              {isFinishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching...
                </>
              ) : (
                'Open Dashboard'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
