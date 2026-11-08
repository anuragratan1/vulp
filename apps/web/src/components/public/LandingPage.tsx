import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Play,
  Terminal,
  GitBranch,
  Lock,
  Globe,
  Mail,
  Table,
  Send,
  MessageSquare,
  Sliders,
} from 'lucide-react';
import { PublicNavbar } from './PublicNavbar.js';
import { PublicFooter } from './PublicFooter.js';
import { AuthModal } from './AuthModal.js';
import { FeaturesPage } from './FeaturesPage.js';
import { IntegrationsPage } from './IntegrationsPage.js';
import { TemplatesPage } from './TemplatesPage.js';
import { DocumentationPage } from './DocumentationPage.js';
import { SecurityPage } from './SecurityPage.js';
import { AboutPage } from './AboutPage.js';
import { ContactPage } from './ContactPage.js';
import { PrivacyPolicyPage } from './PrivacyPolicyPage.js';
import { TermsOfServicePage } from './TermsOfServicePage.js';
import { CookiePolicyPage } from './CookiePolicyPage.js';
import { FaqPage } from './FaqPage.js';
import { useAuth } from '../../context/AuthContext.js';

interface LandingPageProps {
  onEnterApp: () => void;
  initialPath?: string;
  autoOpenAuth?: 'signin' | 'signup' | null;
}

export function LandingPage({ onEnterApp, initialPath = 'home', autoOpenAuth = null }: LandingPageProps) {
  const { isAuthenticated } = useAuth();
  const [currentView, setCurrentView] = useState<
    'home' | 'features' | 'integrations' | 'templates' | 'docs' | 'security' | 'about' | 'contact' | 'privacy' | 'terms' | 'cookies' | 'faq'
  >(() => {
    const clean = initialPath.replace(/^\/+/, '');
    if (
      [
        'features',
        'integrations',
        'templates',
        'docs',
        'security',
        'about',
        'contact',
        'privacy',
        'terms',
        'cookies',
        'faq',
      ].includes(clean)
    ) {
      return clean as any;
    }
    return 'home';
  });

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(Boolean(autoOpenAuth));
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>(autoOpenAuth || 'signup');

  // Interactive Live DAG Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSimStep, setActiveSimStep] = useState<number>(0);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string>('webhook');

  const openAuth = (tab: 'signin' | 'signup') => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  const handleNavigateView = (view: any) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      const path = view === 'home' ? '/' : `/${view}`;
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (autoOpenAuth) {
      setAuthModalTab(autoOpenAuth);
      setAuthModalOpen(true);
    }
  }, [autoOpenAuth]);

  // Simulation step timer
  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setActiveSimStep(1);

    setTimeout(() => setActiveSimStep(2), 700);
    setTimeout(() => setActiveSimStep(3), 1500);
    setTimeout(() => setActiveSimStep(4), 2300);
    setTimeout(() => setActiveSimStep(5), 3100);
    setTimeout(() => {
      setIsSimulating(false);
      setActiveSimStep(5);
    }, 3900);
  };

  // Node data for simulation inspector
  const simNodes: Record<string, { title: string; type: string; timing: string; output: string }> = {
    webhook: {
      title: 'Inbound Customer Webhook',
      type: 'webhook.trigger (POST /hook/signup-lead)',
      timing: '4ms execution',
      output: JSON.stringify(
        {
          event: 'lead_captured',
          customer: { name: 'Elena Rostova', email: 'elena@acme-corp.io', plan: 'Enterprise' },
          tier: 'high-priority',
          score: 9.4,
        },
        null,
        2
      ),
    },
    transform: {
      title: 'Semantic Data Parser',
      type: 'transform.expression',
      timing: '6ms execution',
      output: JSON.stringify(
        {
          crmRowValues: ['Elena Rostova', 'elena@acme-corp.io', 'Enterprise', '$9.4k ARR', 'Inbound Web'],
          priorityAlert: true,
          alertMessage: '🚨 New Enterprise Lead: Elena Rostova (elena@acme-corp.io)',
        },
        null,
        2
      ),
    },
    sheets: {
      title: 'Google Sheets CRM Log',
      type: 'sheets.appendRow',
      timing: '18ms execution',
      output: JSON.stringify(
        {
          spreadsheetId: '1b8K...942',
          updatedRange: 'Sheet1!A14:E14',
          appendedValues: 1,
          status: 'SUCCESS',
        },
        null,
        2
      ),
    },
    telegram: {
      title: 'Telegram DevOps Broadcast',
      type: 'telegram.sendMessage',
      timing: '14ms execution',
      output: JSON.stringify(
        {
          chatId: '-100849182',
          messageId: 4819,
          sentText: '🚨 New Enterprise Lead: Elena Rostova',
          status: 'DELIVERED',
        },
        null,
        2
      ),
    },
    gmail: {
      title: 'Gmail Welcome Receipt',
      type: 'gmail.send',
      timing: '22ms execution',
      output: JSON.stringify(
        {
          recipient: 'elena@acme-corp.io',
          subject: 'Welcome to VULP Enterprise Trial',
          threadId: '18bfa9102c81',
          status: 'SENT',
        },
        null,
        2
      ),
    },
  };

  // Dedicated subpage rendering router
  if (currentView === 'features') {
    return (
      <div>
        <PublicNavbar currentPath="features" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <FeaturesPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'integrations') {
    return (
      <div>
        <PublicNavbar currentPath="integrations" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <IntegrationsPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'templates') {
    return (
      <div>
        <PublicNavbar currentPath="templates" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <TemplatesPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'docs') {
    return (
      <div>
        <PublicNavbar currentPath="docs" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <DocumentationPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'security') {
    return (
      <div>
        <PublicNavbar currentPath="security" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <SecurityPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'about') {
    return (
      <div>
        <PublicNavbar currentPath="about" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <AboutPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'contact') {
    return (
      <div>
        <PublicNavbar currentPath="contact" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <ContactPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'privacy') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <PrivacyPolicyPage onBack={() => handleNavigateView('home')} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'terms') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <TermsOfServicePage onBack={() => handleNavigateView('home')} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'cookies') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <CookiePolicyPage onBack={() => handleNavigateView('home')} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  if (currentView === 'faq') {
    return (
      <div>
        <PublicNavbar currentPath="" onNavigate={handleNavigateView} onOpenAuth={openAuth} />
        <FaqPage onBack={() => handleNavigateView('home')} onOpenAuth={openAuth} />
        <PublicFooter onNavigate={handleNavigateView} />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultTab={authModalTab} onSuccess={onEnterApp} />
      </div>
    );
  }

  // =========================================================================
  // GRAND HOMEPAGE VIEW
  // =========================================================================
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <PublicNavbar currentPath="home" onNavigate={handleNavigateView} onOpenAuth={openAuth} />

      {/* --------------------------------------------------------------------- */}
      {/* 1. HERO SECTION */}
      {/* --------------------------------------------------------------------- */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28 border-b border-[#1E1E1E]">
        {/* Subtle radial background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,115,6,0.12),rgba(10,10,10,0))]" />

        <div className="relative max-w-6xl mx-auto px-6 text-center space-y-8">
          {/* Top Edge Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#242424] shadow-sm text-xs font-semibold text-[#A1A1AA] select-none">
            <span className="flex h-2 w-2 rounded-full bg-[#FF7306] animate-pulse" />
            <span>Autonomous DAG Orchestration</span>
            <span className="text-[#52525B]">•</span>
            <span className="text-white">Cloudflare Edge Engine</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-[-0.035em] text-white leading-[1.06] max-w-4xl mx-auto">
            Automate workflows at the speed of the <span className="text-[#FF7306]">global edge</span>.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-[#A1A1AA] max-w-2xl mx-auto leading-relaxed font-normal">
            A high-velocity visual DAG automation engine. Connect Google Workspace, Telegram, Slack, and webhooks with zero cold starts, intelligent semantic variable auto-mapping, and AES-256 encrypted tenant isolation.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <button
              onClick={() => openAuth('signup')}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-sm shadow-xl shadow-[#FF7306]/25 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                if (isAuthenticated) {
                  onEnterApp();
                } else {
                  openAuth('signin');
                }
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-[#161616] hover:bg-[#202020] text-white font-semibold text-sm border border-[#2A2A2A] shadow-sm transition-colors"
            >
              <Play className="w-4 h-4 text-[#FF7306]" />
              <span>Launch Studio Canvas</span>
            </button>
          </div>

          {/* Value Proof Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-mono text-[#71717A]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Free Tier Forever
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> AES-256 Galois Encryption
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" /> Sub-ms Edge Dispatch
            </span>
          </div>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* INTERACTIVE LIVE DAG CANVASS SIMULATOR */}
        {/* ------------------------------------------------------------------- */}
        <div className="max-w-6xl mx-auto px-6 pt-16">
          <div className="rounded-3xl bg-[#111111] border border-[#242424] shadow-2xl overflow-hidden">
            {/* Window Chrome Header */}
            <div className="px-6 py-4 border-b border-[#202020] bg-[#141414] flex flex-wrap items-center justify-between gap-4 select-none">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
                <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
                <span className="text-xs font-mono text-[#A1A1AA] ml-2">vulp-canvas — Lead Ingestion & Dispatch DAG</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0A0A0A] border border-[#222222] text-[11px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>D1 Cluster Active</span>
                </div>

                <button
                  onClick={runSimulation}
                  disabled={isSimulating}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isSimulating
                      ? 'bg-[#222222] text-[#71717A] cursor-not-allowed'
                      : 'bg-[#FF7306] hover:bg-[#FF8A29] text-white shadow-md shadow-[#FF7306]/20 hover:scale-105 active:scale-95'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
                  <span>{isSimulating ? 'Simulating Run...' : 'Simulate DAG Execution'}</span>
                </button>
              </div>
            </div>

            {/* Visual Canvas Area */}
            <div className="p-6 md:p-10 bg-[#0C0C0C] relative min-h-[380px] flex flex-col justify-between overflow-x-auto">
              {/* Dot Grid Background */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(#FFFFFF 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Node Graph Layout */}
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 py-6 min-w-[700px]">
                {/* Node 1: Webhook Trigger */}
                <div
                  onClick={() => setSelectedNodeKey('webhook')}
                  className={`p-4 rounded-2xl bg-[#161616] border transition-all cursor-pointer w-48 shadow-lg ${
                    selectedNodeKey === 'webhook'
                      ? 'border-[#FF7306] ring-2 ring-[#FF7306]/20'
                      : 'border-[#262626] hover:border-[#383838]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#FF7306]/10 text-[#FF7306] flex items-center justify-center">
                        <Globe className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-white">Webhook</span>
                    </div>
                    {activeSimStep >= 1 ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/10 text-emerald-400 rounded">4ms</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#52525B]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] block font-mono">POST /hook/lead</span>
                  <span className="text-[10px] text-[#71717A] mt-1 block">Trigger Node</span>
                </div>

                <div className={`h-0.5 w-8 transition-colors ${activeSimStep >= 2 ? 'bg-emerald-400' : 'bg-[#262626]'}`} />

                {/* Node 2: Transform & Parse */}
                <div
                  onClick={() => setSelectedNodeKey('transform')}
                  className={`p-4 rounded-2xl bg-[#161616] border transition-all cursor-pointer w-48 shadow-lg ${
                    selectedNodeKey === 'transform'
                      ? 'border-[#FF7306] ring-2 ring-[#FF7306]/20'
                      : 'border-[#262626] hover:border-[#383838]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#A855F7]/10 text-[#A855F7] flex items-center justify-center">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-white">Parser</span>
                    </div>
                    {activeSimStep >= 2 ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/10 text-emerald-400 rounded">6ms</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#52525B]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] block font-mono">&#123;&#123; $json.score &#125;&#125;</span>
                  <span className="text-[10px] text-[#71717A] mt-1 block">Transform Node</span>
                </div>

                <div className={`h-0.5 w-8 transition-colors ${activeSimStep >= 3 ? 'bg-emerald-400' : 'bg-[#262626]'}`} />

                {/* Node 3: Google Sheets CRM */}
                <div
                  onClick={() => setSelectedNodeKey('sheets')}
                  className={`p-4 rounded-2xl bg-[#161616] border transition-all cursor-pointer w-48 shadow-lg ${
                    selectedNodeKey === 'sheets'
                      ? 'border-[#FF7306] ring-2 ring-[#FF7306]/20'
                      : 'border-[#262626] hover:border-[#383838]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#34A853]/10 text-[#34A853] flex items-center justify-center">
                        <Table className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-white">CRM Sheets</span>
                    </div>
                    {activeSimStep >= 3 ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/10 text-emerald-400 rounded">18ms</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#52525B]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] block font-mono">appendRow()</span>
                  <span className="text-[10px] text-[#71717A] mt-1 block">Google OAuth</span>
                </div>

                <div className={`h-0.5 w-8 transition-colors ${activeSimStep >= 4 ? 'bg-emerald-400' : 'bg-[#262626]'}`} />

                {/* Node 4: Telegram Alert */}
                <div
                  onClick={() => setSelectedNodeKey('telegram')}
                  className={`p-4 rounded-2xl bg-[#161616] border transition-all cursor-pointer w-48 shadow-lg ${
                    selectedNodeKey === 'telegram'
                      ? 'border-[#FF7306] ring-2 ring-[#FF7306]/20'
                      : 'border-[#262626] hover:border-[#383838]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#222222]">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#229ED9]/10 text-[#229ED9] flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </div>
                      <span className="text-[11px] font-bold text-white">Telegram</span>
                    </div>
                    {activeSimStep >= 4 ? (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono bg-emerald-500/10 text-emerald-400 rounded">14ms</span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#52525B]" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] block font-mono">sendMessage()</span>
                  <span className="text-[10px] text-[#71717A] mt-1 block">DevOps Channel</span>
                </div>
              </div>

              {/* Bottom Real-Time Telemetry Inspector */}
              <div className="mt-6 p-4 rounded-2xl bg-[#0A0A0A] border border-[#202020] relative z-10 flex flex-col md:flex-row items-start justify-between gap-4 font-mono text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{simNodes[selectedNodeKey].title}</span>
                    <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {simNodes[selectedNodeKey].timing}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#71717A] block">{simNodes[selectedNodeKey].type}</span>
                </div>

                <div className="w-full md:w-3/5 bg-[#121212] p-3 rounded-xl border border-[#242424] max-h-32 overflow-y-auto text-[#A1A1AA]">
                  <pre className="text-[11px] leading-tight text-emerald-300">
                    {simNodes[selectedNodeKey].output}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 2. THE THREE ARCHITECTURAL PILLARS */}
      {/* --------------------------------------------------------------------- */}
      <section className="py-24 border-b border-[#1E1E1E]">
        <div className="max-w-6xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Built differently from the ground up.
            </h2>
            <p className="text-sm text-[#A1A1AA] leading-relaxed">
              We eliminated container spin-up latencies, shared memory leaks, and proprietary lock-in.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-8 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#262626] flex items-center justify-center text-[#FF7306]">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Global Edge Execution</h3>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                Workflows run in stateless Cloudflare Workers V8 isolates across 300+ global locations. Incoming webhooks are answered in sub-milliseconds with zero VM boot time.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#52525B] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero cold starts guaranteed</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#262626] flex items-center justify-center text-emerald-400">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">AES-256-GCM Vault</h3>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                OAuth access tokens, refresh tokens, and bot secrets are encrypted using authenticated 256-bit Galois/Counter Mode cryptography. Your keys are safe even in storage.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#52525B] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Isolated per workspace</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all space-y-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#262626] flex items-center justify-center text-[#3B82F6]">
                <GitBranch className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">Strict Tenant Boundaries</h3>
              <p className="text-xs text-[#8E8E93] leading-relaxed">
                Workspaces are strictly isolated at the database and middleware layer. Every mutation and query validates tenant ownership with zero data co-mingling.
              </p>
              <div className="pt-2 text-[11px] font-mono text-[#52525B] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified in automated tests</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 3. SUPPORTED INTEGRATIONS DIRECTORY HIGHLIGHT */}
      {/* --------------------------------------------------------------------- */}
      <section className="py-24 border-b border-[#1E1E1E]">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Ecosystem</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Connect your business-critical tools.
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Connect through official Google OAuth 2.0 authorization codes and Telegram Bot tokens. Minimum scopes, transparent permissions.
              </p>
            </div>

            <button
              onClick={() => handleNavigateView('integrations')}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#FF7306] hover:text-[#FF8A29] transition-colors"
            >
              <span>Explore All Integrations</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { name: 'Gmail', icon: Mail, color: '#EA4335', action: 'Send RFC-2822' },
              { name: 'Google Sheets', icon: Table, color: '#34A853', action: 'Append & Query' },
              { name: 'Google Drive', icon: Globe, color: '#4285F4', action: 'Upload & Search' },
              { name: 'Telegram Bot', icon: Send, color: '#229ED9', action: 'Markdown Alerts' },
              { name: 'Slack API', icon: MessageSquare, color: '#4A154B', action: 'Channel Webhooks' },
              { name: 'HTTP REST', icon: Terminal, color: '#FF7306', action: 'Custom Egress' },
            ].map((app) => (
              <div
                key={app.name}
                onClick={() => handleNavigateView('integrations')}
                className="p-5 rounded-2xl bg-[#121212] border border-[#202020] hover:border-[#333333] cursor-pointer transition-all space-y-3 text-center group"
              >
                <div
                  className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center border group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${app.color}15`, borderColor: `${app.color}30`, color: app.color }}
                >
                  <app.icon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">{app.name}</span>
                  <span className="text-[10px] text-[#71717A] font-mono">{app.action}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 4. TEMPLATES & READY-TO-DEPLOY BLUEPRINTS */}
      {/* --------------------------------------------------------------------- */}
      <section className="py-24 border-b border-[#1E1E1E]">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Blueprints</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Start from battle-tested templates.
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
                Deploy complete multi-step automations to your personal workspace in a single click.
              </p>
            </div>

            <button
              onClick={() => handleNavigateView('templates')}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#FF7306] hover:text-[#FF8A29] transition-colors"
            >
              <span>View All 5 Templates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: 'Lead Capture → Sheets → Gmail',
                category: 'Sales & Marketing',
                desc: 'Captures webhook submissions, logs row to Google Sheets CRM, and sends instant personalized welcome email.',
                badge: '3 Steps',
              },
              {
                title: 'Form Submission → Telegram Alert',
                category: 'DevOps & Alerts',
                desc: 'Filters feedback by priority with condition logic and pings on-call engineers in Telegram instantly.',
                badge: 'Branching DAG',
              },
              {
                title: 'Weekday 9 AM Digest → Gmail',
                category: 'Productivity',
                desc: 'Runs on edge cron trigger Monday to Friday, compiles morning status, and delivers executive email briefing.',
                badge: 'Scheduled Cron',
              },
            ].map((tpl) => (
              <div
                key={tpl.title}
                onClick={() => handleNavigateView('templates')}
                className="p-7 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] cursor-pointer transition-all flex flex-col justify-between group shadow-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#FF7306] bg-[#FF7306]/10 px-2 py-0.5 rounded-full border border-[#FF7306]/20">
                      {tpl.category}
                    </span>
                    <span className="text-[11px] font-mono text-[#71717A]">{tpl.badge}</span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-[#FF7306] transition-colors">
                    {tpl.title}
                  </h3>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">{tpl.desc}</p>
                </div>

                <div className="pt-6 mt-4 border-t border-[#1C1C1C] flex items-center justify-between text-xs font-semibold text-white">
                  <span>Deploy Blueprint</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#FF7306] group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* 5. HIGH-IMPACT CLOSING CALL TO ACTION */}
      {/* --------------------------------------------------------------------- */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1C1C] via-[#141414] to-[#0A0A0A] border border-[#2E2E2E] p-10 sm:p-16 text-center space-y-8 shadow-2xl">
            <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#FF7306]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4 max-w-2xl mx-auto">
              <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Get Started Now</span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                Ready to orchestrate workflows at the global edge?
              </h2>
              <p className="text-sm sm:text-base text-[#A1A1AA] leading-relaxed">
                Create your private workspace in under 30 seconds. Connect Google Workspace and Telegram with zero setup friction.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                onClick={() => openAuth('signup')}
                className="w-full sm:w-auto px-9 py-4 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-sm shadow-xl shadow-[#FF7306]/30 transition-all hover:scale-105 active:scale-95"
              >
                Create Free Workspace
              </button>

              <button
                onClick={() => handleNavigateView('docs')}
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-[#181818] hover:bg-[#222222] text-white font-semibold text-sm border border-[#2E2E2E] transition-colors"
              >
                Read Documentation
              </button>
            </div>

            <div className="relative z-10 flex flex-wrap items-center justify-center gap-6 text-xs text-[#71717A] pt-4 font-mono">
              <span>✓ No credit card required</span>
              <span>✓ Unlimited active DAGs</span>
              <span>✓ Instant Google Sign-In</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter onNavigate={handleNavigateView} />

      {/* Auth Modal Trigger */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        defaultTab={authModalTab}
        onSuccess={onEnterApp}
      />
    </div>
  );
}
