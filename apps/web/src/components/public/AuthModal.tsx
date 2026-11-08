import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../api/client.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'signin' | 'signup' | 'forgot';
  defaultTab?: 'signin' | 'signup' | 'forgot';
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialTab,
  defaultTab,
  onSuccess,
}: AuthModalProps) {
  const { login, signup, loginWithGoogleIdToken, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(
    defaultTab || initialTab || 'signin'
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Close modal when authentication succeeds
  React.useEffect(() => {
    if (isAuthenticated && isOpen) {
      onSuccess?.();
      onClose();
    }
  }, [isAuthenticated, isOpen, onSuccess, onClose]);

  // Load Google Identity Services client script and initialize
  React.useEffect(() => {
    if (!isOpen || (tab !== 'signin' && tab !== 'signup')) return;

    const handleCredentialResponse = async (response: any) => {
      if (response?.credential) {
        try {
          setLoading(true);
          setError(null);
          await loginWithGoogleIdToken(response.credential);
          onSuccess?.();
          onClose();
        } catch (err: any) {
          setError(err?.message || 'Google sign-in failed');
        } finally {
          setLoading(false);
        }
      }
    };

    if ((window as any).google?.accounts?.id) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: '1060878318083-c9u9herp7lt0jkdhssgl4r97m90rjg9v.apps.googleusercontent.com',
          callback: handleCredentialResponse,
        });
      } catch {}
    }

    const scriptId = 'google-identity-services';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        try {
          (window as any).google?.accounts?.id?.initialize({
            client_id: '1060878318083-c9u9herp7lt0jkdhssgl4r97m90rjg9v.apps.googleusercontent.com',
            callback: handleCredentialResponse,
          });
        } catch {}
      };
      document.body.appendChild(script);
    }
  }, [isOpen, tab, loginWithGoogleIdToken, onSuccess, onClose]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const width = 520;
    const height = 640;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open popup synchronously on user gesture to prevent browser delays/blockers
    const popup = window.open(
      'about:blank',
      'vulp_google_signin',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );

    try {
      const data = await api.getGoogleSignInAuthUrl(window.location.origin);
      if (popup && !popup.closed) {
        popup.location.href = data.url;
      } else {
        window.location.href = data.url;
      }
    } catch (err: any) {
      if (popup && !popup.closed) popup.close();
      setError(err?.message || 'Failed to start Google sign-in');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (tab === 'signin') {
        await login({ email, password });
        onSuccess?.();
        onClose();
      } else if (tab === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        await signup({ email, password, name });
        onSuccess?.();
        onClose();
      } else if (tab === 'forgot') {
        const res = await api.forgotPassword(email);
        setSuccessMessage(res.message);
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setTab('reset');
        }
      } else if (tab === 'reset') {
        const res = await api.resetPassword(resetToken, newPassword);
        setSuccessMessage(res.message);
        setTimeout(() => setTab('signin'), 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication operation failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-7 flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-1.5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#FF7306]/10 border border-[#FF7306]/20 flex items-center justify-center text-[#FF7306] mx-auto font-bold text-lg">
            V
          </div>
          <h3 className="text-xl font-bold text-text-primary tracking-tight">
            {tab === 'signin' && 'Sign in to VULP'}
            {tab === 'signup' && 'Create your account'}
            {tab === 'forgot' && 'Reset your password'}
            {tab === 'reset' && 'Set new password'}
          </h3>
          <p className="text-xs text-text-secondary">
            {tab === 'signin' && 'Access your private workspace and automated workflows'}
            {tab === 'signup' && 'Get started free with unlimited workflows and zero setup'}
            {tab === 'forgot' && 'Enter your email to receive recovery instructions'}
            {tab === 'reset' && 'Enter your new password to regain access'}
          </p>
        </div>

        {/* Tab Switcher for Sign In / Sign Up */}
        {(tab === 'signin' || tab === 'signup') && (
          <div className="flex p-1 bg-surface-elevated rounded-xl border border-border mb-5">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'signin'
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                tab === 'signup'
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Sign Up Free
            </button>
          </div>
        )}

        {/* Alert Messages */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 mb-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Continue with Google */}
        {(tab === 'signin' || tab === 'signup') && (
          <div className="space-y-4 mb-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-semibold border border-neutral-300 transition-all shadow-sm active:scale-[0.99] disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{tab === 'signup' ? 'Sign up with Google' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-border"></div>
              <span className="absolute px-3 bg-surface text-[10px] uppercase font-bold text-text-tertiary tracking-wider">
                or continue with email
              </span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  required
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface-elevated/40 border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306] transition-colors"
                />
              </div>
            </div>
          )}

          {(tab === 'signin' || tab === 'signup' || tab === 'forgot') && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface-elevated/40 border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306] transition-colors"
                />
              </div>
            </div>
          )}

          {(tab === 'signin' || tab === 'signup') && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-text-secondary">Password</label>
                {tab === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setTab('forgot');
                      setError(null);
                    }}
                    className="text-[11px] text-[#FF7306] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-elevated/40 border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {tab === 'reset' && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="password"
                  required
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-surface-elevated/40 border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-[#FF7306] transition-colors"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#FF7306] hover:bg-[#FF7306]/90 text-white font-semibold text-xs shadow-lg shadow-[#FF7306]/20 transition-all duration-150 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...
              </>
            ) : (
              <>
                {tab === 'signin' && 'Sign In'}
                {tab === 'signup' && 'Create Account'}
                {tab === 'forgot' && 'Send Recovery Instructions'}
                {tab === 'reset' && 'Reset Password'}
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Back Link for Forgot / Reset */}
        {(tab === 'forgot' || tab === 'reset') && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setError(null);
              }}
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              ← Back to Sign In
            </button>
          </div>
        )}

        {/* Footer Security Note */}
        <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-center gap-2 text-[11px] text-text-tertiary">
          <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
          <span>Server-side tenant isolation & AES-256-GCM encryption</span>
        </div>
      </div>
    </div>
  );
}

