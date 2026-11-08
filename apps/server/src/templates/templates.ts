import { WorkflowGraph } from '@workflow/engine';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  graph: WorkflowGraph;
  requiredCredentials: {
    stepKey: string;
    stepName: string;
    credentialType: string;
    description: string;
  }[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'template_lead_sheets_gmail',
    name: 'Lead Capture → Google Sheets → Gmail Notification',
    description:
      'Capture incoming leads via webhook, append them to a Google Sheets CRM spreadsheet, and automatically send a personalized email via Gmail.',
    category: 'Sales & Marketing',
    requiredCredentials: [
      {
        stepKey: 'sheets_append',
        stepName: 'Append to CRM Sheet',
        credentialType: 'google',
        description: 'Google account with Google Sheets write permissions.',
      },
      {
        stepKey: 'gmail_notify',
        stepName: 'Send Welcome Email',
        credentialType: 'google',
        description: 'Google account with Gmail send email permissions.',
      },
    ],
    graph: {
      nodes: [
        {
          key: 'webhook_lead',
          type: 'webhook.trigger',
          name: 'Capture Lead Form',
          position: { x: 80, y: 180 },
          params: {
            method: 'POST',
          },
        },
        {
          key: 'sheets_append',
          type: 'sheets.appendRow',
          name: 'Append to CRM Sheet',
          position: { x: 360, y: 180 },
          params: {
            spreadsheetId: 'crm_leads_spreadsheet_id',
            sheetName: 'Sheet1',
            values: {
              Name: '{{webhook_lead.body.name}}',
              Email: '{{webhook_lead.body.email}}',
              Company: '{{webhook_lead.body.company}}',
              Date: '{{$now}}',
            },
          },
        },
        {
          key: 'gmail_notify',
          type: 'gmail.sendEmail',
          name: 'Send Welcome Email',
          position: { x: 640, y: 180 },
          params: {
            to: '{{webhook_lead.body.email}}',
            subject: 'Welcome to Vulp, {{webhook_lead.body.name}}!',
            body: 'Hello {{webhook_lead.body.name}},\n\nThanks for reaching out! We received your inquiry for {{webhook_lead.body.company}} and our team will get in touch shortly.\n\nBest regards,\nThe Vulp Automation Team',
            isHtml: false,
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'webhook_lead',
          sourcePort: 'default',
          target: 'sheets_append',
        },
        {
          id: 'e2',
          source: 'sheets_append',
          sourcePort: 'default',
          target: 'gmail_notify',
        },
      ],
    },
  },
  {
    id: 'template_form_telegram',
    name: 'New Form Submission → Telegram Notification',
    description:
      'Receive inbound form submissions via webhook, evaluate submission score or priority, and notify your sales team immediately on Telegram.',
    category: 'Sales & Marketing',
    requiredCredentials: [
      {
        stepKey: 'tg_alert',
        stepName: 'Telegram Priority Alert',
        credentialType: 'telegram',
        description: 'Telegram Bot Token to post notifications to your chat or channel.',
      },
    ],
    graph: {
      nodes: [
        {
          key: 'webhook_form',
          type: 'webhook.trigger',
          name: 'Inbound Form Webhook',
          position: { x: 80, y: 180 },
          params: {
            method: 'POST',
          },
        },
        {
          key: 'if_priority',
          type: 'logic.if',
          name: 'Is Priority Lead?',
          position: { x: 360, y: 180 },
          params: {
            left: '{{webhook_form.body.score}}',
            operator: 'greater_than',
            right: 50,
          },
        },
        {
          key: 'tg_alert',
          type: 'telegram.sendMessage',
          name: 'Telegram Priority Alert',
          position: { x: 640, y: 180 },
          params: {
            chatId: '-100123456789',
            text: '🔥 *New Priority Form Submission*:\n• *Name*: {{webhook_form.body.name}}\n• *Email*: {{webhook_form.body.email}}\n• *Score*: {{webhook_form.body.score}}\n• *Details*: {{webhook_form.body.message}}',
            parseMode: 'Markdown',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'webhook_form',
          sourcePort: 'default',
          target: 'if_priority',
        },
        {
          id: 'e2',
          source: 'if_priority',
          sourcePort: 'true',
          target: 'tg_alert',
        },
      ],
    },
  },
  {
    id: 'template_github_slack',
    name: 'GitHub Issue → Slack Notification',
    description:
      'Accept bug reports or customer feedback via webhook, create a tracked issue in your GitHub repository, and broadcast the issue link to Slack.',
    category: 'DevOps & Engineering',
    requiredCredentials: [
      {
        stepKey: 'gh_create',
        stepName: 'Create GitHub Issue',
        credentialType: 'github',
        description: 'GitHub Personal Access Token with repo scope to create issues.',
      },
      {
        stepKey: 'slack_broadcast',
        stepName: 'Slack Dev Broadcast',
        credentialType: 'slack',
        description: 'Slack Incoming Webhook URL to deliver notifications.',
      },
    ],
    graph: {
      nodes: [
        {
          key: 'webhook_bug',
          type: 'webhook.trigger',
          name: 'Bug Report Webhook',
          position: { x: 80, y: 180 },
          params: {
            method: 'POST',
          },
        },
        {
          key: 'gh_create',
          type: 'github.createIssue',
          name: 'Create GitHub Issue',
          position: { x: 360, y: 180 },
          params: {
            owner: 'organization-name',
            repo: 'product-repository',
            title: 'Bug: {{webhook_bug.body.title}}',
            body: '### Automated Issue Report\n\n**Reported By**: {{webhook_bug.body.reporter}}\n**Description**:\n{{webhook_bug.body.description}}\n\n*Created automatically via Vulp Studio.*',
            labels: ['bug', 'triage'],
          },
        },
        {
          key: 'slack_broadcast',
          type: 'slack.postMessage',
          name: 'Slack Dev Broadcast',
          position: { x: 640, y: 180 },
          params: {
            text: '🚨 *New GitHub Issue Created*:\n• *Title*: {{gh_create.title}}\n• *Repository*: organization-name/product-repository\n• *Issue URL*: {{gh_create.url}}',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'webhook_bug',
          sourcePort: 'default',
          target: 'gh_create',
        },
        {
          id: 'e2',
          source: 'gh_create',
          sourcePort: 'default',
          target: 'slack_broadcast',
        },
      ],
    },
  },
  {
    id: 'template_scheduled_reminder_gmail',
    name: 'Scheduled Reminder → Gmail',
    description:
      'Run on a recurring schedule (every weekday morning at 9:00 AM) to send an automated briefing or reminder email via Gmail.',
    category: 'Operations',
    requiredCredentials: [
      {
        stepKey: 'gmail_reminder',
        stepName: 'Morning Reminder Email',
        credentialType: 'google',
        description: 'Google account with Gmail send email permissions.',
      },
    ],
    graph: {
      nodes: [
        {
          key: 'sched_morning',
          type: 'schedule.trigger',
          name: 'Weekday 9 AM Schedule',
          position: { x: 80, y: 180 },
          params: {
            cron: '0 9 * * 1-5',
            timezone: 'UTC',
          },
        },
        {
          key: 'gmail_reminder',
          type: 'gmail.sendEmail',
          name: 'Morning Reminder Email',
          position: { x: 380, y: 180 },
          params: {
            to: 'team-leads@company.com',
            subject: 'Daily Standup & Priority Check-in (Scheduled)',
            body: 'Good morning Team,\n\nThis is your automated daily reminder to review pending customer tickets and update your standup tasks.\n\nHave a productive day!\n— Vulp Automation Bot',
            isHtml: false,
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'sched_morning',
          sourcePort: 'default',
          target: 'gmail_reminder',
        },
      ],
    },
  },
  {
    id: 'template_sheets_telegram_alert',
    name: 'Google Sheets Row → Telegram Alert',
    description:
      'Periodically query rows from Google Sheets (e.g. pending high-priority items) and dispatch a summary report directly to Telegram.',
    category: 'Operations',
    requiredCredentials: [
      {
        stepKey: 'sheets_read',
        stepName: 'Read Pending Items',
        credentialType: 'google',
        description: 'Google account with Google Sheets read access.',
      },
      {
        stepKey: 'tg_report',
        stepName: 'Telegram Dispatch',
        credentialType: 'telegram',
        description: 'Telegram Bot Token to post notifications.',
      },
    ],
    graph: {
      nodes: [
        {
          key: 'sched_hourly',
          type: 'schedule.trigger',
          name: 'Hourly Check',
          position: { x: 80, y: 180 },
          params: {
            cron: '0 * * * *',
            timezone: 'UTC',
          },
        },
        {
          key: 'sheets_read',
          type: 'sheets.readRows',
          name: 'Read Pending Items',
          position: { x: 360, y: 180 },
          params: {
            spreadsheetId: 'orders_sheets_id',
            sheetName: 'Orders',
            hasHeaders: true,
          },
        },
        {
          key: 'tg_report',
          type: 'telegram.sendMessage',
          name: 'Telegram Dispatch',
          position: { x: 640, y: 180 },
          params: {
            chatId: '-100987654321',
            text: '📊 *Hourly Orders Report*:\n• *Spreadsheet*: orders_sheets_id\n• *Rows Processed*: {{sheets_read.rowCount}}\n• *Timestamp*: {{$now}}',
            parseMode: 'Markdown',
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'sched_hourly',
          sourcePort: 'default',
          target: 'sheets_read',
        },
        {
          id: 'e2',
          source: 'sheets_read',
          sourcePort: 'default',
          target: 'tg_report',
        },
      ],
    },
  },
];
