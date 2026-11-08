import { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  ExternalLink,
  Clock,
  Globe,
  Sliders,
} from 'lucide-react';
import {
  GoogleSheetsIcon,
  GmailIcon,
  TelegramIcon,
  SlackIcon,
  GitHubIcon,
} from '../ServiceIcons.js';

interface TemplatesPageProps {
  onBack?: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

interface TemplateData {
  id: string;
  name: string;
  category: string;
  description: string;
  nodes: { name: string; type: string; icon: any; iconColor: string }[];
  credentials: string[];
}

export function TemplatesPage({ onBack, onOpenAuth }: TemplatesPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [inspectedTemplate, setInspectedTemplate] = useState<TemplateData | null>(null);

  const templates: TemplateData[] = [
    {
      id: 'template_lead_sheets_gmail',
      name: 'Lead Capture → Google Sheets → Gmail Notification',
      category: 'Sales & Marketing',
      description:
        'Capture incoming leads via secure webhook, append structured contact data to a Google Sheets CRM spreadsheet, and automatically dispatch a personalized confirmation email via Gmail.',
      nodes: [
        { name: 'Capture Lead Form', type: 'webhook.trigger', icon: Globe, iconColor: '#FF7306' },
        { name: 'Append to CRM Sheet', type: 'sheets.appendRow', icon: GoogleSheetsIcon, iconColor: '#34A853' },
        { name: 'Send Welcome Email', type: 'gmail.send', icon: GmailIcon, iconColor: '#EA4335' },
      ],
      credentials: ['Google Sheets write access', 'Gmail send access'],
    },
    {
      id: 'template_form_telegram',
      name: 'Form Submission → Priority Filter → Telegram Alert',
      category: 'Customer Support',
      description:
        'Ingest customer feedback via webhook, evaluate severity with branching logic, and dispatch immediate high-priority alerts to the on-call engineer Telegram channel.',
      nodes: [
        { name: 'Inbound Form Webhook', type: 'webhook.trigger', icon: Globe, iconColor: '#FF7306' },
        { name: 'Is Priority Lead?', type: 'logic.condition', icon: Sliders, iconColor: '#A855F7' },
        { name: 'Telegram Priority Alert', type: 'telegram.sendMessage', icon: TelegramIcon, iconColor: '#229ED9' },
      ],
      credentials: ['Telegram Bot Token'],
    },
    {
      id: 'template_github_slack',
      name: 'Bug Report Webhook → GitHub Issue → Slack Alert',
      category: 'DevOps & Engineering',
      description:
        'Stream crash reports or user bug tickets into a formatted GitHub issue and broadcast real-time deployment status to the engineering team Slack channel.',
      nodes: [
        { name: 'Bug Report Webhook', type: 'webhook.trigger', icon: Globe, iconColor: '#FF7306' },
        { name: 'Create GitHub Issue', type: 'http.request', icon: GitHubIcon, iconColor: '#FFFFFF' },
        { name: 'Slack Dev Broadcast', type: 'slack.sendMessage', icon: SlackIcon, iconColor: '#4A154B' },
      ],
      credentials: ['GitHub Personal Access Token', 'Slack Webhook URL'],
    },
    {
      id: 'template_scheduled_reminder',
      name: 'Weekday 9 AM Briefing → Gmail Digest',
      category: 'Productivity',
      description:
        'Trigger recurring daily schedule at 9:00 AM (Monday to Friday) via edge crons, compile agenda items, and deliver an executive email digest to your inbox.',
      nodes: [
        { name: 'Weekday 9 AM Schedule', type: 'schedule.trigger', icon: Clock, iconColor: '#06B6D4' },
        { name: 'Morning Reminder Email', type: 'gmail.send', icon: GmailIcon, iconColor: '#EA4335' },
      ],
      credentials: ['Gmail send access'],
    },
    {
      id: 'template_sheets_telegram',
      name: 'Google Sheets Row Poller → Telegram Broadcast',
      category: 'Operations',
      description:
        'Poll spreadsheet rows on a recurring hourly cadence, identify unprocessed inventory or status updates, and notify operational logistics groups.',
      nodes: [
        { name: 'Hourly Check', type: 'schedule.trigger', icon: Clock, iconColor: '#06B6D4' },
        { name: 'Read Pending Items', type: 'sheets.readRows', icon: GoogleSheetsIcon, iconColor: '#34A853' },
        { name: 'Telegram Dispatch', type: 'telegram.sendMessage', icon: TelegramIcon, iconColor: '#229ED9' },
      ],
      credentials: ['Google Sheets read access', 'Telegram Bot Token'],
    },
  ];

  const categories = ['all', 'Sales & Marketing', 'Customer Support', 'DevOps & Engineering', 'Productivity', 'Operations'];

  const filtered = templates.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory
  );

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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#141414] border border-[#242424] text-xs text-[#FF7306] font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Pre-built Workflow Blueprints</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            Deploy production automations in <span className="text-[#FF7306]">one click</span>.
          </h1>

          <p className="text-base text-[#A1A1AA] leading-relaxed">
            Stop building from scratch. These proven DAG blueprints connect verified triggers, logic transformations, and integrations into instant workflows in your private workspace.
          </p>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto p-1.5 bg-[#121212] border border-[#202020] rounded-full max-w-fit mx-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#FF7306] text-white shadow-md shadow-[#FF7306]/20'
                  : 'text-[#A1A1AA] hover:text-white hover:bg-[#1C1C1C]'
              }`}
            >
              {cat === 'all' ? 'All Templates' : cat}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="p-8 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all flex flex-col justify-between group shadow-xl shadow-black/30"
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 text-[11px] font-mono font-medium text-[#FF7306] bg-[#FF7306]/10 border border-[#FF7306]/20 rounded-full">
                    {tpl.category}
                  </span>
                  <span className="text-xs text-[#71717A] font-mono">{tpl.nodes.length} Connected Steps</span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight leading-snug">{tpl.name}</h3>
                  <p className="text-xs text-[#8E8E93] leading-relaxed mt-2.5">{tpl.description}</p>
                </div>

                {/* Node Flow Visual Representation */}
                <div className="p-4 bg-[#0A0A0A] border border-[#1E1E1E] rounded-2xl space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] block">
                    Execution Graph Sequence:
                  </span>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {tpl.nodes.map((node, i) => {
                      const Icon = node.icon;
                      return (
                        <div key={node.name} className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#242424] text-xs font-medium text-white">
                            <Icon className="w-3.5 h-3.5" style={{ color: node.iconColor }} />
                            <span>{node.name}</span>
                          </div>
                          {i < tpl.nodes.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-[#52525B]" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Credentials Required */}
                <div className="flex items-center gap-2 text-xs text-[#71717A]">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Requires: {tpl.credentials.join(', ')}</span>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-[#1C1C1C] flex items-center justify-between">
                <button
                  onClick={() => setInspectedTemplate(tpl)}
                  className="text-xs font-semibold text-[#A1A1AA] hover:text-white flex items-center gap-1 transition-colors"
                >
                  <span>Inspect Blueprint</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onOpenAuth('signup')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#FF7306] hover:bg-[#FF8A29] text-white shadow-md shadow-[#FF7306]/20 transition-all hover:scale-105"
                >
                  <span>Instantiate in Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal: Template Blueprint Deep Dive */}
        {inspectedTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
            <div
              className="bg-[#141414] border border-[#2E2E2E] w-full max-w-xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
                <div>
                  <span className="text-[10px] font-mono text-[#FF7306] uppercase tracking-wider">
                    {inspectedTemplate.category}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">{inspectedTemplate.name}</h3>
                </div>

                <button
                  onClick={() => setInspectedTemplate(null)}
                  className="px-3 py-1 rounded-full text-xs font-medium text-[#71717A] hover:text-white bg-[#1C1C1C] transition-colors"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-[#A1A1AA] leading-relaxed">{inspectedTemplate.description}</p>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Configured Workflow Nodes
                </h4>
                <div className="space-y-2">
                  {inspectedTemplate.nodes.map((node, i) => (
                    <div
                      key={node.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-[#0C0C0C] border border-[#202020]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#1A1A1A] text-[10px] font-mono text-[#71717A] flex items-center justify-center">
                          {i + 1}
                        </span>
                        <node.icon className="w-4 h-4" style={{ color: node.iconColor }} />
                        <span className="text-xs font-semibold text-white">{node.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#71717A]">{node.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#262626] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>How to use this template</span>
                </div>
                <p className="text-xs text-[#A1A1AA] leading-relaxed">
                  When you instantiate this template, VULP automatically creates an isolated workflow in your private workspace. You only need to supply your spreadsheet ID or target chat ID before turning it active.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setInspectedTemplate(null);
                    onOpenAuth('signup');
                  }}
                  className="w-full py-3 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-xs shadow-lg shadow-[#FF7306]/20 transition-all hover:scale-[1.02]"
                >
                  Deploy Template in Free Workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
