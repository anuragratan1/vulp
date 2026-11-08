import React, { useState, useRef, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Pencil } from 'lucide-react';

interface EditableWorkflowTitleProps {
  name: string;
  onSaveName: (newName: string) => void;
  disabled?: boolean;
}

export function EditableWorkflowTitle({
  name,
  onSaveName,
  disabled = false,
}: EditableWorkflowTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draftValue whenever parent name changes and not editing
  useEffect(() => {
    if (!isEditing) {
      setDraftValue(name);
    }
  }, [name, isEditing]);

  // Focus and select input text when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const trimmed = draftValue.trim();
    if (trimmed && trimmed !== name) {
      onSaveName(trimmed);
    } else {
      setDraftValue(name);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setDraftValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  };

  if (isEditing && !disabled) {
    return (
      <div className="min-w-0 max-w-[200px] sm:max-w-[320px] md:max-w-[440px] lg:max-w-[560px]">
        <input
          ref={inputRef}
          type="text"
          value={draftValue}
          onChange={(e) => setDraftValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          placeholder="Workflow title"
          className="font-semibold text-xs sm:text-sm text-text-primary bg-[#161616] border border-[#333333] px-2 py-0.5 rounded-[8px] outline-none shadow-sm w-full transition-all"
        />
      </div>
    );
  }

  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setDraftValue(name);
              setIsEditing(true);
            }
          }}
          disabled={disabled}
          className="group flex items-center gap-1.5 px-2 py-1 rounded-[8px] hover:bg-[#181818] border border-transparent hover:border-[#282828] transition-all text-left min-w-0 max-w-[180px] sm:max-w-[280px] md:max-w-[400px] lg:max-w-[520px] cursor-text"
          aria-label="Rename workflow"
        >
          <span className="font-semibold text-xs sm:text-sm text-text-primary truncate tracking-tight">
            {name || 'Untitled Automation'}
          </span>
          <Pencil className="w-3 h-3 text-text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="bottom"
          sideOffset={8}
          className="z-50 px-2.5 py-1 text-xs font-medium text-text-primary bg-[#1C1C1C] border border-[#2E2E2E] rounded-[6px] shadow-2xl max-w-sm break-words"
        >
          <div className="font-semibold">{name || 'Untitled Automation'}</div>
          <div className="text-[10px] text-text-muted mt-0.5">Click to rename</div>
          <Tooltip.Arrow className="fill-[#1C1C1C]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

