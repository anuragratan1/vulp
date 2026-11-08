import { useState } from 'react';
import {
  Send,
  HelpCircle,
  Eye,
  CheckCheck,
  Tag,
  CircleDot,
  Paperclip,
} from 'lucide-react';
import {
  TelegramIcon,
  SlackIcon,
  GitHubIcon,
} from '../../components/ServiceIcons.js';
import {
  SmartInput,
  TokenizedMessageEditor,
  ConfigurationSection,
  resolveExpressionsForPreview,
} from '../fields/index.js';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';

interface IntegrationConfigProps {
  node: CanvasNode;
  params: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
}

// ============================================================================
// 1. Telegram: Send Message (Chat / Channel Composer)
// ============================================================================
export function TelegramSendMessageConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: IntegrationConfigProps) {
  const [showGuide, setShowGuide] = useState(false);

  const chatId = params.chatId || '';
  const text = params.text || '';
  const parseMode = params.parseMode || 'Markdown';
  const mediaUrl = params.mediaUrl || '';
  const mediaType = params.mediaType || 'photo';

  const previewChatId = resolveExpressionsForPreview(chatId, allNodes);
  const previewText = resolveExpressionsForPreview(text, allNodes);
  const previewMediaUrl = resolveExpressionsForPreview(mediaUrl, allNodes);

  // Formatting helpers
  const insertFormatting = (wrapper: string) => {
    const current = text || '';
    onParamChange('text', `${current}${wrapper}text${wrapper}`);
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <div className="flex items-center gap-2">
          <TelegramIcon size={16} />
          <span className="font-semibold text-white block">Telegram Message Composer</span>
        </div>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Broadcast alerts, structured notifications, and updates into Telegram chats or channels.
        </p>
      </div>

      {/* Recipient Section */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white">Target Chat or Channel</label>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="text-[11px] text-[#2AABEE] hover:underline flex items-center gap-1 font-medium"
          >
            <HelpCircle className="w-3 h-3" />
            <span>How to find Chat ID</span>
          </button>
        </div>

        {showGuide && (
          <div className="p-3 rounded-[14px] bg-[#0E1621] border border-[#1E2C3D] text-[11px] text-[#A3B8CC] space-y-2 animate-in fade-in-0 duration-150">
            <span className="font-bold text-[#2AABEE] block">Telegram Recipient Guide:</span>
            <ul className="list-disc list-inside space-y-1 text-[10px] leading-relaxed">
              <li>
                <strong className="text-white">To yourself:</strong> Message <code className="text-[#2AABEE]">@userinfobot</code> in Telegram to obtain your numeric user ID (e.g. <code className="text-white">123456789</code>).
              </li>
              <li>
                <strong className="text-white">To a Public Channel:</strong> Add your bot as an admin with post privileges, then enter the handle prefixed with @ (e.g. <code className="text-white">@my_tech_updates</code>).
              </li>
              <li>
                <strong className="text-white">To a Group Chat:</strong> Add your bot to the group, send a message, and use the group ID (e.g. <code className="text-white">-100123456789</code>).
              </li>
            </ul>
          </div>
        )}

        <SmartInput
          label="Chat ID or Channel Handle"
          value={chatId}
          onChange={(val) => onParamChange('chatId', val)}
          placeholder="e.g. @my_channel or 987654321"
          required={true}
          description="Enter a numeric user/group ID or public channel username prefixed with @"
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />
      </div>

      {/* Message Composer Section */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white">Message Content</label>
          {/* Format pills */}
          <div className="flex rounded-full bg-[#121212] border border-[#262626] p-0.5 text-[10px]">
            {['Markdown', 'HTML', 'MarkdownV2', 'None'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onParamChange('parseMode', mode)}
                className={`px-2.5 py-0.5 rounded-full transition-colors ${
                  parseMode === mode
                    ? 'bg-[#2AABEE] text-white font-medium'
                    : 'text-[#888888] hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Formatting Quick Tools */}
        {parseMode.startsWith('Markdown') && (
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-[#737373]">Formatting:</span>
            <button
              type="button"
              onClick={() => insertFormatting('*')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] font-bold"
              title="Bold"
            >
              *B*
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('_')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] italic"
              title="Italic"
            >
              _I_
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('`')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] font-mono"
              title="Inline Code"
            >
              `Code`
            </button>
            <button
              type="button"
              onClick={() => {
                const current = text || '';
                onParamChange('text', `${current}[Link Text](https://example.com)`);
              }}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3]"
              title="Link"
            >
              [Link]
            </button>
          </div>
        )}

        <TokenizedMessageEditor
          label="Message Text"
          value={text}
          onChange={(val) => onParamChange('text', val)}
          placeholder="🚀 *New Order Alert!* \n\nCustomer: {{ trigger.name }}\nAmount: ${{ trigger.amount }}\nOrder ID: {{ trigger.orderId }}"
          required={true}
          rows={5}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          description="Type your message or insert dynamic variables by typing @ from preceding steps."
        />
      </div>

      {/* Media Attachments (Collapsible) */}
      <ConfigurationSection
        title="Media Attachments (Optional)"
        description="Include images, photos, or documents alongside your Telegram message"
        collapsible={true}
        defaultOpen={Boolean(mediaUrl)}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="w-32">
              <label className="text-[11px] font-medium text-[#A3A3A3] block mb-1">Type</label>
              <select
                value={mediaType}
                onChange={(e) => onParamChange('mediaType', e.target.value)}
                className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-[#2AABEE]"
              >
                <option value="photo">Photo / Image</option>
                <option value="document">Document / PDF</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </div>
            <div className="flex-1">
              <SmartInput
                label="Media URL or Variable Reference"
                value={mediaUrl}
                onChange={(val) => onParamChange('mediaUrl', val)}
                placeholder="https://example.com/receipt.jpg or {{ trigger.photoUrl }}"
                allNodes={allNodes}
                edges={edges}
                nodeRuns={nodeRuns}
                currentNodeId={node.id}
              />
            </div>
          </div>
        </div>
      </ConfigurationSection>

      {/* Live Telegram Messenger Chat Bubble Preview */}
      <div className="p-3.5 rounded-[18px] bg-[#0E1621] border border-[#1E2C3D] space-y-2">
        <div className="flex items-center justify-between text-[#8DA0B3] text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold">
            <Send className="w-3.5 h-3.5 text-[#2AABEE]" />
            <span>Telegram Live Preview</span>
          </div>
          <span className="text-[10px] text-[#566B7F]">
            To: {previewChatId || '@channel'}
          </span>
        </div>

        {/* Telegram Chat Bubble */}
        <div className="max-w-[85%] rounded-[16px] rounded-tl-[4px] bg-[#182533] border border-[#243547] text-white p-3 space-y-2 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="font-semibold text-[#2AABEE]">Vulp Bot</span>
            <span className="text-[#5D84A3]">bot</span>
          </div>

          {/* Optional Media Preview */}
          {previewMediaUrl && (
            <div className="rounded-[10px] bg-[#101923] border border-[#233548] p-2 flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-[#2AABEE] shrink-0" />
              <span className="text-[11px] text-[#A3B8CC] truncate flex-1">
                {previewMediaUrl}
              </span>
            </div>
          )}

          {/* Body Text */}
          <p className="text-xs text-[#E1EAF0] whitespace-pre-wrap leading-relaxed">
            {previewText || 'Message content will render here in real time...'}
          </p>

          {/* Timestamp and Sent Status */}
          <div className="flex items-center justify-end gap-1 text-[9px] text-[#5D84A3] pt-0.5">
            <span>12:45 PM</span>
            <CheckCheck className="w-3 h-3 text-[#2AABEE]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. Slack: Post Message (Workspace Notification Composer)
// ============================================================================
export function SlackPostMessageConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: IntegrationConfigProps) {
  const text = params.text || '';
  const channel = params.channel || '';
  const username = params.username || '';
  const iconEmoji = params.iconEmoji || '';

  const previewText = resolveExpressionsForPreview(text, allNodes);
  const previewChannel = resolveExpressionsForPreview(channel, allNodes);
  const previewUsername = resolveExpressionsForPreview(username, allNodes);

  // Formatting helpers
  const insertSlackFormatting = (wrapper: string) => {
    const current = text || '';
    onParamChange('text', `${current}${wrapper}text${wrapper}`);
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <div className="flex items-center gap-2">
          <SlackIcon size={16} />
          <span className="font-semibold text-white block">Slack Message Composer</span>
        </div>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Post formatted notifications, workflow alerts, and announcements directly into Slack channels.
        </p>
      </div>

      {/* Channel Section */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <SmartInput
          label="Slack Channel"
          value={channel}
          onChange={(val) => onParamChange('channel', val)}
          placeholder="e.g. #sales-leads or #alerts"
          description="Enter a channel name (prefixed with #) or leave blank to use the incoming webhook default."
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />
      </div>

      {/* Message Composer Section */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white">Message Body</label>
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertSlackFormatting('*')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] font-bold"
              title="Bold (*text*)"
            >
              *B*
            </button>
            <button
              type="button"
              onClick={() => insertSlackFormatting('_')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] italic"
              title="Italic (_text_)"
            >
              _I_
            </button>
            <button
              type="button"
              onClick={() => insertSlackFormatting('~')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] line-through"
              title="Strikethrough (~text~)"
            >
              ~S~
            </button>
            <button
              type="button"
              onClick={() => insertSlackFormatting('`')}
              className="px-2 py-0.5 rounded bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] font-mono"
              title="Inline Code"
            >
              `Code`
            </button>
          </div>
        </div>

        <TokenizedMessageEditor
          label="Message Text (Supports Slack mrkdwn)"
          value={text}
          onChange={(val) => onParamChange('text', val)}
          placeholder="New lead captured: *{{ trigger.name }}*\nCompany: _{{ trigger.company }}_\nLead Score: `{{ trigger.score }}`"
          required={true}
          rows={5}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          description="Type message content or choose dynamic variables with @ from earlier steps."
        />
      </div>

      {/* Bot Customization Section */}
      <ConfigurationSection
        title="Sender Identity Overrides (Optional)"
        description="Customize the bot display name and avatar icon"
        collapsible={true}
        defaultOpen={Boolean(username || iconEmoji)}
      >
        <div className="grid grid-cols-2 gap-3">
          <SmartInput
            label="Bot Name Override"
            value={username}
            onChange={(val) => onParamChange('username', val)}
            placeholder="e.g. Vulp Lead Bot"
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />

          <SmartInput
            label="Bot Icon Emoji"
            value={iconEmoji}
            onChange={(val) => onParamChange('iconEmoji', val)}
            placeholder="e.g. :robot_face: or :bell:"
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />
        </div>
      </ConfigurationSection>

      {/* Live Slack Message Preview Card */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center gap-1.5 text-[#A3A3A3] text-[11px] font-semibold">
          <Eye className="w-3.5 h-3.5 text-[#E01E5A]" />
          <span>Slack Channel Preview {previewChannel ? `(${previewChannel})` : ''}</span>
        </div>
        <div className="p-3.5 rounded-[14px] bg-[#1A1D21] border border-[#2E3136] text-white flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#E01E5A] text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
            {iconEmoji ? iconEmoji.slice(0, 2) : (previewUsername ? previewUsername.charAt(0).toUpperCase() : 'V')}
          </div>
          <div className="truncate flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white">
                {previewUsername || 'Vulp Bot'}
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#2C3136] text-[#A0A0A2] font-semibold">
                APP
              </span>
              <span className="text-[10px] text-[#868686]">12:00 PM</span>
            </div>
            <p className="text-xs text-[#D1D2D3] whitespace-pre-wrap leading-relaxed">
              {previewText || 'Message content will render in Slack markdown...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 3. GitHub: Create Issue
// ============================================================================
export function GitHubCreateIssueConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: IntegrationConfigProps) {
  const owner = params.owner || '';
  const repo = params.repo || '';
  const title = params.title || '';
  const body = params.body || '';
  const labels = params.labels || '';

  const previewOwner = resolveExpressionsForPreview(owner, allNodes);
  const previewRepo = resolveExpressionsForPreview(repo, allNodes);
  const previewTitle = resolveExpressionsForPreview(title, allNodes);
  const previewBody = resolveExpressionsForPreview(body, allNodes);

  // Label chips helper
  const commonLabels = [
    { name: 'bug', color: '#D73A4A' },
    { name: 'enhancement', color: '#A2EEEF' },
    { name: 'automation', color: '#7057FF' },
    { name: 'priority-high', color: '#B60205' },
    { name: 'documentation', color: '#0075CA' },
  ];

  const currentLabelList = (typeof labels === 'string' ? labels.split(',') : [])
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleLabel = (labelName: string) => {
    if (currentLabelList.includes(labelName)) {
      onParamChange('labels', currentLabelList.filter((l) => l !== labelName).join(', '));
    } else {
      onParamChange('labels', [...currentLabelList, labelName].join(', '));
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <div className="flex items-center gap-2">
          <GitHubIcon size={16} className="text-[#F0F6FC]" />
          <span className="font-semibold text-white block">Create GitHub Issue</span>
        </div>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Open automated tracking issues, bug reports, and tasks in your GitHub repositories.
        </p>
      </div>

      {/* Repository Section */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <label className="text-xs font-semibold text-white block">Target Repository</label>
        <div className="grid grid-cols-2 gap-3">
          <SmartInput
            label="Repository Owner"
            value={owner}
            onChange={(val) => onParamChange('owner', val)}
            placeholder="e.g. acme-corp"
            required={true}
            description="GitHub username or organization"
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />

          <SmartInput
            label="Repository Name"
            value={repo}
            onChange={(val) => onParamChange('repo', val)}
            placeholder="e.g. web-app"
            required={true}
            description="Target repository"
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />
        </div>
      </div>

      {/* Issue Details Section */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <SmartInput
          label="Issue Title"
          value={title}
          onChange={(val) => onParamChange('title', val)}
          placeholder="e.g. Bug: Order #{{ trigger.orderId }} failed verification"
          required={true}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />

        <TokenizedMessageEditor
          label="Issue Description (Markdown)"
          value={body}
          onChange={(val) => onParamChange('body', val)}
          placeholder="### Automated Issue Details\n\n- Trigger: {{ trigger.name }}\n- Event ID: {{ trigger.id }}\n\nInvestigate logs..."
          rows={5}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          description="Supports GitHub Flavored Markdown and dynamic variables with @."
        />

        {/* Labels Selector & Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#A3A3A3]" />
            <span>Labels</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {commonLabels.map((lbl) => {
              const active = currentLabelList.includes(lbl.name);
              return (
                <button
                  key={lbl.name}
                  type="button"
                  onClick={() => toggleLabel(lbl.name)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                    active
                      ? 'bg-[#238636] border-[#238636] text-white'
                      : 'bg-[#141414] border-[#2A2A2A] text-[#A3A3A3] hover:text-white'
                  }`}
                >
                  {lbl.name}
                </button>
              );
            })}
          </div>

          <SmartInput
            label="Custom Labels (Comma-separated)"
            value={labels}
            onChange={(val) => onParamChange('labels', val)}
            placeholder="e.g. automated, critical, api"
            allNodes={allNodes}
            currentNodeId={node.id}
          />
        </div>
      </div>

      {/* Live GitHub Issue Card Preview */}
      <div className="p-3.5 rounded-[18px] bg-[#0D1117] border border-[#30363D] space-y-2.5">
        <div className="flex items-center justify-between text-[#8B949E] text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold">
            <CircleDot className="w-3.5 h-3.5 text-[#238636]" />
            <span>GitHub Issue Preview</span>
          </div>
          <span className="text-[10px] text-[#58A6FF]">
            {previewOwner && previewRepo ? `${previewOwner}/${previewRepo}` : 'repository'}
          </span>
        </div>

        <div className="p-3.5 rounded-[12px] bg-[#161B22] border border-[#30363D] space-y-2">
          <div className="flex items-start gap-2">
            <span className="px-2 py-0.5 rounded-full bg-[#238636] text-white text-[10px] font-semibold flex items-center gap-1 shrink-0 mt-0.5">
              <CircleDot className="w-2.5 h-2.5" />
              <span>Open</span>
            </span>
            <div className="flex-1 truncate">
              <span className="font-bold text-xs text-white block truncate">
                {previewTitle || 'Issue Title'}
              </span>
              <span className="text-[10px] text-[#8B949E]">
                #101 opened just now by Vulp Automation
              </span>
            </div>
          </div>

          {currentLabelList.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {currentLabelList.map((lbl) => (
                <span
                  key={lbl}
                  className="px-2 py-0.5 rounded-full bg-[#1F242C] border border-[#30363D] text-[10px] text-[#58A6FF] font-medium"
                >
                  {lbl}
                </span>
              ))}
            </div>
          )}

          {previewBody && (
            <p className="text-[11px] text-[#C9D1D9] pt-1.5 border-t border-[#30363D] whitespace-pre-wrap leading-relaxed">
              {previewBody}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
