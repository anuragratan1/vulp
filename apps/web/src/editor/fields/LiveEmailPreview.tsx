import { Eye, Paperclip, Send } from 'lucide-react';
import { CanvasNode } from '../graphConverter.js';
import { resolveExpressionsForPreview } from './variableUtils.js';
import { AttachmentItem } from './AttachmentUploader.js';

export interface LiveEmailPreviewProps {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  senderName?: string;
  attachments?: AttachmentItem[];
  allNodes?: CanvasNode[];
  onOpenTestDialog?: () => void;
  className?: string;
}

export function LiveEmailPreview({
  to,
  subject,
  body,
  cc,
  bcc,
  replyTo,
  senderName,
  attachments = [],
  allNodes = [],
  onOpenTestDialog,
  className = '',
}: LiveEmailPreviewProps) {
  const resolvedTo = resolveExpressionsForPreview(to, allNodes);
  const resolvedSubject = resolveExpressionsForPreview(subject, allNodes);
  const resolvedBody = resolveExpressionsForPreview(body, allNodes);
  const resolvedCc = cc ? resolveExpressionsForPreview(cc, allNodes) : '';
  const resolvedBcc = bcc ? resolveExpressionsForPreview(bcc, allNodes) : '';

  return (
    <div className={`space-y-3 text-xs font-sans ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#CCCCCC]">
          <Eye className="w-3.5 h-3.5 text-[#FF7306]" />
          <span>Live Email Preview (With Sample Data)</span>
        </div>
        {onOpenTestDialog && (
          <button
            type="button"
            onClick={onOpenTestDialog}
            className="px-2.5 py-1 rounded-full bg-[#FF7306]/15 hover:bg-[#FF7306]/25 text-[#FF7306] font-semibold text-[11px] flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3 h-3" />
            <span>Send Test</span>
          </button>
        )}
      </div>

      <div className="rounded-[18px] bg-[#121212] border border-[#242424] overflow-hidden shadow-lg">
        {/* Email Metadata Headers */}
        <div className="p-3.5 space-y-2 border-b border-[#202020] bg-[#161616] text-[11px]">
          {senderName && (
            <div className="flex items-center gap-2 text-[#888888]">
              <span className="w-12 text-[#555555] font-medium">From:</span>
              <span className="text-white font-semibold">{senderName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#888888]">
            <span className="w-12 text-[#555555] font-medium">To:</span>
            <span className="text-white font-medium truncate">
              {resolvedTo || '<recipient@example.com>'}
            </span>
          </div>
          {resolvedCc && (
            <div className="flex items-center gap-2 text-[#888888]">
              <span className="w-12 text-[#555555] font-medium">Cc:</span>
              <span className="text-[#AAAAAA] truncate">{resolvedCc}</span>
            </div>
          )}
          {resolvedBcc && (
            <div className="flex items-center gap-2 text-[#888888]">
              <span className="w-12 text-[#555555] font-medium">Bcc:</span>
              <span className="text-[#AAAAAA] truncate">{resolvedBcc}</span>
            </div>
          )}
          {replyTo && (
            <div className="flex items-center gap-2 text-[#888888]">
              <span className="w-12 text-[#555555] font-medium">Reply-To:</span>
              <span className="text-[#AAAAAA] truncate">{replyTo}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[#888888] pt-0.5">
            <span className="w-12 text-[#555555] font-medium">Subject:</span>
            <span className="text-white font-semibold tracking-tight truncate">
              {resolvedSubject || 'No Subject'}
            </span>
          </div>
        </div>

        {/* Message Body Content */}
        <div className="p-4 text-xs text-[#E0E0E0] leading-relaxed min-h-[100px] max-h-[300px] overflow-y-auto">
          {resolvedBody.includes('<') && resolvedBody.includes('>') ? (
            <div
              className="preview-html-content space-y-2"
              dangerouslySetInnerHTML={{ __html: resolvedBody }}
            />
          ) : (
            <div className="whitespace-pre-wrap font-sans">
              {resolvedBody || 'No message content written yet.'}
            </div>
          )}
        </div>

        {/* Attachments Section in Preview */}
        {attachments.length > 0 && (
          <div className="p-3 border-t border-[#202020] bg-[#161616] flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 text-[10.5px] text-[#737373] mr-1">
              <Paperclip className="w-3 h-3 text-[#FF7306]" />
              <span>{attachments.length} attachment(s):</span>
            </div>
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#202020] border border-[#2E2E2E] text-[10.5px] text-white"
              >
                <span>{a.name}</span>
                {a.size && (
                  <span className="text-[#777777]">
                    ({(a.size / 1024).toFixed(0)} KB)
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .preview-html-content p {
          margin-bottom: 0.5em;
        }
        .preview-html-content h1 {
          font-size: 1.3em;
          font-weight: 700;
          color: #ffffff;
          margin-top: 0.4em;
          margin-bottom: 0.2em;
        }
        .preview-html-content h2 {
          font-size: 1.15em;
          font-weight: 600;
          color: #ffffff;
          margin-top: 0.3em;
          margin-bottom: 0.2em;
        }
        .preview-html-content ul {
          list-style-type: disc;
          padding-left: 1.2em;
          margin-bottom: 0.5em;
        }
        .preview-html-content ol {
          list-style-type: decimal;
          padding-left: 1.2em;
          margin-bottom: 0.5em;
        }
        .preview-html-content a {
          color: #38bdf8;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
