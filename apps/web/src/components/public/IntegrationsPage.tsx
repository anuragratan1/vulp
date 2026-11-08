import { useState } from 'react';
import {
  Layers,
  Search,
  ExternalLink,
  Globe,
  Sliders,
  Clock,
  CheckCircle2,
  Lock,
  ArrowLeft,
} from 'lucide-react';
import {
  GmailIcon,
  GoogleSheetsIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
  GoogleFormsIcon,
  TelegramIcon,
  SlackIcon,
} from '../ServiceIcons.js';

interface IntegrationsPageProps {
  onBack?: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

interface IntegrationCardData {
  id: string;
  name: string;
  category: 'google' | 'messaging' | 'core';
  icon: any;
  iconColor: string;
  badge: string;
  authMethod: string;
  description: string;
  supportedActions: string[];
  scopes: string[];
}

export function IntegrationsPage({ onBack, onOpenAuth }: IntegrationsPageProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'google' | 'messaging' | 'core'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedIntegration, setInspectedIntegration] = useState<IntegrationCardData | null>(null);

  const integrations: IntegrationCardData[] = [
    {
      id: 'google-gmail',
      name: 'Google Gmail',
      category: 'google',
      icon: GmailIcon,
      iconColor: '#EA4335',
      badge: 'Official OAuth 2.0',
      authMethod: 'Google OAuth 2.0 Authorization Code',
      description:
        'Dispatch dynamic, formatted emails with custom headers, multi-recipient addressing, and dynamic variable templating via Gmail API.',
      supportedActions: ['Send Email (MIME RFC 2822)', 'HTML / Plain Text Body', 'CC & BCC Recipients', 'Dynamic Subject Resolution'],
      scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/userinfo.email'],
    },
    {
      id: 'google-sheets',
      name: 'Google Sheets',
      category: 'google',
      icon: GoogleSheetsIcon,
      iconColor: '#34A853',
      badge: 'Official OAuth 2.0',
      authMethod: 'Google OAuth 2.0 Authorization Code',
      description:
        'Append real-time records, synchronize tabular datasets, log webhook payloads, and query spreadsheet values across any workbook.',
      supportedActions: ['Append Row to Sheet', 'Read Range Values', 'Format Date & Timestamp Columns', 'Auto-Create Header Row'],
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      category: 'google',
      icon: GoogleDriveIcon,
      iconColor: '#4285F4',
      badge: 'Official OAuth 2.0',
      authMethod: 'Google OAuth 2.0 Authorization Code',
      description:
        'Search files, upload generated reports, create folder hierarchies, and inspect file metadata in Google Drive.',
      supportedActions: ['Upload File to Folder', 'Search Files by Name/Mime', 'Inspect File Metadata', 'Fetch Download Links'],
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      category: 'google',
      icon: GoogleCalendarIcon,
      iconColor: '#FBBC04',
      badge: 'Official OAuth 2.0',
      authMethod: 'Google OAuth 2.0 Authorization Code',
      description:
        'Create scheduled calendar events, invite attendees with dynamic email variables, and query upcoming schedules.',
      supportedActions: ['Create Calendar Event', 'Set Start/End Time & Timezone', 'Add Meeting Attendees', 'Event Location & Description'],
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    },
    {
      id: 'google-forms',
      name: 'Google Forms',
      category: 'google',
      icon: GoogleFormsIcon,
      iconColor: '#7248B9',
      badge: 'Official OAuth 2.0',
      authMethod: 'Google OAuth 2.0 Authorization Code',
      description:
        'Poll latest responses to surveys and submission forms, extract question-answer pairs, and trigger downstream notifications.',
      supportedActions: ['Poll Form Responses', 'Extract Answer Values', 'Track Submission Timestamps', 'Filter Unprocessed Responses'],
      scopes: ['https://www.googleapis.com/auth/forms.responses.readonly'],
    },
    {
      id: 'telegram',
      name: 'Telegram Bot API',
      category: 'messaging',
      icon: TelegramIcon,
      iconColor: '#229ED9',
      badge: 'Bot Token API',
      authMethod: 'Secure Telegram Bot Token (AES-256 Encrypted)',
      description:
        'Broadcast instant real-time alerts to channels, group chats, or individual users with rich MarkdownV2 or HTML parsing.',
      supportedActions: ['Send Message to Chat/Channel', 'MarkdownV2 & HTML Formatting', 'Disable Link Previews', 'Silent / High-Priority Alerts'],
      scopes: ['sendMessage method access'],
    },
    {
      id: 'slack',
      name: 'Slack Webhooks',
      category: 'messaging',
      icon: SlackIcon,
      iconColor: '#4A154B',
      badge: 'Incoming Webhook',
      authMethod: 'Slack Incoming Webhook URL / Bot Token',
      description:
        'Stream operational events, workflow execution failures, or customer signups directly into designated Slack team channels.',
      supportedActions: ['Post Channel Message', 'Slack mrkdwn Formatting', 'Custom Bot Username & Icon', 'Thread Timestamp Replies'],
      scopes: ['incoming-webhook / chat:write'],
    },
    {
      id: 'http-webhook',
      name: 'HTTP & Webhooks',
      category: 'core',
      icon: Globe,
      iconColor: '#FF7306',
      badge: 'REST Engine',
      authMethod: 'Public / HMAC Signature / Bearer Token',
      description:
        'Call any external REST or GraphQL API with custom headers, query params, timeout limits, and automated JSON parsing.',
      supportedActions: ['GET, POST, PUT, DELETE, PATCH', 'Custom HTTP Headers & Auth', 'JSON / Text / Form-Data Payloads', 'Configurable Timeout & Retry'],
      scopes: ['Direct edge network egress'],
    },
    {
      id: 'transform-expression',
      name: 'Transform & Logic',
      category: 'core',
      icon: Sliders,
      iconColor: '#A855F7',
      badge: 'Built-in Engine',
      authMethod: 'Edge Sandbox (Zero Credentials Required)',
      description:
        'Parse, filter, reshape, and calculate dynamic data flows using familiar JavaScript expressions without third-party dependencies.',
      supportedActions: ['Semantic Expression Builder', 'Conditional Branching (If / Else)', 'Array & Object Mapping', 'Type Casting & Math Helpers'],
      scopes: ['Sandboxed in-memory execution'],
    },
    {
      id: 'schedule-cron',
      name: 'Schedule & Cron',
      category: 'core',
      icon: Clock,
      iconColor: '#06B6D4',
      badge: 'Autonomous',
      authMethod: 'Cloudflare Triggers (Edge Native)',
      description:
        'Execute automated recurring schedules using standard cron expressions with timezone support and sub-minute precision.',
      supportedActions: ['Standard 5-Field Cron Syntax', 'Custom Timezone Support', 'Scheduled Timestamp Injection', 'Automated Jitter Mitigation'],
      scopes: ['Cloudflare Cron Triggers'],
    },
  ];

  const filteredIntegrations = integrations.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.supportedActions.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

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
            <Layers className="w-3.5 h-3.5" />
            <span>Supported Ecosystem</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
            Connect your essential tools with <span className="text-[#FF7306]">zero configuration friction</span>.
          </h1>

          <p className="text-base text-[#A1A1AA] leading-relaxed">
            Every integration in VULP is engineered with minimum necessary permissions, official OAuth 2.0 flows, and hardware-grade credential encryption. No third-party data broker is ever in the middle.
          </p>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-[#121212] border border-[#202020] rounded-2xl">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1">
            {[
              { id: 'all', label: 'All Services' },
              { id: 'google', label: 'Google Workspace' },
              { id: 'messaging', label: 'Messaging' },
              { id: 'core', label: 'Engine & Logic' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#FF7306] text-white shadow-md shadow-[#FF7306]/20'
                    : 'text-[#A1A1AA] hover:text-white hover:bg-[#1A1A1A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search actions or apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-1.5 bg-[#181818] border border-[#262626] rounded-xl text-xs text-white placeholder:text-[#52525B] focus:outline-none focus:border-[#FF7306] transition-colors"
            />
          </div>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="p-7 rounded-3xl bg-[#121212] border border-[#202020] hover:border-[#333333] transition-all flex flex-col justify-between group shadow-lg shadow-black/20"
              >
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center border group-hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${item.iconColor}15`,
                        borderColor: `${item.iconColor}30`,
                        color: item.iconColor,
                      }}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-mono font-medium text-[#A1A1AA] bg-[#181818] border border-[#262626] rounded-full">
                      {item.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{item.name}</h3>
                    <p className="text-xs text-[#8E8E93] leading-relaxed mt-2">{item.description}</p>
                  </div>

                  {/* Supported Actions Pills */}
                  <div className="space-y-2 pt-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A]">
                      Supported Capabilities:
                    </span>
                    <ul className="space-y-1.5">
                      {item.supportedActions.map((action) => (
                        <li key={action} className="flex items-center gap-2 text-xs text-[#D4D4D8]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#1C1C1C] flex items-center justify-between">
                  <button
                    onClick={() => setInspectedIntegration(item)}
                    className="text-xs font-semibold text-[#FF7306] hover:text-[#FF8A29] flex items-center gap-1 transition-colors"
                  >
                    <span>View Scopes</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onOpenAuth('signup')}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1C1C1C] hover:bg-[#282828] text-white transition-colors"
                  >
                    Connect in Studio
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal: Scopes & Permissions Inspection */}
        {inspectedIntegration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
            <div
              className="bg-[#141414] border border-[#2E2E2E] w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#242424]">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center border"
                    style={{
                      backgroundColor: `${inspectedIntegration.iconColor}15`,
                      borderColor: `${inspectedIntegration.iconColor}30`,
                      color: inspectedIntegration.iconColor,
                    }}
                  >
                    <inspectedIntegration.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{inspectedIntegration.name}</h3>
                    <span className="text-[11px] text-[#A1A1AA]">{inspectedIntegration.authMethod}</span>
                  </div>
                </div>

                <button
                  onClick={() => setInspectedIntegration(null)}
                  className="px-3 py-1 rounded-full text-xs font-medium text-[#71717A] hover:text-white bg-[#1C1C1C] transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Minimum Requested OAuth Scopes
                  </h4>
                  <div className="p-3 bg-[#0A0A0A] border border-[#222222] rounded-xl space-y-1.5 font-mono text-xs text-emerald-400">
                    {inspectedIntegration.scopes.map((scope) => (
                      <div key={scope} className="break-all">
                        • {scope}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#1A1A1A] border border-[#262626] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Lock className="w-3.5 h-3.5 text-[#FF7306]" />
                    <span>How Tokens are Stored</span>
                  </div>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">
                    Tokens are encrypted via AES-256-GCM using your isolated workspace encryption key. VULP only uses your token to execute workflows you explicitly author. You can revoke access at any time in Settings.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setInspectedIntegration(null);
                    onOpenAuth('signup');
                  }}
                  className="w-full py-2.5 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-xs transition-colors"
                >
                  Connect {inspectedIntegration.name} Free
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Banner */}
        <div className="p-10 rounded-3xl bg-[#121212] border border-[#242424] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">Need a custom integration or webhook protocol?</h3>
            <p className="text-xs text-[#8E8E93]">
              Use VULP's HTTP Request node to interface with any REST API with custom signatures, headers, and dynamic variables.
            </p>
          </div>
          <button
            onClick={() => onOpenAuth('signup')}
            className="px-6 py-3 rounded-full bg-[#FF7306] hover:bg-[#FF8A29] text-white font-semibold text-xs shrink-0 shadow-lg shadow-[#FF7306]/20 transition-all hover:scale-105"
          >
            Launch Studio & Test
          </button>
        </div>
      </div>
    </div>
  );
}
