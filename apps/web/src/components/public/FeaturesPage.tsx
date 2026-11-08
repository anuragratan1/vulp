import {
  ArrowLeft,
  Zap,
  Cpu,
  Repeat,
  Database,
  Lock,
  Workflow,
  Sparkles,
} from 'lucide-react';

interface FeaturesPageProps {
  onBack: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function FeaturesPage({ onBack, onOpenAuth }: FeaturesPageProps) {
  const featureList = [
    {
      icon: <Workflow className="w-5 h-5 text-[#FF7306]" />,
      title: 'Visual Directed Acyclic Graph (DAG) Engine',
      description:
        'Author complex branching and parallel automation flows with an intuitive drag-and-drop canvas powered by React Flow and topological execution sequencing.',
    },
    {
      icon: <Zap className="w-5 h-5 text-amber-400" />,
      title: 'Global Edge Runtime',
      description:
        'Built directly on Cloudflare Workers and D1 database. Workflows trigger and execute with zero cold starts and sub-millisecond dispatch times across 300+ edge locations.',
    },
    {
      icon: <Lock className="w-5 h-5 text-green-400" />,
      title: 'Zero-Leak AES-256-GCM Vault',
      description:
        'Every credential, token, and API secret is encrypted at rest using Galois/Counter Mode authenticated encryption and strictly isolated to your tenant workspace.',
    },
    {
      icon: <Sparkles className="w-5 h-5 text-purple-400" />,
      title: 'Intelligent Semantic Field Mapping',
      description:
        'Eliminate tedious variable lookup. VULP automatically maps incoming webhook attributes, form response titles, and sheet columns into your action templates.',
    },
    {
      icon: <Repeat className="w-5 h-5 text-blue-400" />,
      title: 'Flexible Triggers & Scheduling',
      description:
        'Trigger workflows manually, through unique authenticated webhook URLs, via Google Forms submission webhooks, or recurring Cron expressions down to the minute.',
    },
    {
      icon: <Database className="w-5 h-5 text-pink-400" />,
      title: 'Step-by-Step Execution Audit Logs',
      description:
        'Every run captures a full immutable graph snapshot, step execution timings, input resolution details, raw outputs, and formatted step logs for complete observability.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-text-primary py-12 px-6">
      <div className="max-w-5xl mx-auto space-y-12">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7306]/10 text-[#FF7306] border border-[#FF7306]/20 text-xs font-semibold">
            <Cpu className="w-3.5 h-3.5" /> High-Performance Edge Engine
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Engineered for Velocity, Precision, and Absolute Isolation
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Discover the technical capabilities powering VULP's visual automation platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featureList.map((item, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl border border-border bg-surface-elevated/40 hover:bg-surface-elevated/70 transition-all duration-200 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center">
                  {item.icon}
                </div>
                <h3 className="text-sm font-bold text-text-primary">{item.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="p-8 rounded-3xl border border-border bg-gradient-to-r from-surface to-surface-elevated text-center space-y-4">
          <h3 className="text-xl font-bold text-text-primary">Ready to experience real visual automation?</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Create your account in seconds and deploy your first pipeline today.
          </p>
          <button
            onClick={() => onOpenAuth('signup')}
            className="px-6 py-2.5 rounded-full bg-[#FF7306] hover:bg-[#FF7306]/90 text-white text-xs font-semibold shadow-lg shadow-[#FF7306]/20 transition-colors"
          >
            Start Free Now
          </button>
        </div>
      </div>
    </div>
  );
}
