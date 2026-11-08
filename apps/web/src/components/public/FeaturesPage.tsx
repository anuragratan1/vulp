import { useState } from 'react';
import {
  Cpu,
  Lock,
  Zap,
  Clock,
  Code2,
  Terminal,
  ArrowRight,
  CheckCircle2,
  GitBranch,
} from 'lucide-react';

interface FeaturesPageProps {
  onBack: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function FeaturesPage({ onBack, onOpenAuth }: FeaturesPageProps) {
  const [activeCodeTab, setActiveCodeTab] = useState<'payload' | 'expression' | 'execution'>('expression');

  const capabilities = [
    {
      icon: GitBranch,
      title: 'Topological DAG Orchestration',
      description:
        'Vulp builds Directed Acyclic Graphs with strict cycle detection and parallel branch dispatch. Nodes evaluate dependencies upstream, ensuring deterministic data flow without race conditions.',
      badge: 'Engine Core',
    },
    {
      icon: Lock,
      title: 'AES-256-GCM Vault Isolation',
      description:
        'API keys, OAuth tokens, and Telegram bot tokens are never stored in plaintext. Secrets are encrypted using AES-256 in Galois/Counter Mode with master-key authentication and workspace scoping.',
      badge: 'Zero-Trust Security',
    },
    {
      icon: Code2,
      title: 'Semantic Variable Auto-Mapping',
      description:
        'Reference outputs from preceding steps using dynamic double-curly syntax (e.g., {{ $json.user.email }}). Type @ in any input field to trigger intelligent variable discovery.',
      badge: 'Developer Ergonomics',
    },
    {
      icon: Zap,
      title: 'Sub-Millisecond Edge Dispatch',
      description:
        'Deployed directly on Cloudflare Workers edge nodes across 300+ global data centers. Zero cold starts, instantaneous webhook ingestion, and resilient distributed execution.',
      badge: 'Global Edge',
    },
    {
      icon: Terminal,
      title: 'Comprehensive Run Telemetry & Replay',
      description:
        'Every execution records per-node input payloads, output states, execution time in milliseconds, and stderr logs. Inspect failed steps and retry workflows directly from history.',
      badge: 'Observability',
    },
    {
      icon: Clock,
      title: 'High-Precision Edge Crons',
      description:
        'Orchestrate recurring batch tasks and synchronizations with standard 5-part cron syntax. Managed directly by edge workers with timezone correction and jitter suppression.',
      badge: 'Autonomous Triggers',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-6xl mx-auto px-6 space-y-24">
        {/* Header Breadcrumb & Hero */}
        <div className="text-center space-y-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#242424] text-xs text-[#FF7306] font-mono">
            <Cpu className="w-3.5 h-3.5" />
            <span>VULP Platform Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            Engineered for precision, speed, and <span className="text-[#FF7306]">total isolation</span>.
          </h1>

          <p className="text-base sm:text-lg text-[#A1A1AA] leading-relaxed">
            Unlike legacy workflow builders trapped on monolithic VMs with multi-second cold starts, VULP runs on a stateless distributed edge engine backed by D1 multi-tenant transactional storage.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth('signup')}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-xs shadow-lg shadow-[#FF7306]/20 transition-all hover:scale-[1.02]"
            >
              <span>Build on VULP Free</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={onBack}
              className="px-6 py-3 rounded-full bg-[#161616] hover:bg-[#202020] text-[#D4D4D8] font-semibold text-xs border border-[#262626] transition-colors"
            >
              Back to Overview
            </button>
          </div>
        </div>

        {/* Core Architecture Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="p-7 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all duration-200 flex flex-col justify-between group shadow-lg shadow-black/20"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-[#FF7306] group-hover:scale-105 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] bg-[#181818] rounded-full border border-[#242424]">
                      {cap.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white tracking-tight">{cap.title}</h3>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">{cap.description}</p>
                </div>

                <div className="pt-6 border-t border-[#1C1C1C] flex items-center gap-2 text-[11px] text-[#52525B]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Production verified in test suite</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Interactive Code/Architecture Inspector */}
        <div className="rounded-3xl bg-[#111111] border border-[#222222] overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-[#222222] bg-[#141414] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <span className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <span className="w-3 h-3 rounded-full bg-[#27C93F]" />
              <span className="text-xs font-mono font-medium text-[#A1A1AA] ml-2">vulp-engine-spec.json</span>
            </div>

            <div className="flex items-center gap-1.5 bg-[#0C0C0C] p-1 rounded-xl border border-[#202020]">
              <button
                onClick={() => setActiveCodeTab('expression')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                  activeCodeTab === 'expression' ? 'bg-[#222222] text-[#FF7306] font-semibold' : 'text-[#71717A] hover:text-white'
                }`}
              >
                Expressions
              </button>
              <button
                onClick={() => setActiveCodeTab('payload')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                  activeCodeTab === 'payload' ? 'bg-[#222222] text-[#FF7306] font-semibold' : 'text-[#71717A] hover:text-white'
                }`}
              >
                Node Payload
              </button>
              <button
                onClick={() => setActiveCodeTab('execution')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors ${
                  activeCodeTab === 'execution' ? 'bg-[#222222] text-[#FF7306] font-semibold' : 'text-[#71717A] hover:text-white'
                }`}
              >
                Execution State
              </button>
            </div>
          </div>

          <div className="p-6 md:p-8 font-mono text-xs leading-relaxed overflow-x-auto text-[#D4D4D8] bg-[#0A0A0A]">
            {activeCodeTab === 'expression' && (
              <pre className="text-emerald-400">
                {`// Dynamic Semantic Expression Resolution
{
  "subject": "Urgent Alert: Incident #{{ $json.event.incidentId }}",
  "recipient": "{{ $json.oncall.engineer.email }}",
  "htmlBody": \`
    <h3>Production Warning Triggered</h3>
    <p>Service: <strong>{{ $json.service.name }}</strong></p>
    <p>Severity Score: <strong>{{ $json.metrics.severityLevel }}</strong> / 10</p>
    <p>Dispatched at: \${new Date().toISOString()}</p>
  \`,
  "resolvedVariables": {
    "event.incidentId": "INC-89421",
    "oncall.engineer.email": "anuragratan321@gmail.com",
    "service.name": "Auth Edge Router",
    "metrics.severityLevel": 9
  }
}`}
              </pre>
            )}

            {activeCodeTab === 'payload' && (
              <pre className="text-amber-300">
                {`// Webhook Ingestion Schema (POST /hook/lead-captured)
{
  "headers": {
    "host": "vulp-studio.workflow-worker.workers.dev",
    "content-type": "application/json",
    "cf-ray": "a577ca34ae57fd8c-SIN"
  },
  "body": {
    "leadId": "ld_98142",
    "user": {
      "name": "Sarah Chen",
      "email": "sarah.chen@enterprise.com",
      "tier": "enterprise",
      "requestedSeats": 50
    },
    "source": "api-signup-form"
  }
}`}
              </pre>
            )}

            {activeCodeTab === 'execution' && (
              <pre className="text-blue-300">
                {`// Topological DAG Step Diagnostics
{
  "runId": "run_01928374-9841-71bf-9d8a",
  "status": "success",
  "totalDurationMs": 42,
  "nodesExecuted": [
    { "key": "webhook_1", "durationMs": 4, "status": "completed" },
    { "key": "transform_parser", "durationMs": 6, "status": "completed" },
    { "key": "sheets_crm_row", "durationMs": 18, "status": "completed" },
    { "key": "telegram_broadcast", "durationMs": 14, "status": "completed" }
  ],
  "tenantIsolation": "ENFORCED (ws_user_primary)"
}`}
              </pre>
            )}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="p-10 md:p-14 rounded-3xl bg-gradient-to-br from-[#1A1A1A] to-[#121212] border border-[#2E2E2E] text-center space-y-6">
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Ready to build visual automations without server overhead?
          </h2>
          <p className="text-sm text-[#A1A1AA] max-w-xl mx-auto">
            Get your own private workspace in seconds. Connect Google Workspace, Telegram, and Slack with verified credentials.
          </p>
          <button
            onClick={() => onOpenAuth('signup')}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-sm shadow-xl shadow-[#FF7306]/20 transition-all hover:scale-105"
          >
            <span>Start Building for Free</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
