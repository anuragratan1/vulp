import { useState } from 'react';
import {
  BookOpen,
  Terminal,
  Zap,
  Lock,
  GitBranch,
  Code2,
  Clock,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

interface DocumentationPageProps {
  onBack?: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function DocumentationPage({ onBack, onOpenAuth }: DocumentationPageProps) {
  const [activeSection, setActiveSection] = useState<'quickstart' | 'concepts' | 'expressions' | 'webhooks' | 'crons' | 'security'>('quickstart');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const navLinks = [
    { id: 'quickstart', label: '1. Getting Started', icon: Zap },
    { id: 'concepts', label: '2. Core Concepts', icon: GitBranch },
    { id: 'expressions', label: '3. Dynamic Expressions', icon: Code2 },
    { id: 'webhooks', label: '4. Inbound Webhooks', icon: Terminal },
    { id: 'crons', label: '5. Schedulers & Crons', icon: Clock },
    { id: 'security', label: '6. Vault & Security', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          {/* Left Sticky Docs Navigation */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="sticky top-28 space-y-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#A1A1AA] hover:text-[#FF7306] transition-colors pb-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Home</span>
                </button>
              )}
              <div className="flex items-center gap-2.5 pb-4 border-b border-[#202020]">
                <BookOpen className="w-4 h-4 text-[#FF7306]" />
                <span className="font-extrabold text-sm text-white tracking-tight">VULP Documentation</span>
              </div>

              <nav className="space-y-1">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id as any)}
                      className={`flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                        isActive
                          ? 'bg-[#FF7306]/10 text-[#FF7306] border border-[#FF7306]/20 shadow-sm'
                          : 'text-[#A1A1AA] hover:text-white hover:bg-[#141414]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 rounded-2xl bg-[#121212] border border-[#202020] space-y-3 pt-4">
                <span className="text-[11px] font-bold text-white block">Need Help?</span>
                <p className="text-[11px] text-[#71717A] leading-relaxed">
                  Join our community or view full source code on GitHub.
                </p>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-[#FF7306] text-white hover:bg-[#FF8A29] transition-colors"
                >
                  Open Studio Canvas
                </button>
              </div>
            </div>
          </aside>

          {/* Right Main Content Area */}
          <main className="lg:col-span-3 space-y-12">
            {activeSection === 'quickstart' && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Quickstart Guide</span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Build your first DAG automation in 3 minutes
                  </h1>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    VULP allows you to compose resilient event-driven pipelines by connecting triggers, transformation nodes, and third-party APIs.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <span className="w-6 h-6 rounded-full bg-[#FF7306] text-white flex items-center justify-center text-xs">
                        1
                      </span>
                      <span>Create your private workspace</span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed pl-8">
                      Sign in using your Google account or email. Every account receives a fully isolated workspace with its own encrypted credential vault and execution log stream.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <span className="w-6 h-6 rounded-full bg-[#FF7306] text-white flex items-center justify-center text-xs">
                        2
                      </span>
                      <span>Add a Trigger Node to the Canvas</span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed pl-8">
                      In the Studio Canvas, drag a <strong>Webhook Trigger</strong> or <strong>Schedule Trigger</strong>. For webhooks, VULP instantly assigns you a unique edge HTTP URL (e.g. <code className="text-[#FF7306] font-mono">/hook/your-key</code>).
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-white">
                      <span className="w-6 h-6 rounded-full bg-[#FF7306] text-white flex items-center justify-center text-xs">
                        3
                      </span>
                      <span>Wire Actions & Test Run</span>
                    </div>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed pl-8">
                      Drag a connection edge from the trigger to a <strong>Google Sheets</strong> or <strong>Telegram</strong> node. Click <strong>Test Run</strong> to dispatch a simulation payload and watch live node badges light up with step outputs.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'concepts' && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Engine Anatomy</span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Directed Acyclic Graphs (DAG) Explained
                  </h1>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    Vulp structures automations as directed acyclic graphs. This model prevents infinite loops and guarantees deterministic execution order.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-3">
                    <h3 className="font-bold text-sm text-white">Triggers vs Actions</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">
                      A workflow contains exactly one active trigger (Webhook, Schedule, or Manual Run). Actions execute downstream once their parent nodes complete successfully.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-3">
                    <h3 className="font-bold text-sm text-white">Branching & Conditional Logic</h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">
                      Using the Condition node, workflows can fork into True and False execution branches based on payload values (e.g., severity &gt; 5 or status == 'paid').
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'expressions' && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Data Mapping</span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Dynamic Semantic Expressions
                  </h1>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    Reference values from upstream nodes using clean double-curly brackets. Type <code className="text-[#FF7306] font-mono">@</code> in any input field to open the variable picker.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#202020]">
                    <span className="text-xs font-mono text-[#71717A]">Syntax Examples</span>
                    <button
                      onClick={() => copyToClipboard('{{ $json.user.email }}', 'syntax')}
                      className="flex items-center gap-1 text-[11px] text-[#A1A1AA] hover:text-white"
                    >
                      {copiedCode === 'syntax' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy</span>
                    </button>
                  </div>

                  <div className="space-y-2 text-xs font-mono text-emerald-400">
                    <div>// Access webhook payload object</div>
                    <div className="text-white bg-[#0A0A0A] p-2.5 rounded-lg border border-[#222222]">
                      &#123;&#123; $json.customer.email &#125;&#125;
                    </div>

                    <div>// Access specific step by node key</div>
                    <div className="text-white bg-[#0A0A0A] p-2.5 rounded-lg border border-[#222222]">
                      &#123;&#123; $nodes.sheets_crm_row.data.rowNumber &#125;&#125;
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'webhooks' && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Ingestion</span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Inbound Webhook Endpoints
                  </h1>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    Every webhook trigger exposes a global edge endpoint. Send JSON, form data, or raw text payloads with HTTP POST or GET.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-4">
                  <div className="text-xs font-mono text-[#71717A]">Example cURL Dispatch:</div>
                  <pre className="p-4 rounded-xl bg-[#0A0A0A] border border-[#222222] font-mono text-xs text-amber-300 overflow-x-auto">
{`curl -X POST https://vulp-studio.workflow-worker.workers.dev/hook/YOUR_WEBHOOK_KEY \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": "order_created",
    "orderId": "ord_9182",
    "amount": 149.00,
    "customer": { "email": "client@example.com" }
  }'`}
                  </pre>
                </div>
              </div>
            )}

            {activeSection === 'crons' && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Scheduled Workflows</span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Edge Cron Timers & Recurrence
                  </h1>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    VULP edge workers evaluate active scheduled workflows every minute. Configure arbitrary cadences with standard cron expressions.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-4 rounded-xl bg-[#121212] border border-[#202020] space-y-1">
                    <span className="text-[#FF7306] font-bold">0 * * * *</span>
                    <p className="text-[#A1A1AA]">Every hour on the hour</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#121212] border border-[#202020] space-y-1">
                    <span className="text-[#FF7306] font-bold">0 9 * * 1-5</span>
                    <p className="text-[#A1A1AA]">Every weekday at 9:00 AM</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#121212] border border-[#202020] space-y-1">
                    <span className="text-[#FF7306] font-bold">*/15 * * * *</span>
                    <p className="text-[#A1A1AA]">Every 15 minutes</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#121212] border border-[#202020] space-y-1">
                    <span className="text-[#FF7306] font-bold">0 0 1 * *</span>
                    <p className="text-[#A1A1AA]">First day of every month at midnight</p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'security' && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-3">
                  <span className="text-xs font-mono text-[#FF7306] uppercase tracking-wider">Data Protection</span>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Vault Security & Credential Isolation
                  </h1>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    Credentials and tokens are encrypted before hitting persistent storage using authenticated AES-256 in Galois/Counter Mode.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-[#121212] border border-[#202020] space-y-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Vault Cryptography Guarantees</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[#A1A1AA]">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>AES-256-GCM authenticated ciphertext with 96-bit initialization vectors.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Multi-tenant workspace isolation: user A cannot query user B credentials.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Immediate token revocation and secure deletion on disconnect.</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
