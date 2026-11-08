import React, { useState } from 'react';
import {
  Play,
  Globe,
  GitBranch,
  GitMerge,
  Clock,
  Plus,
  Search,
  X,
  Webhook,
  Calendar,
} from 'lucide-react';
import {
  TelegramIcon,
  SlackIcon,
  GitHubIcon,
  GmailIcon,
  GoogleSheetsIcon,
  GoogleDriveIcon,
  GoogleCalendarIcon,
  GoogleFormsIcon,
} from '../components/ServiceIcons.js';
import { NodeTypeMetadata } from '../api/client.js';

interface NodePaletteProps {
  nodeTypes: NodeTypeMetadata[];
  onAddNode: (type: string) => void;
  onClose?: () => void;
  title?: string;
}

function getNodeDisplayInfo(type: string, fallbackLabel: string) {
  switch (type) {
    case 'manual.trigger':
      return {
        title: 'Manual Trigger',
        description: 'Trigger workflow manually or with test payload',
        icon: Play,
      };
    case 'webhook.trigger':
      return {
        title: 'Webhook Trigger',
        description: 'Trigger flow automatically via unique HTTP URL',
        icon: Webhook,
      };
    case 'schedule.trigger':
      return {
        title: 'Schedule Trigger',
        description: 'Trigger flow on a recurring cron schedule',
        icon: Calendar,
      };
    case 'google_forms.trigger':
    case 'forms.trigger':
      return {
        title: 'Google Forms Trigger',
        description: 'Trigger flow automatically on new form response',
        icon: GoogleFormsIcon,
      };
    case 'http.request':
      return {
        title: 'HTTP Request',
        description: 'Call external APIs with headers & body',
        icon: Globe,
      };
    case 'gmail.sendEmail':
      return {
        title: 'Gmail: Send Email',
        description: 'Send plain text or HTML emails from Gmail',
        icon: GmailIcon,
      };
    case 'sheets.readRows':
      return {
        title: 'Google Sheets: Read Rows',
        description: 'Read spreadsheet rows with header mapping',
        icon: GoogleSheetsIcon,
      };
    case 'sheets.appendRow':
      return {
        title: 'Google Sheets: Append Row',
        description: 'Append new rows to any Google Sheet',
        icon: GoogleSheetsIcon,
      };
    case 'sheets.updateRow':
      return {
        title: 'Google Sheets: Update Row',
        description: 'Update specific cells or rows in a sheet',
        icon: GoogleSheetsIcon,
      };
    case 'drive.uploadFile':
      return {
        title: 'Google Drive: Upload File',
        description: 'Upload files and documents to Google Drive',
        icon: GoogleDriveIcon,
      };
    case 'drive.searchFiles':
      return {
        title: 'Google Drive: Find Files',
        description: 'Search for files by name or query in Drive',
        icon: GoogleDriveIcon,
      };
    case 'calendar.createEvent':
      return {
        title: 'Google Calendar: Create Event',
        description: 'Create scheduled meetings with attendees',
        icon: GoogleCalendarIcon,
      };
    case 'telegram.sendMessage':
      return {
        title: 'Telegram Message',
        description: 'Send bot messages to Telegram chats & channels',
        icon: TelegramIcon,
      };
    case 'slack.postMessage':
      return {
        title: 'Slack Message',
        description: 'Post rich formatted notifications to Slack channels',
        icon: SlackIcon,
      };
    case 'github.createIssue':
      return {
        title: 'GitHub Issue',
        description: 'Create tracked issues in GitHub repositories',
        icon: GitHubIcon,
      };
    case 'logic.if':
      return {
        title: 'IF Condition',
        description: 'Branch flow using true/false criteria',
        icon: GitBranch,
      };
    case 'logic.merge':
      return {
        title: 'Merge Branches',
        description: 'Reunite parallel paths into one step',
        icon: GitMerge,
      };
    case 'logic.delay':
      return {
        title: 'Delay',
        description: 'Pause flow for a specified duration',
        icon: Clock,
      };
    default: {
      const lower = (type || '').toLowerCase();
      if (lower.includes('gmail')) {
        return {
          title: fallbackLabel || 'Gmail',
          description: 'Gmail operation step',
          icon: GmailIcon,
        };
      }
      if (lower.includes('sheet')) {
        return {
          title: fallbackLabel || 'Google Sheets',
          description: 'Google Sheets operation step',
          icon: GoogleSheetsIcon,
        };
      }
      if (lower.includes('drive')) {
        return {
          title: fallbackLabel || 'Google Drive',
          description: 'Google Drive operation step',
          icon: GoogleDriveIcon,
        };
      }
      if (lower.includes('calendar')) {
        return {
          title: fallbackLabel || 'Google Calendar',
          description: 'Google Calendar operation step',
          icon: GoogleCalendarIcon,
        };
      }
      if (lower.includes('telegram')) {
        return {
          title: fallbackLabel || 'Telegram',
          description: 'Telegram operation step',
          icon: TelegramIcon,
        };
      }
      if (lower.includes('slack')) {
        return {
          title: fallbackLabel || 'Slack',
          description: 'Slack operation step',
          icon: SlackIcon,
        };
      }
      if (lower.includes('github')) {
        return {
          title: fallbackLabel || 'GitHub',
          description: 'GitHub operation step',
          icon: GitHubIcon,
        };
      }
      return {
        title: fallbackLabel || type,
        description: 'Custom automation step',
        icon: Globe,
      };
    }
  }
}

export function NodePalette({ nodeTypes, onAddNode, onClose, title }: NodePaletteProps) {
  const [search, setSearch] = useState('');

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const filtered = nodeTypes.filter((nt) => {
    const q = search.toLowerCase();
    const info = getNodeDisplayInfo(nt.type, nt.label);
    return (
      info.title.toLowerCase().includes(q) ||
      info.description.toLowerCase().includes(q) ||
      nt.type.toLowerCase().includes(q)
    );
  });

  const triggers = filtered.filter((n) => n.category === 'trigger');
  const integrations = filtered.filter(
    (n) =>
      n.category === 'action' &&
      (n.type.startsWith('google.') ||
        n.type.startsWith('gmail.') ||
        n.type.startsWith('sheets.') ||
        n.type.startsWith('drive.') ||
        n.type.startsWith('calendar.') ||
        n.type.startsWith('telegram.') ||
        n.type.startsWith('slack.') ||
        n.type.startsWith('github.'))
  );
  const actions = filtered.filter(
    (n) => n.category === 'action' && !integrations.some((i) => i.type === n.type)
  );
  const logic = filtered.filter((n) => n.category === 'logic');

  return (
    <div className="w-80 bg-[#141414] border-r border-[#222222] flex flex-col h-full font-sans select-none">
      {/* Search Header */}
      <div className="p-4 border-b border-[#222222] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
            {title || 'Step Library'}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-text-muted hover:text-text-primary hover:bg-[#202020] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search triggers, integrations..."
            className="w-full bg-[#1A1A1A] border border-[#282828] focus:border-[#444] text-text-primary rounded-[12px] pl-8 pr-3 py-2 text-xs outline-none transition-colors"
          />
        </div>
      </div>

      {/* Palette List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Triggers Section */}
        {triggers.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider px-2">
              Triggers
            </span>
            <div className="space-y-1">
              {triggers.map((nt) => renderPaletteItem(nt))}
            </div>
          </div>
        )}

        {/* External Integrations Section */}
        {integrations.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider px-2">
              Connected Integrations
            </span>
            <div className="space-y-1">
              {integrations.map((nt) => renderPaletteItem(nt))}
            </div>
          </div>
        )}

        {/* Standard Actions Section */}
        {actions.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider px-2">
              Actions
            </span>
            <div className="space-y-1">
              {actions.map((nt) => renderPaletteItem(nt))}
            </div>
          </div>
        )}

        {/* Logic / Flow Control Section */}
        {logic.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider px-2">
              Logic & Flow Control
            </span>
            <div className="space-y-1">
              {logic.map((nt) => renderPaletteItem(nt))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-xs text-text-muted">
            No matching steps found
          </div>
        )}
      </div>
    </div>
  );

  function renderPaletteItem(nt: NodeTypeMetadata) {
    const info = getNodeDisplayInfo(nt.type, nt.label);
    const Icon = info.icon;

    return (
      <div
        key={nt.type}
        draggable
        onDragStart={(e) => onDragStart(e, nt.type)}
        onClick={() => onAddNode(nt.type)}
        className="group p-2.5 rounded-[14px] bg-[#171717] hover:bg-[#1E1E1E] border border-[#242424] hover:border-[#383838] flex items-center justify-between gap-3 cursor-grab active:cursor-grabbing transition-all shadow-sm"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-[#222222] border border-[#2C2C2C] flex items-center justify-center shrink-0 shadow-inner">
            <Icon size={16} />
          </div>
          <div className="truncate">
            <span className="text-xs font-medium text-text-primary block leading-tight truncate">
              {info.title}
            </span>
            <span className="text-[10px] text-text-muted block leading-tight mt-0.5 truncate">
              {info.description}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddNode(nt.type);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-full bg-[#242424] hover:bg-[#2C2C2C] text-text-primary transition-opacity shrink-0"
          title="Add step to canvas"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }
}
