import { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
} from '@xyflow/react';
import { Check, X } from 'lucide-react';

export interface WorkflowEdgeData {
  isExecuting?: boolean;
  branch?: 'true' | 'false' | 'default';
  [key: string]: unknown;
}

export const WorkflowEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
  sourceHandleId,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.32,
  });

  const isTrueBranch = Boolean(sourceHandleId?.startsWith('true') || data?.branch === 'true');
  const isFalseBranch = Boolean(sourceHandleId?.startsWith('false') || data?.branch === 'false');
  const isExecuting = Boolean(data?.isExecuting);

  // Wire stroke color based on branch and state - uses semantic tokens with color accents
  let strokeColor = 'var(--color-edge)';
  if (selected) {
    strokeColor = 'var(--color-edge-selected)';
  } else if (isExecuting) {
    strokeColor = isTrueBranch ? 'var(--color-success)' : 'var(--color-accent)';
  } else if (isTrueBranch) {
    strokeColor = '#10B981';
  } else if (isFalseBranch) {
    strokeColor = '#F43F5E';
  }

  // Label badge placed smoothly at geometric midpoint of any cardinal or diagonal curve
  const badgeX = labelX;
  const badgeY = labelY;

  return (
    <>
      {/* Invisible wider hit-target for effortless clicking/hovering */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        className="react-flow__edge-interaction cursor-pointer"
      />

      {/* Main Connection Wire */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 2.25 : 1.75}
        strokeLinecap="round"
        className={`transition-colors duration-150 ${
          isExecuting ? 'animate-wire-flow' : ''
        }`}
        style={{
          ...style,
          stroke: strokeColor,
          filter: selected ? 'drop-shadow(0 0 6px rgba(255, 115, 6, 0.4))' : undefined,
        }}
      />

      {/* Live Data Pulse Particle during workflow execution */}
      {isExecuting && (
        <circle
          r={3}
          fill={isTrueBranch ? 'var(--color-success)' : '#FFFFFF'}
          className="pointer-events-none drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
        >
          <animateMotion
            dur="1.2s"
            repeatCount="indefinite"
            path={edgePath}
            rotate="auto"
          />
        </circle>
      )}

      {/* Branch Badges for True / False conditions */}
      {(isTrueBranch || isFalseBranch) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${badgeX}px,${badgeY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan select-none"
          >
            {isTrueBranch ? (
              <div
                title="Condition True"
                className="w-5 h-5 rounded-[6px] bg-surface-elevated border border-emerald-500/40 text-emerald-500 flex items-center justify-center shadow-md transition-transform hover:scale-110"
              >
                <Check className="w-3 h-3 text-emerald-500" strokeWidth={2.5} />
              </div>
            ) : (
              <div
                title="Condition False"
                className="w-5 h-5 rounded-[6px] bg-surface-elevated border border-rose-500/40 text-rose-500 flex items-center justify-center shadow-md transition-transform hover:scale-110"
              >
                <X className="w-3 h-3 text-rose-500" strokeWidth={2.5} />
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

WorkflowEdge.displayName = 'WorkflowEdge';

