import { useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft } from 'lucide-react';
import {
  DiscoveredVariable,
  StepVariableGroup,
} from './dynamicVariableDiscovery.js';

export interface VariableAutocompleteMenuProps {
  query: string;
  groups: StepVariableGroup[];
  coords: { top: number; left: number; bottom?: number; elementTop?: number };
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onConfirm: (variable: DiscoveredVariable) => void;
  onClose: () => void;
  defaultNodeKey?: string;
  onSelectCustomPath?: (expr: string) => void;
  onTestStep?: () => void;
  anchorEl?: HTMLElement | null;
  getAnchorRect?: () => { top: number; left: number; bottom?: number; elementTop?: number } | null;
}

function formatCompactType(type: string): string {
  switch (type?.toLowerCase()) {
    case 'string':
      return 'str';
    case 'number':
      return 'num';
    case 'boolean':
      return 'bool';
    case 'array':
      return 'list';
    case 'object':
      return 'obj';
    default:
      return type || 'any';
  }
}

export function VariableAutocompleteMenu({
  query,
  groups,
  coords,
  selectedIndex,
  onSelectIndex,
  onConfirm,
  onClose,
  defaultNodeKey = 'trigger',
  onSelectCustomPath,
  anchorEl,
  getAnchorRect,
}: VariableAutocompleteMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Position tracking when scrolling or resizing
  const [currentCoords, setCurrentCoords] = useState(coords);

  useEffect(() => {
    setCurrentCoords(coords);
  }, [coords.top, coords.left, coords.bottom, coords.elementTop]);

  // Clean search query without leading '@'
  const cleanQuery = query.replace(/^@/, '').trim().toLowerCase();

  // Flattened and filtered variables list matching the query
  const filteredVariables = useMemo(() => {
    const list: DiscoveredVariable[] = [];
    for (const group of groups) {
      for (const v of group.variables) {
        if (
          !cleanQuery ||
          v.label.toLowerCase().includes(cleanQuery) ||
          v.path.toLowerCase().includes(cleanQuery) ||
          v.nodeKey.toLowerCase().includes(cleanQuery) ||
          v.stepName.toLowerCase().includes(cleanQuery)
        ) {
          list.push(v);
        }
      }
    }
    return list;
  }, [groups, cleanQuery]);

  // Show source context badge only when variables come from multiple steps
  const showSourceContext = groups.length > 1;

  // Viewport-aware, stable popup positioning calculation
  const POPUP_WIDTH = 270;
  const MAX_POPUP_HEIGHT = 220;
  const MARGIN = 12;

  const { top, bottom, left, maxHeight } = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        top: currentCoords.bottom ?? currentCoords.top,
        bottom: undefined,
        left: currentCoords.left,
        maxHeight: MAX_POPUP_HEIGHT,
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Clamp horizontal position strictly within viewport
    let clampedLeft = currentCoords.left;
    if (clampedLeft + POPUP_WIDTH > viewportWidth - MARGIN) {
      clampedLeft = Math.max(MARGIN, viewportWidth - POPUP_WIDTH - MARGIN);
    }
    if (clampedLeft < MARGIN) {
      clampedLeft = MARGIN;
    }

    const anchorBottom = currentCoords.bottom ?? (currentCoords.top + 20);
    const anchorTop = currentCoords.elementTop ?? currentCoords.top;

    const spaceBelow = viewportHeight - anchorBottom - MARGIN;
    const spaceAbove = anchorTop - MARGIN;

    // Stable vertical decision: flip above only if space below is insufficient AND above has more room
    const shouldFlipAbove = spaceBelow < MAX_POPUP_HEIGHT && spaceAbove > spaceBelow;

    if (shouldFlipAbove) {
      return {
        top: undefined,
        bottom: Math.max(MARGIN, viewportHeight - anchorTop + 4),
        left: clampedLeft,
        maxHeight: Math.min(MAX_POPUP_HEIGHT, Math.max(80, spaceAbove)),
      };
    } else {
      return {
        top: anchorBottom + 4,
        bottom: undefined,
        left: clampedLeft,
        maxHeight: Math.min(MAX_POPUP_HEIGHT, Math.max(80, spaceBelow)),
      };
    }
  }, [currentCoords]);

  // Reposition smoothly or close when parent scroll containers move
  useEffect(() => {
    const handleScrollOrResize = (e?: Event) => {
      // Don't reposition or dismiss when scrolling the suggestion list itself
      if (e && e.target && menuRef.current?.contains(e.target as Node)) {
        return;
      }

      if (getAnchorRect) {
        const newRect = getAnchorRect();
        if (newRect) {
          // If anchor has scrolled off-screen, close cleanly
          if (
            (newRect.bottom !== undefined && newRect.bottom < 0) ||
            (newRect.elementTop ?? newRect.top) > window.innerHeight
          ) {
            onClose();
          } else {
            setCurrentCoords(newRect);
          }
        }
      } else if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) {
          onClose();
        } else {
          setCurrentCoords({
            top: rect.top,
            bottom: rect.bottom + 4,
            elementTop: rect.top,
            left: Math.max(MARGIN, rect.left),
          });
        }
      }
    };

    window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [getAnchorRect, anchorEl, onClose]);

  // Auto-scroll selected item into view strictly inside listRef, NEVER touching parent scroll
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>('[data-selected="true"]');
    if (activeEl) {
      const container = listRef.current;
      const itemTop = activeEl.offsetTop;
      const itemHeight = activeEl.offsetHeight;
      const itemBottom = itemTop + itemHeight;

      if (itemTop < container.scrollTop) {
        container.scrollTop = itemTop;
      } else if (itemBottom > container.scrollTop + container.clientHeight) {
        container.scrollTop = itemBottom - container.clientHeight;
      }
    }
  }, [selectedIndex]);

  // Close when clicking outside
  useEffect(() => {
    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDownOutside, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside, true);
    };
  }, [onClose]);

  // Escape key handler on window
  useEffect(() => {
    const handleDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleDocKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleDocKeyDown, true);
    };
  }, [onClose]);

  // Highlight matching characters in label/path
  const renderHighlighted = (text: string, highlight: string) => {
    if (!highlight || !text) return text;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return text;

    return (
      <>
        {text.slice(0, idx)}
        <span className="text-[#FF7306] font-semibold underline underline-offset-2">
          {text.slice(idx, idx + highlight.length)}
        </span>
        {text.slice(idx + highlight.length)}
      </>
    );
  };

  if (typeof document === 'undefined') return null;

  const content = (
    <div
      ref={menuRef}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        top: top !== undefined ? `${top}px` : undefined,
        bottom: bottom !== undefined ? `${bottom}px` : undefined,
        left: `${left}px`,
        width: `${POPUP_WIDTH}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 99999,
      }}
      className="vulp-autocomplete-menu flex flex-col rounded-12 bg-surface-elevated border border-border shadow-panel overflow-hidden text-xs font-sans text-text-primary select-none animate-in fade-in-0 duration-75"
    >
      <div
        ref={listRef}
        className="overflow-y-auto flex-1 p-1 space-y-0.5 max-h-[220px]"
      >
        {filteredVariables.length > 0 ? (
          filteredVariables.map((variable, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={variable.id}
                type="button"
                data-var-path={variable.path}
                data-selected={isSelected}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => onSelectIndex(idx)}
                onClick={() => onConfirm(variable)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#FF7306]/15 text-text-primary dark:text-white font-medium border-l-2 border-[#FF7306] pl-2'
                    : 'text-text-primary hover:bg-surface-hover border-l-2 border-transparent pl-2'
                }`}
              >
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="text-xs truncate">
                    {renderHighlighted(variable.label, cleanQuery)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {showSourceContext && (
                    <span
                      className="text-[10px] text-text-muted/70 truncate max-w-[75px]"
                      title={variable.stepName}
                    >
                      {variable.stepName}
                    </span>
                  )}
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded text-text-muted bg-surface-hover/80 border border-border/50">
                    {formatCompactType(variable.type)}
                  </span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="py-2.5 px-3 text-center">
            <p className="text-xs text-text-muted select-none">No matching variables</p>
            {cleanQuery && onSelectCustomPath && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelectCustomPath(`{{ ${defaultNodeKey}.${cleanQuery} }}`)}
                className="mt-1.5 w-full text-left px-2 py-1.5 rounded-lg text-xs text-text-muted hover:bg-surface-hover hover:text-text-primary flex items-center justify-between gap-1.5 transition-colors cursor-pointer"
              >
                <span className="truncate">
                  Use <code className="font-mono text-[#FF7306] text-[11px]">{`{{ ${defaultNodeKey}.${cleanQuery} }}`}</code>
                </span>
                <CornerDownLeft className="w-3 h-3 text-text-muted shrink-0 opacity-70" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
