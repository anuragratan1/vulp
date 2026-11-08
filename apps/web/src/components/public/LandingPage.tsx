import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Workflow,
  CheckCircle2,
  Play,
  Terminal,
} from 'lucide-react';
import { PublicNavbar } from './PublicNavbar.js';
import { PublicFooter } from './PublicFooter.js';
import { AuthModal } from './AuthModal.js';
import { FeaturesPage } from './FeaturesPage.js';
import { IntegrationsPage } from './IntegrationsPage.js';
import { AboutPage } from './AboutPage.js';
import { ContactPage } from './ContactPage.js';
import { PrivacyPolicyPage } from './PrivacyPolicyPage.js';
import { TermsOfServicePage } from './TermsOfServicePage.js';
import { CookiePolicyPage } from './CookiePolicyPage.js';

interface LandingPageProps {
  onEnterApp: () => void;
}

export function LandingPage({ onEnterApp }: LandingPageProps) {
  const [currentView, setCurrentView] = useState<
    'home' | 'features' | 'integrations' | 'templates' | 'about' | 'contact' | 'privacy' | 'terms' | 'cookies'
  >('home');

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signup');

  // Interactive demo pipeline active node
  const [activeDemoStep, setActiveDemoStep] = useState<number>(1);

  const openAuth = (tab: 'signin' | 'signup') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  if (currentView === 'features') {
    return (
      <div>
        <PublicNavbar currentPath="features" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <FeaturesPage onBack={() => setCurrentView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  if (currentView === 'integrations') {
    return (
      <div>
        <PublicNavbar currentPath="integrations" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <IntegrationsPage onBack={() => setCurrentView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  if (currentView === 'about') {
    return (
      <div>
        <PublicNavbar currentPath="about" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <AboutPage onBack={() => setCurrentView('home')} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  if (currentView === 'contact') {
    return (
      <div>
        <PublicNavbar currentPath="contact" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <ContactPage onBack={() => setCurrentView('home')} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  if (currentView === 'privacy') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <PrivacyPolicyPage onBack={() => setCurrentView('home')} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  if (currentView === 'terms') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <TermsOfServicePage onBack={() => setCurrentView('home')} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  if (currentView === 'cookies') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />
        <CookiePolicyPage onBack={() => setCurrentView('home')} />
        <PublicFooter onNavigate={setCurrentView as any} />
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
          onSuccess={onEnterApp}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <PublicNavbar currentPath="home" onNavigate={setCurrentView as any} onOpenAuth={openAuth} />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-24 md:pt-32 md:pb-36 border-b border-border/80">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(255,115,6,0.15),rgba(255,255,255,0))]" />

        <div className="relative max-w-5xl mx-auto px-6 text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-elevated border border-border shadow-sm text-xs font-semibold text-text-secondary">
            <span className="flex h-2 w-2 rounded-full bg-[#FF7306] animate-pulse" />
            <span>Autonomous Visual Automation Platform</span>
            <span className="text-[#FF7306]">•</span>
            <span className="text-text-primary">Cloudflare Edge Engine</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-text-primary leading-[1.08]">
            Automate workflows at the speed of the <span className="text-[#FF7306]">global edge</span>.
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed font-normal">
            A high-velocity visual DAG orchestration platform. Connect Google Workspace, Telegram, Slack, and Webhooks
            with zero cold starts, intelligent semantic auto-mapping, and AES-256 encrypted tenant isolation.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => openAuth('signup')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-[#FF7306] hover:bg-[#FF7306]/90 text-white font-semibold text-sm shadow-xl shadow-[#FF7306]/25 transition-all duration-150 hover:scale-[1.02]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onEnterApp}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-surface-elevated hover:bg-surface-hover text-text-primary font-semibold text-sm border border-border shadow-sm transition-colors"
            >
              <Play className="w-4 h-4 text-[#FF7306]" />
              <span>Launch Studio Canvas</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-6 pt-6 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Free Tier Forever
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" /> AES-256 Galois Encryption
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-green-500" /> Sub-ms Edge Dispatch
            </span>
          </div>
        </div>
      </section>

      {/* Interactive Workflow Canvas Simulation */}
      <section className="py-20 px-6 max-w-6xl mx-auto border-b border-border">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Visual Directed Acyclic Graph (DAG) Execution
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-xl mx-auto">
            Click any node below to inspect real-time variable resolution, payload flows, and execution logs.
          </p>
        </div>

        {/* Pipeline Preview Window */}
        <div className="rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden">
          {/* Header Bar */}
          <div className="p-4 border-b border-border bg-surface-elevated/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/40" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                <span className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/40" />
              </div>
              <span className="text-xs font-semibold text-text-secondary ml-3">
                Pipeline: Google Forms Lead Ingestion → Telegram Broadcast → Sheets Append
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 text-[11px] font-semibold border border-green-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Succeeded (24ms)
              </span>
            </div>
          </div>

          {/* Interactive DAG Nodes */}
          <div className="p-8 md:p-12 bg-surface-elevated/20 grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Step 1: Trigger */}
            <div
              onClick={() => setActiveDemoStep(1)}
              className={`cursor-pointer p-5 rounded-2xl border transition-all duration-200 ${
                activeDemoStep === 1
                  ? 'border-[#FF7306] bg-surface-elevated shadow-lg shadow-[#FF7306]/10 scale-[1.02]'
                  : 'border-border bg-surface/80 hover:bg-surface-elevated'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  Trigger
                </span>
                <span className="text-[11px] font-mono text-green-400">0ms</span>
              </div>
              <h4 className="text-sm font-bold text-text-primary mb-1">Google Forms Submission</h4>
              <p className="text-[11px] text-text-secondary mb-3">
                Captures incoming responder data and questions in real time.
              </p>
              <div className="text-[10px] font-mono p-2 rounded-lg bg-surface border border-border text-text-tertiary truncate">
                formId: "1FAIpQLSc..."
              </div>
            </div>

            {/* Step 2: Transform / Action */}
            <div
              onClick={() => setActiveDemoStep(2)}
              className={`cursor-pointer p-5 rounded-2xl border transition-all duration-200 ${
                activeDemoStep === 2
                  ? 'border-[#FF7306] bg-surface-elevated shadow-lg shadow-[#FF7306]/10 scale-[1.02]'
                  : 'border-border bg-surface/80 hover:bg-surface-elevated'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                  Action
                </span>
                <span className="text-[11px] font-mono text-green-400">14ms</span>
              </div>
              <h4 className="text-sm font-bold text-text-primary mb-1">Telegram Broadcast</h4>
              <p className="text-[11px] text-text-secondary mb-3">
                Interpolates responder name and sends immediate alert card.
              </p>
              <div className="text-[10px] font-mono p-2 rounded-lg bg-surface border border-border text-text-tertiary truncate">
                text: "🚀 New Lead: &#123;&#123;name&#125;&#125;"
              </div>
            </div>

            {/* Step 3: Persistence */}
            <div
              onClick={() => setActiveDemoStep(3)}
              className={`cursor-pointer p-5 rounded-2xl border transition-all duration-200 ${
                activeDemoStep === 3
                  ? 'border-[#FF7306] bg-surface-elevated shadow-lg shadow-[#FF7306]/10 scale-[1.02]'
                  : 'border-border bg-surface/80 hover:bg-surface-elevated'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                  Persistence
                </span>
                <span className="text-[11px] font-mono text-green-400">10ms</span>
              </div>
              <h4 className="text-sm font-bold text-text-primary mb-1">Google Sheets Append</h4>
              <p className="text-[11px] text-text-secondary mb-3">
                Appends row into active sheet matching discovered header schema.
              </p>
              <div className="text-[10px] font-mono p-2 rounded-lg bg-surface border border-border text-text-tertiary truncate">
                spreadsheet: "Q4 Leads CRM"
              </div>
            </div>
          </div>

          {/* Interactive Inspection Terminal Panel */}
          <div className="p-6 border-t border-border bg-surface/90 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-text-tertiary text-[11px]">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#FF7306]" />
                Step Inspector Telemetry (Node {activeDemoStep} of 3)
              </span>
              <span className="text-green-400">Status: Succeeded</span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-border/80 text-[11px] text-text-secondary leading-relaxed overflow-x-auto">
              {activeDemoStep === 1 && (
                <div>
                  <span className="text-purple-400 font-bold">[Trigger Event: Google Forms]</span> Payload verified
                  <br />
                  &gt; Timestamp: {new Date().toISOString()}
                  <br />
                  &gt; Responder: "sarah.connor@cyberdyne.org"
                  <br />
                  &gt; Questions: ["Company Name", "Estimated Budget", "Project Description"]
                  <br />
                  &gt; Output: &#123; "name": "Sarah Connor", "budget": "$25,000", "urgency": "High" &#125;
                </div>
              )}

              {activeDemoStep === 2 && (
                <div>
                  <span className="text-blue-400 font-bold">[Action: Telegram Bot]</span> Dispatching message via API
                  <br />
                  &gt; Credential ID: "cred_vault_encrypted_aes256"
                  <br />
                  &gt; Target Chat: "-10023498234 (Lead Notifications Channel)"
                  <br />
                  &gt; Interpolated Body: "🔔 New Inbound Lead!\n• Name: Sarah Connor\n• Budget: $25,000"
                  <br />
                  &gt; HTTP Response: 200 OK (Telegram API message_id: 8492)
                </div>
              )}

              {activeDemoStep === 3 && (
                <div>
                  <span className="text-green-400 font-bold">[Action: Google Sheets]</span> Appending row values
                  <br />
                  &gt; Target Spreadsheet: "Q4 Leads CRM" (Sheet1)
                  <br />
                  &gt; Headers Auto-Mapped: ["Timestamp", "Lead Name", "Email", "Budget", "Status"]
                  <br />
                  &gt; Appended Row Index: 42
                  <br />
                  &gt; Execution Finished: DAG completed in 24ms total duration.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-20 px-6 max-w-6xl mx-auto border-b border-border">
        <div className="text-center space-y-3 mb-14">
          <h2 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Architected for Mission-Critical Workflows
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-xl mx-auto">
            Everything you need to orchestrate complex operations with zero maintenance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-border bg-surface-elevated/40 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-[#FF7306] flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Sub-Millisecond Edge Dispatch</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Executes on Cloudflare Workers edge nodes across 300+ cities globally with zero container spin-up lag.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface-elevated/40 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Zero-Leak Multi-Tenant Vault</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Every token is encrypted at rest using AES-256-GCM. Strict foreign key checks enforce private workspace boundaries.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-border bg-surface-elevated/40 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Workflow className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-text-primary">Intelligent Auto-Mapping</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Dynamic schema discovery maps questions and nested JSON keys straight into Google Sheets, Slack, and Gmail.
            </p>
          </div>
        </div>
      </section>

      {/* Transparent Pricing Section */}
      <section className="py-20 px-6 max-w-5xl mx-auto border-b border-border">
        <div className="text-center space-y-3 mb-14">
          <h2 className="text-3xl font-extrabold text-text-primary tracking-tight">
            Simple, Transparent Free Tier
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
            Free forever for individuals and small teams. No credit card required.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Free Tier */}
          <div className="p-8 rounded-3xl border-2 border-[#FF7306] bg-surface-elevated/60 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#FF7306] bg-[#FF7306]/10 px-3 py-1 rounded-full border border-[#FF7306]/20">
                  Starter Plan
                </span>
                <span className="text-xs font-semibold text-green-400">Current Offering</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-text-primary">$0</span>
                <span className="text-xs text-text-secondary">/ forever</span>
              </div>
              <p className="text-xs text-text-secondary">
                Everything required to automate your business processes and APIs.
              </p>

              <ul className="space-y-2.5 text-xs text-text-secondary pt-4 border-t border-border">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>Unlimited Workflow Canvases</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>10,000 Executions per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>Official Google OAuth (Gmail, Drive, Sheets, Forms)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>Telegram Bot & Slack Webhook integration</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span>AES-256 Galois encrypted private vault</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => openAuth('signup')}
              className="w-full py-3 rounded-full bg-[#FF7306] hover:bg-[#FF7306]/90 text-white font-semibold text-xs shadow-lg shadow-[#FF7306]/20 transition-colors"
            >
              Sign Up Free
            </button>
          </div>

          {/* Pro Cloud Tier (Coming Soon) */}
          <div className="p-8 rounded-3xl border border-border bg-surface/40 flex flex-col justify-between space-y-6 opacity-85">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary bg-surface-elevated px-3 py-1 rounded-full border border-border">
                  Pro Cloud
                </span>
                <span className="text-xs font-semibold text-text-tertiary">Coming Q1 2027</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-text-primary">$29</span>
                <span className="text-xs text-text-secondary">/ month</span>
              </div>
              <p className="text-xs text-text-secondary">
                For high-volume production operations and enterprise pipelines.
              </p>

              <ul className="space-y-2.5 text-xs text-text-secondary pt-4 border-t border-border">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-text-tertiary shrink-0" />
                  <span>500,000 Executions per month</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-text-tertiary shrink-0" />
                  <span>1-second cron precision triggers</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-text-tertiary shrink-0" />
                  <span>Dedicated Cloudflare execution queues</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-text-tertiary shrink-0" />
                  <span>Custom webhook domains & team role-based access</span>
                </li>
              </ul>
            </div>

            <button
              disabled
              className="w-full py-3 rounded-full bg-surface-elevated text-text-tertiary font-semibold text-xs border border-border cursor-not-allowed"
            >
              Join Pro Waitlist
            </button>
          </div>
        </div>
      </section>

      {/* Google API User Data Policy Compliance Banner */}
      <section className="py-12 px-6 max-w-4xl mx-auto">
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated/30 flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-green-400 shrink-0 mt-1" />
          <div className="space-y-1.5 text-xs text-text-secondary leading-relaxed">
            <h4 className="font-bold text-text-primary text-sm">Google API User Data Policy Compliance</h4>
            <p>
              VULP adheres strictly to the Google API Services User Data Policy, including the Limited Use requirements.
              Data received from Google APIs is never transferred to third parties, used for serving advertisements,
              or utilized for training AI/ML models. You retain full control to revoke credentials or delete your account at any time.
            </p>
            <button
              onClick={() => setCurrentView('privacy')}
              className="text-[#FF7306] font-semibold hover:underline inline-block pt-1"
            >
              Read our full Privacy Policy →
            </button>
          </div>
        </div>
      </section>

      <PublicFooter onNavigate={setCurrentView as any} />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
        onSuccess={onEnterApp}
      />
    </div>
  );
}
