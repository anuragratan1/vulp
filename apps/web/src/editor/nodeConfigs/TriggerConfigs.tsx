import { useState, useMemo } from 'react';
import {
  Play,
  Webhook,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Terminal,
  RefreshCw,
  FileJson,
  Code,
  Trash2,
  Info,
} from 'lucide-react';
import {
  UniversalSelect,
  UniversalTextInput,
  UniversalKeyValueEditor,
} from '../fields/index.js';
import { CanvasNode } from '../graphConverter.js';
import { WebhookRecord, api } from '../../api/client.js';
import { extractFieldsFromData } from '../fields/dynamicVariableDiscovery.js';

interface TriggerConfigProps {
  node: CanvasNode;
  params: Record<string, any>;
  onParamChange: (key: string | Record<string, any>, value?: any) => void;
  allNodes?: CanvasNode[];
  workflowActive?: boolean;
  webhooks?: WebhookRecord[];
  workflowId?: string;
}

// 1. Manual Trigger Configuration
export function ManualTriggerConfig({
  params,
  onParamChange,
  allNodes,
  node,
}: TriggerConfigProps) {
  const payload = params.payload || {};

  const samplePresets = [
    {
      label: 'New Customer Lead',
      data: { leadId: 'LEAD-501', email: 'sarah.c@sky.net', name: 'Sarah Connor', score: 92 },
    },
    {
      label: 'E-commerce Order',
      data: { orderId: 'ORD-9921', customer: 'Alex Murphy', amount: 249.99, status: 'paid' },
    },
    {
      label: 'User Signup',
      data: { userId: 'usr_882', email: 'elena@example.com', plan: 'pro', team: 'Engineering' },
    },
  ];

  const isPresetActive = (presetData: Record<string, any>) => {
    if (!payload || typeof payload !== 'object') return false;
    const pKeys = Object.keys(payload);
    const dKeys = Object.keys(presetData);
    if (pKeys.length === 0 || pKeys.length !== dKeys.length) return false;
    return dKeys.every((k) => String(payload[k]) === String(presetData[k]));
  };

  const handleApplyPreset = (preset: (typeof samplePresets)[0]) => {
    if (isPresetActive(preset.data)) return;

    // Check if user has entered non-empty values that would be replaced
    const hasExistingData =
      payload &&
      typeof payload === 'object' &&
      Object.keys(payload).length > 0 &&
      Object.values(payload).some((v) => v !== '' && v !== null && v !== undefined);

    if (hasExistingData) {
      const confirmed = window.confirm(
        `Apply preset "${preset.label}"? This will replace your current payload fields.`
      );
      if (!confirmed) return;
    }

    onParamChange('payload', preset.data);
  };

  return (
    <div className="space-y-5 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#171717] border border-[#262626] space-y-2">
        <div className="flex items-center gap-2">
          <Play className="w-3.5 h-3.5 text-[#FF7306]" />
          <span className="font-semibold text-white block">Manual Workflow Trigger</span>
        </div>
        <p className="text-[11px] text-[#A0A0A0] leading-relaxed">
          This trigger starts your workflow manually whenever you click <strong className="text-white">Run</strong> or <strong className="text-white">Test Step</strong>. You can provide test input fields below or load a sample preset to simulate incoming data for downstream actions.
        </p>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-[#737373]">Load Preset:</span>
          {samplePresets.map((preset) => {
            const active = isPresetActive(preset.data);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`px-2.5 py-0.5 rounded-full text-[10px] transition-all flex items-center gap-1 cursor-pointer ${
                  active
                    ? 'bg-[#FF7306]/15 border border-[#FF7306]/60 text-[#FF7306] font-semibold shadow-xs'
                    : 'bg-[#202020] hover:bg-[#2A2A2A] border border-[#2E2E2E] text-[#A0A0A0] hover:text-white'
                }`}
                title={active ? `Active preset: ${preset.label}` : `Load preset: ${preset.label}`}
              >
                {active ? (
                  <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                ) : (
                  <span>+</span>
                )}
                <span>{preset.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Key-Value Payload Editor */}
      <UniversalKeyValueEditor
        label="Test Payload Fields (Incoming Data)"
        value={payload}
        onChange={(newPayload) => onParamChange('payload', newPayload)}
        keyPlaceholder="Field Name (e.g. email)"
        valuePlaceholder="Value (e.g. sarah@sky.net)"
        description="Downstream steps can reference these fields using {{ trigger.fieldName }}"
        allNodes={allNodes}
        currentNodeId={node.id}
      />
    </div>
  );
}

// 2. Webhook Trigger Configuration
export function WebhookTriggerConfig({
  params,
  onParamChange,
  workflowActive = false,
  webhooks = [],
  node,
  workflowId,
}: TriggerConfigProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showJsonInput, setShowJsonInput] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [customJsonText, setCustomJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const currentWebhook = webhooks.find((w) => w.nodeKey === node.id);
  const webhookUrl =
    currentWebhook?.url ||
    (currentWebhook ? `${window.location.origin}/hook/${currentWebhook.token}` : '');

  const method = params.method || 'POST';
  const path = params.path || '';

  const handleCopyUrl = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Sample payload from params
  const samplePayload = params.samplePayload;

  // Normalize sample payload data for discovery
  const normalizedSampleData = useMemo(() => {
    if (!samplePayload) return null;
    let data = samplePayload;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return null;
      }
    }
    if (typeof data !== 'object' || data === null) return null;
    if ('body' in data && typeof data.body === 'object' && data.body !== null) {
      return data.body;
    }
    return data;
  }, [samplePayload]);

  // Discovered fields from the sample payload
  const discoveredFields = useMemo(() => {
    if (!normalizedSampleData) return [];
    return extractFieldsFromData(
      normalizedSampleData,
      'webhook',
      'Webhook Trigger',
      'trigger',
      'sample'
    );
  }, [normalizedSampleData]);

  // Canonical test lead payload matching user's exact test case
  const testLeadPayload = {
    leadId: 'LEAD-TEST-002',
    name: 'Alex Morgan',
    email: 'anuragratan2590@gmail.com',
    phone: '+1-555-010-2020',
    score: 96,
    source: 'VULP Integration Test',
  };

  const handleLoadTestPayload = async () => {
    onParamChange('samplePayload', testLeadPayload);
    if (workflowId) {
      try {
        await api.setWebhookSample(workflowId, node.id, testLeadPayload);
      } catch (err) {
        console.error('Failed to persist sample payload to server', err);
      }
    }
  };

  const handleSaveCustomJson = async () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(customJsonText);
      onParamChange('samplePayload', parsed);
      if (workflowId) {
        await api.setWebhookSample(workflowId, node.id, parsed);
      }
      setShowJsonInput(false);
      setCustomJsonText('');
    } catch (e: any) {
      setJsonError(e.message || 'Invalid JSON format');
    }
  };

  const handleClearSample = async () => {
    onParamChange('samplePayload', null);
    if (workflowId) {
      try {
        await api.setWebhookSample(workflowId, node.id, {});
      } catch (err) {
        console.error('Failed to clear sample payload', err);
      }
    }
  };

  const handleRefreshSample = async () => {
    if (!workflowId) return;
    setIsRefreshing(true);
    try {
      const res = await api.getWebhookSample(workflowId, node.id);
      if (res.samplePayload) {
        onParamChange('samplePayload', res.samplePayload);
      }
    } catch (err) {
      console.error('Failed to fetch webhook sample', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const sampleCurl = `curl -X ${method} "${webhookUrl || 'https://vulp.app/hook/...'}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testLeadPayload, null, 2)}'`;

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(sampleCurl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-5 text-xs font-sans">
      {/* Webhook Endpoint Card */}
      <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-[#FF7306]" />
            <span className="font-semibold text-white">Unique Webhook Endpoint</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                workflowActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
              }`}
            />
            <span className="text-[10px] text-[#A0A0A0]">
              {workflowActive ? 'Live & Listening' : 'Draft Mode'}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Send HTTP requests to this URL to instantly trigger this workflow in real time.
        </p>

        {/* Copyable Webhook URL box */}
        <div className="relative flex items-center">
          <input
            type="text"
            readOnly
            value={webhookUrl || 'Webhook URL generated when workflow is saved'}
            className="w-full bg-[#141414] border border-[#262626] text-white font-mono text-[11px] rounded-full pl-4 pr-24 py-2.5 outline-none select-all truncate"
          />
          <button
            type="button"
            onClick={handleCopyUrl}
            disabled={!webhookUrl}
            className="absolute right-1.5 px-3 py-1 rounded-full bg-[#242424] hover:bg-[#303030] text-white text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {copiedUrl ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy URL</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Schema & Sample Payload Card */}
      <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-[#FF7306]" />
            <span className="font-semibold text-white">Discovered Schema & Sample Data</span>
          </div>

          <div className="flex items-center gap-2">
            {discoveredFields.length > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {discoveredFields.length} {discoveredFields.length === 1 ? 'field' : 'fields'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800 text-[10px] text-neutral-400 font-medium">
                No payload yet
              </span>
            )}

            {workflowId && (
              <button
                type="button"
                onClick={handleRefreshSample}
                disabled={isRefreshing}
                className="p-1 rounded-lg bg-[#242424] hover:bg-[#303030] text-neutral-300 hover:text-white transition-colors"
                title="Refresh webhook schema from server"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {discoveredFields.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#A0A0A0]">
                Discovered payload fields (available to downstream steps):
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-[10px] text-[#FF7306] hover:underline flex items-center gap-1 font-medium"
                >
                  <Code className="w-2.5 h-2.5" />
                  {showRawJson ? 'Hide JSON' : 'View JSON'}
                </button>
                <button
                  type="button"
                  onClick={handleClearSample}
                  className="text-[10px] text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors"
                  title="Clear captured sample"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* Field chips */}
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-[#121212] rounded-[14px] border border-[#222]">
              {discoveredFields.map((f) => (
                <div
                  key={f.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1A1A1A] border border-[#2E2E2E] text-[11px]"
                >
                  <span className="font-mono text-white font-medium">{f.path}</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-[#2A2A2A] text-[#A0A0A0] uppercase font-mono">
                    {f.type}
                  </span>
                  {f.sampleValue !== undefined && f.sampleValue !== null && (
                    <span className="text-[10px] text-neutral-400 truncate max-w-[120px]">
                      = {String(f.sampleValue)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {showRawJson && (
              <pre className="p-3 bg-[#0F0F0F] border border-[#222] rounded-[14px] font-mono text-[10px] text-neutral-300 overflow-x-auto max-h-48 leading-relaxed select-all">
                {JSON.stringify(normalizedSampleData, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-[14px] bg-[#141414] border border-[#222] space-y-1.5">
            <div className="flex items-center gap-1.5 text-neutral-200 font-medium text-[11px]">
              <Info className="w-3.5 h-3.5 text-[#FF7306]" />
              No webhook payload received yet
            </div>
            <p className="text-[11px] text-[#888] leading-relaxed">
              Send an HTTP request to the endpoint above, or load sample data below to dynamically discover fields for downstream actions and Auto-Map.
            </p>
          </div>
        )}

        {/* Actions bar for sample data */}
        <div className="space-y-2 pt-1 border-t border-[#222]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadTestPayload}
              className="px-3 py-1.5 rounded-full bg-[#242424] hover:bg-[#303030] text-white text-[11px] font-medium transition-colors flex items-center gap-1.5"
            >
              <Play className="w-3 h-3 text-[#FF7306]" />
              Load Test Lead Payload
            </button>

            <button
              type="button"
              onClick={() => {
                setShowJsonInput(!showJsonInput);
                if (!showJsonInput) {
                  setCustomJsonText(
                    normalizedSampleData
                      ? JSON.stringify(normalizedSampleData, null, 2)
                      : JSON.stringify(testLeadPayload, null, 2)
                  );
                }
              }}
              className="px-3 py-1.5 rounded-full bg-[#1F1F1F] hover:bg-[#282828] text-neutral-300 hover:text-white text-[11px] font-medium transition-colors"
            >
              {showJsonInput ? 'Cancel' : 'Paste / Edit JSON...'}
            </button>
          </div>

          {showJsonInput && (
            <div className="p-3 rounded-[14px] bg-[#121212] border border-[#262626] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-white">Paste JSON Payload</span>
                <span className="text-[10px] text-neutral-500">Supports nested objects & arrays</span>
              </div>
              <textarea
                value={customJsonText}
                onChange={(e) => setCustomJsonText(e.target.value)}
                rows={6}
                className="w-full bg-[#0A0A0A] border border-[#242424] rounded-[10px] p-2.5 font-mono text-[11px] text-white outline-none focus:border-[#FF7306]"
                placeholder='{\n  "leadId": "LEAD-001",\n  "name": "Jane Doe"\n}'
              />
              {jsonError && <p className="text-[10px] text-red-400">{jsonError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowJsonInput(false)}
                  className="px-3 py-1 rounded-full text-neutral-400 hover:text-white text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomJson}
                  className="px-3.5 py-1 rounded-full bg-[#FF7306] hover:bg-[#e06505] text-white text-[11px] font-medium"
                >
                  Save Sample
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HTTP Method Selector */}
      <UniversalSelect
        label="Accepted HTTP Method"
        value={method}
        onChange={(val) => onParamChange('method', val)}
        options={['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'ANY']}
        description="Choose which HTTP method this webhook should accept. POST is standard for payload ingestion."
      />

      {/* Custom Path Identifier (Optional) */}
      <UniversalTextInput
        label="Custom Path Identifier"
        optionalBadge={true}
        value={path}
        onChange={(val) => onParamChange('path', val)}
        placeholder="e.g. stripe-charges or lead-capture"
        description="Optional human-friendly slug to identify this webhook source."
      />

      {/* Sample cURL Command */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#A3A3A3] flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-[#FF7306]" />
            Test Webhook with cURL
          </span>
          <button
            type="button"
            onClick={handleCopyCurl}
            className="text-[10px] text-[#A0A0A0] hover:text-white flex items-center gap-1 transition-colors"
          >
            {copiedCurl ? (
              <span className="text-emerald-400">Copied cURL</span>
            ) : (
              <span>Copy cURL</span>
            )}
          </button>
        </div>
        <pre className="p-2.5 rounded-[12px] bg-[#0F0F0F] border border-[#1E1E1E] text-[10px] font-mono text-[#7A7A7A] overflow-x-auto whitespace-pre-wrap leading-relaxed select-all">
          {sampleCurl}
        </pre>
      </div>
    </div>
  );
}

// 3. Schedule Trigger Configuration
export function ScheduleTriggerConfig({
  params,
  onParamChange,
}: TriggerConfigProps) {
  const cron = params.cron || '0 * * * *';
  const timezone = params.timezone || 'UTC';

  // Common friendly frequencies
  const frequencies = [
    { label: 'Every 15 minutes', cron: '*/15 * * * *' },
    { label: 'Every hour', cron: '0 * * * *' },
    { label: 'Every day at 9:00 AM', cron: '0 9 * * *' },
    { label: 'Every day at midnight', cron: '0 0 * * *' },
    { label: 'Every Monday at 9:00 AM', cron: '0 9 * * 1' },
    { label: 'Every weekday (Mon-Fri) at 9:00 AM', cron: '0 9 * * 1-5' },
    { label: 'Custom Cron Expression', cron: '__custom__' },
  ];

  const matched = frequencies.find((f) => f.cron === cron);
  const [selectedFreq, setSelectedFreq] = useState(matched ? matched.cron : '__custom__');

  const handleFreqSelect = (val: string) => {
    setSelectedFreq(val);
    if (val !== '__custom__') {
      onParamChange('cron', val);
    }
  };

  // Human translation of cron
  const translateCron = (c: string) => {
    if (c === '*/15 * * * *') return 'Runs every 15 minutes.';
    if (c === '0 * * * *') return 'Runs at the beginning of every hour.';
    if (c === '0 9 * * *') return 'Runs once every day at 09:00 AM.';
    if (c === '0 0 * * *') return 'Runs every day at midnight (00:00).';
    if (c === '0 9 * * 1') return 'Runs every Monday at 09:00 AM.';
    if (c === '0 9 * * 1-5') return 'Runs every weekday (Monday through Friday) at 09:00 AM.';
    return `Custom cron schedule: "${c}".`;
  };

  const commonTimezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Asia/Kolkata',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];

  return (
    <div className="space-y-5 text-xs font-sans">
      {/* Frequency Picker */}
      <UniversalSelect
        label="Run Frequency"
        value={selectedFreq}
        onChange={handleFreqSelect}
        options={frequencies.map((f) => ({ value: f.cron, label: f.label }))}
        description="Choose how often this automated workflow should execute."
      />

      {/* Custom Cron input if selected */}
      {selectedFreq === '__custom__' && (
        <UniversalTextInput
          label="Cron Expression (5 fields)"
          value={cron}
          onChange={(val) => onParamChange('cron', val)}
          placeholder="e.g. 0 12 * * 1-5"
          description="Standard 5-field cron syntax: minute, hour, day of month, month, day of week."
        />
      )}

      {/* Human Schedule Translation Card */}
      <div className="p-3.5 rounded-[18px] bg-[#171717] border border-[#262626] flex items-start gap-2.5">
        <Clock className="w-4 h-4 text-[#FF7306] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white block">Schedule Summary</span>
          <p className="text-[11px] text-[#A0A0A0] mt-0.5 leading-relaxed">
            {translateCron(cron)}
          </p>
        </div>
      </div>

      {/* Timezone Selector */}
      <UniversalSelect
        label="Timezone"
        value={timezone}
        onChange={(val) => onParamChange('timezone', val)}
        options={commonTimezones}
        description="Times and days will be evaluated in this timezone."
      />
    </div>
  );
}
