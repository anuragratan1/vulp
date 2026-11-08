import * as Tooltip from '@radix-ui/react-tooltip';
import { Cloud, CloudAlert, Loader2 } from 'lucide-react';

export type CloudSaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface CloudAutosaveIndicatorProps {
  status: CloudSaveStatus;
  error?: string | null;
  onSaveNow?: () => void;
  onRetry?: () => void;
}

export function CloudAutosaveIndicator({
  status,
  error,
  onSaveNow,
  onRetry,
}: CloudAutosaveIndicatorProps) {
  if (status === 'saving') {
    return (
      <Tooltip.Root delayDuration={150}>
        <Tooltip.Trigger asChild>
          <div
            className="relative inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-text-muted cursor-default shrink-0 select-none"
            aria-label="Saving changes..."
            tabIndex={0}
          >
            <Cloud className="w-4 h-4 text-text-muted/80" />
            <Loader2 className="w-2.5 h-2.5 text-text-primary animate-spin absolute" />
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={8}
            className="z-50 px-2.5 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
          >
            Saving changes...
            <Tooltip.Arrow className="fill-[#1C1C1C]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  if (status === 'error') {
    return (
      <Tooltip.Root delayDuration={150}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors animate-pulse shrink-0 cursor-pointer"
            aria-label={`Save failed: ${error || 'Connection error'}. Click to retry.`}
          >
            <CloudAlert className="w-4 h-4 text-red-400" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={8}
            className="z-50 px-2.5 py-1.5 text-xs font-medium text-red-200 bg-[#221212] border border-red-500/30 rounded-[6px] shadow-2xl max-w-xs"
          >
            <div className="font-semibold text-red-300">Save failed</div>
            <div className="text-[11px] text-red-300/80 mt-0.5">{error || 'Unable to reach backend'}</div>
            <div className="text-[10px] text-text-muted mt-1 underline">Click to retry</div>
            <Tooltip.Arrow className="fill-[#221212]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  if (status === 'unsaved') {
    return (
      <Tooltip.Root delayDuration={150}>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={onSaveNow}
            className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-text-muted hover:text-text-primary hover:bg-[#1A1A1A] transition-colors shrink-0 cursor-pointer"
            aria-label="Unsaved changes. Click to save now."
          >
            <Cloud className="w-4 h-4" />
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="bottom"
            sideOffset={8}
            className="z-50 px-2.5 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
          >
            Unsaved changes · Click to save (⌘S)
            <Tooltip.Arrow className="fill-[#1C1C1C]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    );
  }

  // status === 'saved': Cloud with checkmark (server-confirmed)
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <div
          className="inline-flex items-center justify-center w-7 h-7 rounded-[8px] text-emerald-400 hover:bg-[#1A1A1A] transition-colors cursor-default shrink-0 select-none"
          aria-label="All changes saved to cloud"
          tabIndex={0}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-emerald-400"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
            <polyline points="9 13.5 11.5 16 15.5 11" />
          </svg>
        </div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={8}
          className="z-50 px-2.5 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl pointer-events-none select-none"
        >
          Saved to cloud
          <Tooltip.Arrow className="fill-[#1C1C1C]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
