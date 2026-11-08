import {
  ShieldCheck,
  Lock,
  Server,
  KeyRound,
  CheckCircle2,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Database,
} from 'lucide-react';

interface SecurityPageProps {
  onBack?: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function SecurityPage({ onBack, onOpenAuth }: SecurityPageProps) {
  const pillars = [
    {
      icon: Lock,
      title: 'AES-256-GCM Galois Encryption',
      description:
        'All sensitive secrets, API keys, and OAuth access and refresh tokens are encrypted at the edge before being written to persistent storage. Vulp uses 256-bit AES in Galois/Counter Mode with unique IVs, guaranteeing both confidentiality and cryptographic integrity.',
    },
    {
      icon: Database,
      title: 'Strict Multi-Tenant Isolation',
      description:
        'Workspaces are strictly partitioned at the database and API layer. Every query enforces workspace ownership derived from the cryptographically verified session token. Users can never discover, read, execute, or modify another tenant’s workflows or runs.',
    },
    {
      icon: FileCheck,
      title: 'Google OAuth Limited Use Compliance',
      description:
        'Vulp adheres to the Google API Services User Data Policy, including the Limited Use requirements. We request only the minimum necessary scopes required to execute your configured steps. We never sell, transfer, or use your Google data for serving advertisements.',
    },
    {
      icon: Server,
      title: 'Stateless Edge Execution Runtime',
      description:
        'Pipelines execute in ephemeral Cloudflare Worker V8 isolates with zero server persistence. Workflows spin up in sub-milliseconds and terminate immediately upon completion, leaving no leftover memory state or shared process footprints.',
    },
    {
      icon: KeyRound,
      title: 'Safe Token Revocation & Disconnect',
      description:
        'When you disconnect a Google account or delete a credential, Vulp immediately calls the provider revocation endpoints and wipes the encrypted record from your database vault.',
    },
    {
      icon: Trash2,
      title: 'Complete Right to Deletion',
      description:
        'Users maintain sovereign control over their data. Deleting your workspace or account permanently purges all workflows, node parameters, execution history logs, and encrypted credentials from our distributed D1 database.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-6xl mx-auto px-6 space-y-16">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#FF7306] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        )}
        {/* Header Hero */}
        <div className="text-center space-y-5 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#242424] text-xs text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Trust Security Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            Security engineered into every <span className="text-[#FF7306]">edge execution</span>.
          </h1>

          <p className="text-base text-[#A1A1AA] leading-relaxed">
            Automation platforms handle your most sensitive tokens, spreadsheets, and messaging channels. VULP is architected from day one with hardware-grade cryptography, strict tenant boundaries, and minimal scope principles.
          </p>
        </div>

        {/* Security Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="p-8 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all flex flex-col justify-between group shadow-xl shadow-black/30"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#181818] border border-[#282828] flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{pillar.title}</h3>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">{pillar.description}</p>
                </div>

                <div className="pt-6 border-t border-[#1C1C1C] flex items-center gap-2 text-[11px] text-[#52525B]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enforced at backend middleware</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Google User Data Disclosure Box */}
        <div className="p-8 md:p-10 rounded-3xl bg-[#121212] border border-[#242424] space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <FileCheck className="w-4 h-4 text-[#FF7306]" />
            <span>Google API Services User Data Policy Compliance</span>
          </div>
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            VULP's use and transfer to any other app of information received from Google APIs will adhere to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF7306] hover:underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E1E1E] text-xs text-[#8E8E93]">
              <strong className="text-white block mb-1">No Human Access:</strong>
              No human at VULP reads your emails, spreadsheet data, or calendar events.
            </div>
            <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E1E1E] text-xs text-[#8E8E93]">
              <strong className="text-white block mb-1">No Advertising:</strong>
              Your Google data is never used or transferred to serve ads or train generalized AI models.
            </div>
            <div className="p-4 rounded-2xl bg-[#0A0A0A] border border-[#1E1E1E] text-xs text-[#8E8E93]">
              <strong className="text-white block mb-1">Scoped Execution:</strong>
              Data is read strictly to fulfill user-configured workflow nodes in real-time.
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-br from-[#161616] to-[#0E0E0E] border border-[#2E2E2E] text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Build on an enterprise-ready security foundation.
          </h2>
          <p className="text-sm text-[#A1A1AA] max-w-xl mx-auto">
            Experience complete tenant isolation, hardware-grade token encryption, and transparent edge execution.
          </p>
          <button
            onClick={() => onOpenAuth('signup')}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-sm shadow-xl shadow-[#FF7306]/20 transition-all hover:scale-105"
          >
            <span>Create Your Secure Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
