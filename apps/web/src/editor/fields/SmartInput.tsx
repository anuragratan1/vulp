import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Variable, Code2, AlertCircle } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { CanvasNode, CanvasEdge } from '../graphConverter.js';
import { NodeRunRecord } from '../../api/client.js';
import { DynamicDataPicker } from './DynamicDataPicker.js';
import { getVariableDisplayInfo } from './variableUtils.js';
import {
  VARIABLE_TOKEN_CLASS,
  createTokenHtml,
  serializeTokensToPlainText,
  deserializePlainTextToTokens,
  convertTextExpressionsToChips,
} from './tokenSerialization.js';
import {
  discoverWorkflowVariables,
  DiscoveredVariable,
} from './dynamicVariableDiscovery.js';
import { VariableAutocompleteMenu } from './VariableAutocompleteMenu.js';

export interface SmartInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'url' | 'password';
  description?: string;
  error?: string;
  allNodes?: CanvasNode[];
  edges?: CanvasEdge[];
  nodeRuns?: NodeRunRecord[];
  currentNodeId?: string;
  allowVariables?: boolean;
  className?: string;
}

export function SmartInput({
  label,
  value = '',
  onChange,
  placeholder,
  required,
  type = 'text',
  description,
  error: customError,
  allNodes = [],
  edges = [],
  nodeRuns = [],
  currentNodeId = '',
  allowVariables = true,
  className = '',
}: SmartInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Autocomplete state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; bottom?: number; elementTop?: number }>({
    top: 0,
    left: 0,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const strVal = String(value || '');
  const hasVariablesAllowed = allowVariables && type !== 'password';

  // Dynamic variable discovery
  const variableGroups = useMemo(() => {
    if (!hasVariablesAllowed) return [];
    return discoverWorkflowVariables({
      currentNodeId,
      allNodes,
      edges,
      nodeRuns,
      includeSystem: true,
    });
  }, [hasVariablesAllowed, currentNodeId, allNodes, edges, nodeRuns]);

  const defaultNodeKey = useMemo(() => {
    const trigger = allNodes.find((n) => n.data.category === 'trigger');
    return trigger?.data.key || trigger?.id || 'trigger';
  }, [allNodes]);

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

  // Sync value from props to contenteditable DOM
  useEffect(() => {
    if (isAdvancedMode || !hasVariablesAllowed) return;
    if (!editableRef.current) return;
    const currentRaw = serializeTokensToPlainText(editableRef.current);
    if (currentRaw !== strVal) {
      editableRef.current.innerHTML = deserializePlainTextToTokens(strVal, allNodes);
    }
  }, [strVal, allNodes, isAdvancedMode, hasVariablesAllowed]);

  // Email validation check (expressions count as valid email segments)
  let validationError = customError;
  if (!validationError && type === 'email' && strVal.trim()) {
    const withoutExpressions = strVal.replace(/\{\{\s*[^{}]+\s*\}\}/g, 'valid@example.com');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = withoutExpressions.split(/[,;]/).map((e) => e.trim()).filter(Boolean);
    const invalid = emails.some((e) => !emailRegex.test(e));
    if (invalid) {
      validationError = 'Please enter a valid email address (e.g. user@company.com)';
    }
  }

  // Emit serialized text to onChange
  const emitChange = useCallback(() => {
    if (!editableRef.current) return;
    const serialized = serializeTokensToPlainText(editableRef.current);
    onChange(serialized);
  }, [onChange]);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editableRef.current?.contains(range.commonAncestorContainer)) {
        setSavedRange(range);
      }
    }
  };

  const checkAutocompleteTrigger = useCallback(() => {
    if (!hasVariablesAllowed) return;

    if (isAdvancedMode) {
      const input = inputRef.current;
      if (!input) return;
      const cursor = input.selectionStart ?? 0;
      const val = input.value;
      const textBefore = val.slice(0, cursor);
      const atIndex = textBefore.lastIndexOf('@');

      if (atIndex === -1) {
        setIsMenuOpen(false);
        return;
      }

      const charBefore = atIndex > 0 ? textBefore.charAt(atIndex - 1) : ' ';
      if (!/[\s\(\[\{\,\;]/.test(charBefore) && atIndex !== 0) {
        setIsMenuOpen(false);
        return;
      }

      const query = textBefore.slice(atIndex + 1);
      if (/[\s\n\r]/.test(query)) {
        setIsMenuOpen(false);
        return;
      }

      const rect = input.getBoundingClientRect();
      setMenuCoords({
        top: rect.top,
        bottom: rect.bottom + 4,
        elementTop: rect.top,
        left: Math.max(12, rect.left),
      });
      setAutocompleteQuery(query);
      setIsMenuOpen(true);
      setSelectedIndex(0);
      return;
    }

    // Normal mode (contenteditable)
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
    const atIndex = textBeforeCaret.lastIndexOf('@');

    if (atIndex === -1) {
      setIsMenuOpen(false);
      return;
    }

    const charBeforeAt = atIndex > 0 ? textBeforeCaret.charAt(atIndex - 1) : ' ';
    if (!/[\s\(\[\{]/.test(charBeforeAt) && atIndex !== 0) {
      setIsMenuOpen(false);
      return;
    }

    const query = textBeforeCaret.slice(atIndex + 1);
    if (/[\s\n\r]/.test(query)) {
      setIsMenuOpen(false);
      return;
    }

    try {
      const range = sel.getRangeAt(0).cloneRange();
      range.setStart(sel.anchorNode, atIndex);
      range.setEnd(sel.anchorNode, offset);
      let rect = range.getBoundingClientRect();
      const editorRect = editableRef.current?.getBoundingClientRect();

      if (!rect || (rect.top === 0 && rect.bottom === 0 && rect.left === 0)) {
        if (editorRect) {
          rect = new DOMRect(editorRect.left + 8, editorRect.top + 20, 0, 18);
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
  }, [hasVariablesAllowed, isAdvancedMode]);

  const getAnchorRect = useCallback(() => {
    if (isAdvancedMode && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom + 4,
        elementTop: rect.top,
        left: Math.max(12, rect.left),
      };
    }
    if (editableRef.current) {
      const r = editableRef.current.getBoundingClientRect();
      return {
        top: r.top,
        bottom: r.bottom + 4,
        elementTop: r.top,
        left: Math.max(12, r.left),
      };
    }
    return null;
  }, [isAdvancedMode]);

  const insertToken = useCallback(
    (rawExpr: string, fieldLabel: string, stepName?: string) => {
      if (isAdvancedMode) {
        const input = inputRef.current;
        if (!input) {
          onChange(strVal ? `${strVal} ${rawExpr}` : rawExpr);
          return;
        }

        const cursor = input.selectionStart ?? input.value.length;
        const val = input.value;
        const textBefore = val.slice(0, cursor);
        const atIndex = textBefore.lastIndexOf('@');

        let newVal = '';
        let newCursor = 0;

        if (atIndex !== -1) {
          const before = val.slice(0, atIndex);
          const after = val.slice(cursor);
          newVal = `${before}${rawExpr}${after ? (after.startsWith(' ') ? after : ` ${after}`) : ' '}`;
          newCursor = (before + rawExpr + ' ').length;
        } else {
          newVal = `${val} ${rawExpr} `;
          newCursor = newVal.length;
        }

        setIsMenuOpen(false);
        setAutocompleteQuery('');
        onChange(newVal);

        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newCursor, newCursor);
          }
        }, 10);
        return;
      }

      if (!editableRef.current) return;
      editableRef.current.focus();

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !editableRef.current.contains(sel.anchorNode)) {
        // Append to the end of editable container
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = createTokenHtml(rawExpr, fieldLabel, stepName);
        while (tempDiv.firstChild) {
          editableRef.current.appendChild(tempDiv.firstChild);
        }
        setIsMenuOpen(false);
        setAutocompleteQuery('');
        emitChange();
        return;
      }

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

      // Create chip node and trailing space
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
    [isAdvancedMode, isMenuOpen, strVal, onChange, emitChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
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

    // Enter key: prevent multiline in single line SmartInput
    if (e.key === 'Enter') {
      e.preventDefault();
      return;
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
    if (editableRef.current) {
      convertTextExpressionsToChips(editableRef.current, allNodes);
    }
    emitChange();
    checkAutocompleteTrigger();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/[\r\n]+/g, ' ');
    document.execCommand('insertText', false, text);
    if (editableRef.current) {
      convertTextExpressionsToChips(editableRef.current, allNodes);
    }
    emitChange();
  };

  const handleInsertVariableFromPicker = (expr: string) => {
    const info = getVariableDisplayInfo(expr, allNodes);
    if (!isAdvancedMode && editableRef.current && savedRange) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }
    insertToken(expr, info.label, info.stepName);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current && !isAdvancedMode && editableRef.current) {
      editableRef.current.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.selectAllChildren(editableRef.current);
        sel.collapseToEnd();
      }
    }
  };

  return (
    <div className={`space-y-1.5 text-xs font-sans ${className}`}>
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#A3A3A3] flex items-center gap-1.5 select-none">
          <span>{label}</span>
          {required && (
            <span className="text-rose-400 font-bold" title="Required field">
              *
            </span>
          )}
        </label>

        {hasVariablesAllowed && (
          <div className="flex items-center gap-1.5">
            {/* Advanced / Code Mode Toggle */}
            <button
              type="button"
              onClick={() => setIsAdvancedMode(!isAdvancedMode)}
              className={`p-1 rounded-md text-[10px] flex items-center gap-1 transition-colors ${
                isAdvancedMode
                  ? 'text-[#FF7306] bg-[#FF7306]/10 font-medium'
                  : 'text-[#666666] hover:text-[#999999]'
              }`}
              title={isAdvancedMode ? 'Switch to readable variable view' : 'Inspect or edit raw expression syntax'}
            >
              <Code2 className="w-3 h-3" />
              <span>{isAdvancedMode ? 'Normal' : 'Code'}</span>
            </button>

            {/* Variable Picker Trigger */}
            <DropdownMenu.Root open={isPickerOpen} onOpenChange={setIsPickerOpen}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  onMouseDown={saveSelection}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#A0A0A0] hover:text-[#FF7306] hover:bg-[#202020] px-2 py-0.5 rounded-full transition-colors select-none group cursor-pointer"
                  title="Insert dynamic data from workflow steps (or type @)"
                >
                  <Variable className="w-3 h-3 text-[#FF7306] group-hover:scale-110 transition-transform" />
                  <span>Variable</span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content side="bottom" align="end" sideOffset={6} className="z-50">
                  <DynamicDataPicker
                    allNodes={allNodes}
                    edges={edges}
                    nodeRuns={nodeRuns}
                    currentNodeId={currentNodeId}
                    onSelect={(expr) => {
                      handleInsertVariableFromPicker(expr);
                      setIsPickerOpen(false);
                    }}
                    onClose={() => setIsPickerOpen(false)}
                  />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        )}
      </div>

      {/* Input container */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative flex items-center min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#171717] border transition-all ${
          validationError
            ? 'border-rose-500/80 focus-within:border-rose-500'
            : 'border-[#262626] focus-within:border-[#444444]'
        }`}
      >
        {!hasVariablesAllowed ? (
          <input
            ref={inputRef}
            type={type}
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-white text-xs outline-none placeholder:text-[#555555]"
          />
        ) : isAdvancedMode ? (
          <input
            ref={inputRef}
            type="text"
            value={strVal}
            onChange={(e) => {
              onChange(e.target.value);
              setTimeout(checkAutocompleteTrigger, 0);
            }}
            onKeyDown={handleKeyDown}
            onClick={checkAutocompleteTrigger}
            onKeyUp={checkAutocompleteTrigger}
            onBlur={() => {
              setTimeout(() => setIsMenuOpen(false), 200);
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-white text-xs font-mono outline-none placeholder:text-[#555555]"
          />
        ) : (
          <>
            {/* Visual placeholder overlay for contenteditable */}
            {!strVal && !isFocused && placeholder && (
              <div className="absolute left-3.5 inset-y-0 flex items-center text-xs text-[#555555] pointer-events-none select-none">
                {placeholder}
              </div>
            )}
            <div
              ref={editableRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              role="textbox"
              aria-multiline="false"
              spellCheck={false}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => {
                setIsFocused(true);
                checkAutocompleteTrigger();
              }}
              onBlur={() => {
                setIsFocused(false);
                setTimeout(() => setIsMenuOpen(false), 200);
              }}
              onClick={checkAutocompleteTrigger}
              onKeyUp={checkAutocompleteTrigger}
              className="w-full bg-transparent text-white text-xs outline-none whitespace-nowrap overflow-x-auto min-h-[20px] py-0.5 leading-normal select-text"
            />
          </>
        )}
      </div>

      {/* Floating Inline Autocomplete Menu */}
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
            const info = getVariableDisplayInfo(customExpr, allNodes);
            insertToken(customExpr, info.label, info.stepName);
          }}
          getAnchorRect={getAnchorRect}
        />
      )}

      {/* Validation or Helper Description */}
      {validationError ? (
        <p className="text-[11px] text-rose-400 flex items-center gap-1 pt-0.5 animate-in fade-in-0 duration-150">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{validationError}</span>
        </p>
      ) : description ? (
        <p className="text-[11px] text-[#737373] leading-relaxed pt-0.5">{description}</p>
      ) : null}
    </div>
  );
}