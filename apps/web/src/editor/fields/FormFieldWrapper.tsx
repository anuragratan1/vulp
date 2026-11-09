import { useState } from 'react';
import { Variable, AlertCircle } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { DynamicDataPicker, DynamicSourceField } from './DynamicDataPicker.js';
import { VariableChip } from './VariableChip.js';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';

export interface FormFieldWrapperProps {
  label: string;
  required?: boolean;
  optionalBadge?: boolean;
  description?: string;
  error?: string;
  allowDynamicData?: boolean;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId?: string;
  onInsertDynamic?: (expression: string, field: DynamicSourceField) => void;
  children: React.ReactNode;
  className?: string;
  value?: any;
}

export function FormFieldWrapper({
  label,
  required,
  optionalBadge = false,
  description,
  error,
  allowDynamicData = true,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId = '',
  onInsertDynamic,
  children,
  className = '',
  value,
}: FormFieldWrapperProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Check if current value contains an expression
  const expressionMatches =
    typeof value === 'string' ? value.match(/\{\{\s*([^}]+?)\s*\}\}/g) : null;

  return (
    <div className={`space-y-1.5 text-xs font-sans ${className}`}>
      {/* Top Header Row */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3] flex items-center gap-1.5 select-none">
          <span>{label}</span>
          {required && (
            <span className="text-rose-400 font-bold" title="Required field">
              *
            </span>
          )}
          {!required && optionalBadge && (
            <span className="text-[10px] text-[#737373] bg-[#1E1E1E] px-1.5 py-0.5 rounded-full font-normal">
              Optional
            </span>
          )}
        </label>

        {/* Dynamic Data Picker Trigger */}
        {allowDynamicData && onInsertDynamic && (
          <DropdownMenu.Root open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] font-medium text-[#FF7306] hover:text-[#FFA154] hover:bg-[#FF7306]/10 px-2 py-0.5 rounded-full transition-colors select-none group cursor-pointer"
                title="Insert data from previous workflow steps"
              >
                <Variable className="w-3 h-3 text-[#FF7306] group-hover:rotate-12 transition-transform" />
                <span>Insert variable</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="bottom"
                align="end"
                sideOffset={8}
                className="z-50"
              >
                <DynamicDataPicker
                  allNodes={allNodes}
                  edges={edges}
                  nodeRuns={nodeRuns}
                  currentNodeId={currentNodeId}
                  onSelect={(expr, field) => {
                    onInsertDynamic(expr, field);
                    setIsPickerOpen(false);
                  }}
                  onClose={() => setIsPickerOpen(false)}
                />
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {/* Input / Control element */}
      <div className="relative">{children}</div>

      {/* Dynamic Data Chips Preview */}
      {expressionMatches && expressionMatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {expressionMatches.map((expr, idx) => (
            <VariableChip
              key={idx}
              expression={expr}
              allNodes={allNodes}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Description / Helper text */}
      {description && !error && (
        <p className="text-[11px] text-[#737373] leading-relaxed pt-0.5">{description}</p>
      )}

      {/* Inline Validation Error */}
      {error && (
        <div className="flex items-start gap-1.5 pt-0.5 text-rose-400 text-[11px] animate-in fade-in-0 duration-150">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
