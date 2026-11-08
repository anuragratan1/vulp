import { ArrowLeft, Cpu, Github } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function AboutPage({ onBack, onOpenAuth }: AboutPageProps) {
  const stack = [
    { name: 'Cloudflare Workers', role: 'Global Stateless Edge Runtime (Zero Cold Starts)' },
    { name: 'Cloudflare D1', role: 'Distributed Transactional SQLite Database with Tenant Isolation' },
    { name: 'React Flow', role: 'Interactive Visual DAG Node Canvas Engine' },
    { name: 'Web Crypto API', role: 'AES-256-GCM Hardware-Grade Credential Encryption' },
    { name: 'Google Identity Services', role: 'Cryptographically Verified Server-Side ID Tokens' },
    { name: 'TypeScript', role: 'End-to-End Type Safety across Engine, Worker, and Web' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-4xl mx-auto px-6 space-y-16">
        {/* Navigation Breadcrumb */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#FF7306] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {/* Title & Brand */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141414] border border-[#242424] text-xs font-mono text-[#FF7306]">
            <Cpu className="w-3.5 h-3.5" />
            <span>Engineering Philosophy</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
            Why we built <span className="text-[#FF7306]">VULP</span>.
          </h1>

          <p className="text-base sm:text-lg text-[#A1A1AA] leading-relaxed">
            Most automation platforms were engineered a decade ago for traditional servers. They suffer from multi-second container spin-up delays, arbitrary per-step paywalls, and opaque execution black boxes.
          </p>
        </div>

        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-7 rounded-3xl bg-[#121212] border border-[#202020] space-y-3">
            <h3 className="font-bold text-base text-white">Edge-First Architecture</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              By executing directly on Cloudflare Workers edge nodes across 300+ cities, workflows start in sub-milliseconds without container boot overhead or idle server costs.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-[#121212] border border-[#202020] space-y-3">
            <h3 className="font-bold text-base text-white">Full Observability & Diagnostics</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Every step execution records exact input arguments, output JSON, duration in milliseconds, and stderr logs. You never have to guess why a webhook failed.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-[#121212] border border-[#202020] space-y-3">
            <h3 className="font-bold text-base text-white">Hardware-Grade Cryptography</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              Credentials and OAuth tokens are protected by AES-256-GCM authenticated encryption. Tenant isolation is enforced at the database layer with cryptographic workspace tokens.
            </p>
          </div>

          <div className="p-7 rounded-3xl bg-[#121212] border border-[#202020] space-y-3">
            <h3 className="font-bold text-base text-white">Open Source & Developer-Owned</h3>
            <p className="text-xs text-[#8E8E93] leading-relaxed">
              You own your workflows, DAG graphs, and business logic. The platform is transparent, hackable, and built on battle-tested open standards.
            </p>
          </div>
        </div>

        {/* Technical Architecture Stack */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">The Modern Edge Stack</h2>
            <p className="text-xs text-[#8E8E93]">Built with precision using state-of-the-art developer infrastructure.</p>
          </div>

          <div className="rounded-2xl border border-[#222222] divide-y divide-[#1C1C1C] overflow-hidden bg-[#121212]">
            {stack.map((item) => (
              <div key={item.name} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[#FF7306]">{item.name}</span>
                <span className="text-xs text-[#A1A1AA]">{item.role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="p-8 rounded-3xl bg-[#141414] border border-[#242424] text-center space-y-4">
          <h3 className="text-lg font-bold text-white">Ready to experience high-velocity workflow automation?</h3>
          <p className="text-xs text-[#8E8E93] max-w-md mx-auto">
            Create your free account today and deploy your first DAG pipeline in minutes.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-6 py-2.5 rounded-full text-xs font-semibold bg-[#FF7306] hover:bg-[#FF8A29] text-white shadow-lg shadow-[#FF7306]/20 transition-all hover:scale-105"
            >
              Start Building Free
            </button>
            <a
              href="https://github.com/anuragratan1/vulp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-semibold bg-[#1C1C1C] text-white hover:bg-[#262626] border border-[#2A2A2A] transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub Repo</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
