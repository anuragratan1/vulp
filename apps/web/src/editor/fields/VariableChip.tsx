import { X } from 'lucide-react';
import { CanvasNode } from '../graphConverter.js';
import { getVariableDisplayInfo } from './variableUtils.js';

export interface VariableChipProps {
  expression: string; // e.g. "{{ webhook_lead.body.email }}"
  allNodes?: CanvasNode[];
  onRemove?: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function VariableChip({
  expression,
  allNodes = [],
  onRemove,
  className = '',
  size = 'md',
}: VariableChipProps) {
  const info = getVariableDisplayInfo(expression, allNodes);
  const isSmall = size === 'sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#202020] border border-[#383838] hover:border-[#505050] text-white font-medium select-none align-middle transition-colors shadow-xs group ${
        isSmall ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'
      } ${className}`}
      title={`Step: ${info.stepName} (${info.raw})`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7306] shrink-0" />
      <span className="text-[#A3A3A3] text-[10.5px] font-normal truncate max-w-[120px]">
        {info.stepName}
      </span>
      <span className="text-[#666666] text-[10px] select-none">→</span>
      <span className="text-white font-semibold tracking-tight truncate max-w-[150px]">
        {info.label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-[#737373] hover:text-white rounded-full p-0.5 hover:bg-[#333333] transition-colors ml-0.5"
          title="Remove variable"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}
