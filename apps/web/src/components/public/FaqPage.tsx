import { useState } from 'react';
import { HelpCircle, ChevronDown, Search } from 'lucide-react';

interface FaqPageProps {
  onBack: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

interface FaqItem {
  q: string;
  a: string;
  category: 'general' | 'integrations' | 'security' | 'developer';
}

export function FaqPage({ onBack, onOpenAuth }: FaqPageProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [selectedCat, setSelectedCat] = useState<'all' | 'general' | 'integrations' | 'security' | 'developer'>('all');
  const [search, setSearch] = useState('');

  const faqs: FaqItem[] = [
    {
      category: 'general',
      q: 'What makes VULP different from traditional automation tools like Zapier or Make?',
      a: 'VULP runs on a stateless distributed edge architecture (Cloudflare Workers) backed by D1 SQLite database. Unlike VM-based engines that suffer from multi-second cold starts and steep per-step billing, VULP executes DAG graphs in sub-milliseconds with zero idle server overhead, predictable execution, and complete private workspace isolation.',
    },
    {
      category: 'general',
      q: 'Is VULP free to use?',
      a: 'Yes! VULP offers a generous permanent free tier with unlimited active workflows, manual test executions, and complete access to Google Workspace, Telegram, and Slack integrations. We believe developers and teams should be able to build production automations without arbitrary paywalls.',
    },
    {
      category: 'integrations',
      q: 'How does Google Workspace authorization work?',
      a: 'VULP uses official Google OAuth 2.0 authorization code flows with minimum necessary scopes. When you authorize Gmail, Sheets, Drive, Calendar, or Forms, your tokens are encrypted using AES-256-GCM and stored in your private workspace vault. We strictly adhere to Google API Services User Data Policy, including Limited Use requirements.',
    },
    {
      category: 'integrations',
      q: 'Can I connect multiple Google accounts or workspaces?',
      a: 'Yes. You can create multiple isolated workspaces within your VULP account (e.g. Personal Ops, Client Alpha, Production DevOps). Each workspace possesses its own encrypted credential vault and separate OAuth tokens.',
    },
    {
      category: 'developer',
      q: 'How do incoming webhooks authenticate and trigger workflows?',
      a: 'Every webhook trigger node generates a unique global edge URL (e.g. /hook/:uniqueKey). You can dispatch HTTP POST or GET requests from GitHub, Stripe, Shopify, or custom backends. The payload is instantly parsed into a typed $json object accessible by all downstream nodes.',
    },
    {
      category: 'developer',
      q: 'Can I write custom JavaScript expressions or transform payloads?',
      a: 'Yes. VULP features dynamic semantic expressions using double curly syntax (e.g. {{ $json.customer.email }}). In addition, Transform nodes allow you to filter arrays, reshape nested objects, and perform string/math calculations directly inside the visual canvas.',
    },
    {
      category: 'security',
      q: 'Where is my workflow data and execution history stored?',
      a: 'All workflow definitions, node parameters, encrypted credentials, and execution logs are stored in Cloudflare D1 distributed SQLite database with strict foreign-key tenant isolation. We do not sell or monetize user data under any circumstances.',
    },
    {
      category: 'security',
      q: 'How do I revoke an integration or delete my account?',
      a: 'You can disconnect any integration at any time from the Connections tab, which immediately revokes provider tokens and purges credentials from the vault. Account deletion permanently purges all workflows and run history from the database.',
    },
  ];

  const filtered = faqs.filter((f) => {
    const matchCat = selectedCat === 'all' || f.category === selectedCat;
    const matchSearch =
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F5] pt-24 pb-20 selection:bg-[#FF7306]/20 selection:text-[#FF7306]">
      <div className="max-w-4xl mx-auto px-6 space-y-16">
        {/* Header Hero */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#242424] text-xs text-[#FF7306] font-mono">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-[1.15]">
            Everything you need to know about <span className="text-[#FF7306]">VULP</span>.
          </h1>

          <p className="text-base text-[#A1A1AA] leading-relaxed max-w-xl mx-auto">
            Clear answers on edge runtime performance, Google OAuth security, webhook dispatch, and workspace tenant isolation.
          </p>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-[#121212] border border-[#202020] rounded-2xl">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1">
            {[
              { id: 'all', label: 'All' },
              { id: 'general', label: 'General' },
              { id: 'integrations', label: 'Integrations' },
              { id: 'developer', label: 'Developer' },
              { id: 'security', label: 'Security' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCat === cat.id
                    ? 'bg-[#FF7306] text-white shadow-md shadow-[#FF7306]/20'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-[#181818] border border-[#262626] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#FF7306] transition-colors"
            />
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {filtered.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={item.q}
                className="rounded-2xl bg-[#121212] border border-[#202020] hover:border-[#2C2C2C] transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none"
                >
                  <span className="font-bold text-sm sm:text-base text-white">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[#FF7306]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-xs sm:text-sm text-[#A1A1AA] leading-relaxed border-t border-[#1C1C1C] animate-in fade-in-0 duration-150">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still have questions? */}
        <div className="p-8 rounded-3xl bg-[#141414] border border-[#222222] text-center space-y-4">
          <h3 className="text-lg font-bold text-white">Have a question not listed here?</h3>
          <p className="text-xs text-[#8E8E93] max-w-md mx-auto">
            Our engineering team is always available to help. Reach out directly or open an issue on our public GitHub repository.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => onBack()}
              className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#1C1C1C] text-white hover:bg-[#262626] border border-[#2A2A2A] transition-colors"
            >
              Return Home
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#FF7306] hover:bg-[#FF8A29] text-white shadow-md shadow-[#FF7306]/20 transition-all hover:scale-105"
            >
              Start Free Today
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
