import { GitMerge } from 'lucide-react';
import {
  UniversalConditionBuilder,
  UniversalDurationInput,
} from '../fields/index.js';
import { CanvasNode } from '../graphConverter.js';

interface LogicConfigProps {
  node: CanvasNode;
  params: Record<string, any>;
  onParamChange: (key: string, value: any) => void;
  allNodes?: CanvasNode[];
}

// 1. IF / ELSE Branching Node
export function IfNodeConfig({
  node,
  params,
  onParamChange,
  allNodes = [],
}: LogicConfigProps) {
  const left = String(params.left ?? '');
  const operator = String(params.operator ?? 'equals');
  const right = String(params.right ?? '');

  return (
    <div className="space-y-5 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#171717] border border-[#262626] space-y-1">
        <span className="font-semibold text-white block">Conditional Branching</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Evaluate incoming data to decide whether execution flows down the TRUE or FALSE branch.
        </p>
      </div>

      <UniversalConditionBuilder
        left={left}
        operator={operator}
        right={right}
        onChange={(updates) => {
          if (updates.left !== undefined) onParamChange('left', updates.left);
          if (updates.operator !== undefined) onParamChange('operator', updates.operator);
          if (updates.right !== undefined) onParamChange('right', updates.right);
        }}
        allNodes={allNodes}
        currentNodeId={node.id}
      />
    </div>
  );
}

// 2. Delay Node
export function DelayNodeConfig({
  params,
  onParamChange,
}: LogicConfigProps) {
  const durationMs = Number(params.durationMs) || 1000;

  return (
    <div className="space-y-5 text-xs font-sans">
      <div className="p-3.5 rounded-[18px] bg-[#171717] border border-[#262626] space-y-1">
        <span className="font-semibold text-white block">Pause Workflow</span>
        <p className="text-[11px] text-[#7A7A7A] leading-relaxed">
          Hold execution for a specified duration before continuing to subsequent steps.
        </p>
      </div>

      <UniversalDurationInput
        label="Wait Duration"
        valueMs={durationMs}
        onChangeMs={(ms) => onParamChange('durationMs', ms)}
      />
    </div>
  );
}

// 3. Merge Node
export function MergeNodeConfig(_props: LogicConfigProps) {
  return (
    <div className="space-y-5 text-xs font-sans">
      <div className="p-4 rounded-[20px] bg-[#171717] border border-[#262626] space-y-3">
        <div className="flex items-center gap-2 text-white">
          <GitMerge className="w-4 h-4 text-[#FF7306]" />
          <span className="font-semibold text-sm">Branch Convergence</span>
        </div>
        <p className="text-[11px] text-[#A0A0A0] leading-relaxed">
          Merge brings multiple parallel branches or IF/ELSE paths back into a single unified step.
        </p>

        <div className="p-3 rounded-[14px] bg-[#141414] border border-[#242424] space-y-2">
          <span className="text-[11px] font-semibold text-white block">Execution Behavior:</span>
          <ul className="text-[11px] text-[#7A7A7A] space-y-1 list-disc list-inside">
            <li>Waits for active incoming steps to resolve.</li>
            <li>Passes incoming step data forward to downstream steps.</li>
            <li>No parameters required — automatically adapts to connected wires.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
