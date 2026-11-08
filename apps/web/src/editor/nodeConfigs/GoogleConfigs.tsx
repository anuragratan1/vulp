import { useState, useEffect, useRef } from 'react';
import {
  UniversalTextarea,
  UniversalToggle,
  UniversalSelect,
  SmartInput,
  RichTextEmailEditor,
  AttachmentUploader,
  AttachmentItem,
  LiveEmailPreview,
  TestEmailModal,
  ConfigurationSection,
  SpreadsheetPicker,
  UniversalKeyValueEditor,
  resolveExpressionsForPreview,
} from '../fields/index.js';
import { SheetsFieldMapper } from '../SheetsFieldMapper.js';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord, api } from '../../api/client.js';
import { GoogleCalendarIcon } from '../../components/ServiceIcons.js';
import {
  Clock,
  MapPin,
  Users,
  Video,
  FileText,
  FileSpreadsheet,
  FileCode,
  UploadCloud,
  FolderOpen,
  Search,
  Eye,
} from 'lucide-react';

interface GoogleConfigProps {
  node: CanvasNode;
  params: Record<string, any>;
  onParamChange: (key: string | Record<string, any>, value?: any) => void;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
}

// ============================================================================
// 1. Gmail: Send Email (Reference Composer Implementation)
// ============================================================================
export function GmailSendEmailConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: GoogleConfigProps) {
  const [showCc, setShowCc] = useState(Boolean(params.cc));
  const [showBcc, setShowBcc] = useState(Boolean(params.bcc));
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const to = params.to || '';
  const subject = params.subject || '';
  const body = params.body || '';
  const cc = params.cc || '';
  const bcc = params.bcc || '';
  const replyTo = params.replyTo || '';
  const senderName = params.senderName || '';
  const isHtml = params.isHtml === undefined ? true : Boolean(params.isHtml);
  const attachments: AttachmentItem[] = Array.isArray(params.attachments) ? params.attachments : [];

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* 1. Recipients Section */}
      <div className="space-y-2 p-3.5 rounded-[18px] bg-[#161616] border border-[#242424]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white tracking-tight">Recipients</span>
          <div className="flex items-center gap-2">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="text-[11px] font-medium text-[#888888] hover:text-[#FF7306] transition-colors"
              >
                + CC
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="text-[11px] font-medium text-[#888888] hover:text-[#FF7306] transition-colors"
              >
                + BCC
              </button>
            )}
          </div>
        </div>

        {/* To (Required) */}
        <SmartInput
          label="To (Recipient Email)"
          value={to}
          onChange={(val) => onParamChange('to', val)}
          placeholder="user@example.com or select variable"
          required={true}
          type="email"
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          description="Enter an email address or select a recipient from an earlier step."
        />

        {/* Optional CC */}
        {showCc && (
          <div className="pt-1 animate-in fade-in-0 duration-150">
            <SmartInput
              label="CC (Carbon Copy)"
              value={cc}
              onChange={(val) => onParamChange('cc', val)}
              placeholder="colleagues@company.com"
              type="email"
              allNodes={allNodes}
              edges={edges}
              nodeRuns={nodeRuns}
              currentNodeId={node.id}
            />
          </div>
        )}

        {/* Optional BCC */}
        {showBcc && (
          <div className="pt-1 animate-in fade-in-0 duration-150">
            <SmartInput
              label="BCC (Blind Carbon Copy)"
              value={bcc}
              onChange={(val) => onParamChange('bcc', val)}
              placeholder="archive@company.com"
              type="email"
              allNodes={allNodes}
              edges={edges}
              nodeRuns={nodeRuns}
              currentNodeId={node.id}
            />
          </div>
        )}
      </div>

      {/* 2. Subject Line */}
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424]">
        <SmartInput
          label="Subject Line"
          value={subject}
          onChange={(val) => onParamChange('subject', val)}
          placeholder="e.g. Welcome to Vulp, {{ trigger.name }}!"
          required={true}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />
      </div>

      {/* 3. Rich Text Message Composer */}
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424]">
        <RichTextEmailEditor
          label="Email Message"
          value={body}
          onChange={(val) => onParamChange('body', val)}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          isHtml={isHtml}
          onToggleHtml={(htmlMode) => onParamChange('isHtml', htmlMode)}
        />
      </div>

      {/* 4. Attachments */}
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424]">
        <AttachmentUploader
          attachments={attachments}
          onChange={(newAtts) => onParamChange('attachments', newAtts)}
          credentialId={node.data.credentialId}
          allNodes={allNodes}
          currentNodeId={node.id}
        />
      </div>

      {/* 5. Advanced Options (Collapsed by default) */}
      <ConfigurationSection
        title="Advanced Email Options"
        description="Sender identity, reply-to routing, and format controls"
        collapsible={true}
        defaultOpen={Boolean(replyTo || senderName)}
      >
        <SmartInput
          label="Sender Display Name (Optional)"
          value={senderName}
          onChange={(val) => onParamChange('senderName', val)}
          placeholder="e.g. Vulp Support Team"
          allNodes={allNodes}
          currentNodeId={node.id}
          description="Name shown in the recipient's inbox alongside your Gmail address."
        />

        <SmartInput
          label="Reply-To Address (Optional)"
          value={replyTo}
          onChange={(val) => onParamChange('replyTo', val)}
          placeholder="e.g. support-replies@company.com"
          type="email"
          allNodes={allNodes}
          currentNodeId={node.id}
          description="Replies will be directed to this address instead of the sender address."
        />

        <UniversalToggle
          label="Format Email as HTML"
          value={isHtml}
          onChange={(val) => onParamChange('isHtml', val)}
          description="Enabled by default. Keep active to render rich fonts, styles, links, and inline images."
        />
      </ConfigurationSection>

      {/* 6. Live Email Preview */}
      <LiveEmailPreview
        to={to}
        subject={subject}
        body={body}
        cc={cc}
        bcc={bcc}
        replyTo={replyTo}
        senderName={senderName}
        attachments={attachments}
        allNodes={allNodes}
        onOpenTestDialog={() => setIsTestModalOpen(false)}
      />

      {/* 7. Test Email Modal */}
      <TestEmailModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        credentialId={node.data.credentialId}
        to={to}
        subject={subject}
        body={body}
        cc={cc}
        bcc={bcc}
        replyTo={replyTo}
        senderName={senderName}
        isHtml={isHtml}
        attachments={attachments}
        allNodes={allNodes}
      />
    </div>
  );
}

// ============================================================================
// 2. Google Sheets: Append Row
// ============================================================================
export function SheetsAppendRowConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: GoogleConfigProps) {
  const spreadsheetId = params.spreadsheetId ? String(params.spreadsheetId) : '';
  const sheetName = params.sheetName ? String(params.sheetName) : 'Sheet1';
  const values = params.values;
  const mappingMeta = params._mappingMeta;

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <span className="font-semibold text-white block">Append Row to Google Sheet</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Insert a new record row into your spreadsheet, mapping each column header dynamically.
        </p>
      </div>

      {/* Spreadsheet & Worksheet Selector */}
      <SpreadsheetPicker
        credentialId={node.data.credentialId}
        spreadsheetId={spreadsheetId}
        sheetName={sheetName}
        onChangeSpreadsheet={(id) => {
          if (id !== spreadsheetId) {
            onParamChange({
              spreadsheetId: id,
              sheetName: 'Sheet1',
              values: {},
              _mappingMeta: {},
            });
          }
        }}
        onChangeSheetName={(name) => {
          if (name !== sheetName) {
            onParamChange({
              sheetName: name,
              values: {},
              _mappingMeta: {},
            });
          }
        }}
        allNodes={allNodes}
        currentNodeId={node.id}
        onCreatedSpreadsheet={(info) => {
          const initVals = info.initialValues || {};
          const initMeta = Object.fromEntries(
            Object.keys(initVals).map((k) => [k, { origin: 'auto', value: initVals[k] }])
          );
          onParamChange({
            spreadsheetId: info.spreadsheetId,
            sheetName: info.sheetName,
            values: initVals,
            _mappingMeta: initMeta,
          });
        }}
      />

      {/* Field Mapping Interface */}
      <SheetsFieldMapper
        spreadsheetId={spreadsheetId || undefined}
        sheetName={sheetName}
        credentialId={node.data.credentialId}
        values={values}
        mappingMeta={mappingMeta}
        allNodes={allNodes}
        edges={edges}
        nodeRuns={nodeRuns}
        currentNodeId={node.id}
        onChangeValues={(newVals, newMeta) => {
          if (newMeta !== undefined) {
            onParamChange({ values: newVals, _mappingMeta: newMeta });
          } else {
            onParamChange('values', newVals);
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// 3. Google Sheets: Read Rows
// ============================================================================
export function SheetsReadRowsConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: GoogleConfigProps) {
  const spreadsheetId = params.spreadsheetId ? String(params.spreadsheetId) : '';
  const sheetName = params.sheetName || 'Sheet1';
  const range = params.range || '';
  const hasHeaders = params.hasHeaders !== false;

  const presets = [
    { label: 'All Rows', value: '' },
    { label: 'Cols A to F', value: 'A:F' },
    { label: 'First 50 Rows', value: 'A1:Z50' },
    { label: 'Cols A to D', value: 'A:D' },
  ];

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <span className="font-semibold text-white block">Read Rows from Spreadsheet</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Retrieve spreadsheet rows as structured records for downstream processing.
        </p>
      </div>

      {/* Spreadsheet & Tab Picker */}
      <SpreadsheetPicker
        credentialId={node.data.credentialId}
        spreadsheetId={spreadsheetId}
        sheetName={sheetName}
        onChangeSpreadsheet={(id) => onParamChange('spreadsheetId', id)}
        onChangeSheetName={(name) => onParamChange('sheetName', name)}
        allNodes={allNodes}
        currentNodeId={node.id}
      />

      {/* Range and Header Settings */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white">Range Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => onParamChange('range', p.value)}
                className={`px-2.5 py-1 rounded-full text-[11px] transition-colors border ${
                  range === p.value
                    ? 'bg-[#0F9D58] border-[#0F9D58] text-white font-medium'
                    : 'bg-[#121212] border-[#262626] text-[#A3A3A3] hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <SmartInput
          label="Cell Range (A1 Notation)"
          value={range}
          onChange={(val) => onParamChange('range', val)}
          placeholder="e.g. A1:F50 (Leave empty to read all rows)"
          description="Specific range of cells to query. Leave blank to read the whole sheet."
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />

        <UniversalToggle
          label="First Row Contains Column Headers"
          value={hasHeaders}
          onChange={(val) => onParamChange('hasHeaders', val)}
          description="When active, row objects are keyed by column headers (e.g. row.Email, row.Name)."
        />
      </div>

      {/* Output Schema Preview Card */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center gap-1.5 text-[#A3A3A3] text-[11px] font-semibold">
          <Eye className="w-3.5 h-3.5 text-[#0F9D58]" />
          <span>Output Records Preview</span>
        </div>
        <div className="p-3 rounded-[12px] bg-[#0E1B13] border border-[#18482E] text-[#D1F2DE] font-mono text-[11px] space-y-1">
          <div className="text-[10px] text-[#0F9D58] font-bold">
            Output Array ({sheetName}{range ? `!${range}` : ''})
          </div>
          <pre className="text-[10px] leading-relaxed whitespace-pre-wrap">
            {JSON.stringify(
              [
                { Name: 'Sarah Connor', Email: 'sarah.c@sky.net', Status: 'Active', Score: 94 },
                { Name: 'John Doe', Email: 'john.d@sky.net', Status: 'Pending', Score: 78 },
              ],
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. Google Sheets: Update Row
// ============================================================================
export function SheetsUpdateRowConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges: _edges = [],
  nodeRuns: _nodeRuns = [],
}: GoogleConfigProps) {
  const spreadsheetId = params.spreadsheetId ? String(params.spreadsheetId) : '';
  const sheetName = params.sheetName || 'Sheet1';
  const range = params.range || 'Sheet1!A2:E2';
  const values = params.values || {};

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <span className="font-semibold text-white block">Update Existing Sheet Cells</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Overwrite specific cell ranges in an existing spreadsheet row with dynamic values.
        </p>
      </div>

      {/* Spreadsheet & Tab Picker */}
      <SpreadsheetPicker
        credentialId={node.data.credentialId}
        spreadsheetId={spreadsheetId}
        sheetName={sheetName}
        onChangeSpreadsheet={(id) => onParamChange('spreadsheetId', id)}
        onChangeSheetName={(name) => onParamChange('sheetName', name)}
        allNodes={allNodes}
        currentNodeId={node.id}
      />

      {/* Target Range */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <SmartInput
          label="Target Range to Overwrite"
          value={range}
          onChange={(val) => onParamChange('range', val)}
          placeholder="e.g. Sheet1!A2:E2 or A2:C2"
          required={true}
          description="Exact cell range to overwrite in A1 notation (e.g. Sheet1!A2:E2)."
          allNodes={allNodes}
          currentNodeId={node.id}
        />
      </div>

      {/* Row Values Mapping */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3">
        <UniversalKeyValueEditor
          label="Cell Values to Write"
          value={typeof values === 'object' && values !== null ? values : {}}
          onChange={(newVals) => onParamChange('values', newVals)}
          keyPlaceholder="Column or Field (e.g. Status)"
          valuePlaceholder="Value (e.g. {{ trigger.status }})"
          description="Specify values for each column. Sequential entries will fill cells left-to-right."
          allNodes={allNodes}
          currentNodeId={node.id}
        />
      </div>
    </div>
  );
}

// ============================================================================
// 5. Google Drive: Upload File
// ============================================================================
export function DriveUploadFileConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: GoogleConfigProps) {
  const fileName = params.fileName || 'export_{{ $now }}.txt';
  const content = params.content || '';
  const folderId = params.folderId || '';
  const mimeType = params.mimeType || 'text/plain';

  const [sourceMode, setSourceMode] = useState<'upload' | 'step' | 'direct'>('step');
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load folders
  useEffect(() => {
    if (!node.data.credentialId) {
      setFolders([{ id: '', name: 'Root (My Drive)' }]);
      return;
    }
    let cancelled = false;
    setIsLoadingFolders(true);
    api
      .getGoogleDriveFiles(node.data.credentialId, undefined, 'folders')
      .then((items) => {
        if (!cancelled && items) {
          const mapped = items.map((f) => ({ id: f.id, name: f.name }));
          setFolders([{ id: '', name: 'Root (My Drive)' }, ...mapped]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFolders([{ id: '', name: 'Root (My Drive)' }]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFolders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.data.credentialId]);

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onParamChange('fileName', file.name);
    if (file.type) onParamChange('mimeType', file.type);

    const reader = new FileReader();
    if (file.type.startsWith('text/') || file.type === 'application/json' || file.name.endsWith('.csv')) {
      reader.onload = () => {
        onParamChange('content', reader.result as string);
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        onParamChange('content', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const previewFileName = resolveExpressionsForPreview(fileName, allNodes);
  const selectedFolder = folders.find((f) => f.id === folderId);

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <span className="font-semibold text-white block">Upload File to Google Drive</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Store documents, reports, attachments, and exports directly in Google Drive.
        </p>
      </div>

      {/* File Source Segmented Mode */}
      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-white">File Source</label>
          <div className="flex rounded-full bg-[#121212] border border-[#262626] p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setSourceMode('step')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                sourceMode === 'step' ? 'bg-[#FF7306] text-white font-medium' : 'text-[#888888] hover:text-white'
              }`}
            >
              Step Output / Variable
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('upload')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                sourceMode === 'upload' ? 'bg-[#FF7306] text-white font-medium' : 'text-[#888888] hover:text-white'
              }`}
            >
              Upload Local File
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('direct')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                sourceMode === 'direct' ? 'bg-[#FF7306] text-white font-medium' : 'text-[#888888] hover:text-white'
              }`}
            >
              Direct Content
            </button>
          </div>
        </div>

        {sourceMode === 'upload' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#333333] hover:border-[#FF7306] rounded-[16px] p-6 text-center cursor-pointer transition-colors bg-[#121212]"
          >
            <UploadCloud className="w-8 h-8 text-[#FF7306] mx-auto mb-2" />
            <span className="text-xs font-medium text-white block">Click to browse or drop file here</span>
            <span className="text-[10px] text-[#737373] mt-1 block">
              Supports CSV, PDF, JSON, Images, and Text files
            </span>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {sourceMode === 'step' && (
          <SmartInput
            label="File Content / Upstream Reference"
            value={content}
            onChange={(val) => onParamChange('content', val)}
            placeholder="e.g. {{ webhook.attachment }} or {{ generate_pdf.data }}"
            required={true}
            description="Reference binary or text data from a previous workflow step."
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />
        )}

        {sourceMode === 'direct' && (
          <UniversalTextarea
            label="File Content (Text / JSON / CSV)"
            value={content}
            onChange={(val) => onParamChange('content', val)}
            placeholder="Order ID,Customer,Amount\n{{ trigger.orderId }},{{ trigger.name }},149.00"
            required={true}
            rows={5}
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />
        )}

        {/* File Name */}
        <SmartInput
          label="File Name"
          value={fileName}
          onChange={(val) => onParamChange('fileName', val)}
          placeholder="e.g. Invoice_{{ trigger.orderId }}.pdf"
          required={true}
          description="Name of the file including extension (e.g. .pdf, .csv, .json)."
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />

        {/* Target Folder Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[#A3A3A3] flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-[#FFB020]" />
              <span>Target Drive Folder</span>
            </span>
            {isLoadingFolders && <span className="text-[9px] text-[#737373]">Loading folders...</span>}
          </label>
          <div className="relative">
            <select
              value={folderId}
              onChange={(e) => onParamChange('folderId', e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-[#FF7306] pr-8"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* MIME Type Selection */}
        <UniversalSelect
          label="MIME Type"
          value={mimeType}
          onChange={(val) => onParamChange('mimeType', val)}
          options={[
            { value: 'text/plain', label: 'Plain Text (.txt)' },
            { value: 'application/pdf', label: 'PDF Document (.pdf)' },
            { value: 'text/csv', label: 'CSV Spreadsheet (.csv)' },
            { value: 'application/json', label: 'JSON Document (.json)' },
            { value: 'text/html', label: 'HTML File (.html)' },
            { value: 'image/png', label: 'PNG Image (.png)' },
            { value: 'image/jpeg', label: 'JPEG Image (.jpg)' },
          ]}
        />
      </div>

      {/* Live Drive File Card Preview */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center gap-1.5 text-[#A3A3A3] text-[11px] font-semibold">
          <Eye className="w-3.5 h-3.5 text-[#FFB020]" />
          <span>Drive File Preview</span>
        </div>
        <div className="p-3.5 rounded-[14px] bg-[#161616] border border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div className="w-9 h-9 rounded-xl bg-[#202020] border border-[#333333] flex items-center justify-center shrink-0">
              {mimeType.includes('pdf') ? (
                <FileText className="w-5 h-5 text-[#EA4335]" />
              ) : mimeType.includes('csv') ? (
                <FileSpreadsheet className="w-5 h-5 text-[#0F9D58]" />
              ) : mimeType.includes('json') ? (
                <FileCode className="w-5 h-5 text-[#4285F4]" />
              ) : (
                <FileText className="w-5 h-5 text-[#A3A3A3]" />
              )}
            </div>
            <div className="truncate">
              <span className="font-semibold text-xs text-white block truncate">
                {previewFileName || 'file.txt'}
              </span>
              <span className="text-[10px] text-[#737373]">
                Folder: {selectedFolder?.name || 'Root (My Drive)'} • {mimeType}
              </span>
            </div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1D3224] text-[#34A853] font-medium shrink-0 ml-2">
            Ready to Upload
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 6. Google Drive: Find Files
// ============================================================================
export function DriveSearchFilesConfig({
  node: _node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: GoogleConfigProps) {
  const query = params.query || '';
  const pageSize = Number(params.pageSize) || 10;
  const folderId = params.folderId || '';

  const sampleFilters = [
    { label: 'PDFs only', query: "mimeType = 'application/pdf'" },
    { label: 'Spreadsheets', query: "mimeType = 'application/vnd.google-apps.spreadsheet'" },
    { label: "Name contains 'Report'", query: "name contains 'Report'" },
  ];

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <span className="font-semibold text-white block">Search Google Drive Files</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Locate spreadsheets, documents, and media across your Google Drive workspace.
        </p>
      </div>

      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-white">Filter Presets</label>
          <div className="flex flex-wrap gap-1.5">
            {sampleFilters.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => onParamChange('query', f.query)}
                className={`px-2.5 py-1 rounded-full text-[11px] transition-colors border ${
                  query === f.query
                    ? 'bg-[#4285F4] border-[#4285F4] text-white font-medium'
                    : 'bg-[#121212] border-[#262626] text-[#A3A3A3] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <SmartInput
          label="Search Query"
          value={query}
          onChange={(val) => onParamChange('query', val)}
          placeholder="e.g. Contract or name contains 'Q4'"
          description="Standard Drive query syntax or simple keyword to match file names."
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
        />

        <SmartInput
          label="Folder ID Scope (Optional)"
          value={folderId}
          onChange={(val) => onParamChange('folderId', val)}
          placeholder="Leave empty to search all folders"
          description="Constrain the search to a specific parent folder ID."
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
        />

        <UniversalSelect
          label="Maximum Results"
          value={String(pageSize)}
          onChange={(val) => onParamChange('pageSize', Number(val) || 10)}
          options={[
            { value: '5', label: 'Top 5 files' },
            { value: '10', label: 'Top 10 files (Standard)' },
            { value: '25', label: 'Top 25 files' },
            { value: '50', label: 'Top 50 files' },
          ]}
        />
      </div>

      {/* Output preview */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center gap-1.5 text-[#A3A3A3] text-[11px] font-semibold">
          <Search className="w-3.5 h-3.5 text-[#4285F4]" />
          <span>Output Structure Sample</span>
        </div>
        <div className="p-3 rounded-[12px] bg-[#0E1626] border border-[#173153] text-[#D0E2FF] font-mono text-[10px] space-y-1">
          <div className="text-[10px] text-[#4285F4] font-bold">files[] (Available to next steps)</div>
          <pre className="whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(
              [
                {
                  id: '1aBcDeFgHiJkLmNoP',
                  name: 'Q4_Financial_Report.pdf',
                  mimeType: 'application/pdf',
                  webViewLink: 'https://drive.google.com/file/d/...',
                },
              ],
              null,
              2
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. Google Calendar: Create Event
// ============================================================================
export function CalendarCreateEventConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
}: GoogleConfigProps) {
  const summary = params.summary || '';
  const description = params.description || '';
  const startTime = params.startTime || '2026-11-06T10:00:00Z';
  const endTime = params.endTime || '2026-11-06T11:00:00Z';
  const timeZone = params.timeZone || 'UTC';
  const attendees = params.attendees || '';
  const calendarId = params.calendarId || 'primary';
  const location = params.location || '';
  const [isAllDay, setIsAllDay] = useState(false);

  const [calendars, setCalendars] = useState<Array<{ id: string; summary: string }>>([]);

  useEffect(() => {
    if (!node.data.credentialId) {
      setCalendars([{ id: 'primary', summary: 'Primary Calendar' }]);
      return;
    }
    api
      .getGoogleCalendars(node.data.credentialId)
      .then((items) => {
        if (items && items.length > 0) setCalendars(items);
      })
      .catch(() => {
        setCalendars([{ id: 'primary', summary: 'Primary Calendar' }]);
      });
  }, [node.data.credentialId]);

  // Quick duration add
  const addDurationMinutes = (minutes: number) => {
    try {
      const start = new Date(startTime);
      if (!isNaN(start.getTime())) {
        const end = new Date(start.getTime() + minutes * 60000);
        onParamChange('endTime', end.toISOString().slice(0, 16) + ':00Z');
      }
    } catch {}
  };

  const previewSummary = resolveExpressionsForPreview(summary, allNodes);
  const previewLocation = resolveExpressionsForPreview(location, allNodes);
  const previewDescription = resolveExpressionsForPreview(description, allNodes);

  return (
    <div className="space-y-4 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#161616] border border-[#242424] space-y-1">
        <span className="font-semibold text-white block">Schedule Calendar Event</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Create Google Calendar appointments, invitations, and automated meetings.
        </p>
      </div>

      <div className="p-4 rounded-[18px] bg-[#161616] border border-[#242424] space-y-3.5">
        {/* Calendar Picker */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-[#A3A3A3] flex items-center gap-1.5">
            <GoogleCalendarIcon size={14} className="shrink-0" />
            <span>Target Calendar</span>
          </label>
          <div className="relative">
            <select
              value={calendarId}
              onChange={(e) => onParamChange('calendarId', e.target.value)}
              className="w-full bg-[#121212] border border-[#2A2A2A] rounded-[12px] px-3 py-2 text-xs text-white appearance-none focus:outline-none focus:border-[#4285F4] pr-8"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* Event Title */}
        <SmartInput
          label="Event Title"
          value={summary}
          onChange={(val) => onParamChange('summary', val)}
          placeholder="e.g. Discovery Call with {{ trigger.name }}"
          required={true}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />

        {/* Date & Time Settings */}
        <div className="p-3 rounded-[14px] bg-[#121212] border border-[#262626] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#34A853]" />
              <span>Event Schedule</span>
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#888888]">All-day event</span>
              <button
                type="button"
                onClick={() => setIsAllDay(!isAllDay)}
                className={`w-7 h-4 rounded-full transition-colors relative ${
                  isAllDay ? 'bg-[#34A853]' : 'bg-[#2A2A2A]'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-transform ${
                    isAllDay ? 'left-3.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SmartInput
              label="Start Time"
              value={startTime}
              onChange={(val) => onParamChange('startTime', val)}
              placeholder="2026-11-06T10:00:00Z"
              required={true}
              allNodes={allNodes}
              edges={edges}
              nodeRuns={nodeRuns}
              currentNodeId={node.id}
            />

            <SmartInput
              label="End Time"
              value={endTime}
              onChange={(val) => onParamChange('endTime', val)}
              placeholder="2026-11-06T11:00:00Z"
              required={true}
              allNodes={allNodes}
              edges={edges}
              nodeRuns={nodeRuns}
              currentNodeId={node.id}
            />
          </div>

          {/* Quick Duration Buttons */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-[#737373]">Quick End Time:</span>
            <button
              type="button"
              onClick={() => addDurationMinutes(30)}
              className="px-2 py-0.5 rounded-full bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
            >
              +30m
            </button>
            <button
              type="button"
              onClick={() => addDurationMinutes(60)}
              className="px-2 py-0.5 rounded-full bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
            >
              +1 hour
            </button>
            <button
              type="button"
              onClick={() => addDurationMinutes(120)}
              className="px-2 py-0.5 rounded-full bg-[#1A1A1A] hover:bg-[#262626] border border-[#333333] text-[10px] text-[#A3A3A3] hover:text-white transition-colors"
            >
              +2 hours
            </button>
          </div>

          {/* Timezone */}
          <SmartInput
            label="Timezone"
            value={timeZone}
            onChange={(val) => onParamChange('timeZone', val)}
            placeholder="UTC or America/New_York"
            description="e.g. UTC, America/New_York, Europe/London, Asia/Kolkata"
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />
        </div>

        {/* Location & Video Call */}
        <div className="space-y-1.5">
          <SmartInput
            label="Location or Meeting Link"
            value={location}
            onChange={(val) => onParamChange('location', val)}
            placeholder="e.g. Google Meet or 123 Tech Blvd, Suite 400"
            allNodes={allNodes}
            edges={edges}
            nodeRuns={nodeRuns}
            currentNodeId={node.id}
          />
          {!location && (
            <button
              type="button"
              onClick={() => onParamChange('location', 'Google Meet (link generated on invite)')}
              className="text-[10px] text-[#4285F4] hover:underline flex items-center gap-1"
            >
              <Video className="w-3 h-3" />
              <span>Use Google Meet video call</span>
            </button>
          )}
        </div>

        {/* Attendees */}
        <SmartInput
          label="Attendees (Comma-separated emails)"
          value={attendees}
          onChange={(val) => onParamChange('attendees', val)}
          placeholder="e.g. sarah@sky.net, alex@example.com, {{ trigger.email }}"
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
          description="Enter recipient emails or dynamic step variables."
        />

        {/* Description / Agenda */}
        <UniversalTextarea
          label="Event Description / Agenda"
          value={description}
          onChange={(val) => onParamChange('description', val)}
          placeholder="Meeting agenda, briefing notes, and preparation links..."
          rows={3}
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={node.id}
        />
      </div>

      {/* Live Calendar Event Card Preview */}
      <div className="p-3.5 rounded-[18px] bg-[#141414] border border-[#242424] space-y-2">
        <div className="flex items-center gap-1.5 text-[#A3A3A3] text-[11px] font-semibold">
          <Eye className="w-3.5 h-3.5 text-[#4285F4]" />
          <span>Google Calendar Event Preview</span>
        </div>
        <div className="p-3.5 rounded-[14px] bg-[#161616] border border-[#262626] border-l-4 border-l-[#4285F4] space-y-2">
          <div className="flex items-start justify-between">
            <span className="font-bold text-xs text-white">
              {previewSummary || 'Untitled Event'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A2536] text-[#70A5F9] font-medium">
              Confirmed
            </span>
          </div>

          <div className="space-y-1 text-[11px] text-[#A3A3A3]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-[#34A853]" />
              <span>
                {startTime} — {endTime} ({timeZone})
              </span>
            </div>

            {previewLocation && (
              <div className="flex items-center gap-1.5 text-[#E1E1E1]">
                <MapPin className="w-3 h-3 text-[#EA4335]" />
                <span>{previewLocation}</span>
              </div>
            )}

            {attendees && (
              <div className="flex items-center gap-1.5 text-[#73A5C6]">
                <Users className="w-3 h-3 text-[#4285F4]" />
                <span>Attendees: {attendees}</span>
              </div>
            )}
          </div>

          {previewDescription && (
            <p className="text-[11px] text-[#888888] pt-1 border-t border-[#262626] whitespace-pre-wrap leading-relaxed">
              {previewDescription}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
