import { useState, useMemo } from 'react';
import {
  Globe,
  Copy,
  Check,
  Code2,
  SlidersHorizontal,
  KeyRound,
  FileJson,
} from 'lucide-react';
import {
  UniversalSelect,
  SmartInput,
  UniversalKeyValueEditor,
  UniversalTextarea,
  ConfigurationSection,
  resolveExpressionsForPreview,
} from '../fields/index.js';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';

interface HttpRequestConfigProps {
  node: CanvasNode;
  params: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
}

export function HttpRequestConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: HttpRequestConfigProps) {
  const method = params.method || 'GET';
  const url = params.url || '';
  const queryParams = params.queryParams || {};
  const headers = params.headers || {};
  const body = params.body;
  const timeoutMs = Number(params.timeoutMs) || 30000;

  const [copiedCurl, setCopiedCurl] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');

  const [bodyMode, setBodyMode] = useState<'json-builder' | 'raw' | 'none'>(() => {
    if (method === 'GET') return 'none';
    if (typeof body === 'string') return 'raw';
    if (typeof body === 'object' && body !== null) return 'json-builder';
    return 'json-builder';
  });

  const methods = [
    { name: 'GET', color: '#10B981', border: '#059669' },
    { name: 'POST', color: '#3B82F6', border: '#2563EB' },
    { name: 'PUT', color: '#F59E0B', border: '#D97706' },
    { name: 'PATCH', color: '#8B5CF6', border: '#7C3AED' },
    { name: 'DELETE', color: '#EF4444', border: '#DC2626' },
  ];

  // Header presets
  const applyHeaderPreset = (key: string, defaultVal: string) => {
    const updated = { ...(typeof headers === 'object' ? headers : {}) };
    updated[key] = defaultVal;
    onParamChange('headers', updated);
  };

  // Preview expressions
  const previewUrl = resolveExpressionsForPreview(url, allNodes);

  // Generate simulated cURL command
  const curlCommand = useMemo(() => {
    let cmd = `curl -X ${method} "${previewUrl || 'https://api.example.com'}`;
    const qEntries = Object.entries(queryParams).filter(([k]) => Boolean(k));
    if (qEntries.length > 0) {
      const qStr = qEntries
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      cmd += (cmd.includes('?') ? '&' : '?') + qStr;
    }
    cmd += '"';

    if (typeof headers === 'object' && headers !== null) {
      for (const [hk, hv] of Object.entries(headers)) {
        if (hk) {
          cmd += ` \\\n  -H "${hk}: ${hv}"`;
        }
      }
    }

    if (method !== 'GET' && bodyMode !== 'none' && body !== undefined && body !== null) {
      const payloadStr = typeof body === 'object' ? JSON.stringify(body) : String(body);
      cmd += ` \\\n  -d '${payloadStr.replace(/'/g, "'\\''")}'`;
    }

    return cmd;
  }, [method, previewUrl, queryParams, headers, body, bodyMode]);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#FF7306]" />
          <span className="font-semibold text-white block">HTTP / REST API Client</span>
        </div>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Send automated HTTP requests to external REST APIs, endpoints, or webhooks.
        </p>
      </div>

      {/* Method and URL Input Container */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <label className="text-xs font-semibold text-white block">HTTP Method & Endpoint</label>

        {/* Method Badges */}
        <div className="flex flex-wrap gap-1.5">
          {methods.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => {
                onParamChange('method', m.name);
                if (m.name === 'GET') setBodyMode('none');
                else if (bodyMode === 'none') setBodyMode('json-builder');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                method === m.name
                  ? 'text-white shadow-sm'
                  : 'bg-[#121212] border-[#2A2A2A] text-[#737373] hover:text-white'
              }`}
              style={{
                backgroundColor: method === m.name ? m.color : undefined,
                borderColor: method === m.name ? m.border : undefined,
              }}
            >
              {m.name}
            </button>
          ))}
        </div>

        {/* URL Input */}
        <SmartInput
          label="Request URL"
          value={url}
          onChange={(val) => onParamChange('url', val)}
          placeholder="https://api.example.com/v1/orders"
          required={true}
          type="url"
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          description="Supports query parameters and dynamic variables (e.g. {{ trigger.id }})."
        />
      </div>

      {/* Tabs Container: Query Params, Headers, Body */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="flex items-center gap-1 border-b border-[#242424] pb-2 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('params')}
            className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
              activeTab === 'params'
                ? 'bg-[#222222] text-white font-medium'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            <span>Query Parameters</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
              activeTab === 'headers'
                ? 'bg-[#222222] text-white font-medium'
                : 'text-[#888888] hover:text-white'
            }`}
          >
            <KeyRound className="w-3 h-3" />
            <span>Headers</span>
          </button>
          {method !== 'GET' && (
            <button
              type="button"
              onClick={() => setActiveTab('body')}
              className={`px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 ${
                activeTab === 'body'
                  ? 'bg-[#222222] text-white font-medium'
                  : 'text-[#888888] hover:text-white'
              }`}
            >
              <FileJson className="w-3 h-3" />
              <span>Body</span>
            </button>
          )}
        </div>

        {/* Tab 1: Query Parameters */}
        {activeTab === 'params' && (
          <div className="space-y-3 pt-1">
            <UniversalKeyValueEditor
              label="URL Query Parameters"
              value={typeof queryParams === 'object' && queryParams !== null ? queryParams : {}}
              onChange={(newParams) => onParamChange('queryParams', newParams)}
              keyPlaceholder="Key (e.g. status)"
              valuePlaceholder="Value (e.g. active)"
              description="Appended to the URL as ?key=value queries."
              allNodes={allNodes}
              currentNodeId={node.id}
            />
          </div>
        )}

        {/* Tab 2: Headers with Quick Presets */}
        {activeTab === 'headers' && (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-[#737373]">Quick Presets:</span>
              <button
                type="button"
                onClick={() => applyHeaderPreset('Authorization', 'Bearer {{ token }}')}
                className="px-2 py-0.5 rounded-full bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
              >
                + Bearer Auth
              </button>
              <button
                type="button"
                onClick={() => applyHeaderPreset('Content-Type', 'application/json')}
                className="px-2 py-0.5 rounded-full bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
              >
                + JSON Content
              </button>
              <button
                type="button"
                onClick={() => applyHeaderPreset('X-API-Key', '{{ secrets.apiKey }}')}
                className="px-2 py-0.5 rounded-full bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
              >
                + API Key
              </button>
            </div>

            <UniversalKeyValueEditor
              label="Custom Request Headers"
              value={typeof headers === 'object' && headers !== null ? headers : {}}
              onChange={(newHeaders) => onParamChange('headers', newHeaders)}
              keyPlaceholder="Header (e.g. Authorization)"
              valuePlaceholder="Value (e.g. Bearer token)"
              description="Pass authentication, format headers, or custom metadata."
              allNodes={allNodes}
              currentNodeId={node.id}
            />
          </div>
        )}

        {/* Tab 3: Request Body */}
        {activeTab === 'body' && method !== 'GET' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white">Body Mode</label>
              <div className="flex rounded-full bg-[#121212] border border-[#262626] p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setBodyMode('json-builder')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    bodyMode === 'json-builder'
                      ? 'bg-[#FF7306] text-white font-medium'
                      : 'text-[#737373] hover:text-white'
                  }`}
                >
                  Fields Form (Key-Value)
                </button>
                <button
                  type="button"
                  onClick={() => setBodyMode('raw')}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    bodyMode === 'raw'
                      ? 'bg-[#FF7306] text-white font-medium'
                      : 'text-[#737373] hover:text-white'
                  }`}
                >
                  Raw JSON / Code
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBodyMode('none');
                    onParamChange('body', undefined);
                  }}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    bodyMode === 'none'
                      ? 'bg-[#FF7306] text-white font-medium'
                      : 'text-[#737373] hover:text-white'
                  }`}
                >
                  None
                </button>
              </div>
            </div>

            {bodyMode === 'json-builder' && (
              <UniversalKeyValueEditor
                label="JSON Body Fields"
                value={typeof body === 'object' && body !== null ? body : {}}
                onChange={(newBody) => onParamChange('body', newBody)}
                keyPlaceholder="Property Name (e.g. customerId)"
                valuePlaceholder="Value (e.g. {{ trigger.id }})"
                description="Each field will be serialized automatically into the JSON request body."
                allNodes={allNodes}
                currentNodeId={node.id}
              />
            )}

            {bodyMode === 'raw' && (
              <UniversalTextarea
                label="Raw Body Content (JSON / Text)"
                value={typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body ?? '')}
                onChange={(val) => {
                  try {
                    const parsed = JSON.parse(val);
                    onParamChange('body', parsed);
                  } catch {
                    onParamChange('body', val);
                  }
                }}
                placeholder='{\n  "name": "Sarah",\n  "score": {{ trigger.score }}\n}'
                rows={6}
                allNodes={allNodes}
                edges={edges}
                nodeRuns={nodeRuns}
                currentNodeId={node.id}
              />
            )}
          </div>
        )}
      </div>

      {/* Advanced Connection & Timeout Settings */}
      <ConfigurationSection
        title="Advanced Request Settings"
        description="Timeout limits and connection handling"
        collapsible={true}
        defaultOpen={false}
      >
        <UniversalSelect
          label="Request Timeout"
          value={String(timeoutMs)}
          onChange={(val) => onParamChange('timeoutMs', Number(val) || 30000)}
          options={[
            { value: '5000', label: '5 seconds' },
            { value: '15000', label: '15 seconds' },
            { value: '30000', label: '30 seconds (Standard)' },
            { value: '60000', label: '60 seconds' },
            { value: '120000', label: '2 minutes' },
          ]}
          description="Maximum duration to wait for the API endpoint to respond before timing out."
        />
      </ConfigurationSection>

      {/* Live cURL Preview Card */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center justify-between text-[#A3A3A3] text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold">
            <Code2 className="w-3.5 h-3.5 text-[#FF7306]" />
            <span>cURL Preview</span>
          </div>
          <button
            type="button"
            onClick={handleCopyCurl}
            className="flex items-center gap-1 text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
          >
            {copiedCurl ? (
              <>
                <Check className="w-3 h-3 text-[#10B981]" />
                <span className="text-[#10B981]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>
        <div className="p-3 rounded-[12px] bg-[#0A0A0A] border border-[#222222] font-mono text-[10px] text-[#E0E0E0] overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {curlCommand}
        </div>
      </div>
    </div>
  );
}
