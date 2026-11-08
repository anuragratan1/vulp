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
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialTab = 'signin',
  onSuccess,
}: AuthModalProps) {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(initialTab);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
