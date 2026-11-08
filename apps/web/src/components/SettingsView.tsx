import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Moon,
  ShieldCheck,
  Bell,
  Sliders,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { ThemeSelector } from './ThemeSelector.js';

interface SettingsViewProps {
  onBack: () => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Australia/Sydney',
];

export function SettingsView({ onBack }: SettingsViewProps) {
  // Local preferences backed by localStorage
  const [timezone, setTimezone] = useState(() => {
    return localStorage.getItem('vulp_user_timezone') || 'UTC';
  });

  const [errorPolicy, setErrorPolicy] = useState(() => {
    return localStorage.getItem('vulp_default_error_policy') || 'stop';
  });

  const [timeoutSec, setTimeoutSec] = useState(() => {
    return localStorage.getItem('vulp_default_timeout_sec') || '30';
  });

  const [notifyFailures, setNotifyFailures] = useState(() => {
    return localStorage.getItem('vulp_notify_failures') !== 'false';
  });

  const [notifyExpired, setNotifyExpired] = useState(() => {
    return localStorage.getItem('vulp_notify_expired') !== 'false';
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePreferences = () => {
    localStorage.setItem('vulp_user_timezone', timezone);
    localStorage.setItem('vulp_default_error_policy', errorPolicy);
    localStorage.setItem('vulp_default_timeout_sec', timeoutSec);
    localStorage.setItem('vulp_notify_failures', String(notifyFailures));
    localStorage.setItem('vulp_notify_expired', String(notifyExpired));
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex-1 bg-background flex flex-col h-full overflow-hidden font-sans select-none">
      {/* Header */}
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
              <SettingsIcon className="w-4 h-4 text-text-secondary" />
              <h1 className="text-xl font-bold text-text-primary tracking-tight">Settings</h1>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Workspace configuration, defaults, and security policies
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSavePreferences}
          className="px-5 py-2 rounded-full bg-text-primary hover:opacity-90 text-background text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
        >
          {savedSuccess ? 'Saved Preferences' : 'Save Changes'}
        </button>
      </header>

      {/* Main Settings Sections */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {savedSuccess && (
            <div className="p-3.5 rounded-[16px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Workspace preferences successfully saved.</span>
            </div>
          )}

          {/* 1. General Preferences */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
              <Moon className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text-primary">General Preferences</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Appearance / Theme */}
              <div className="space-y-1.5">
                <label className="font-semibold text-text-secondary block">
                  Interface Theme
                </label>
                <p className="text-[11px] text-text-muted leading-relaxed mb-2">
                  Achromatic Dark mode is tailored for high focus. Light and System modes are fully supported.
                </p>
                <ThemeSelector />
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <label className="font-semibold text-text-secondary block">
                  Default Timezone
                </label>
                <p className="text-[11px] text-text-muted leading-relaxed mb-2">
                  Used for schedule triggers, date formatting, and execution timeline timestamps.
                </p>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Automation Defaults */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
              <Sliders className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text-primary">Automation Defaults</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
              {/* Error Policy */}
              <div className="space-y-1.5">
                <label className="font-semibold text-text-secondary block">
                  Default Error Handling
                </label>
                <p className="text-[11px] text-text-muted leading-relaxed mb-2">
                  Controls step failure behavior when no node-specific policy is set.
                </p>
                <select
                  value={errorPolicy}
                  onChange={(e) => setErrorPolicy(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                >
                  <option value="stop">Stop automation immediately on failure</option>
                  <option value="continue">Continue downstream execution</option>
                </select>
              </div>

              {/* Timeout */}
              <div className="space-y-1.5">
                <label className="font-semibold text-text-secondary block">
                  HTTP Step Timeout
                </label>
                <p className="text-[11px] text-text-muted leading-relaxed mb-2">
                  Maximum execution window for outbound webhook &amp; REST requests.
                </p>
                <select
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-full bg-surface-secondary border border-border text-text-primary focus:outline-none transition-colors"
                >
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds (Recommended)</option>
                  <option value="60">60 seconds</option>
                  <option value="120">120 seconds</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Notifications */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
              <Bell className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-bold text-text-primary">Notifications &amp; Alerts</h2>
            </div>

            <div className="space-y-4 text-xs">
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-secondary border border-border cursor-pointer">
                <div>
                  <div className="font-semibold text-text-primary">Execution Failure Alerts</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Highlight failed automations prominently on the Overview dashboard.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyFailures}
                  onChange={(e) => setNotifyFailures(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF7306] bg-surface border-border focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-secondary border border-border cursor-pointer">
                <div>
                  <div className="font-semibold text-text-primary">Expired Connection Warnings</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Alert when OAuth access tokens expire or require user reconnection.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={notifyExpired}
                  onChange={(e) => setNotifyExpired(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FF7306] bg-surface border-border focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 4. Security & Cryptographic Vault */}
          <div className="p-6 rounded-[24px] bg-surface border border-border space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 pb-3 border-b border-border-subtle">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-text-primary">Security &amp; Encryption</h2>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-surface-secondary border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-text-primary block">AES-256-GCM Vault</span>
                    <span className="text-[11px] text-text-muted">Master Key verified active</span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Secured
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-surface-secondary border border-border flex items-start gap-3 text-text-muted">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Plaintext secrets are never stored on disk or transmitted to the client. Tokens and passwords are decrypted in-memory only during step execution and immediately scrubbed from engine logs.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
