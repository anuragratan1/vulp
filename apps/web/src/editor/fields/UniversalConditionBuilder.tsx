import { ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';
import { SmartInput } from './SmartInput.js';

export interface UniversalConditionBuilderProps {
  left: string;
  operator: string;
  right: string;
  onChange: (updates: { left?: string; operator?: string; right?: string }) => void;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId?: string;
  className?: string;
}

export function UniversalConditionBuilder({
  left = '',
  operator = 'equals',
  right = '',
  onChange,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId = '',
  className = '',
}: UniversalConditionBuilderProps) {
  const operatorOptions = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'contains', label: 'Contains text' },
    { value: 'greater_than', label: 'Is greater than (>)' },
    { value: 'less_than', label: 'Is less than (<)' },
    { value: 'is_empty', label: 'Is empty / missing' },
    { value: 'is_not_empty', label: 'Has any value (not empty)' },
  ];

  const isUnary = operator === 'is_empty' || operator === 'is_not_empty';

  // Human readable evaluation sentence
  const selectedOpLabel =
    operatorOptions.find((o) => o.value === operator)?.label.toLowerCase() || 'equals';
  const displayLeft = left ? (left.includes('{{') ? left.replace(/[{}]/g, '').trim() : `"${left}"`) : '[Value]';
  const displayRight = isUnary ? '' : right ? (right.includes('{{') ? right.replace(/[{}]/g, '').trim() : `"${right}"`) : '[Value]';

  return (
    <div className={`space-y-4 text-xs font-sans ${className}`}>
      {/* 1. Left Operand */}
      <SmartInput
        label="Value to Check (Left Operand)"
        required={true}
        description="Select data from a previous step or enter a value (type @ to insert variable)."
        value={left}
        onChange={(val) => onChange({ left: val })}
        placeholder="e.g. {{ webhook_lead.body.score }} or 100"
        allNodes={allNodes}
        edges={edges}
        nodeRuns={nodeRuns}
        currentNodeId={currentNodeId}
        allowVariables={true}
      />

      {/* 2. Condition Operator */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#A3A3A3]">Condition Rule</label>
        <div className="relative">
          <select
            value={operator}
            onChange={(e) => onChange({ operator: e.target.value })}
            className="w-full bg-[#171717] border border-[#262626] focus:border-[#4A4A4A] text-white rounded-full px-4 py-2.5 text-xs appearance-none outline-none transition-all cursor-pointer pr-10"
          >
            {operatorOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#171717] text-white">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[#737373] absolute right-3.5 top-3 pointer-events-none" />
        </div>
      </div>

      {/* 3. Right Operand (hidden for unary operators) */}
      {!isUnary && (
        <SmartInput
          label="Compare Against (Right Operand)"
          required={true}
          description="Value, number, or variable to compare with (type @ to insert variable)."
          value={right}
          onChange={(val) => onChange({ right: val })}
          placeholder="e.g. 80 or VIP"
          allNodes={allNodes}
          edges={edges}
          nodeRuns={nodeRuns}
          currentNodeId={currentNodeId}
          allowVariables={true}
        />
      )}

      {/* 4. Live Human Explanation Card */}
      <div className="p-3.5 rounded-[18px] bg-[#1A1A1A] border border-[#262626] space-y-2">
        <span className="text-[11px] font-semibold text-[#A3A3A3] uppercase tracking-wider block">
          Rule Summary
        </span>
        <div className="p-2.5 rounded-[12px] bg-[#141414] border border-[#222222] text-xs text-white leading-relaxed">
          If <span className="font-semibold text-[#FF9E5E]">{displayLeft}</span>{' '}
          <span className="font-medium text-white">{selectedOpLabel}</span>{' '}
          {!isUnary && <span className="font-semibold text-[#FF9E5E]">{displayRight}</span>}:
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div className="p-2 rounded-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>TRUE branch runs</span>
          </div>
          <div className="p-2 rounded-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-1.5 font-medium">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span>FALSE branch runs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
