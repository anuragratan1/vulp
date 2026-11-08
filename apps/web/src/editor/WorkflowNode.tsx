import React, { memo, useState, useMemo } from 'react';
import { Handle, Position, NodeProps, useConnection, useNodeConnections } from '@xyflow/react';
import {
  Play,
  Globe,
  GitBranch,
  GitMerge,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Webhook,
  Plus,
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
import { CanvasNode } from './graphConverter.js';

interface NodeMetaInfo {
  defaultTitle: string;
  icon: React.ElementType;
  defaultSubtext: string;
}

function getNodeMetaDisplay(type: string, name?: string): NodeMetaInfo {
  const lower = (name || '').toLowerCase();

  switch (type) {
    case 'manual.trigger':
      return {
        defaultTitle: 'Manual Trigger',
        icon: Play,
        defaultSubtext: 'Click Run to start this automation',
      };
    case 'webhook.trigger':
      return {
        defaultTitle: 'Webhook',
        icon: Webhook,
        defaultSubtext: 'Inbound Webhook',
      };
    case 'schedule.trigger':
      return {
        defaultTitle: 'Schedule',
        icon: Clock,
        defaultSubtext: 'Recurring Trigger',
      };
    case 'google_forms.trigger':
    case 'forms.trigger':
      return {
        defaultTitle: 'Google Forms',
        icon: GoogleFormsIcon,
        defaultSubtext: 'New Form Response',
      };
    case 'http.request':
      return {
        defaultTitle: 'HTTP Request',
        icon: Globe,
        defaultSubtext: 'Fetch Details',
      };
    case 'gmail.sendEmail':
      return {
        defaultTitle: 'Gmail',
        icon: GmailIcon,
        defaultSubtext: 'Send Email',
      };
    case 'sheets.readRows':
      return {
        defaultTitle: 'Google Sheets',
        icon: GoogleSheetsIcon,
        defaultSubtext: 'Read Rows',
      };
    case 'sheets.appendRow':
      return {
        defaultTitle: 'Google Sheets',
        icon: GoogleSheetsIcon,
        defaultSubtext: 'Append Row',
      };
    case 'sheets.updateRow':
      return {
        defaultTitle: 'Google Sheets',
        icon: GoogleSheetsIcon,
        defaultSubtext: 'Update Row',
      };
    case 'drive.uploadFile':
      return {
        defaultTitle: 'Google Drive',
        icon: GoogleDriveIcon,
        defaultSubtext: 'Upload File',
      };
    case 'drive.searchFiles':
      return {
        defaultTitle: 'Google Drive',
        icon: GoogleDriveIcon,
        defaultSubtext: 'Find Files',
      };
    case 'calendar.createEvent':
      return {
        defaultTitle: 'Google Calendar',
        icon: GoogleCalendarIcon,
        defaultSubtext: 'Create Event',
      };
    case 'telegram.sendMessage':
      return {
        defaultTitle: 'Telegram',
        icon: TelegramIcon,
        defaultSubtext: 'Send Message',
      };
    case 'slack.postMessage':
      return {
        defaultTitle: 'Slack',
        icon: SlackIcon,
        defaultSubtext: 'Post Message',
      };
    case 'github.createIssue':
      return {
        defaultTitle: 'GitHub',
        icon: GitHubIcon,
        defaultSubtext: 'Create Issue',
      };
    case 'logic.if':
      return {
        defaultTitle: 'IF',
        icon: GitBranch,
        defaultSubtext: 'Branch Condition',
      };
    case 'logic.merge':
      return {
        defaultTitle: 'Merge',
        icon: GitMerge,
        defaultSubtext: 'Combine Branches',
      };
    case 'logic.delay':
      return {
        defaultTitle: 'Delay',
        icon: Clock,
        defaultSubtext: 'Pause Execution',
      };
    default:
      if (lower.includes('mail') || lower.includes('email') || type.includes('gmail')) {
        return {
          defaultTitle: 'Gmail',
          icon: GmailIcon,
          defaultSubtext: 'Send Email',
        };
      }
      if (lower.includes('sheet') || lower.includes('lead') || type.includes('sheet')) {
        return {
          defaultTitle: 'Google Sheets',
          icon: GoogleSheetsIcon,
          defaultSubtext: 'Append Row',
        };
      }
      if (lower.includes('drive') || type.includes('drive')) {
        return {
          defaultTitle: 'Google Drive',
          icon: GoogleDriveIcon,
          defaultSubtext: 'Upload File',
        };
      }
      if (lower.includes('calendar') || type.includes('calendar')) {
        return {
          defaultTitle: 'Google Calendar',
          icon: GoogleCalendarIcon,
          defaultSubtext: 'Create Event',
        };
      }
      if (lower.includes('telegram') || type.includes('telegram')) {
        return {
          defaultTitle: 'Telegram',
          icon: TelegramIcon,
          defaultSubtext: 'Send Message',
        };
      }
      if (lower.includes('slack') || type.includes('slack')) {
        return {
          defaultTitle: 'Slack',
          icon: SlackIcon,
          defaultSubtext: 'Post Message',
        };
      }
      if (lower.includes('github') || type.includes('github')) {
        return {
          defaultTitle: 'GitHub',
          icon: GitHubIcon,
          defaultSubtext: 'Create Issue',
        };
      }
      return {
        defaultTitle: type.split('.').pop() || 'Step',
        icon: Globe,
        defaultSubtext: 'Action Step',
      };
  }
}

function WorkflowNodeComponent({
  id,
  data,
  selected,
  width,
  height,
  positionAbsoluteX,
  positionAbsoluteY,
}: NodeProps<CanvasNode>) {
  const { category, type, name, status } = data;
  const isTrigger =
    category === 'trigger' ||
    type.endsWith('.trigger') ||
    type.startsWith('manual.') ||
    type.startsWith('webhook.') ||
    type.startsWith('schedule.');
  const isIf = type === 'logic.if';
  const isMerge = type === 'logic.merge';
  const isStandardAction = !isTrigger && !isIf && !isMerge;

  const meta = getNodeMetaDisplay(type, name);
  const Icon = meta.icon;
  const title = name || meta.defaultTitle;

  // Dynamic informative subtext from params
  let subtext = meta.defaultSubtext;
  if (type === 'google_forms.trigger' || type === 'forms.trigger') {
    subtext = data.params?.formTitle ? String(data.params.formTitle) : 'New Form Response';
  } else if (type === 'telegram.sendMessage' && data.params?.chatId) {
    subtext = `Chat: ${String(data.params.chatId)}`;
  } else if (type === 'slack.postMessage' && data.params?.channel) {
    subtext = `#${String(data.params.channel)}`;
  } else if (type === 'github.createIssue' && data.params?.repo) {
    subtext = `${String(data.params.owner || '')}/${String(data.params.repo)}`;
  } else if (type === 'gmail.sendEmail' && data.params?.to) {
    subtext = `To: ${String(data.params.to)}`;
  } else if (type === 'sheets.appendRow' && data.params?.sheetName) {
    subtext = `Sheet: ${String(data.params.sheetName)}`;
  } else if (type === 'calendar.createEvent' && data.params?.summary) {
    subtext = String(data.params.summary);
  } else if (type === 'drive.uploadFile' && data.params?.fileName) {
    subtext = String(data.params.fileName);
  }

  // Border & selection styling strictly matching design tokens
  let borderClasses = 'border-border';
  if (selected) {
    borderClasses = 'border-accent shadow-[0_0_0_1px_rgba(59,130,246,0.5)] ring-1 ring-accent/30';
  } else if (status === 'running') {
    borderClasses = 'border-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.3)] animate-pulse';
  } else if (status === 'failed') {
    borderClasses = 'border-red-500/80 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]';
  } else if (status === 'succeeded') {
    borderClasses = 'border-emerald-500/60';
  }

  // Track connections on this node
  const nodeConnections = useNodeConnections({ id });
  const isNodeConnected = nodeConnections.length > 0;

  // Set of handle IDs that currently have an active edge connected to them
  const connectedHandleIds = useMemo(() => {
    const ids = new Set<string>();
    for (const conn of nodeConnections) {
      if (conn.source === id && conn.sourceHandle) {
        ids.add(conn.sourceHandle);
      }
      if (conn.target === id && conn.targetHandle) {
        ids.add(conn.targetHandle);
      }
    }
    return ids;
  }, [nodeConnections, id]);

  // Local hover tracking
  const [isHovered, setIsHovered] = useState(false);

  // Connection state when user drags a connection wire
  const connection = useConnection((s) => ({
    inProgress: s.inProgress,
    fromNodeId: s.fromNode?.id ?? null,
    fromHandleType: s.fromHandle?.type ?? null,
    toNodeId: s.toNode?.id ?? null,
    to: s.to,
  }));

  const isConnecting = connection.inProgress;
  const isSelf = connection.fromNodeId === id;

  // Detect whether a dragged connection cursor is approaching this node
  const isApproaching = useMemo(() => {
    if (!isConnecting || isSelf) return false;
    if (isHovered) return true;
    if (connection.toNodeId === id) return true;
    if (connection.to && typeof positionAbsoluteX === 'number' && typeof positionAbsoluteY === 'number') {
      const nodeW = width || 240;
      const nodeH = height || 64;
      const cx = connection.to.x;
      const cy = connection.to.y;
      const dx = Math.max(positionAbsoluteX - cx, 0, cx - (positionAbsoluteX + nodeW));
      const dy = Math.max(positionAbsoluteY - cy, 0, cy - (positionAbsoluteY + nodeH));
      return Math.sqrt(dx * dx + dy * dy) < 110;
    }
    return false;
  }, [
    isConnecting,
    isSelf,
    isHovered,
    connection.toNodeId,
    connection.to,
    positionAbsoluteX,
    positionAbsoluteY,
    width,
    height,
  ]);

  // Contextual visibility predicate for additional handles
  const isAdditionalHandleRevealed = (handleId: string, handleType: 'source' | 'target') => {
    // 1. If this specific handle already has an active connected edge, it must always remain visible
    if (connectedHandleIds.has(handleId)) {
      return true;
    }
    // 2. Active/selected state: Reveal additional relevant handles when node is active AND connected
    if (selected && isNodeConnected) {
      return true;
    }
    // 3. Connection-dragging state: When user drags a wire and approaches this node, reveal compatible handles
    if (isApproaching) {
      const compatibleType = connection.fromHandleType === 'source' ? 'target' : 'source';
      if (handleType === compatibleType) {
        return true;
      }
    }
    return false;
  };

  // Base handle class with generous invisible hit area and smooth hover transition
  const baseHandleClass =
    "before:content-[''] before:absolute before:-inset-3 before:rounded-full before:cursor-crosshair shadow-xs transition-all duration-180";

  const primaryHandleClass = `${baseHandleClass} handle-primary`;

  const getAdditionalHandleClass = (revealed: boolean, extraClasses = '') =>
    `${baseHandleClass} handle-additional ${revealed ? 'handle-revealed' : 'handle-hidden'} ${extraClasses}`;

  return (
    <div
      className={`workflow-node group relative min-w-[210px] max-w-[260px] rounded-[18px] bg-node ${borderClasses} border transition-all duration-200 select-none cursor-pointer shadow-md ${
        selected ? 'selected ring-1 ring-accent/40' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {/* ============================================================= */}
      {/* 1. LEFT FACE HANDLES (TARGET INPUTS)                         */}
      {/* ============================================================= */}

      {/* Standard Action: Single primary input at center */}
      {isStandardAction && (
        <Handle
          id="input"
          type="target"
          position={Position.Left}
          style={{ top: '50%' }}
          isConnectable={true}
          className={primaryHandleClass}
          title="Input (from left)"
        />
      )}

      {/* IF node: Single primary input at center */}
      {isIf && (
        <Handle
          id="input"
          type="target"
          position={Position.Left}
          style={{ top: '50%' }}
          isConnectable={true}
          className={primaryHandleClass}
          title="Condition Input"
        />
      )}

      {/* Merge node: Two balanced inputs on left */}
      {isMerge && (
        <>
          <Handle
            id="input"
            type="target"
            position={Position.Left}
            style={{ top: '32%' }}
            isConnectable={true}
            className={primaryHandleClass}
            title="Branch Input 1"
          />
          <Handle
            id="input-bottom"
            type="target"
            position={Position.Left}
            style={{ top: '68%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-bottom', 'target'))}
            title="Branch Input 2"
          />
        </>
      )}

      {/* ============================================================= */}
      {/* 2. TOP FACE HANDLES (CONTEXTUAL MULTI-DIRECTIONAL)            */}
      {/* ============================================================= */}

      {/* Standard Action: Target & Source centered at 50% */}
      {isStandardAction && (
        <>
          <Handle
            id="input-top"
            type="target"
            position={Position.Top}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-top', 'target'))}
            title="Input (from top)"
          />
          <Handle
            id="default-top"
            type="source"
            position={Position.Top}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('default-top', 'source'))}
            title="Output (to top)"
          />
        </>
      )}

      {/* Trigger: Source output upwards centered at 50% */}
      {isTrigger && (
        <Handle
          id="default-top"
          type="source"
          position={Position.Top}
          style={{ left: '50%' }}
          isConnectable={true}
          className={getAdditionalHandleClass(isAdditionalHandleRevealed('default-top', 'source'))}
          title="Output (to top)"
        />
      )}

      {/* IF node: Input & TRUE branch centered at 50% */}
      {isIf && (
        <>
          <Handle
            id="input-top"
            type="target"
            position={Position.Top}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-top', 'target'))}
            title="Input (from top)"
          />
          <Handle
            id="true-top"
            type="source"
            position={Position.Top}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(
              isAdditionalHandleRevealed('true-top', 'source'),
              '!border-emerald-400 hover:!border-emerald-300 hover:!bg-emerald-500/20'
            )}
            title="True Branch (to top)"
          />
        </>
      )}

      {/* Merge: Input & Source centered at 50% */}
      {isMerge && (
        <>
          <Handle
            id="input-top"
            type="target"
            position={Position.Top}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-top', 'target'))}
            title="Input (from top)"
          />
          <Handle
            id="default-top"
            type="source"
            position={Position.Top}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('default-top', 'source'))}
            title="Output (to top)"
          />
        </>
      )}

      {/* ============================================================= */}
      {/* 3. BOTTOM FACE HANDLES (CONTEXTUAL MULTI-DIRECTIONAL)         */}
      {/* ============================================================= */}

      {/* Standard Action: Target & Source centered at 50% */}
      {isStandardAction && (
        <>
          <Handle
            id="input-bottom"
            type="target"
            position={Position.Bottom}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-bottom', 'target'))}
            title="Input (from bottom)"
          />
          <Handle
            id="default-bottom"
            type="source"
            position={Position.Bottom}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('default-bottom', 'source'))}
            title="Output (to bottom)"
          />
        </>
      )}

      {/* Trigger: Source output downwards centered at 50% */}
      {isTrigger && (
        <Handle
          id="default-bottom"
          type="source"
          position={Position.Bottom}
          style={{ left: '50%' }}
          isConnectable={true}
          className={getAdditionalHandleClass(isAdditionalHandleRevealed('default-bottom', 'source'))}
          title="Output (to bottom)"
        />
      )}

      {/* IF node: Input & FALSE branch centered at 50% */}
      {isIf && (
        <>
          <Handle
            id="input-bottom"
            type="target"
            position={Position.Bottom}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-bottom', 'target'))}
            title="Input (from bottom)"
          />
          <Handle
            id="false-bottom"
            type="source"
            position={Position.Bottom}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(
              isAdditionalHandleRevealed('false-bottom', 'source'),
              '!border-rose-400 hover:!border-rose-300 hover:!bg-rose-500/20'
            )}
            title="False Branch (to bottom)"
          />
        </>
      )}

      {/* Merge: Input & Source centered at 50% */}
      {isMerge && (
        <>
          <Handle
            id="input-bottom-face"
            type="target"
            position={Position.Bottom}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('input-bottom-face', 'target'))}
            title="Input (from bottom)"
          />
          <Handle
            id="default-bottom"
            type="source"
            position={Position.Bottom}
            style={{ left: '50%' }}
            isConnectable={true}
            className={getAdditionalHandleClass(isAdditionalHandleRevealed('default-bottom', 'source'))}
            title="Output (to bottom)"
          />
        </>
      )}

      {/* ============================================================= */}
      {/* NODE CONTENT CONTAINER                                        */}
      {/* ============================================================= */}
      <div className="p-3.5 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Official service logo container: clean, naturally integrated without harsh stroke/border */}
          <div className="w-10 h-10 rounded-xl bg-node-icon text-text-primary flex items-center justify-center shrink-0">
            <Icon size={22} className="shrink-0" />
          </div>

          {/* Text information */}
          <div className="truncate flex-1">
            <span className="text-xs font-semibold text-text-primary block leading-tight truncate">
              {title}
            </span>
            <span className="text-[11px] text-text-muted font-normal block leading-tight mt-1 font-sans truncate">
              {subtext}
            </span>
          </div>
        </div>

        {/* Subtle branch labels for IF node (Right side) */}
        {isIf && (
          <div className="flex flex-col justify-between h-9 text-[8.5px] font-mono font-bold select-none pointer-events-none pr-0.5 shrink-0 text-right">
            <span className="text-emerald-500 font-bold tracking-wider">TRUE</span>
            <span className="text-rose-500 font-bold tracking-wider">FALSE</span>
          </div>
        )}

        {/* Status indicator badge */}
        {Boolean(status) && (
          <div className="shrink-0 flex items-center">
            {status === 'running' && (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            )}
            {status === 'succeeded' && (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            {status === 'failed' && (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* 4. RIGHT FACE HANDLES (SOURCE OUTPUTS)                        */}
      {/* ============================================================= */}

      {/* Standard Action, Triggers, & Merge: exactly ONE primary output on right, vertically centered */}
      {(isStandardAction || isTrigger || isMerge) && (
        <Handle
          id="default"
          type="source"
          position={Position.Right}
          style={{ top: '50%' }}
          isConnectable={true}
          className={primaryHandleClass}
          title="Output (to right)"
        />
      )}

      {/* Contextual "Add Action" affordance for Manual Trigger when output is unconnected */}
      {Boolean(data.showAddActionAffordance) && !isConnecting && !connectedHandleIds.has('default') && (
        <div
          className="absolute left-full top-1/2 -translate-y-1/2 flex items-center z-20 pointer-events-auto nodrag nopan select-none pl-2"
          style={{ transform: 'translateY(-50%)' }}
        >
          {/* Subtle connecting line from output handle */}
          <div className="w-3 border-t border-dashed border-[#FF7306]/60 mr-1.5" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (typeof data.onAddNextAction === 'function') {
                (data.onAddNextAction as (nodeId: string) => void)(id);
              }
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated/95 hover:bg-surface-hover border border-[#FF7306]/50 hover:border-[#FF7306] text-text-primary text-[11px] font-medium shadow-md hover:shadow-lg transition-all group/btn whitespace-nowrap cursor-pointer hover:scale-105 active:scale-95"
            title="Add first action step"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-[#FF7306]/15 flex items-center justify-center text-[#FF7306] group-hover/btn:bg-[#FF7306] group-hover/btn:text-black transition-colors">
              <Plus className="w-2.5 h-2.5" />
            </span>
            <span>Add Action</span>
          </button>
        </div>
      )}

      {/* IF node: TWO clearly separated outputs on right (TRUE at 32%, FALSE at 68%) */}
      {isIf && (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: '32%' }}
            isConnectable={true}
            className={`${primaryHandleClass} !border-emerald-400 hover:!border-emerald-300 hover:!bg-emerald-500/20 shadow-[0_0_6px_rgba(52,211,153,0.35)]`}
            title="True Branch (Condition Met)"
          />
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: '68%' }}
            isConnectable={true}
            className={`${primaryHandleClass} !border-rose-400 hover:!border-rose-300 hover:!bg-rose-500/20 shadow-[0_0_6px_rgba(244,63,94,0.35)]`}
            title="False Branch (Condition Unmet)"
          />
        </>
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
