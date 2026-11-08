import { useState, useEffect } from 'react';
import {
  Send,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CanvasNode } from '../graphConverter.js';
import { resolveExpressionsForPreview } from './variableUtils.js';
import { AttachmentItem } from './AttachmentUploader.js';
import { api } from '../../api/client.js';

export interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentialId?: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  senderName?: string;
  isHtml?: boolean;
  attachments?: AttachmentItem[];
  allNodes?: CanvasNode[];
}

export function TestEmailModal({
  isOpen,
  onClose,
  credentialId,
  to,
  subject,
  body,
  cc,
  bcc,
  replyTo,
  senderName,
  isHtml = true,
  attachments = [],
  allNodes = [],
}: TestEmailModalProps) {
  const [recipientChoice, setRecipientChoice] = useState<'myself' | 'custom'>('custom');
  const [customTo, setCustomTo] = useState('');
  const [myEmail, setMyEmail] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    messageId?: string;
    error?: string;
  } | null>(null);

  // Discover user's connected Google account email
  useEffect(() => {
    if (credentialId) {
      api.getCredentials().then((creds) => {
        const found = creds.find((c) => c.id === credentialId);
        if (found) {
          const match = found.name.match(/\(([^)]+)\)/);
          if (match) {
            setMyEmail(match[1]);
          }
        }
      }).catch(() => {});
    }

    const resolvedDefault = resolveExpressionsForPreview(to, allNodes);
    setCustomTo(resolvedDefault);
  }, [credentialId, to, allNodes]);

  if (!isOpen) return null;

  const targetEmail = recipientChoice === 'myself' && myEmail ? myEmail : customTo;
  const resolvedSubject = resolveExpressionsForPreview(subject, allNodes) || 'Test email from VULP';
  const resolvedBody = resolveExpressionsForPreview(body, allNodes);

  const handleSendTest = async () => {
    if (!credentialId) {
      setTestResult({
        success: false,
        error: 'Please select a connected Google account first.',
      });
      return;
    }
    if (!targetEmail || !targetEmail.trim()) {
      setTestResult({
        success: false,
        error: 'Please specify a recipient email address.',
      });
      return;
    }

    setIsSending(true);
    setTestResult(null);

    try {
      const payload: any = {
        credentialId,
        to: targetEmail.trim(),
        subject: `[VULP TEST] ${resolvedSubject}`,
        body: resolvedBody,
        isHtml,
        cc: cc ? resolveExpressionsForPreview(cc, allNodes) : undefined,
        bcc: bcc ? resolveExpressionsForPreview(bcc, allNodes) : undefined,
        replyTo,
        senderName,
        attachments: attachments.map((a) => ({
          name: a.name,
          mimeType: a.mimeType,
          content: a.content,
          encoding: a.encoding,
          url: a.url,
          driveFileId: a.driveFileId,
        })),
      };

      const res = await fetch('/api/integrations/google/gmail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setTestResult({
        success: true,
        messageId: data.result?.id,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err?.message || 'Failed to send test email',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none font-sans animate-in fade-in-0 duration-150">
      <div className="w-full max-w-lg rounded-[24px] bg-[#161616] border border-[#282828] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-[#242424] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-[#222222] border border-[#303030] flex items-center justify-center text-[#FF7306]">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Test Gmail Email</h3>
              <p className="text-[11px] text-[#7A7A7A]">
                Send an actual test email through your connected Gmail account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#7A7A7A] hover:text-white hover:bg-[#222222] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Recipient Mode Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#A3A3A3]">Send Test To</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRecipientChoice('custom')}
                className={`p-3 rounded-[14px] border text-left transition-all ${
                  recipientChoice === 'custom'
                    ? 'bg-[#202020] border-[#FF7306] text-white font-semibold'
                    : 'bg-[#181818] border-[#262626] text-[#888888] hover:text-white'
                }`}
              >
                <div className="text-xs">Custom Email</div>
                <div className="text-[10.5px] text-[#737373] mt-0.5 truncate">
                  {customTo || 'Enter address'}
                </div>
              </button>

              <button
                type="button"
                disabled={!myEmail}
                onClick={() => setRecipientChoice('myself')}
                className={`p-3 rounded-[14px] border text-left transition-all ${
                  recipientChoice === 'myself'
                    ? 'bg-[#202020] border-[#FF7306] text-white font-semibold'
                    : 'bg-[#181818] border-[#262626] text-[#888888] hover:text-white'
                } ${!myEmail ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-xs">Myself</div>
                <div className="text-[10.5px] text-[#737373] mt-0.5 truncate">
                  {myEmail || 'No account email'}
                </div>
              </button>
            </div>
          </div>

          {/* Custom Email Input */}
          {recipientChoice === 'custom' && (
            <div className="space-y-1">
              <label className="text-[11px] text-[#888888]">Destination Email Address</label>
              <input
                type="email"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                placeholder="test.user@company.com"
                className="w-full bg-[#121212] border border-[#2A2A2A] rounded-full px-3.5 py-2 text-xs text-white outline-none focus:border-[#444]"
              />
            </div>
          )}

          {/* Test Payload Preview Summary */}
          <div className="p-3 rounded-[14px] bg-[#121212] border border-[#222222] space-y-1.5 text-[11px]">
            <div className="text-[#737373] font-medium uppercase tracking-wider text-[10px]">
              Outgoing Message Summary
            </div>
            <div className="flex gap-2 text-[#CCCCCC] truncate">
              <span className="text-[#666666] w-14 shrink-0">Subject:</span>
              <span className="truncate font-medium">{resolvedSubject}</span>
            </div>
            <div className="flex gap-2 text-[#CCCCCC]">
              <span className="text-[#666666] w-14 shrink-0">Files:</span>
              <span>{attachments.length} attachment(s)</span>
            </div>
          </div>

          {/* Result Alert */}
          {testResult && (
            <div
              className={`p-3.5 rounded-[16px] border text-xs flex items-start gap-2.5 animate-in fade-in-0 duration-150 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold text-xs">
                  {testResult.success ? 'Test Email Sent Successfully!' : 'Test Email Failed'}
                </div>
                <div className="text-[11px] opacity-90 leading-relaxed">
                  {testResult.success
                    ? `Message delivered via Gmail API. Check the inbox at ${targetEmail}. (ID: ${testResult.messageId})`
                    : testResult.error}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#242424] bg-[#141414] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs text-[#888888] hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={isSending || !targetEmail}
            onClick={handleSendTest}
            className={`px-5 py-2 rounded-full bg-[#FF7306] hover:bg-[#E56600] text-black font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isSending || !targetEmail ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-black" />
                <span>Send Test Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
