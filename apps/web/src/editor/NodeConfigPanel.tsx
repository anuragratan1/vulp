import { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Play,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Code2,
} from 'lucide-react';
import {
  ServiceIcon,
  getServiceBrandColor,
} from '../components/ServiceIcons.js';
import { CanvasNode, CanvasEdge } from './graphConverter.js';
import {
  api,
  NodeTypeMetadata,
  CredentialRecord,
  WebhookRecord,
  NodeRunRecord,
} from '../api/client.js';
import {
  UniversalAccountSelector,
  SmartInput,
  UniversalTextarea,
  UniversalSelect,
  UniversalToggle,
  UniversalKeyValueEditor,
} from './fields/index.js';
import {
  ManualTriggerConfig,
  WebhookTriggerConfig,
  ScheduleTriggerConfig,
  GoogleFormsTriggerConfig,
  IfNodeConfig,
  DelayNodeConfig,
  MergeNodeConfig,
  HttpRequestConfig,
  GmailSendEmailConfig,
  SheetsAppendRowConfig,
  SheetsReadRowsConfig,
  SheetsUpdateRowConfig,
  DriveUploadFileConfig,
  DriveSearchFilesConfig,
  CalendarCreateEventConfig,
  TelegramSendMessageConfig,
  SlackPostMessageConfig,
  GitHubCreateIssueConfig,
} from './nodeConfigs/index.js';

export const NODE_DESCRIPTIONS: Record<string, string> = {
  'manual.trigger': 'Starts this workflow manually on demand. You can supply optional test input data to simulate incoming data for downstream actions.',
  'webhook.trigger': 'Listens for incoming HTTP requests and triggers this workflow with the received data.',
  'google_forms.trigger': 'Triggers automatically whenever someone submits a Google Form and maps responses into dynamic workflow variables.',
  'forms.trigger': 'Triggers automatically whenever someone submits a Google Form and maps responses into dynamic workflow variables.',
  'schedule.trigger': 'Executes this workflow automatically on a scheduled recurring cadence or cron timer.',
  'http.request': 'Sends an automated HTTP request to any external API or webhook endpoint.',
  'logic.if': 'Branches your workflow by evaluating conditions on data from previous steps.',
  'logic.delay': 'Pauses workflow execution for a specified amount of time before continuing.',
  'logic.merge': 'Combines data from multiple branches back into a single downstream execution path.',
  'gmail.sendEmail': 'Sends automated emails with personalized dynamic variables through Gmail.',
  'sheets.appendRow': 'Appends a new row of data to a Google Spreadsheet with mapped columns.',
  'sheets.readRows': 'Reads rows and column data from a Google Spreadsheet for use in workflow steps.',
  'sheets.updateRow': 'Updates or overwrites specific cells in an existing Google Spreadsheet row.',
  'drive.uploadFile': 'Creates or uploads text, JSON, CSV, or document files to Google Drive.',
  'drive.searchFiles': 'Searches files and folders in Google Drive by name, query, or file type.',
  'calendar.createEvent': 'Schedules meetings and creates automated events on Google Calendar.',
  'telegram.sendMessage': 'Sends messages and automated alerts to a Telegram chat or channel.',
  'slack.postMessage': 'Posts formatted messages, alerts, and rich cards to Slack channels.',
  'github.createIssue': 'Opens a new issue in a GitHub repository with custom markdown and labels.',
};

interface NodeConfigPanelProps {
  node: CanvasNode | null;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  meta: NodeTypeMetadata | undefined;
  workflowId?: string;
  workflowActive?: boolean;
  onUpdate: (key: string, updates: Partial<CanvasNode['data']>) => void;
  onDelete: (key: string) => void;
  onClose: () => void;
  onTestStep?: () => void;
}

export function NodeConfigPanel({
  node,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  meta,
  workflowId,
  workflowActive = false,
  onUpdate,
  onDelete,
  onClose,
  onTestStep,
}: NodeConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'output' | 'settings'>(() => {
    if (typeof window === 'undefined') return 'config';
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'test' || t === 'output' || t === 'settings' ? t : 'config';
  });
  const [isWideMode, setIsWideMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('wide') === 'true';
  });
  const [copiedKey, setCopiedKey] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Testing State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'succeeded' | 'failed';
    durationMs?: number;
    output?: any;
    error?: string;
  } | null>(null);

  // External data
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);

  const loadCredentials = async () => {
    try {
      const list = await api.getCredentials();
      setCredentials(list);
    } catch {}
  };

  useEffect(() => {
    loadCredentials();

    if (workflowId) {
      api.getWorkflowWebhooks(workflowId).then(setWebhooks).catch(() => {});
    }
  }, [workflowId, node?.id]);

  if (!node) return null;

  const { data } = node;
  const params = data.params || {};

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(node.id, { name: e.target.value });
  };

  const handleParamChange = (fieldName: string | Record<string, any>, value?: any) => {
    if (typeof fieldName === 'object' && fieldName !== null) {
      const updated = { ...params, ...fieldName };
      onUpdate(node.id, { params: updated });
    } else {
      const updated = { ...params, [fieldName]: value };
      onUpdate(node.id, { params: updated });
    }
  };

  const handleCredentialChange = (credentialId: string) => {
    onUpdate(node.id, { credentialId: credentialId || undefined });
  };

  const handleRetryChange = (key: string, value: any) => {
    const current = data.retry || { maxAttempts: 1, backoff: 'fixed', delayMs: 1000 };
    const updated = { ...current, [key]: value };
    onUpdate(node.id, { retry: updated });
  };

  const handleOnErrorChange = (value: 'stop' | 'continue') => {
    onUpdate(node.id, { onError: value });
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(data.key || node.id);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Run Step Test
  const handleRunStepTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = Date.now();

    try {
      // 1. Basic inline client validation check
      if (meta?.params) {
        for (const f of meta.params) {
          if (f.required && (params[f.name] === undefined || params[f.name] === '')) {
            throw new Error(`Missing required field: "${f.label || f.name}". Please fill it in.`);
          }
        }
      }

      // Specialized Direct Gmail Test Execution
      if (data.type === 'gmail.sendEmail') {
        if (!data.credentialId) {
          throw new Error('Google Workspace / Gmail credential is required. Please connect your Google account.');
        }
        const testRes = await fetch('/api/integrations/google/gmail/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentialId: data.credentialId,
            to: params.to,
            subject: params.subject,
            body: params.body,
            cc: params.cc,
            bcc: params.bcc,
            replyTo: params.replyTo,
            senderName: params.senderName,
            isHtml: params.isHtml,
            attachments: params.attachments,
          }),
        });
        const testData = await testRes.json();
        const duration = Date.now() - start;
        if (!testRes.ok || !testData.success) {
          throw new Error(testData.error || 'Failed to send test email via Gmail API');
        }
        setTestResult({
          status: 'succeeded',
          durationMs: duration,
          output: {
            message: `Email successfully delivered via Gmail API to ${params.to}.`,
            id: testData.result?.id,
            threadId: testData.result?.threadId,
            to: testData.result?.to,
            attachmentsCount: testData.result?.attachmentsCount || 0,
          },
        });
        return;
      }

      // Specialized Direct Telegram Test Execution
      if (data.type === 'telegram.sendMessage') {
        if (!data.credentialId) {
          throw new Error('Telegram Bot credential is required. Please connect your Telegram Bot token.');
        }
        const testRes = await fetch('/api/integrations/telegram/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            credentialId: data.credentialId,
            chatId: params.chatId,
            text: params.text,
            parseMode: params.parseMode,
          }),
        });
        const testData = await testRes.json();
        const duration = Date.now() - start;
        if (!testRes.ok || !testData.success) {
          throw new Error(testData.error || 'Failed to send test message via Telegram Bot API');
        }
        setTestResult({
          status: 'succeeded',
          durationMs: duration,
          output: {
            message: `Message successfully delivered to Telegram chat ${params.chatId}.`,
            messageId: testData.result?.messageId,
            chatId: testData.result?.chatId,
            date: testData.result?.date,
            sender: testData.result?.sender,
          },
        });
        return;
      }

      // 2. If workflow is saved, trigger a test execution
      if (workflowId) {
        const targetNodeKey = data.key || node.id;
        const { runId } = await api.runWorkflow(workflowId, {
          triggerKey: data.category === 'trigger' ? targetNodeKey : undefined,
          triggerPayload: data.type === 'manual.trigger' ? params.payload : undefined,
        });

        // Poll for completion (up to 4s)
        let matchedNodeRun: NodeRunRecord | undefined;
        for (let i = 0; i < 8; i++) {
          await new Promise((r) => setTimeout(r, 400));
          const details = await api.getRunDetails(runId);
          matchedNodeRun = details.nodeRuns.find(
            (nr) => nr.nodeKey === targetNodeKey || nr.nodeKey === node.id || nr.nodeKey === data.key
          );
          if (matchedNodeRun && matchedNodeRun.status !== 'running') {
            break;
          }
        }

        const duration = Date.now() - start;
        if (matchedNodeRun) {
          setTestResult({
            status: matchedNodeRun.status === 'succeeded' ? 'succeeded' : 'failed',
            durationMs: duration,
            output: matchedNodeRun.output ?? matchedNodeRun.paramsResolved,
            error: matchedNodeRun.error || undefined,
          });
        } else {
          setTestResult({
            status: 'failed',
            durationMs: duration,
            error: `Step '${data.name || node.id}' did not execute during workflow run. Verify upstream trigger inputs and step connections.`,
          });
        }
      } else {
        if (isIntegrationStep && !data.credentialId) {
          throw new Error(`A connected account is required to test ${data.name || 'this integration step'}. Please select a credential.`);
        }
        // Simulated local validation pass for offline draft non-integration nodes
        await new Promise((r) => setTimeout(r, 350));
        setTestResult({
          status: 'succeeded',
          durationMs: Date.now() - start,
          output: {
            message: 'All parameters validated successfully.',
            configuredFields: Object.keys(params),
            readyToRun: true,
          },
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'failed',
        durationMs: Date.now() - start,
        error: err?.message || String(err),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const isIntegrationStep = Boolean(meta?.credentialType);
  const brandColor = getServiceBrandColor(data.type);
  const oneSentenceDescription =
    NODE_DESCRIPTIONS[data.type] || `${meta?.label || 'Step'} in your automated workflow.`;

  // Render Specialized Configuration based on node type
  const renderSpecializedConfig = () => {
    switch (data.type) {
      case 'manual.trigger':
        return (
          <ManualTriggerConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
          />
        );
      case 'webhook.trigger':
        return (
          <WebhookTriggerConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            workflowActive={workflowActive}
            webhooks={webhooks}
            workflowId={workflowId}
          />
        );
      case 'schedule.trigger':
        return (
          <ScheduleTriggerConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
          />
        );
      case 'google_forms.trigger':
      case 'forms.trigger':
        return (
          <GoogleFormsTriggerConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            workflowActive={workflowActive}
            workflowId={workflowId}
          />
        );
      case 'http.request':
        return (
          <HttpRequestConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'logic.if':
        return (
          <IfNodeConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
          />
        );
      case 'logic.delay':
        return (
          <DelayNodeConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
          />
        );
      case 'logic.merge':
        return (
          <MergeNodeConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
          />
        );
      case 'gmail.sendEmail':
        return (
          <GmailSendEmailConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'sheets.appendRow':
        return (
          <SheetsAppendRowConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'sheets.readRows':
        return (
          <SheetsReadRowsConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'sheets.updateRow':
        return (
          <SheetsUpdateRowConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'drive.uploadFile':
        return (
          <DriveUploadFileConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'drive.searchFiles':
        return (
          <DriveSearchFilesConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'calendar.createEvent':
        return (
          <CalendarCreateEventConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'telegram.sendMessage':
        return (
          <TelegramSendMessageConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'slack.postMessage':
        return (
          <SlackPostMessageConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      case 'github.createIssue':
        return (
          <GitHubCreateIssueConfig
            node={node}
            params={params}
            onParamChange={handleParamChange}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
          />
        );
      default:
        // Universal Form fallback using FormField components
        return (
          <div className="space-y-4">
            {meta?.params?.map((field) => {
              const val =
                params[field.name] !== undefined
                  ? params[field.name]
                  : field.default ?? '';

              if (field.kind === 'boolean') {
                return (
                  <UniversalToggle
                    key={field.name}
                    label={field.label || field.name}
                    value={Boolean(val)}
                    onChange={(v) => handleParamChange(field.name, v)}
                  />
                );
              }

              if (field.kind === 'select' && field.options) {
                return (
                  <UniversalSelect
                    key={field.name}
                    label={field.label || field.name}
                    value={String(val)}
                    onChange={(v) => handleParamChange(field.name, v)}
                    options={field.options}
                    required={field.required}
                  />
                );
              }

              if (field.kind === 'text') {
                return (
                  <UniversalTextarea
                    key={field.name}
                    label={field.label || field.name}
                    value={String(val)}
                    onChange={(v) => handleParamChange(field.name, v)}
                    required={field.required}
                    allNodes={allNodes}
                    edges={edges}
                    nodeRuns={nodeRuns}
                    currentNodeId={node.id}
                  />
                );
              }

              if (field.kind === 'json') {
                return (
                  <UniversalKeyValueEditor
                    key={field.name}
                    label={field.label || field.name}
                    value={typeof val === 'object' && val !== null ? val : {}}
                    onChange={(v) => handleParamChange(field.name, v)}
                    allNodes={allNodes}
                    currentNodeId={node.id}
                  />
                );
              }

              return (
                <SmartInput
                  key={field.name}
                  label={field.label || field.name}
                  value={val !== null && val !== undefined ? String(val) : ''}
                  onChange={(v) => handleParamChange(field.name, v)}
                  required={field.required}
                  placeholder={field.label || field.name}
                  allNodes={allNodes}
                  edges={edges}
                  nodeRuns={nodeRuns}
                  currentNodeId={node.id}
                />
              );
            })}
          </div>
        );
    }
  };

  return (
    <aside
      className={`${
        isWideMode ? 'w-[780px]' : 'w-[460px]'
      } bg-[#141414] border-l border-[#222222] flex flex-col h-full shrink-0 shadow-2xl z-20 select-none transition-[width] duration-200 ease-in-out font-sans`}
    >
      {/* Panel Header */}
      <div className="p-5 border-b border-[#222222] flex items-start justify-between bg-[#141414]">
        <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-3">
          <div
            className="w-11 h-11 rounded-[14px] bg-[#1A1A1A] border border-white/[0.08] flex items-center justify-center shrink-0 shadow-md"
            style={{ borderColor: isIntegrationStep ? `${brandColor}40` : 'rgba(255,255,255,0.08)' }}
          >
            <ServiceIcon service={data.type} size={22} />
          </div>
          <div className="truncate flex-1">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={data.name || ''}
                onChange={handleNameChange}
                placeholder={meta?.label || 'Step Name'}
                className="font-bold text-sm text-white tracking-tight bg-transparent border-b border-transparent hover:border-[#444] focus:border-[#FF7306] outline-none transition-colors truncate max-w-[240px]"
              />
            </div>
            <p className="text-[11px] text-[#8E8E8E] truncate mt-0.5 font-normal">
              {oneSentenceDescription}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsWideMode(!isWideMode)}
            className="p-2 rounded-full text-[#7A7A7A] hover:text-white hover:bg-[#202020] transition-colors"
            title={isWideMode ? 'Collapse to standard width' : 'Expand panel width for focus'}
          >
            {isWideMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[#7A7A7A] hover:text-white hover:bg-[#202020] transition-colors"
            title="Close inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#222222] px-5 gap-6 text-xs font-medium bg-[#141414]">
        <button
          type="button"
          onClick={() => setActiveTab('config')}
          className={`py-3 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'config'
              ? 'text-white font-semibold'
              : 'text-[#737373] hover:text-[#A3A3A3]'
          }`}
        >
          <span>Configuration</span>
          {activeTab === 'config' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF7306] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('test')}
          className={`py-3 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'test'
              ? 'text-white font-semibold'
              : 'text-[#737373] hover:text-[#A3A3A3]'
          }`}
        >
          <span>Test Step</span>
          {activeTab === 'test' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF7306] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('output')}
          className={`py-3 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'output'
              ? 'text-white font-semibold'
              : 'text-[#737373] hover:text-[#A3A3A3]'
          }`}
        >
          <span>Output & Schema</span>
          {activeTab === 'output' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF7306] rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`py-3 transition-colors relative flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'text-white font-semibold'
              : 'text-[#737373] hover:text-[#A3A3A3]'
          }`}
        >
          <span>Settings</span>
          {activeTab === 'settings' && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF7306] rounded-full" />
          )}
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs font-sans">
        {activeTab === 'config' ? (
          <>
            {/* Connected Account Section (for Integrations) */}
            {isIntegrationStep && (
              <UniversalAccountSelector
                serviceType={data.type}
                credentialType={meta?.credentialType}
                selectedCredentialId={data.credentialId}
                credentials={credentials}
                onSelectCredential={handleCredentialChange}
                onRefreshCredentials={loadCredentials}
              />
            )}

            {/* Specialized or Universal Node Form */}
            {renderSpecializedConfig()}
          </>
        ) : activeTab === 'test' ? (
          /* Test Step Tab */
          <div className="space-y-4">
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-2">
              <span className="font-semibold text-white block">Step Validation & Test</span>
              <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
                Test this step individually using your current parameters or sample payload to verify that it executes properly.
              </p>
            </div>

            {/* Run Test Trigger Box */}
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Execute Step Test</span>
                {testResult?.durationMs && (
                  <span className="text-[11px] text-[#737373] font-mono">
                    Elapsed: {testResult.durationMs}ms
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleRunStepTest}
                disabled={isTesting}
                className="w-full py-2.5 px-4 rounded-full bg-[#FF7306] hover:bg-[#FFA154] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Executing step test...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Step Test</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Results Display */}
            {testResult && (
              <div className="space-y-3 animate-in fade-in-0 duration-150">
                {testResult.status === 'succeeded' ? (
                  <div className="p-3.5 rounded-[18px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Step executed successfully!</span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80 leading-relaxed pl-6">
                      Outputs and variables are ready for downstream workflow steps.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-[18px] bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                    <div className="flex items-center gap-2 font-semibold text-rose-200">
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>Test execution failed</span>
                    </div>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed pl-6">
                      {testResult.error || 'Execution encountered an unexpected issue.'}
                    </p>
                  </div>
                )}

                {/* Structured Output Preview */}
                {testResult.output && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider block">
                      Returned Output Data
                    </span>
                    <pre className="p-3.5 rounded-[16px] bg-[#101010] border border-[#222222] font-mono text-[11px] text-[#A0A0A0] overflow-x-auto max-h-56 select-all">
                      {JSON.stringify(testResult.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'output' ? (
          /* Output & Schema Tab */
          <div className="space-y-5">
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-2">
              <span className="font-semibold text-white block">Step Ports & Outputs</span>
              <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
                Downstream steps can reference this step&apos;s output variables in expressions.
              </p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {(data.outputs || ['default']).map((p) => (
                  <span
                    key={p}
                    className="px-3 py-1 rounded-full bg-[#1E1E1E] border border-[#2A2A2A] text-xs font-mono text-white"
                  >
                    Port: {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Reference Variable ID */}
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Step Variable Reference</span>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="flex items-center gap-1 text-[11px] text-[#FF7306] hover:text-[#FFA154] transition-colors"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy expression</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-full bg-[#141414] border border-[#222222] font-mono text-[11px] text-[#FF9E5E] px-4">
                {`{{ ${data.key || node.id}.output }}`}
              </div>
            </div>
          </div>
        ) : (
          /* Settings Tab: Retries, Error Handling, and Raw JSON */
          <div className="space-y-5">
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-3">
              <UniversalSelect
                label="On Error Behavior"
                value={data.onError || 'stop'}
                onChange={(val) => handleOnErrorChange(val as 'stop' | 'continue')}
                options={[
                  { value: 'stop', label: 'Stop workflow execution (Recommended)' },
                  { value: 'continue', label: 'Continue workflow execution despite errors' },
                ]}
                description="Determine whether downstream steps should execute if this step fails."
              />
            </div>

            {/* Retries */}
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-3">
              <span className="font-semibold text-white block">Automatic Retries</span>

              <UniversalSelect
                label="Maximum Retry Attempts"
                value={String(data.retry?.maxAttempts ?? 1)}
                onChange={(val) => handleRetryChange('maxAttempts', Number(val) || 1)}
                options={[
                  { value: '1', label: 'No retries (Attempt once)' },
                  { value: '2', label: 'Retry 1 time' },
                  { value: '3', label: 'Retry 2 times' },
                  { value: '5', label: 'Retry 4 times' },
                ]}
              />

              <UniversalSelect
                label="Backoff Strategy"
                value={data.retry?.backoff || 'fixed'}
                onChange={(val) => handleRetryChange('backoff', val)}
                options={[
                  { value: 'fixed', label: 'Fixed delay between retries' },
                  { value: 'exponential', label: 'Exponential backoff (Double wait time)' },
                ]}
              />
            </div>

            {/* Raw Parameters Inspector (Advanced) */}
            <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-2">
              <span className="font-semibold text-white block flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-[#A3A3A3]" />
                Raw Parameter JSON (Advanced)
              </span>
              <pre className="p-3 rounded-[14px] bg-[#101010] border border-[#222222] font-mono text-[10px] text-[#8E8E8E] overflow-x-auto max-h-40 select-all">
                {JSON.stringify(params, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-[#222222] bg-[#141414] space-y-2">
        {activeTab !== 'test' && (
          <button
            type="button"
            onClick={() => {
              if (onTestStep) {
                onTestStep();
              } else {
                setActiveTab('test');
              }
            }}
            className="w-full py-2.5 px-4 rounded-full bg-[#202020] hover:bg-[#282828] border border-[#2C2C2C] text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.99]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Test step configuration</span>
          </button>
        )}

        {confirmDelete ? (
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-1.5 px-3 rounded-full border border-[#2E2E2E] text-[#8E8E8E] hover:text-white text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="flex-1 py-1.5 px-3 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors shadow-sm"
            >
              Confirm Delete
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-full py-1 text-center text-[11px] text-[#737373] hover:text-rose-400 transition-colors"
          >
            Delete this step
          </button>
        )}
      </div>
    </aside>
  );
}
