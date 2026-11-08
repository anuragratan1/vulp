import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Variable, AlertCircle } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';
import {
  discoverWorkflowVariables,
  DiscoveredVariable,
} from './dynamicVariableDiscovery.js';
import {
  VARIABLE_TOKEN_CLASS,
  createTokenHtml,
  serializeTokensToPlainText,
  deserializePlainTextToTokens,
  convertTextExpressionsToChips,
} from './tokenSerialization.js';
import { getVariableDisplayInfo } from './variableUtils.js';
import { VariableAutocompleteMenu } from './VariableAutocompleteMenu.js';
import { DynamicDataPicker } from './DynamicDataPicker.js';

export interface TokenizedMessageEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  optionalBadge?: boolean;
  description?: string;
  error?: string;
  rows?: number;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId?: string;
  className?: string;
}

export function TokenizedMessageEditor({
  label,
  value = '',
  onChange,
  placeholder = 'Type a message... (Type @ to mention variables)',
  required,
  optionalBadge,
  description,
  error,
  rows = 4,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId = '',
  className = '',
}: TokenizedMessageEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isFallbackPickerOpen, setIsFallbackPickerOpen] = useState(false);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Autocomplete menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; bottom?: number; elementTop?: number }>({
    top: 0,
    left: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Dynamic variable discovery
  const variableGroups = useMemo(() => {
    return discoverWorkflowVariables({
      currentNodeId,
      allNodes,
      edges,
      nodeRuns,
      includeSystem: true,
    });
  }, [currentNodeId, allNodes, edges, nodeRuns]);

  // Default node key for custom fallback expressions
  const defaultNodeKey = useMemo(() => {
    const trigger = allNodes.find((n) => n.data.category === 'trigger');
    return trigger?.data.key || trigger?.id || 'trigger';
  }, [allNodes]);

  // Sync incoming value to editor DOM
  useEffect(() => {
    if (!editorRef.current) return;
    const currentRaw = serializeTokensToPlainText(editorRef.current);
    if (currentRaw !== value) {
      editorRef.current.innerHTML = deserializePlainTextToTokens(value, allNodes);
    }
  }, [value, allNodes]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      setSavedRange(sel.getRangeAt(0));
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (sel && savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  };

  // Emit serialized text to onChange
  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const serialized = serializeTokensToPlainText(editorRef.current);
    onChange(serialized);
  }, [onChange]);

  // Insert a variable token at current range/caret
  const insertToken = useCallback(
    (rawExpr: string, fieldLabel: string, stepName?: string) => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      const range = sel.getRangeAt(0);

      // If autocomplete was active, delete the typed @query before inserting token
      let targetNode = sel.anchorNode;
      let offset = sel.anchorOffset;

      if (targetNode && targetNode.nodeType !== Node.TEXT_NODE && targetNode.firstChild) {
        targetNode = targetNode.firstChild;
        offset = targetNode.textContent?.length || 0;
      }

      if (isMenuOpen && targetNode && targetNode.nodeType === Node.TEXT_NODE) {
        const text = targetNode.textContent || '';
        const atIdx = text.lastIndexOf('@', Math.max(0, offset - 1));
        if (atIdx !== -1) {
          range.setStart(targetNode, atIdx);
          range.setEnd(targetNode, offset);
          range.deleteContents();
        }
      }

      // Create chip node
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = createTokenHtml(rawExpr, fieldLabel, stepName);
      const chipNode = tempDiv.firstChild!;
      const spaceNode = tempDiv.lastChild!;

      range.insertNode(spaceNode);
      range.insertNode(chipNode);

      // Move caret directly after trailing space
      range.setStartAfter(spaceNode);
      range.setEndAfter(spaceNode);
      sel.removeAllRanges();
      sel.addRange(range);

      setIsMenuOpen(false);
      setAutocompleteQuery('');
      emitChange();
    },
    [isMenuOpen, emitChange]
  );

  // Check for @ trigger near caret and measure coordinates
  const checkAutocompleteTrigger = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.anchorNode) {
      setIsMenuOpen(false);
      return;
    }

    let targetNode = sel.anchorNode;
    let offset = sel.anchorOffset;

    if (targetNode.nodeType === Node.ELEMENT_NODE) {
      const child = targetNode.childNodes[Math.max(0, offset - 1)] || targetNode.firstChild;
      if (child && child.nodeType === Node.TEXT_NODE) {
        targetNode = child;
        offset = child.textContent?.length || 0;
      }
    }

    if (targetNode.nodeType !== Node.TEXT_NODE) {
      setIsMenuOpen(false);
      return;
    }

    const text = targetNode.textContent || '';
    const textBeforeCaret = text.slice(0, offset);

    // Find the latest '@' symbol
    const atIndex = textBeforeCaret.lastIndexOf('@');

    if (atIndex === -1) {
      setIsMenuOpen(false);
      return;
    }

    // Only trigger if preceded by start of line or whitespace
    const charBeforeAt = atIndex > 0 ? textBeforeCaret.charAt(atIndex - 1) : ' ';
    if (!/[\s\(\[\{]/.test(charBeforeAt) && atIndex !== 0) {
      setIsMenuOpen(false);
      return;
    }

    const query = textBeforeCaret.slice(atIndex + 1);

    // If query contains spaces or line breaks, dismiss autocomplete
    if (/[\s\n\r]/.test(query)) {
      setIsMenuOpen(false);
      return;
    }

    // Measure caret coordinates
    try {
      const range = sel.getRangeAt(0).cloneRange();
      range.setStart(sel.anchorNode, atIndex);
      range.setEnd(sel.anchorNode, offset);
      let rect = range.getBoundingClientRect();

      const editorRect = editorRef.current?.getBoundingClientRect();

      // If caret rect is empty or zero, fall back to editor rect
      if (!rect || (rect.top === 0 && rect.bottom === 0 && rect.left === 0)) {
        if (editorRect) {
          rect = new DOMRect(editorRect.left + 16, editorRect.top + 28, 0, 18);
        }
      }

      setMenuCoords({
        top: rect.top,
        bottom: rect.bottom + 4,
        elementTop: editorRect?.top ?? rect.top,
        left: Math.max(12, rect.left),
      });
      setAutocompleteQuery(query);
      setIsMenuOpen(true);
      setSelectedIndex(0);
    } catch {
      setIsMenuOpen(false);
    }
  }, []);

  // Anchor rect getter for smooth scroll tracking
  const getAnchorRect = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && sel.anchorNode) {
      try {
        const range = sel.getRangeAt(0).cloneRange();
        const text = sel.anchorNode.textContent || '';
        const offset = sel.anchorOffset;
        const atIdx = text.lastIndexOf('@', Math.max(0, offset - 1));
        if (atIdx !== -1) {
          range.setStart(sel.anchorNode, atIdx);
          range.setEnd(sel.anchorNode, offset);
          const r = range.getBoundingClientRect();
          if (r && (r.top !== 0 || r.bottom !== 0)) {
            return {
              top: r.top,
              bottom: r.bottom + 4,
              elementTop: editorRef.current?.getBoundingClientRect().top ?? r.top,
              left: Math.max(12, r.left),
            };
          }
        }
      } catch {
        // Fall back to editor element rect
      }
    }
    if (editorRef.current) {
      const r = editorRef.current.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom + 4,
        elementTop: r.top,
        left: Math.max(12, r.left),
      };
    }
    return null;
  }, []);

  // Filter variables for keyboard navigation
  const matchingVariables = useMemo(() => {
    const q = autocompleteQuery.trim().toLowerCase();
    const list: DiscoveredVariable[] = [];
    for (const group of variableGroups) {
      for (const v of group.variables) {
        if (
          !q ||
          v.label.toLowerCase().includes(q) ||
          v.path.toLowerCase().includes(q) ||
          v.nodeKey.toLowerCase().includes(q) ||
          v.stepName.toLowerCase().includes(q)
        ) {
          list.push(v);
        }
      }
    }
    return list;
  }, [variableGroups, autocompleteQuery]);

  // Keydown handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isMenuOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMenuOpen(false);
        return;
      }
      if (matchingVariables.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % matchingVariables.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + matchingVariables.length) % matchingVariables.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const chosen = matchingVariables[selectedIndex];
          if (chosen) {
            insertToken(chosen.rawExpression, chosen.label, chosen.stepName);
          }
          return;
        }
      } else if (autocompleteQuery.trim()) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const customExpr = `{{ ${defaultNodeKey}.${autocompleteQuery.trim()} }}`;
          const info = getVariableDisplayInfo(customExpr, allNodes);
          insertToken(customExpr, info.label, info.stepName);
          return;
        }
      }
    }

    // Handle backspace when adjacent to variable chip
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed && sel.anchorNode) {
        if (sel.anchorNode.nodeType === Node.ELEMENT_NODE) {
          const el = sel.anchorNode as HTMLElement;
          const target = el.childNodes[sel.anchorOffset - 1] as HTMLElement;
          if (target && target.classList?.contains(VARIABLE_TOKEN_CLASS)) {
            target.remove();
            emitChange();
          }
        }
      }
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      convertTextExpressionsToChips(editorRef.current, allNodes);
    }
    emitChange();
    checkAutocompleteTrigger();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if (editorRef.current) {
      convertTextExpressionsToChips(editorRef.current, allNodes);
    }
    emitChange();
  };

  const minHeightPx = Math.max(80, rows * 22);

  return (
    <div className={`space-y-1.5 text-xs font-sans ${className}`}>
      {/* Header Bar */}
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

        {/* Optional Variable browser dropdown trigger */}
        <DropdownMenu.Root open={isFallbackPickerOpen} onOpenChange={setIsFallbackPickerOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              onMouseDown={saveSelection}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#FF7306] hover:text-[#FFA154] hover:bg-[#FF7306]/10 px-2 py-0.5 rounded-full transition-colors select-none cursor-pointer"
              title="Insert dynamic variable (or type @ in message)"
            >
              <Variable className="w-3 h-3 text-[#FF7306]" />
              <span>Variable</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content side="bottom" align="end" sideOffset={6} className="z-50">
              <DynamicDataPicker
                allNodes={allNodes}
                currentNodeId={currentNodeId}
                onSelect={(expr, field) => {
                  restoreSelection();
                  insertToken(expr, field.label, field.sourceNodeName);
                  setIsFallbackPickerOpen(false);
                }}
                onClose={() => setIsFallbackPickerOpen(false)}
              />
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Editor Surface */}
      <div
        className={`relative rounded-[18px] bg-[#171717] border transition-all ${
          error
            ? 'border-rose-500/80 focus-within:border-rose-500'
            : isFocused
            ? 'border-[#4A4A4A] ring-1 ring-white/10'
            : 'border-[#262626] hover:border-[#383838]'
        }`}
      >
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            // Small timeout to allow menu clicks before dismissing
            setTimeout(() => setIsMenuOpen(false), 200);
          }}
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onClick={checkAutocompleteTrigger}
          onKeyUp={checkAutocompleteTrigger}
          style={{ minHeight: `${minHeightPx}px` }}
          data-placeholder={placeholder}
          className="w-full p-3.5 text-xs text-white outline-none font-sans leading-relaxed break-words empty:before:content-[attr(data-placeholder)] empty:before:text-[#555555] empty:before:pointer-events-none select-text cursor-text"
        />
      </div>

      {/* Floating Autocomplete Menu */}
      {isMenuOpen && (
        <VariableAutocompleteMenu
          query={autocompleteQuery}
          groups={variableGroups}
          coords={menuCoords}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onConfirm={(variable) => {
            insertToken(variable.rawExpression, variable.label, variable.stepName);
          }}
          onClose={() => setIsMenuOpen(false)}
          defaultNodeKey={defaultNodeKey}
          onSelectCustomPath={(customExpr) => {
            insertToken(customExpr, customExpr);
          }}
          getAnchorRect={getAnchorRect}
        />
      )}

      {/* Validation or description message */}
      {error ? (
        <p className="text-[11px] text-rose-400 flex items-center gap-1 pt-0.5 animate-in fade-in-0 duration-150">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </p>
      ) : description ? (
        <p className="text-[11px] text-[#737373] leading-relaxed pt-0.5">{description}</p>
      ) : null}
    </div>
  );
}
