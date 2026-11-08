import { ArrowLeft, ExternalLink, CheckCircle2, ShieldCheck } from 'lucide-react';

interface IntegrationsPageProps {
  onBack: () => void;
  onOpenAuth: (tab: 'signin' | 'signup') => void;
}

export function IntegrationsPage({ onBack, onOpenAuth }: IntegrationsPageProps) {
  const integrations = [
    {
      id: 'google-workspace',
      name: 'Google Workspace',
      category: 'Productivity & Office',
      color: '#4285F4',
      description: 'Connect Gmail, Google Sheets, Google Drive, Google Forms, and Google Calendar via single OAuth consent.',
      badge: 'Official OAuth2',
      operations: [
        'Gmail: Send formatted HTML emails with variable interpolation',
        'Google Sheets: Append rows with auto-discovered columns and header mapping',
        'Google Sheets: Read existing rows and cell ranges',
        'Google Drive: Upload and search documents, spreadsheets, and files',
        'Google Calendar: Schedule events with start, end, attendees, and descriptions',
        'Google Forms: Trigger instant workflow execution upon response submission',
      ],
      scopes: [
        'gmail.send',
        'spreadsheets',
        'drive.file',
        'calendar.events',
        'forms.responses.readonly',
        'forms.body',
      ],
    },
    {
      id: 'telegram',
      name: 'Telegram',
      category: 'Messaging & Alerts',
      color: '#24A1DE',
      badge: 'Bot Token',
      description: 'Send direct alerts, status updates, and broadcast messages to channels, groups, and personal chats.',
      operations: [
        'Send message with HTML / Markdown formatting',
        'Direct chat and group broadcast support',
        'Real-time connection verification in dashboard',
      ],
      scopes: ['Bot Token from @BotFather'],
    },
    {
      id: 'slack',
      name: 'Slack',
      category: 'Team Collaboration',
      color: '#E01E5A',
      badge: 'Incoming Webhook',
      description: 'Post automated notification cards, alert banners, and workflow reports into Slack channels.',
      operations: [
        'Post rich notification messages into target channels',
        'Inline payload validation and instant test execution',
      ],
      scopes: ['Incoming Webhook URL from Slack Apps'],
    },
    {
      id: 'github',
      name: 'GitHub',
      category: 'Developer Tools',
      color: '#F0F6FC',
      badge: 'Personal Access Token',
      description: 'Create issues, trigger CI/CD dispatch events, and track repository tasks automatically.',
      operations: [
        'Create new issues with labels and assignees',
        'Sync errors and run failures into issue trackers',
      ],
      scopes: ['repo, issues'],
    },
    {
      id: 'webhooks-http',
      name: 'Webhooks & HTTP REST',
      category: 'Core Connectivity',
      color: '#FF7306',
      badge: 'Universal Protocol',
      description: 'Connect any external webhook provider or call arbitrary REST APIs with headers, auth, and JSON bodies.',
      operations: [
        'Incoming unique webhook token listeners',
        'Universal HTTP Request action with GET, POST, PUT, DELETE, PATCH',
        'Custom headers and query parameters',
      ],
      scopes: ['Standard HTTP/1.1 & HTTP/2'],
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> 100% Real API Integrations
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Integrations Directory
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Connect your favorite productivity platforms, cloud tools, and messaging channels with zero friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl border border-border bg-surface-elevated/40 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white"
                      style={{ backgroundColor: item.color }}
                    >
                      {item.name[0]}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">{item.name}</h3>
                      <span className="text-[11px] text-text-secondary">{item.category}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-surface border border-border text-[10px] font-semibold text-text-secondary">
                    {item.badge}
                  </span>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">{item.description}</p>

                <div className="space-y-2 pt-2 border-t border-border/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Supported Operations
                  </span>
                  <ul className="space-y-1.5 text-xs text-text-secondary">
                    {item.operations.map((op, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                        <span>{op}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  <span>AES-256 Encrypted</span>
                </div>
                <button
                  onClick={() => onOpenAuth('signup')}
                  className="text-xs font-semibold text-[#FF7306] hover:underline flex items-center gap-1"
                >
                  Connect in App <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
