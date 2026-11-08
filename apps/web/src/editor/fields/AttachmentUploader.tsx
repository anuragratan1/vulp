import React, { useState, useRef } from 'react';
import {
  Paperclip,
  Upload,
  Link as LinkIcon,
  HardDrive,
  FileText,
  X,
  FileCode,
  FileSpreadsheet,
  File,
  Image as ImageIcon,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CanvasNode } from '../graphConverter.js';

export interface AttachmentItem {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  source: 'local' | 'url' | 'drive' | 'step';
  content?: string; // base64 or text
  encoding?: 'base64' | 'utf-8';
  url?: string;
  driveFileId?: string;
  stepExpression?: string;
}

export interface AttachmentUploaderProps {
  attachments: AttachmentItem[];
  onChange: (attachments: AttachmentItem[]) => void;
  credentialId?: string;
  allNodes?: CanvasNode[];
  currentNodeId?: string;
  className?: string;
}

export function AttachmentUploader({
  attachments = [],
  onChange,
  credentialId,
  allNodes = [],
  currentNodeId = '',
  className = '',
}: AttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeModal, setActiveModal] = useState<'url' | 'drive' | 'step' | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlNameInput, setUrlNameInput] = useState('');
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [stepExprInput, setStepExprInput] = useState('');

  // Calculate total size
  const totalBytes = attachments.reduce((sum, a) => sum + (a.size || 0), 0);
  const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB limit
  const isOverLimit = totalBytes > MAX_TOTAL_BYTES;

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get icon by file extension or mime type
  const getFileIcon = (name: string, _mime?: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <ImageIcon className="w-3.5 h-3.5 text-blue-400" />;
    }
    if (['csv', 'xlsx', 'xls', 'sheet'].includes(ext || '')) {
      return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />;
    }
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) {
      return <FileText className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (['json', 'xml', 'html', 'js', 'ts'].includes(ext || '')) {
      return <FileCode className="w-3.5 h-3.5 text-purple-400" />;
    }
    return <File className="w-3.5 h-3.5 text-[#999999]" />;
  };

  // 1. Handle Local File Upload
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64WithHeader = event.target?.result as string;
        // Strip data:mime;base64, prefix
        const base64Data = base64WithHeader.split(',')[1] || '';

        const newAttachment: AttachmentItem = {
          id: `att_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          source: 'local',
          content: base64Data,
          encoding: 'base64',
        };

        onChange([...attachments, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 2. Add URL Attachment
  const handleAddUrlAttachment = () => {
    if (!urlInput.trim()) return;
    const name = urlNameInput.trim() || urlInput.split('/').pop()?.split('?')[0] || 'attachment';

    const newAttachment: AttachmentItem = {
      id: `att_url_${Date.now()}`,
      name,
      source: 'url',
      url: urlInput.trim(),
    };

    onChange([...attachments, newAttachment]);
    setUrlInput('');
    setUrlNameInput('');
    setActiveModal(null);
  };

  // 3. Load and Select Google Drive Files
  const handleOpenDriveModal = async () => {
    setActiveModal('drive');
    setLoadingDrive(true);
    setDriveError(null);

    try {
      if (!credentialId) {
        throw new Error('Please select a connected Google account first.');
      }
      const res = await fetch(
        `/api/integrations/google/drive/files?credentialId=${encodeURIComponent(credentialId)}`
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to list Google Drive files');
      }
      const data = await res.json();
      setDriveFiles(data.files || []);
    } catch (err: any) {
      setDriveError(err?.message || 'Could not access Google Drive');
    } finally {
      setLoadingDrive(false);
    }
  };

  const handleSelectDriveFile = (file: any) => {
    const newAttachment: AttachmentItem = {
      id: `att_drive_${file.id}`,
      name: file.name,
      size: file.size ? Number(file.size) : undefined,
      mimeType: file.mimeType,
      source: 'drive',
      driveFileId: file.id,
    };

    onChange([...attachments, newAttachment]);
    setActiveModal(null);
  };

  // 4. Add Upstream Workflow Output as Attachment
  const handleAddStepAttachment = () => {
    if (!stepExprInput.trim()) return;

    const newAttachment: AttachmentItem = {
      id: `att_step_${Date.now()}`,
      name: stepExprInput.trim(),
      source: 'step',
      stepExpression: stepExprInput.trim(),
    };

    onChange([...attachments, newAttachment]);
    setStepExprInput('');
    setActiveModal(null);
  };

  // Remove attachment
  const handleRemove = (id: string) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  // Upstream nodes for step picker
  const upstreamNodes = allNodes.filter((n) => n.id !== currentNodeId);

  return (
    <div className={`space-y-2 text-xs font-sans ${className}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={true}
        onChange={handleLocalFileUpload}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3] flex items-center gap-1.5 select-none">
          <Paperclip className="w-3.5 h-3.5 text-[#FF7306]" />
          <span>Attachments ({attachments.length})</span>
        </label>

        {/* Add Attachment Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="px-2.5 py-1 rounded-full bg-[#1F1F1F] hover:bg-[#282828] border border-[#2E2E2E] text-[11px] font-semibold text-white flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF7306]" />
              <span>Add File</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-50 w-56 p-1.5 rounded-[16px] bg-[#1A1A1A] border border-[#2E2E2E] shadow-2xl space-y-1 text-xs"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-white hover:bg-[#242424] transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <div>
                  <div className="font-semibold text-xs">Upload Computer File</div>
                  <div className="text-[10px] text-[#7A7A7A]">PDF, image, CSV, doc</div>
                </div>
              </button>

              <button
                type="button"
                onClick={handleOpenDriveModal}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-white hover:bg-[#242424] transition-colors"
              >
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <div className="font-semibold text-xs">Google Drive File</div>
                  <div className="text-[10px] text-[#7A7A7A]">Pick from connected Drive</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('url')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-white hover:bg-[#242424] transition-colors"
              >
                <LinkIcon className="w-3.5 h-3.5 text-amber-400" />
                <div>
                  <div className="font-semibold text-xs">Download from URL</div>
                  <div className="text-[10px] text-[#7A7A7A]">Public web file link</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('step')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-left text-white hover:bg-[#242424] transition-colors"
              >
                <FileCode className="w-3.5 h-3.5 text-purple-400" />
                <div>
                  <div className="font-semibold text-xs">Previous Step Output</div>
                  <div className="text-[10px] text-[#7A7A7A]">Data from earlier step</div>
                </div>
              </button>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-2.5 rounded-[14px] bg-[#161616] border border-[#262626] hover:border-[#333333] transition-colors group"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                <div className="w-7 h-7 rounded-[8px] bg-[#222222] flex items-center justify-center shrink-0">
                  {getFileIcon(att.name, att.mimeType)}
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium text-white truncate">{att.name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-[#777777]">
                    <span>{formatSize(att.size)}</span>
                    <span>•</span>
                    <span className="capitalize text-[#999999]">{att.source}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRemove(att.id)}
                className="p-1 rounded-full text-[#666666] hover:text-rose-400 hover:bg-[#242424] transition-colors"
                title="Remove attachment"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Total Size Indicator */}
          <div className="flex items-center justify-between text-[11px] text-[#737373] px-1 pt-0.5">
            <span>Total: {formatSize(totalBytes)} / 25 MB max</span>
            {isOverLimit && (
              <span className="text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                <span>Exceeds Gmail limit</span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-[16px] bg-[#151515] border border-[#242424] text-center text-[#737373] text-[11px] leading-relaxed">
          No attachments added yet. You can attach local documents, URLs, or files from Google Drive.
        </div>
      )}

      {/* URL Attachment Modal */}
      {activeModal === 'url' && (
        <div className="p-3.5 rounded-[16px] bg-[#181818] border border-[#2E2E2E] space-y-2.5 animate-in fade-in-0 duration-150">
          <div className="font-semibold text-white text-xs">Attach from URL</div>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/files/invoice.pdf"
            className="w-full bg-[#121212] border border-[#2B2B2B] rounded-full px-3.5 py-2 text-xs text-white outline-none focus:border-[#444]"
          />
          <input
            type="text"
            value={urlNameInput}
            onChange={(e) => setUrlNameInput(e.target.value)}
            placeholder="Custom file name (optional, e.g. receipt.pdf)"
            className="w-full bg-[#121212] border border-[#2B2B2B] rounded-full px-3.5 py-2 text-xs text-white outline-none focus:border-[#444]"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-3 py-1.5 rounded-full text-xs text-[#888888] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddUrlAttachment}
              className="px-4 py-1.5 rounded-full bg-[#FF7306] text-black text-xs font-semibold hover:bg-[#E56600]"
            >
              Add URL
            </button>
          </div>
        </div>
      )}

      {/* Google Drive Picker Modal */}
      {activeModal === 'drive' && (
        <div className="p-3.5 rounded-[16px] bg-[#181818] border border-[#2E2E2E] space-y-2.5 animate-in fade-in-0 duration-150">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white text-xs flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Select File from Google Drive</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="text-[#666666] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingDrive ? (
            <div className="p-6 text-center text-[#888888] flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-[#FF7306]" />
              <span>Loading Drive files...</span>
            </div>
          ) : driveError ? (
            <div className="p-3 rounded-[12px] bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {driveError}
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="p-4 text-center text-[#737373] text-xs">
              No files found in Google Drive root.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {driveFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectDriveFile(f)}
                  className="w-full flex items-center justify-between p-2 rounded-[10px] text-left hover:bg-[#222222] transition-colors group"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <File className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs text-white truncate">{f.name}</span>
                  </div>
                  <span className="text-[10px] text-[#777777] shrink-0">{formatSize(f.size)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upstream Step Output Modal */}
      {activeModal === 'step' && (
        <div className="p-3.5 rounded-[16px] bg-[#181818] border border-[#2E2E2E] space-y-2.5 animate-in fade-in-0 duration-150">
          <div className="font-semibold text-white text-xs">Attach from Workflow Step</div>
          <p className="text-[11px] text-[#888888]">
            Enter the expression for the file data or URL returned by an upstream step:
          </p>
          <div className="space-y-1">
            {upstreamNodes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setStepExprInput(`{{ ${n.data.key || n.id}.file }}`)}
                className="w-full text-left px-2.5 py-1.5 rounded-[8px] hover:bg-[#242424] text-[11px] text-[#CCCCCC] flex items-center justify-between"
              >
                <span>{n.data.name || n.data.key}</span>
                <span className="text-[10px] font-mono text-[#FF7306]">
                  {`{{ ${n.data.key || n.id}.file }}`}
                </span>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={stepExprInput}
            onChange={(e) => setStepExprInput(e.target.value)}
            placeholder="{{ http_fetch.data }}"
            className="w-full bg-[#121212] border border-[#2B2B2B] rounded-full px-3.5 py-2 text-xs text-white font-mono outline-none focus:border-[#444]"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-3 py-1.5 rounded-full text-xs text-[#888888] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddStepAttachment}
              className="px-4 py-1.5 rounded-full bg-[#FF7306] text-black text-xs font-semibold hover:bg-[#E56600]"
            >
              Add Step Output
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
